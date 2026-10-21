package br.com.vetorurbano.api.collection;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
class CollectionBackfillMigrationIT {
    private static final DockerImageName POSTGIS_IMAGE = DockerImageName
            .parse("postgis/postgis:17-3.5")
            .asCompatibleSubstituteFor("postgres");

    @Container
    private static final PostgreSQLContainer<?> POSTGIS = new PostgreSQLContainer<>(POSTGIS_IMAGE)
            .withDatabaseName("vetor_urbano_backfill_migration_test")
            .withUsername("vetor_backfill_test")
            .withPassword("vetor_backfill_test");

    @Test
    void upgradesLegacyBackfillUsageIntoTheCumulativeWindowBudget() throws Exception {
        Flyway throughV15 = Flyway.configure()
                .dataSource(POSTGIS.getJdbcUrl(), POSTGIS.getUsername(), POSTGIS.getPassword())
                .locations("classpath:db/migration")
                .target(MigrationVersion.fromVersion("15"))
                .load();
        throughV15.migrate();

        Timestamp earlier = Timestamp.from(Instant.now().minusSeconds(10));
        Timestamp later = Timestamp.from(Instant.now().minusSeconds(5));
        try (var connection = DriverManager.getConnection(
                POSTGIS.getJdbcUrl(), POSTGIS.getUsername(), POSTGIS.getPassword())) {
            try (PreparedStatement source = connection.prepareStatement("""
                    INSERT INTO collection_sources (source_id, window_start, window_end, poll_seconds, page_size,
                        max_pages, paused, created_at, updated_at)
                    VALUES ('vu-demo-source-001', '2026-06-01', NULL, 60, 100, 20, false, ?, ?)
                    """)) {
                source.setTimestamp(1, earlier);
                source.setTimestamp(2, earlier);
                source.executeUpdate();
            }
            insertLegacyRun(connection, "vu-legacy-backfill-success", 12, "SUCCEEDED_NO_CHANGES", null, earlier, earlier);
            UUID resumedAfterFailure = insertLegacyRun(connection, "vu-legacy-backfill-resumed", 7,
                    "SUCCEEDED_NO_CHANGES", null, earlier, later);
            insertLegacyEvent(connection, resumedAfterFailure, earlier, "RUN_PARTIAL");
            UUID stillPartial = insertLegacyRun(connection, "vu-legacy-backfill-partial", 2,
                    "PARTIAL", "UPSTREAM_UNAVAILABLE", earlier, later);
            insertLegacyEvent(connection, stillPartial, later, "RUN_PARTIAL");
        }

        Flyway throughV17 = Flyway.configure()
                .dataSource(POSTGIS.getJdbcUrl(), POSTGIS.getUsername(), POSTGIS.getPassword())
                .locations("classpath:db/migration")
                .target(MigrationVersion.fromVersion("17"))
                .load();
        throughV17.migrate();

        Timestamp afterV17 = Timestamp.from(Instant.now().plusSeconds(10));
        try (var connection = DriverManager.getConnection(
                POSTGIS.getJdbcUrl(), POSTGIS.getUsername(), POSTGIS.getPassword())) {
            try (var statement = connection.createStatement();
                    ResultSet window = statement.executeQuery("""
                            SELECT pages_requested FROM collection_backfill_windows
                            WHERE source_id='vu-demo-source-001' AND window_start='2026-06-01' AND window_end='2026-06-10'
                            """)) {
                assertTrue(window.next());
                assertEquals(22, window.getInt("pages_requested"), "V17 reconciles the final state and one failure");
            }
            UUID postV17Failure = insertLegacyRun(connection, "vu-post-v17-backfill-partial", 0,
                    "PARTIAL", "UPSTREAM_UNAVAILABLE", afterV17, afterV17);
            insertLegacyEvent(connection, postV17Failure, afterV17, "RUN_PARTIAL");
            try (var statement = connection.prepareStatement("""
                    UPDATE collection_backfill_windows SET pages_requested = pages_requested + 1
                    WHERE source_id='vu-demo-source-001' AND window_start='2026-06-01' AND window_end='2026-06-10'
                    """)) {
                assertEquals(1, statement.executeUpdate(), "the post-V17 request reserves its page before failing");
            }
        }

        Flyway latest = Flyway.configure()
                .dataSource(POSTGIS.getJdbcUrl(), POSTGIS.getUsername(), POSTGIS.getPassword())
                .locations("classpath:db/migration")
                .load();
        latest.migrate();

        try (var connection = DriverManager.getConnection(
                POSTGIS.getJdbcUrl(), POSTGIS.getUsername(), POSTGIS.getPassword());
                var statement = connection.createStatement();
                ResultSet window = statement.executeQuery("""
                        SELECT pages_requested FROM collection_backfill_windows
                        WHERE source_id='vu-demo-source-001' AND window_start='2026-06-01' AND window_end='2026-06-10'
                        """)) {
            assertTrue(window.next(), "V17 must seed the exact legacy backfill window");
            assertEquals(24, window.getInt("pages_requested"),
                    "pre-V17 failures consume budget while the post-V17 reservation is not counted twice");
        }

        try (var connection = DriverManager.getConnection(
                POSTGIS.getJdbcUrl(), POSTGIS.getUsername(), POSTGIS.getPassword());
                var statement = connection.createStatement();
                ResultSet pacing = statement.executeQuery("""
                        SELECT last_backfill_request_at FROM collection_sources WHERE source_id='vu-demo-source-001'
                        """)) {
            assertTrue(pacing.next());
            assertNotNull(pacing.getTimestamp("last_backfill_request_at"),
                    "the migration must preserve a conservative pacing timestamp for legacy work");
        }
    }

    private static UUID insertLegacyRun(java.sql.Connection connection, String id, int pagesDone, String state,
            String errorClass, Timestamp startedAt, Timestamp updatedAt) throws Exception {
        UUID runId = UUID.nameUUIDFromBytes(id.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        try (PreparedStatement run = connection.prepareStatement("""
                INSERT INTO collection_runs (id, source_id, kind, window_start, window_end, next_page, take,
                    max_pages, pages_done, state, error_class, started_at, updated_at)
                VALUES (?::uuid, 'vu-demo-source-001', 'BACKFILL', '2026-06-01', '2026-06-10', ?, 100, 20,
                    ?, ?, ?, ?, ?)
                """)) {
            run.setString(1, runId.toString());
            run.setInt(2, pagesDone + 1);
            run.setInt(3, pagesDone);
            run.setString(4, state);
            run.setString(5, errorClass);
            run.setTimestamp(6, startedAt);
            run.setTimestamp(7, updatedAt);
            run.executeUpdate();
        }
        return runId;
    }

    private static void insertLegacyEvent(java.sql.Connection connection, UUID runId, Timestamp occurredAt,
            String event) throws Exception {
        try (PreparedStatement row = connection.prepareStatement("""
                INSERT INTO collection_run_events (run_id, source_id, occurred_at, event, detail)
                VALUES (?::uuid, 'vu-demo-source-001', ?, ?, '{}'::jsonb)
                """)) {
            row.setString(1, runId.toString());
            row.setTimestamp(2, occurredAt);
            row.setString(3, event);
            row.executeUpdate();
        }
    }
}
