package br.com.vetorurbano.api.occurrences;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
class DatabaseMigrationIT {
    private static final DockerImageName POSTGIS_IMAGE = DockerImageName
            .parse("postgis/postgis:17-3.5")
            .asCompatibleSubstituteFor("postgres");

    @Container
    private static final PostgreSQLContainer<?> POSTGIS = new PostgreSQLContainer<>(POSTGIS_IMAGE)
            .withDatabaseName("vetor_urbano_test")
            .withUsername("vetor_test")
            .withPassword("vetor_test");

    @Test
    void migrationCreatesPostgisSchemaAndKnownSyntheticRelations() throws Exception {
        Flyway.configure()
                .dataSource(POSTGIS.getJdbcUrl(), POSTGIS.getUsername(), POSTGIS.getPassword())
                .locations("classpath:db/migration")
                .load()
                .migrate();

        try (Connection connection = DriverManager.getConnection(
                    POSTGIS.getJdbcUrl(), POSTGIS.getUsername(), POSTGIS.getPassword());
                Statement statement = connection.createStatement()) {
            try (ResultSet result = statement.executeQuery(
                    "SELECT extversion FROM pg_extension WHERE extname = 'postgis'")) {
                assertTrue(result.next());
                assertNotNull(result.getString("extversion"));
            }

            assertEquals(4, count(statement, "SELECT count(*) FROM occurrences WHERE publication_status = 'PUBLISHED'"));
            assertEquals(1, count(statement, "SELECT count(*) FROM occurrences WHERE publication_status = 'PENDING'"));
            assertEquals(2, count(statement, "SELECT count(*) FROM happenings"));
            assertEquals(3, count(statement, "SELECT count(*) FROM occurrence_clippings"));
            assertEquals(1, count(statement, "SELECT count(DISTINCT occurrence_id) FROM occurrence_clippings"));

            try (ResultSet territory = statement.executeQuery(
                    "SELECT location FROM occurrences WHERE id = 'vu-demo-occurrence-territory-001'")) {
                assertTrue(territory.next());
                assertNull(territory.getObject("location"));
            }

            try (ResultSet boundary = statement.executeQuery("""
                    SELECT ST_Distance(
                        ST_SetSRID(ST_MakePoint(-43.1915, -22.9033), 4326)::geography,
                        location
                    ) AS meters
                    FROM occurrences
                    WHERE id = 'vu-demo-occurrence-contingency-002'
                    """)) {
                assertTrue(boundary.next());
                assertEquals(1000.0, boundary.getDouble("meters"), 0.001);
            }
        }
    }

    @Test
    void migrationIsIdempotentAndDoesNotDuplicateFactsOrClippingLinks() throws Exception {
        Flyway flyway = Flyway.configure()
                .dataSource(POSTGIS.getJdbcUrl(), POSTGIS.getUsername(), POSTGIS.getPassword())
                .locations("classpath:db/migration")
                .load();
        flyway.migrate();
        flyway.migrate();

        try (Connection connection = DriverManager.getConnection(
                    POSTGIS.getJdbcUrl(), POSTGIS.getUsername(), POSTGIS.getPassword());
                Statement statement = connection.createStatement()) {
            assertEquals(5, count(statement, "SELECT count(*) FROM occurrences"));
            assertEquals(3, count(statement, "SELECT count(*) FROM occurrence_clippings"));
        }
    }

    private static int count(Statement statement, String sql) throws Exception {
        try (ResultSet result = statement.executeQuery(sql)) {
            assertTrue(result.next());
            return result.getInt(1);
        }
    }
}
