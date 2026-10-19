package br.com.vetorurbano.api.auth;

import static org.junit.jupiter.api.Assertions.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
class PdfExportHttpIT extends LocalAuthHttpSupport {
    @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>(DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    static final MutableClock CLOCK = new MutableClock();
    @TestConfiguration static class TimeConfig { @Bean @Primary Clock clock() { return CLOCK; } }
    @Override PostgreSQLContainer<?> database() { return DB; }
    @Override MutableClock clock() { return CLOCK; }
    @Override Class<?> timeConfiguration() { return TimeConfig.class; }
    static final String EXPORT = "reports/exports/pdf?periodStart=2026-10-14T15:00:00Z&periodEnd=2026-10-15T15:00:00Z&text=NAO_GUARDAR&longitude=-43.19&latitude=-22.9&radiusMeters=1000";
    static Map<String, Object> counts() {
        return Map.of("occurrences", 4, "happenings", 2, "mappedOccurrences", 3, "listOnlyOccurrences", 1, "temporallyCertain", 3, "temporallyPossible", 1);
    }
    static Map<String, Object> completed() {
        return Map.of("generatedAt", "2026-10-15T17:00:00Z", "outcome", "SUCCEEDED", "counts", counts(),
                "snapshotOccurrenceIds", List.of("vu-demo-occurrence-traffic-001", "vu-demo-occurrence-contingency-001",
                        "vu-demo-occurrence-contingency-002", "vu-demo-occurrence-territory-001"));
    }
    static Map<String, Object> failed() {
        return Map.of("generatedAt", "2026-10-15T17:00:00Z", "outcome", "FAILED", "counts", counts());
    }
    @Test void successfulExportRequiresSnapshotIdsAndRejectsWithdrawnRelatedContent() throws Exception {
        try (var app = start()) {
            register(app, "pdf35@example.test", true);
            accept(login(app, "pdf35@example.test"));
            var missingIds = new HashMap<String, Object>(completed());
            missingIds.remove("snapshotOccurrenceIds");
            assertEquals(400, request(app, "POST", EXPORT, missingIds).statusCode());
            var body = new HashMap<String, Object>(completed());
            body.put("snapshotOccurrenceIds", List.of());
            assertEquals(400, request(app, "POST", EXPORT, body).statusCode());
            body.put("snapshotOccurrenceIds", List.of("vu-demo-occurrence-traffic-001"));
            assertEquals(400, request(app, "POST", EXPORT, body).statusCode());
            var ids = List.of("vu-demo-occurrence-traffic-001", "vu-demo-occurrence-contingency-001",
                    "vu-demo-occurrence-contingency-002", "vu-demo-occurrence-territory-001");
            body.put("snapshotOccurrenceIds", ids);
            var missing = new ArrayList<>(ids);
            missing.set(1, "vu-missing-35");
            body.put("snapshotOccurrenceIds", missing);
            assertEquals(409, request(app, "POST", EXPORT, body).statusCode());
            missing.set(1, "vu-demo-occurrence-pending-control");
            assertEquals(409, request(app, "POST", EXPORT, body).statusCode());
            body.put("snapshotOccurrenceIds", ids);
            body.put("counts", Map.of("occurrences", 1, "happenings", 1, "mappedOccurrences", 1,
                    "listOnlyOccurrences", 0, "temporallyCertain", 1, "temporallyPossible", 0));
            var jdbc = app.getBean(JdbcTemplate.class);
            // An uncommitted withdrawal owns the same row lock needed by the export authorization.
            try (var connection = app.getBean(javax.sql.DataSource.class).getConnection()) {
                connection.setAutoCommit(false);
                try (var statement = connection.prepareStatement("UPDATE occurrences SET publication_status='WITHDRAWN' WHERE id=?")) {
                    statement.setString(1, ids.get(1));
                    statement.executeUpdate();
                }
                var export = java.util.concurrent.CompletableFuture.supplyAsync(() -> {
                    try { return request(app, "POST", EXPORT, body); }
                    catch (Exception exception) { throw new RuntimeException(exception); }
                });
                boolean waiting = false;
                long deadline = System.nanoTime() + java.time.Duration.ofSeconds(5).toNanos();
                while (!waiting && System.nanoTime() < deadline) {
                    waiting = jdbc.queryForObject("SELECT count(*)>0 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE 'SELECT publication_status%FOR SHARE'", Boolean.class);
                    if (!waiting) Thread.sleep(20);
                }
                assertTrue(waiting, "HTTP export reached its publication row lock");
                assertFalse(export.isDone(), "export waits for the competing withdrawal decision");
                connection.commit();
                var response = export.get(10, java.util.concurrent.TimeUnit.SECONDS);
                assertEquals(409, response.statusCode(), response.body());
                assertEquals("SNAPSHOT_UNAVAILABLE", JSON.readTree(response.body()).path("code").asString());
            } finally {
                jdbc.update("UPDATE occurrences SET publication_status='PUBLISHED' WHERE id=?", ids.get(1));
            }
            assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM auth_audit_events WHERE action='REPORT_PDF_EXPORT' AND outcome='SUCCEEDED' AND account_id=(SELECT id FROM local_accounts WHERE email='pdf35@example.test')", Integer.class));
        }
    }

    @Test void pdfSnapshotExportRequiresSessionCsrfAndPersistsMinimizedAuditWithoutRequerying() throws Exception {
        UUID actor;
        try (var app = start()) {
            assertEquals(401, request(app, "POST", EXPORT, completed()).statusCode());
            register(app, "pdf34@example.test", true);
            accept(login(app, "pdf34@example.test"));
            assertEquals(403, request(app, "POST", EXPORT, completed(), null, false).statusCode());
            var response = request(app, "POST", EXPORT, completed());
            assertEquals(200, response.statusCode(), response.body());
            assertEquals("PDF_EXPORT_RECORDED", JSON.readTree(response.body()).path("code").asString());
            var refused = request(app, "POST", EXPORT, Map.of("generatedAt", "2026-10-15T17:00:00Z", "outcome", "SUCCEEDED",
                "counts", Map.of("occurrences", 4, "happenings", 2, "mappedOccurrences", 4, "listOnlyOccurrences", 4, "temporallyCertain", 0, "temporallyPossible", 0)));
            assertEquals(400, refused.statusCode(), refused.body());
            assertEquals(200, request(app, "POST", EXPORT, failed()).statusCode());
            var jdbc = app.getBean(JdbcTemplate.class);
            var event = jdbc.queryForMap("SELECT account_id, event_class, parameters::text AS parameters FROM auth_audit_events WHERE action='REPORT_PDF_EXPORT' AND outcome='SUCCEEDED'");
            actor = (UUID) event.get("account_id");
            assertEquals("USE", event.get("event_class"));
            var parameters = JSON.readTree(event.get("parameters").toString());
            assertFalse(parameters.toString().contains("NAO_GUARDAR"));
            assertFalse(parameters.toString().contains("-43.19"));
            assertEquals("CLIENT_SNAPSHOT", parameters.path("snapshotOrigin").asString());
            assertEquals("PDF", parameters.path("format").asString());
            assertEquals("2026-10-15T17:00:00Z", parameters.path("snapshotGeneratedAt").asString());
            assertEquals(4, parameters.path("occurrences").asInt());
            assertEquals(2, parameters.path("happenings").asInt());
            assertEquals(3, parameters.path("mappedOccurrences").asInt());
            assertEquals(1, parameters.path("listOnlyOccurrences").asInt());
            assertEquals(3, parameters.path("temporallyCertain").asInt());
            assertEquals(1, parameters.path("temporallyPossible").asInt());
            assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM auth_audit_events WHERE action='REPORT_PDF_EXPORT' AND outcome='FAILED'", Integer.class));
            assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM auth_audit_events WHERE action='CONSULTATION'", Integer.class));
        }
        try (var restarted = start()) {
            var jdbc = restarted.getBean(JdbcTemplate.class);
            assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM auth_audit_events WHERE action='REPORT_PDF_EXPORT' AND outcome='SUCCEEDED' AND account_id=?", Integer.class, actor));
            assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM auth_audit_events WHERE action='REPORT_PDF_EXPORT' AND outcome='FAILED' AND account_id=?", Integer.class, actor));
        }
    }
}
