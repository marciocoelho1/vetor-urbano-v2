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
        return Map.of("generatedAt", "2026-10-15T17:00:00Z", "outcome", "SUCCEEDED", "counts", counts());
    }
    static Map<String, Object> failed() {
        return Map.of("generatedAt", "2026-10-15T17:00:00Z", "outcome", "FAILED", "counts", counts());
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
