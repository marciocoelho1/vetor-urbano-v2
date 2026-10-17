package br.com.vetorurbano.api.occurrences;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.server.context.WebServerApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Testcontainers
class OccurrenceQueryHttpIT {
    private static final DockerImageName POSTGIS_IMAGE = DockerImageName
            .parse("postgis/postgis:17-3.5")
            .asCompatibleSubstituteFor("postgres");
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Container
    private static final PostgreSQLContainer<?> POSTGIS = new PostgreSQLContainer<>(POSTGIS_IMAGE)
            .withDatabaseName("vetor_urbano_http_test")
            .withUsername("vetor_http_test")
            .withPassword("vetor_http_test");

    private String sessionCookie;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    @Test
    void realHttpReturnsOnlyPublishedOccurrencesAndSurvivesApiRestart() throws Exception {
        JsonNode firstResponse;
        try (var application = startApi()) {
            var response = get(application, allDefaultWindow());
            assertEquals(200, response.statusCode());
            firstResponse = JSON.readTree(response.body());
            assertDefaultCounts(firstResponse);
            assertEquals(4, firstResponse.path("items").size());
            assertFalse(response.body().contains("Controle não publicado"));
            assertFalse(response.body().contains("internalEvaluation"));

            var territorialRecord = findItem(firstResponse, "vu-demo-occurrence-territory-001");
            assertEquals("TERRITORY", territorialRecord.path("locationPrecision").asString());
            assertTrue(territorialRecord.path("coordinates").isNull());

            var transitResponse = get(application, allDefaultWindow() + "&category=TRANSITO");
            assertEquals(200, transitResponse.statusCode());
            var transit = JSON.readTree(transitResponse.body());
            assertEquals(1, transit.path("counts").path("occurrences").asInt());
            assertEquals(1, transit.path("counts").path("happenings").asInt());
            assertEquals(2, transit.path("relatedItems").size());
            assertEquals("POSSIBLE", findIn(transit.path("relatedItems"), "vu-demo-occurrence-contingency-001").path("temporalMatch").asString());
            assertFalse(transitResponse.body().contains("pending-control"));
            assertEquals(
                    3,
                    findItem(transit, "vu-demo-occurrence-traffic-001").path("clippings").size());

            var sourceResponse = get(application, allDefaultWindow() + "&sourceId=vu-demo-source-002");
            assertEquals(1, JSON.readTree(sourceResponse.body()).path("counts").path("occurrences").asInt());
            var textResponse = get(application, allDefaultWindow() + "&text=colisao&minReliability=3");
            assertEquals(1, JSON.readTree(textResponse.body()).path("counts").path("occurrences").asInt());
            var situationResponse = get(application, allDefaultWindow() + "&situation=ONGOING");
            assertEquals(1, JSON.readTree(situationResponse.body()).path("counts").path("occurrences").asInt());
        }

        try (var restartedApplication = startApi()) {
            var afterRestart = get(restartedApplication, allDefaultWindow());
            assertEquals(200, afterRestart.statusCode());
            var body = JSON.readTree(afterRestart.body());
            assertDefaultCounts(body);
            assertEquals(
                    3,
                    findItem(body, "vu-demo-occurrence-traffic-001").path("clippings").size());
        }
    }

