package br.com.vetorurbano.api.occurrences;

import static org.junit.jupiter.api.Assertions.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.flywaydb.core.Flyway;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
class ActiveReportQueryIT {
    @Container
    static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>(DockerImageName
            .parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    private static final Instant NOW = Instant.parse("2026-10-17T12:00:00Z");
    private static final Coordinates CENTER = new Coordinates(-43.1915, -22.9033);

    @Test
    void syntheticRecentsAndInjectedValidityAreIndependentPerEffectAndGeodesic() {
        var ds = new DriverManagerDataSource(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
        Flyway.configure().dataSource(ds).load().migrate();
        var jdbc = new JdbcTemplate(ds);
        jdbc.update("DELETE FROM occurrence_clippings");
        jdbc.update("DELETE FROM publication_versions");
        jdbc.update("DELETE FROM occurrences");
        // All inputs below are synthetic test cases, NOT approved product validity periods.
        add(jdbc, "recent-closed", "CLOSED", "2026-10-17T11:00:00Z", 0, "PUBLISHED");
        add(jdbc, "old-valid", "ONGOING", "2026-10-10T12:00:00Z", 5000, "PUBLISHED");
        add(jdbc, "old-no-policy", "ONGOING", "2026-10-10T12:00:00Z", 100, "PUBLISHED");
        add(jdbc, "outside", "ONGOING", "2026-10-10T12:00:00Z", 5001, "PUBLISHED");
        add(jdbc, "draft", "ONGOING", "2026-10-17T11:00:00Z", 0, "PENDING");
        add(jdbc, "start-edge", "UNKNOWN", "2026-10-16T12:00:00Z", 100, "PUBLISHED");
        add(jdbc, "now-edge", "CLOSED", "2026-10-17T12:00:00Z", 100, "PUBLISHED");
        var repository = new OccurrenceQueryRepository(new NamedParameterJdbcTemplate(ds));
        var clock = Clock.fixed(NOW, ZoneOffset.UTC);
        var evaluated = new ArrayList<Instant>();
        var service = new ActiveReportQueryService(repository, clock, (effect, at) -> {
            evaluated.add(at);
            return Set.of("old-valid", "outside").contains(effect.id());
        });
        assertEquals(Set.of("recent-closed", "old-valid", "start-edge"), ids(service.find(CENTER, 5000)));
        assertFalse(evaluated.isEmpty());
        assertTrue(evaluated.stream().allMatch(NOW::equals));
        assertEquals(Set.of("recent-closed", "start-edge"), ids(
                new ActiveReportQueryService(repository, clock, (effect, at) -> false).find(CENTER, 5000)));
        assertEquals(Set.of("recent-closed", "start-edge"), ids(service.find(CENTER, 4999)));
        // Synthetic expiry supplied only by this test: no production confirmation semantics.
        var expiry = NOW.plusSeconds(60);
        ActiveReportQueryService.ValidityPolicy syntheticValidity = (effect, at) ->
                effect.id().equals("old-valid") && at.isBefore(expiry);
        assertTrue(ids(new ActiveReportQueryService(repository, clock, syntheticValidity)
                .find(CENTER, 5000)).contains("old-valid"));
        assertFalse(ids(new ActiveReportQueryService(repository, Clock.fixed(expiry, ZoneOffset.UTC), syntheticValidity)
                .find(CENTER, 5000)).contains("old-valid"));
        jdbc.update("UPDATE occurrences SET location=NULL, location_precision='TERRITORY' WHERE id='recent-closed'");
        assertFalse(ids(service.find(CENTER, 5000)).contains("recent-closed"));
        jdbc.update("UPDATE occurrences SET occurred_at=NULL, occurred_from='2026-10-16T11:00:00Z', occurred_until='2026-10-16T13:00:00Z' WHERE id='now-edge'");
        assertTrue(ids(service.find(CENTER, 5000)).contains("now-edge"));
        assertEquals(TemporalMatch.POSSIBLE, service.find(CENTER, 5000).stream()
                .filter(effect -> effect.id().equals("now-edge")).findFirst().orElseThrow().temporalMatch());
        assertEquals(TemporalMatch.OUTSIDE, service.find(CENTER, 5000).stream()
                .filter(effect -> effect.id().equals("old-valid")).findFirst().orElseThrow().temporalMatch());
        assertEquals("ONGOING", jdbc.queryForObject("SELECT situation FROM occurrences WHERE id='old-no-policy'", String.class));
        assertThrows(InvalidQueryException.class, () -> service.find(CENTER, 5001));
        assertThrows(InvalidQueryException.class, () -> service.find(CENTER, 0));
        assertThrows(InvalidQueryException.class, () -> service.find(null, 5000));
        assertThrows(IllegalArgumentException.class, () -> service.find(new Coordinates(Double.NaN, 0), 5000));
    }

    private static Set<String> ids(List<OccurrenceRecord> items) {
        return items.stream().map(OccurrenceRecord::id).collect(java.util.stream.Collectors.toSet());
    }

    private static void add(JdbcTemplate jdbc, String id, String state, String at, int distance, String status) {
        jdbc.update("""
                INSERT INTO occurrences (id,happening_id,title,description,category,occurrence_type,subtype,
                situation,reliability_score,municipality,neighborhood,location_precision,location,occurred_at,publication_status)
                VALUES (?, 'vu-demo-happening-001', 'Synthetic effect', 'Synthetic test only', 'TRANSITO', 'ACIDENTE',
                'COLISAO', ?, 3, 'Rio de Janeiro', 'Centro', 'POINT',
                ST_Project(ST_SetSRID(ST_MakePoint(-43.1915,-22.9033),4326)::geography, ?, 0), ?::timestamptz, ?)
                """, id, state, distance, at, status);
    }
}
