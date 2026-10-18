package br.com.vetorurbano.api.territories;

import static org.junit.jupiter.api.Assertions.*;

import java.time.LocalDate;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
class TerritorialVersionRepositoryIT {
    @Container
    static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>(DockerImageName
            .parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    static final UUID AUTHOR=UUID.randomUUID();
    static TerritorialVersionRepository repository;
    static JdbcTemplate jdbc;
    static final String POLYGON = "SRID=4326;POLYGON((-43 -23,-42 -23,-42 -22,-43 -22,-43 -23))";

    @BeforeAll
    static void prepare() {
        var source = new DriverManagerDataSource(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
        Flyway.configure().dataSource(source).load().migrate();

        jdbc = new JdbcTemplate(source);
        jdbc.update("INSERT INTO local_accounts(id,display_name,email,password_hash,role,created_at,last_sent_at,resend_window_start) VALUES(?, 'Autor sintético', 'repo26@example.test','not-a-login-credential','ADMIN',now(),now(),now())", AUTHOR);
        repository = new TerritorialVersionRepository(jdbc);
    }

    private void append(UUID id, int expected, TerritorialVersion details) {
        repository.append(id, expected, details, AUTHOR, "Revisão sintética de repositório");
    }

    private TerritorialVersion draft(String geometry, LocalDate reference) {
        return new TerritorialVersion("Área sintética", null, null, "Documento sintético, seção A",
                reference, "Sem validação operacional", geometry);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {
        "SRID=4326;POINT(-43 -23)",
        "SRID=4326;LINESTRING(-43 -23,-42 -22)",
        "SRID=4326;GEOMETRYCOLLECTION(POLYGON((-43 -23,-42 -23,-42 -22,-43 -23)))",
        "SRID=3857;POLYGON((-43 -23,-42 -23,-42 -22,-43 -23))",
        "POLYGON((-43 -23,-42 -23,-42 -22,-43 -23))",
        "SRID=4326;POLYGON EMPTY",
        "SRID=4326;MULTIPOLYGON EMPTY",
        "SRID=4326;POLYGON((0 0,1 1,1 0,0 1,0 0))",
        "SRID=4326;POLYGON((181 0,182 0,182 1,181 0))",
        "SRID=4326;POLYGON((0 91,1 91,1 92,0 91))",
        "SRID=4326;POLYGON Z((0 0 1,1 0 1,1 1 1,0 0 1))",
        "SRID=4326;POLYGON((0 0,1 0,1 1))",
        "not a geometry"
    })
    void rejectsInvalidBoundaryAtomically(String boundary) {
        UUID id = UUID.randomUUID();
        assertThrows(org.springframework.dao.DataAccessException.class,
                () -> append(id, 0, draft(boundary, null)));
        assertTrue(repository.history(id).isEmpty());
        append(id, 0, draft(POLYGON, null));
        assertEquals(1, repository.history(id).size());
    }

    @Test
    void acceptsMultiPolygonAndKeepsIndependentSourceEvidenceAndTemporalReference() {
        UUID id = UUID.randomUUID();
        String sourceId = jdbc.queryForObject("SELECT id FROM sources ORDER BY id LIMIT 1", String.class);
        var details = new TerritorialVersion("Outra área sintética", "Grupo indicado sintético", sourceId,
                "Documento B / página 4", LocalDate.of(2019, 3, 4), "Referência histórica, não atual",
                "SRID=4326;MULTIPOLYGON(((-43 -23,-42 -23,-42 -22,-43 -23)))");
        append(id, 0, details);
        var saved = repository.history(id).get(0).details();
        assertEquals(sourceId, saved.sourceId());
        assertEquals("Documento B / página 4", saved.evidenceReference());
        assertEquals(LocalDate.of(2019, 3, 4), saved.referenceDate());
        assertEquals("Referência histórica, não atual", saved.limitations());
        assertTrue(saved.boundaryEwkt().startsWith("SRID=4326;MULTIPOLYGON"));
    }

    @Test
    void changesGeometryAndDetailsWithoutRewritingBeforeSnapshotAndRollsBackInvalidSuccessor() {
        UUID id = UUID.randomUUID();
        append(id, 0, draft(POLYGON, null));
        var before = repository.history(id).get(0);
        assertThrows(org.springframework.dao.DataAccessException.class,
                () -> append(id, 1, draft("SRID=4326;POINT(0 0)", null)));
        assertEquals(java.util.List.of(before), repository.history(id));
        var after = new TerritorialVersion("Nome revisado sintético", null, null, null, null, null,
                "SRID=4326;POLYGON((0 0,1 0,1 1,0 0))");
        append(id, 1, after);
        var history = repository.history(id);
        assertEquals(before, history.get(0));
        assertEquals("Nome revisado sintético", history.get(1).details().name());
        assertNotEquals(before.details().boundaryEwkt(), history.get(1).details().boundaryEwkt());
        assertNull(history.get(1).details().evidenceReference());
    }

    @Test
    void staleAppendDoesNotOverwritePreviousDetailsOrConsumeVersion() {
        UUID id = UUID.randomUUID();
        append(id, 0, draft(POLYGON, null));
        assertThrows(org.springframework.dao.OptimisticLockingFailureException.class,
                () -> append(id, 0, draft(POLYGON, LocalDate.of(2020, 1, 1))));
        assertEquals(1, repository.history(id).size());
        assertNull(repository.history(id).get(0).details().referenceDate());
        append(id, 1, draft(POLYGON, LocalDate.of(2020, 1, 1)));
        assertEquals(2, repository.history(id).get(1).version());
    }

    @Test
    void concurrentAppendAllowsOnlyOneSuccessor() throws Exception {
        UUID id = UUID.randomUUID();
        append(id, 0, draft(POLYGON, null));
        var gate = new java.util.concurrent.CountDownLatch(1);
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<Boolean> append = () -> {
                gate.await();
                try {
                    append(id, 1, draft(POLYGON, LocalDate.of(2021, 1, 1)));
                    return true;
                } catch (org.springframework.dao.OptimisticLockingFailureException conflict) {
                    return false;
                }
            };
            var first = pool.submit(append);
            var second = pool.submit(append);
            gate.countDown();
            assertNotEquals(first.get(10, java.util.concurrent.TimeUnit.SECONDS),
                    second.get(10, java.util.concurrent.TimeUnit.SECONDS));
        }
        assertEquals(2, repository.history(id).size());
    }

    @Test
    void appendsVersionsWithStableIdentityAndPreservesUnknownWithoutUsingRegistrationDate() {
        UUID id = UUID.randomUUID();
        append(id, 0, draft(POLYGON, null));
        append(id, 1, draft(POLYGON, LocalDate.of(2020, 1, 2)));
        var history = repository.history(id);
        assertEquals(2, history.size());
        assertEquals(id, history.get(0).territoryId());
        assertEquals(id, history.get(1).territoryId());
        assertEquals(1, history.get(0).version());
        assertEquals(2, history.get(1).version());
        assertNull(history.get(0).details().referenceDate());
        assertNull(history.get(0).details().indicatedGroup());
        assertNull(history.get(0).details().sourceId());
        assertEquals("Documento sintético, seção A", history.get(0).details().evidenceReference());
        assertNotNull(history.get(0).recordedAt());
        assertEquals(LocalDate.of(2020, 1, 2), history.get(1).details().referenceDate());
        assertTrue(repository.history(UUID.randomUUID()).isEmpty());
    }
}