    @Test
    void reportQueryRequiresSessionReturnsPersistedResultsAndAuditsOnlyApprovedMetadata() throws Exception {
        String auditParameters;
        long auditId;
        try (var application = startApi()) {
            var anonymous = getReportWithoutSession(application, allDefaultWindow());
            assertEquals(401, anonymous.statusCode());
            assertFalse(anonymous.body().contains("counts"));

            var response = getReport(application, allDefaultWindow()
                    + "&text=COLISAO&timeStart=07:00&timeEnd=12:00"
                    + "&category=TRANSITO"
                    + "&municipality=Rio%20de%20Janeiro"
                    + "&longitude=-43.1915&latitude=-22.9033&radiusMeters=1000"
                    + "&west=-43.20&south=-22.91&east=-43.17&north=-22.90");
            assertEquals(200, response.statusCode());
            var result = JSON.readTree(response.body());
            assertEquals(1, result.path("counts").path("occurrences").asInt());
            assertEquals("vu-demo-occurrence-traffic-001", result.path("items").get(0).path("id").asString());

            var auditRow = application.getBean(org.springframework.jdbc.core.JdbcTemplate.class)
                    .queryForMap(
                            "SELECT id, parameters::text AS parameters FROM auth_audit_events WHERE action='REPORT_GENERATION' ORDER BY id DESC LIMIT 1");
            auditId = ((Number) auditRow.get("id")).longValue();
            auditParameters = (String) auditRow.get("parameters");

            var initialSnapshot = JSON.readTree(getReport(application, allDefaultWindow()).body());
            assertEquals(4, initialSnapshot.path("counts").path("occurrences").asInt());
            var jdbc = application.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
            jdbc.update("INSERT INTO happenings (id, title, description) VALUES (?, ?, ?)",
                    "vu-report-refresh-happening", "Acontecimento de atualização",
                    "Criado somente pelo teste de atualização explícita.");
            try {
                jdbc.update("""
                        INSERT INTO occurrences (
                            id, happening_id, title, description, category, occurrence_type, subtype,
                            situation, reliability_score, municipality, neighborhood, location_precision,
                            location, occurred_at, occurred_from, occurred_until, publication_status
                        ) VALUES (
                            'vu-report-refresh-occurrence', 'vu-report-refresh-happening',
                            'Nova ocorrência sintética', 'Criada pelo teste para conferir Atualizar relatório.',
                            'TRANSITO', 'ACIDENTE', 'COLISAO', 'UNKNOWN', 3,
                            'Rio de Janeiro', 'Centro', 'POINT',
                            ST_SetSRID(ST_MakePoint(-43.19, -22.90), 4326)::GEOGRAPHY,
                            '2026-10-15T12:00:00Z', NULL, NULL, 'PUBLISHED'
                        )
                        """);
                var refreshedSnapshot = JSON.readTree(getReport(application, allDefaultWindow()).body());
                assertEquals(5, refreshedSnapshot.path("counts").path("occurrences").asInt());
                assertEquals(3, refreshedSnapshot.path("counts").path("happenings").asInt());
            } finally {
                jdbc.update("DELETE FROM occurrences WHERE id = ?", "vu-report-refresh-occurrence");
                jdbc.update("DELETE FROM happenings WHERE id = ?", "vu-report-refresh-happening");
            }
        }

        try (var restarted = startApi()) {
            var audit = JSON.readTree(auditParameters);
            assertTrue(audit.path("hasText").asBoolean());
            assertTrue(audit.path("hasSpatialFilter").asBoolean());
            assertEquals("Rio de Janeiro", audit.path("municipalities").get(0).asString());
            assertEquals("07:00", audit.path("timeStart").asString());
            assertEquals("12:00", audit.path("timeEnd").asString());
            assertEquals(1, audit.path("occurrences").asInt());
            assertEquals(1, audit.path("happenings").asInt());
            assertFalse(audit.has("text"));
            assertFalse(auditParameters.contains("COLISAO"));
            assertFalse(audit.has("center"));
            assertFalse(audit.has("longitude"));
            assertFalse(audit.has("latitude"));
            assertFalse(audit.has("radiusMeters"));
            assertFalse(audit.has("bounds"));
            assertEquals(auditParameters, restarted.getBean(org.springframework.jdbc.core.JdbcTemplate.class)
                    .queryForObject("SELECT parameters::text FROM auth_audit_events WHERE id=?", String.class, auditId));
        }
    }

    @Test
    void reportQueryPreservesEmptyCategorySelectionAndAuditsDailyTimeFilters() throws Exception {
        try (var application = startApi()) {
            var response = getReport(application, allDefaultWindow()
                    + "&categorySelection=NONE&timeStart=07:00&timeEnd=12:00");

            assertEquals(200, response.statusCode());
            var result = JSON.readTree(response.body());
            assertEquals(0, result.path("counts").path("occurrences").asInt());
            assertEquals(0, result.path("counts").path("happenings").asInt());
            assertEquals(0, result.path("items").size());

            var auditParameters = application.getBean(org.springframework.jdbc.core.JdbcTemplate.class)
                    .queryForObject(
                            "SELECT parameters FROM auth_audit_events WHERE action='REPORT_GENERATION' ORDER BY id DESC LIMIT 1",
                            String.class);
            var audit = JSON.readTree(auditParameters);
            assertEquals("NONE", audit.path("categorySelection").asString());
            assertEquals("07:00", audit.path("timeStart").asString());
            assertEquals("12:00", audit.path("timeEnd").asString());
            assertEquals(0, audit.path("occurrences").asInt());
            assertEquals(0, audit.path("happenings").asInt());
        }
    }

    @Test
    void httpHonorsOffsetHalfOpenIntervalsAndPostgisDistanceBoundary() throws Exception {
        try (var application = startApi()) {
            var endExclusive = get(application,
                    "periodStart=2026-10-14T14:00:00Z"
                            + "&periodEnd=2026-10-14T15:00:00Z"
                            + "&category=TRANSITO");
            assertEquals(200, endExclusive.statusCode());
            var empty = JSON.readTree(endExclusive.body());
            assertEquals(0, empty.path("counts").path("occurrences").asInt());
            assertEquals(0, empty.path("counts").path("happenings").asInt());
            assertEquals(0, empty.path("items").size());

            var offsetInterval = get(application,
                    "periodStart=2026-10-15T05:00:00-03:00"
                            + "&periodEnd=2026-10-15T10:00:00-03:00"
                            + "&category=CONTINGENCIA");
            assertEquals(200, offsetInterval.statusCode());
            var temporal = JSON.readTree(offsetInterval.body());
            assertEquals(2, temporal.path("counts").path("occurrences").asInt());
            assertEquals(1, temporal.path("counts").path("temporallyCertain").asInt());
            assertEquals(1, temporal.path("counts").path("temporallyPossible").asInt());
            assertEquals(
                    "POSSIBLE",
                    findItem(temporal, "vu-demo-occurrence-contingency-001")
                            .path("temporalMatch")
                            .asString());
            assertEquals(
                    "2026-10-14T14:00:00Z",
                    findItem(temporal, "vu-demo-occurrence-contingency-001")
                            .path("temporal")
                            .path("occurredFrom")
                            .asString());

            // 08:00–10:00 -03 = 11:00–13:00Z: excludes the exact fact at 09:00Z.
            var laterWindow = get(application,
                    "periodStart=2026-10-15T08:00:00-03:00"
                            + "&periodEnd=2026-10-15T10:00:00-03:00"
                            + "&category=CONTINGENCIA");
            var later = JSON.readTree(laterWindow.body());
            assertEquals("OUTSIDE", findIn(later.path("relatedItems"), "vu-demo-occurrence-traffic-001").path("temporalMatch").asString());
            assertEquals(200, laterWindow.statusCode());
            assertEquals(1, later.path("counts").path("occurrences").asInt());
            assertEquals(0, later.path("counts").path("temporallyCertain").asInt());
            assertEquals(1, later.path("counts").path("temporallyPossible").asInt());
            var utcWindow = get(application,
                    "periodStart=2026-10-15T08:00:00Z&periodEnd=2026-10-15T13:00:00Z"
                            + "&category=CONTINGENCIA");
            assertEquals(temporal.path("items"), JSON.readTree(utcWindow.body()).path("items"));

            var base = "periodStart=2026-10-14T15:00:00Z"
                    + "&periodEnd=2026-10-15T10:00:00Z"
                    + "&category=CONTINGENCIA"
                    + "&longitude=-43.1915&latitude=-22.9033";
            var atBoundary = get(application, base + "&radiusMeters=1000");
            var beforeBoundary = get(application, base + "&radiusMeters=999");
            assertEquals(200, atBoundary.statusCode());
            assertEquals(200, beforeBoundary.statusCode());
            assertEquals(
                    2,
                    JSON.readTree(atBoundary.body()).path("counts").path("occurrences").asInt());
            assertEquals(
                    1,
                    JSON.readTree(beforeBoundary.body()).path("counts").path("occurrences").asInt());
            assertEquals(
                    1,
                    JSON.readTree(beforeBoundary.body()).path("counts").path("mappedOccurrences").asInt());
        }
    }

    @Test
    void httpCombinesFiltersAndPreservesExistingDailyAndVisibleAreaSemantics() throws Exception {
        try (var application = startApi()) {
            var combined = get(application, allDefaultWindow()
                    + "&category=TRANSITO&category=SEGURANCA&type=ACIDENTE"
                    + "&subtype=ACIDENTE:COLISAO&sourceId=vu-demo-source-002"
                    + "&municipality=Rio%20de%20Janeiro&neighborhood=Centro"
                    + "&minReliability=3&maxReliability=3&situation=UNKNOWN&text=COLISAO");
            assertEquals(200, combined.statusCode());
            assertEquals(1, JSON.readTree(combined.body()).path("counts").path("occurrences").asInt());
            var mismatch = get(application, allDefaultWindow() + "&type=FURTO&subtype=ACIDENTE:NAO_INFORMADO");
            assertEquals(200, mismatch.statusCode());
            assertEquals(0, JSON.readTree(mismatch.body()).path("items").size());
            var clock = get(application, allDefaultWindow() + "&timeStart=05:00&timeEnd=07:00");
            assertEquals(200, clock.statusCode());
            assertEquals(2, JSON.readTree(clock.body()).path("items").size());
            var wrap = get(application, allDefaultWindow() + "&timeStart=22:00&timeEnd=07:00");
            assertEquals(2, JSON.readTree(wrap.body()).path("items").size());
            var bounds = get(application, allDefaultWindow() + "&west=-43.20&south=-22.91&east=-43.17&north=-22.90");
            assertEquals(200, bounds.statusCode());
            assertEquals(3, JSON.readTree(bounds.body()).path("counts").path("mappedOccurrences").asInt());
            assertEquals(0, JSON.readTree(bounds.body()).path("counts").path("listOnlyOccurrences").asInt());
            var ongoing = get(application, "situation=ONGOING");
            assertEquals(200, ongoing.statusCode());
            assertEquals(1, JSON.readTree(ongoing.body()).path("items").size());
            for (var invalid : java.util.List.of("timeStart=25:00", "west=-43", "timeEnd=7:00", "subtype=bad%20value")) {
                var response = get(application, allDefaultWindow() + "&" + invalid);
                assertEquals(400, response.statusCode(), invalid);
                assertFalse(JSON.readTree(response.body()).has("counts"));
            }
            assertEquals(400, get(application, "situation=UNKNOWN").statusCode());
        }
    }

    @Test
    void authenticatedReportQueryAuditsApprovedFiltersWithoutSavingSearchTextOrGeometry() throws Exception {
        String auditParameters;
        long auditId;
        try (var application = startApi()) {
            var response = get(application, allDefaultWindow()
                    + "&text=termo-privado-sintetico"
                    + "&category=TRANSITO"
                    + "&municipality=Rio%20de%20Janeiro"
                    + "&longitude=-43.1915&latitude=-22.9033&radiusMeters=1000"
                    + "&west=-43.20&south=-22.91&east=-43.17&north=-22.90");

            assertEquals(200, response.statusCode());
            assertEquals(0, JSON.readTree(response.body()).path("counts").path("occurrences").asInt());

            var auditRow = application.getBean(org.springframework.jdbc.core.JdbcTemplate.class)
                    .queryForMap(
                            "SELECT id, parameters::text AS parameters FROM auth_audit_events WHERE module='query' AND action='CONSULTATION' ORDER BY id DESC LIMIT 1");
            auditId = ((Number) auditRow.get("id")).longValue();
            auditParameters = (String) auditRow.get("parameters");
        }

        try (var restarted = startApi()) {
            var audit = JSON.readTree(auditParameters);
            assertTrue(audit.path("hasText").asBoolean());
            assertEquals("Rio de Janeiro", audit.path("municipalities").get(0).asString());
            assertTrue(audit.has("periodStart"));
            assertFalse(audit.has("text"));
            assertFalse(auditParameters.contains("termo-privado-sintetico"));
            assertFalse(audit.has("center"));
            assertFalse(audit.has("longitude"));
            assertFalse(audit.has("latitude"));
            assertFalse(audit.has("radiusMeters"));
            assertFalse(audit.has("bounds"));
            assertEquals(auditParameters, restarted.getBean(org.springframework.jdbc.core.JdbcTemplate.class)
                    .queryForObject("SELECT parameters::text FROM auth_audit_events WHERE id=?", String.class, auditId));
        }
    }

    @Test
    void invalidHttpQueriesReturnBadRequestInsteadOfAValidZero() throws Exception {
        try (var application = startApi()) {
            var response = get(application,
                    "periodStart=2026-10-15T15:00:00Z"
                            + "&periodEnd=2026-10-14T15:00:00Z");
            assertEquals(400, response.statusCode());
            var body = JSON.readTree(response.body());
            assertEquals("INVALID_QUERY", body.path("error").path("code").asString());
            assertFalse(body.has("counts"));
        }
    }

    @Test
    void unavailableDatabaseReturns503WithoutCountsAndRecovers() throws Exception {
        try (var application = startApi()) {
            assertEquals(200, get(application, allDefaultWindow()).statusCode());
            var docker = org.testcontainers.DockerClientFactory.instance().client();
            docker.pauseContainerCmd(POSTGIS.getContainerId()).exec();
            try {
                var response = get(application, allDefaultWindow());
                assertEquals(503, response.statusCode());
                var body = JSON.readTree(response.body());
                assertEquals("ACCESS_UNAVAILABLE", body.path("code").asString());
                assertFalse(body.has("counts"));
                assertFalse(response.body().contains("jdbc"));
            } finally {
                docker.unpauseContainerCmd(POSTGIS.getContainerId()).exec();
            }
            assertEquals(200, get(application, allDefaultWindow()).statusCode());
        }
    }

    private ConfigurableApplicationContext startApi() {
        var app = new SpringApplicationBuilder(br.com.vetorurbano.api.VetorUrbanoApiApplication.class)
                .profiles("local")
                .run(
                        "--server.address=127.0.0.1",
                        "--server.port=0",
                        "--vetor.accounts.enabled=true", "--vetor.accounts.mailbox-port=0",
                        "--spring.datasource.url=" + POSTGIS.getJdbcUrl() + "&socketTimeout=2",
                        "--spring.datasource.hikari.connection-timeout=1500",
                        "--spring.datasource.username=" + POSTGIS.getUsername(),
                        "--spring.datasource.password=" + POSTGIS.getPassword());
        var jdbc=app.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        String encoded=app.getBean(br.com.vetorurbano.api.accounts.AccountPassword.class).derive("Consulta sintética protegida 14");
        jdbc.update("INSERT INTO local_accounts(id,display_name,email,password_hash,status,created_at,confirmed_at,last_sent_at,resend_window_start) VALUES(?,'Consulta sintética','query14@example.test',?,'CONFIRMED',now(),now(),now(),now()) ON CONFLICT(email) DO NOTHING",java.util.UUID.randomUUID(),encoded);
        jdbc.update("DELETE FROM auth_request_limits");
        var login=app.getBean(br.com.vetorurbano.api.auth.AuthService.class).login(java.util.Map.of("email","query14@example.test","password","Consulta sintética protegida 14"),null);
        assertEquals(200, login.status(), "a conta sintética do teste precisa autenticar antes da jornada HTTP");
        sessionCookie="vu_session="+login.cookie();
        return app;
    }

    private HttpResponse<String> get(
            ConfigurableApplicationContext application,
            String query) throws Exception {
        return getPath(application, "/api/v1/occurrences", query, true);
    }

    private HttpResponse<String> getReport(
            ConfigurableApplicationContext application,
            String query) throws Exception {
        return getPath(application, "/api/v1/reports/occurrences", query, true);
    }

    private HttpResponse<String> getReportWithoutSession(
            ConfigurableApplicationContext application,
            String query) throws Exception {
        return getPath(application, "/api/v1/reports/occurrences", query, false);
    }

    private HttpResponse<String> getPath(
            ConfigurableApplicationContext application,
            String path,
            String query,
            boolean authenticated) throws Exception {
        assertTrue(application instanceof WebServerApplicationContext);
        var server = ((WebServerApplicationContext) application).getWebServer();
        assertNotNull(server);
        var uri = URI.create("http://127.0.0.1:" + server.getPort() + path + "?" + query);
        var builder = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(10)).GET();
        if (authenticated) builder.header("Cookie", sessionCookie);
        var request = builder.build();
        return http.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private static String allDefaultWindow() {
        return "periodStart=2026-10-14T15:00:00Z&periodEnd=2026-10-15T15:00:00Z";
    }

    private static void assertDefaultCounts(JsonNode body) {
        var counts = body.path("counts");
        assertEquals(4, counts.path("occurrences").asInt());
        assertEquals(2, counts.path("happenings").asInt());
        assertEquals(3, counts.path("mappedOccurrences").asInt());
        assertEquals(1, counts.path("listOnlyOccurrences").asInt());
        assertEquals(3, counts.path("temporallyCertain").asInt());
        assertEquals(1, counts.path("temporallyPossible").asInt());
    }

    private static JsonNode findItem(JsonNode response, String id) {
        return findIn(response.path("items"), id);
    }

    private static JsonNode findIn(JsonNode items, String id) {
        for (var item : items) {
            if (id.equals(item.path("id").asString())) {
                return item;
            }
        }
        throw new AssertionError("Expected occurrence " + id + " in HTTP response.");
    }
}
