package br.com.vetorurbano.api.auth;

import static org.junit.jupiter.api.Assertions.*;
import java.net.URI;
import java.net.http.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.nio.file.*;
import org.junit.jupiter.api.*;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.web.server.context.WebServerApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import br.com.vetorurbano.api.accounts.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Testcontainers
class AuditHttpIT extends LocalAuthHttpSupport {
    @Container static final PostgreSQLContainer<?> DB=new PostgreSQLContainer<>(DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    static final MutableClock CLOCK=new MutableClock();
    @TestConfiguration static class TimeConfig { @Bean @Primary Clock clock(){return CLOCK;} }
    @Override PostgreSQLContainer<?> database() { return DB; }
    @Override MutableClock clock() { return CLOCK; }
    @Override Class<?> timeConfiguration() { return TimeConfig.class; }
    @Test void logsRequireAdministratorWithMfaAndExposeClassifiedEventsAfterRestart() throws Exception {
        try (var app = start()) {
            assertEquals(401, request(app, "GET", "admin/logs", null).statusCode());
            register(app, "logs19@example.test", true);
            accept(login(app, "logs19@example.test"));
            assertEquals(403, request(app, "GET", "admin/logs", null).statusCode());
            assertEquals(200, request(app, "GET", query(), null).statusCode());
            UUID admin = bootstrap(app);
            accept(login(app, "admin14@example.test"));
            assertEquals(403, request(app, "GET", "admin/logs", null).statusCode());
            byte[] secret = enrolledSecret(app, admin);
            accept(request(app, "POST", "auth/mfa/verification", Map.of("code", code(secret))));
            var response = request(app, "GET", "admin/logs?eventClass=USE", null);
            assertEquals(200, response.statusCode(), response.body());
            var body = JSON.readTree(response.body());
            assertTrue(body.path("items").isArray());
            assertTrue(body.path("items").toString().contains("CONSULTATION"));
            assertFalse(body.path("items").toString().contains("password"));
            assertEquals("USE", body.path("items").get(0).path("eventClass").asString());
            assertNotNull(body.path("items").get(0).get("actor"));
        }
        try (var restarted = start()) {
            var response = request(restarted, "GET", "admin/logs?eventClass=USE", null);
            assertEquals(200, response.statusCode());
            assertTrue(response.body().contains("CONSULTATION"));
        }
    }    @Test void retentionUsesEventTimeHidesExpiredAndCleanupPreservesVersions() throws Exception {
        try (var app = start("--vetor.audit.use-retention=10s", "--vetor.audit.security-retention=20s", "--vetor.audit.admin-retention=30s")) {
            UUID admin = bootstrap(app);
            accept(login(app, "admin14@example.test"));
            byte[] secret = enrolledSecret(app, admin);
            accept(request(app, "POST", "auth/mfa/verification", Map.of("code", code(secret))));
            assertEquals(200, request(app, "GET", query(), null).statusCode());
            var jdbc = app.getBean(JdbcTemplate.class);
            var source = request(app, "POST", "admin/sources", Map.of("name", "Fonte sintética 19", "channel", "Canal sintético", "territories", List.of("Rio de Janeiro"), "pillars", List.of("TRANSITO"), "accessMethod", "MANUAL", "rating", 3, "ratingJustification", "Avaliação sintética"));
            assertEquals(201, source.statusCode(), source.body());
            // Existing source writes use system time: fix the event fixture to the test clock.
            jdbc.update("UPDATE source_audit_events SET occurred_at=?", Timestamp.from(CLOCK.instant()));
            long versionCount = jdbc.queryForObject("SELECT count(*) FROM source_versions", Long.class);
            CLOCK.advance(10);
            var expiredUse = request(app, "GET", "admin/logs?eventClass=USE", null);
            assertEquals(200, expiredUse.statusCode());
            assertEquals(0, JSON.readTree(expiredUse.body()).path("items").size(), "Expiry is inclusive and enforced before physical cleanup");
            assertTrue(request(app, "GET", "admin/logs?eventClass=SECURITY", null).body().contains("LOGIN"));
            CLOCK.advance(10);
            assertFalse(request(app, "GET", "admin/logs?eventClass=SECURITY", null).body().contains("LOGIN"));
            assertTrue(request(app, "GET", "admin/logs?eventClass=ADMIN", null).body().contains("Fonte sintética 19"));
            CLOCK.advance(10);
            assertFalse(request(app, "GET", "admin/logs?eventClass=ADMIN", null).body().contains("Fonte sintética 19"));
            assertEquals(403, request(app, "POST", "admin/logs/cleanup", Map.of(), null, false).statusCode());
            var cleanup = request(app, "POST", "admin/logs/cleanup", Map.of());
            assertEquals(200, cleanup.statusCode(), cleanup.body());
            assertEquals(CLOCK.instant().toString(), JSON.readTree(cleanup.body()).path("executedAt").asString());
            assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM auth_audit_events WHERE action IN ('CONSULTATION','LOGIN')", Integer.class));
            assertEquals(versionCount, jdbc.queryForObject("SELECT count(*) FROM source_versions", Long.class));
            assertTrue(request(app, "GET", "admin/logs?eventClass=ADMIN", null).body().contains("LOG_CLEANUP"));
        }
    }
    @Test void paginationIsStableAndLegacyUsageParametersAreMinimized() throws Exception {
        try (var app = start()) {
            UUID admin = bootstrap(app);
            accept(login(app, "admin14@example.test"));
            byte[] secret = enrolledSecret(app, admin);
            accept(request(app, "POST", "auth/mfa/verification", Map.of("code", code(secret))));
            for (int index = 0; index < 53; index++) assertEquals(200, request(app, "GET", query(), null).statusCode());
            app.getBean(JdbcTemplate.class).update("UPDATE auth_audit_events SET parameters=parameters || '{\"text\":\"LOCAL_SECRETO\",\"longitude\":-43.19,\"password\":\"SEGREDO_TESTE\"}'::jsonb WHERE module='query'");
            var first = request(app, "GET", "admin/logs?eventClass=USE", null);
            assertEquals(200, first.statusCode());
            assertFalse(first.body().contains("LOCAL_SECRETO"));
            assertFalse(first.body().contains("longitude"));
            assertFalse(first.body().contains("SEGREDO_TESTE"));
            var body = JSON.readTree(first.body());
            assertEquals(50, body.path("items").size());
            assertTrue(body.path("hasMore").asBoolean());
            String cursor = java.net.URLEncoder.encode(body.path("nextCursor").asString(), java.nio.charset.StandardCharsets.UTF_8);
            assertEquals(200, request(app, "GET", query(), null).statusCode());
            var second = JSON.readTree(request(app, "GET", "admin/logs?eventClass=USE&cursor=" + cursor, null).body());
            assertEquals(3, second.path("items").size());
            var ids = new HashSet<String>();
            for (var item : body.path("items")) assertTrue(ids.add(item.path("id").asString()));
            for (var item : second.path("items")) assertTrue(ids.add(item.path("id").asString()));
            assertEquals(400, request(app, "GET", "admin/logs?eventClass=UNKNOWN", null).statusCode());
            assertEquals(400, request(app, "GET", "admin/logs?cursor=invalid", null).statusCode());
        }
    }
    @Test void logsProjectLiveAndHistoricalActorsWithoutCollapsingAccountAndDomainReferences() throws Exception {
        try (var app = start()) {
            UUID closedAdmin = bootstrap(app);
            accept(login(app, "admin14@example.test"));
            byte[] closedAdminSecret = enrolledSecret(app, closedAdmin);
            accept(request(app, "POST", "auth/mfa/verification", Map.of("code", code(closedAdminSecret))));

            assertEquals(200, request(app, "POST", "account/display-name", Map.of("displayName", "Admin histórico sintético")).statusCode());
            var created = request(app, "POST", "admin/sources", Map.of(
                "name", "Fonte sintética de autoria histórica",
                "channel", "Canal local sintético",
                "territories", List.of("Rio de Janeiro"),
                "pillars", List.of("TRANSITO"),
                "accessMethod", "MANUAL",
                "rating", 3,
                "ratingJustification", "Avaliação fictícia para integração"
            ));
            assertEquals(201, created.statusCode(), created.body());
            String sourceId = JSON.readTree(created.body()).path("id").asString();
            var jdbc = app.getBean(JdbcTemplate.class);
            long accountEventNumber = jdbc.queryForObject(
                "SELECT id FROM account_audit_events WHERE account_id=? AND action='DISPLAY_NAME' ORDER BY id DESC LIMIT 1",
                Long.class, closedAdmin);
            long sourceEventNumber = jdbc.queryForObject(
                "SELECT id FROM source_audit_events WHERE source_id=? AND action='CREATE' ORDER BY id DESC LIMIT 1",
                Long.class, sourceId);
            long securityEventNumber = jdbc.queryForObject(
                "SELECT id FROM auth_audit_events WHERE account_id=? AND event_class='SECURITY' ORDER BY id DESC LIMIT 1",
                Long.class, closedAdmin);

            var liveLogs = JSON.readTree(request(app, "GET", "admin/logs", null).body());
            long domainEventNumber = jdbc.queryForObject(
                "SELECT id FROM auth_audit_events WHERE account_id=? AND event_class='ADMIN' ORDER BY id DESC LIMIT 1",
                Long.class, closedAdmin);
            var liveAccountEvent = findEvent(liveLogs, "account-" + accountEventNumber);
            assertNotNull(liveAccountEvent);
            assertEquals(closedAdmin.toString(), liveAccountEvent.path("actor").asString());
            assertTrue(liveAccountEvent.has("historicalActor"));
            assertTrue(liveAccountEvent.path("historicalActor").isNull());
            var liveSourceEvent = findEvent(liveLogs, "source-" + sourceEventNumber);
            assertNotNull(liveSourceEvent);
            assertEquals(closedAdmin.toString(), liveSourceEvent.path("actor").asString());
            assertTrue(liveSourceEvent.path("historicalActor").isNull());
            var liveSecurityEvent = findEvent(liveLogs, "access-" + securityEventNumber);
            assertNotNull(liveSecurityEvent);
            assertEquals(closedAdmin.toString(), liveSecurityEvent.path("actor").asString());
            assertTrue(liveSecurityEvent.path("historicalActor").isNull());
            var liveDomainEvent = findEvent(liveLogs, "access-" + domainEventNumber);
            assertNotNull(liveDomainEvent);
            assertEquals(closedAdmin.toString(), liveDomainEvent.path("actor").asString());
            assertTrue(liveDomainEvent.path("historicalActor").isNull());

            var reader = JSON.readTree("""
                {"action":"create","email":"logs-reader@example.test","displayName":"Leitor de logs","password":"Frase sintética para sessão 14"}
                """);
            new TransactionTemplate(app.getBean(org.springframework.transaction.PlatformTransactionManager.class))
                .executeWithoutResult(status -> LocalAccountAdmin.execute(
                    jdbc, app.getBean(AuthService.class), app.getBean(AccountPassword.class), CLOCK, reader));
            UUID readerId = jdbc.queryForObject("SELECT id FROM local_accounts WHERE email='logs-reader@example.test'", UUID.class);
            accept(login(app, "logs-reader@example.test"));
            byte[] readerSecret = enrolledSecret(app, readerId);
            accept(request(app, "POST", "auth/mfa/verification", Map.of("code", code(readerSecret))));
            String readerCookie = cookie;
            String readerCsrf = csrf;

            CLOCK.advance(30);
            cookie = null;
            csrf = null;
            accept(login(app, "admin14@example.test"));
            accept(request(app, "POST", "auth/mfa/verification", Map.of("code", code(closedAdminSecret))));
            CLOCK.advance(30);
            var closure = request(app, "POST", "account/closure", Map.of(
                "currentPassword", "Frase sintética para sessão 14",
                "mfaCode", code(closedAdminSecret)
            ));
            assertEquals(200, closure.statusCode(), closure.body());
            cookie = readerCookie;
            csrf = readerCsrf;

            var closedLogsResponse = request(app, "GET", "admin/logs", null);
            assertEquals(200, closedLogsResponse.statusCode(), closedLogsResponse.body());
            var closedLogs = JSON.readTree(closedLogsResponse.body());
            assertFalse(closedLogsResponse.body().contains(closedAdmin.toString()),
                "A resposta não pode expor o UUID da conta eliminada");

            UUID securityReference = jdbc.queryForObject(
                "SELECT historical_actor_id FROM account_audit_events WHERE action='ACCOUNT_CLOSURE' AND outcome='CLOSED'",
                UUID.class);
            UUID domainReference = jdbc.queryForObject(
                "SELECT historical_actor_id FROM source_audit_events WHERE source_id=? AND action='CREATE'",
                UUID.class, sourceId);
            assertNotEquals(securityReference, domainReference,
                "Segurança/conta e autoria de domínio precisam manter referências distintas");
            assertNotEquals(closedAdmin, securityReference);
            assertNotEquals(closedAdmin, domainReference);

            var historicalAccountEvent = findEvent(closedLogs, "account-" + accountEventNumber);
            assertNotNull(historicalAccountEvent);
            assertTrue(historicalAccountEvent.path("actor").isNull());
            assertEquals(securityReference.toString(), historicalAccountEvent.path("historicalActor").asString());
            var historicalSourceEvent = findEvent(closedLogs, "source-" + sourceEventNumber);
            assertNotNull(historicalSourceEvent);
            assertTrue(historicalSourceEvent.path("actor").isNull());
            assertEquals(domainReference.toString(), historicalSourceEvent.path("historicalActor").asString());
            var historicalSecurityEvent = findEvent(closedLogs, "access-" + securityEventNumber);
            assertNotNull(historicalSecurityEvent);
            assertTrue(historicalSecurityEvent.path("actor").isNull());
            assertEquals(securityReference.toString(), historicalSecurityEvent.path("historicalActor").asString());
            var historicalDomainEvent = findEvent(closedLogs, "access-" + domainEventNumber);
            assertNotNull(historicalDomainEvent);
            assertTrue(historicalDomainEvent.path("actor").isNull());
            assertEquals(domainReference.toString(), historicalDomainEvent.path("historicalActor").asString());
        }
    }

    private static JsonNode findEvent(JsonNode page, String id) {
        for (var event : page.path("items")) if (id.equals(event.path("id").asString())) return event;
        return null;
    }

    @Test void scheduledCleanupDeletesEligibleUsageWithoutHumanIntervention() throws Exception {
        try (var app = start("--vetor.audit.use-retention=1s", "--vetor.audit.cleanup-delay=100", "--vetor.audit.cleanup-initial-delay=100")) {
            UUID admin = bootstrap(app);
            accept(login(app, "admin14@example.test"));
            byte[] secret = enrolledSecret(app, admin);
            accept(request(app, "POST", "auth/mfa/verification", Map.of("code", code(secret))));
            assertEquals(200, request(app, "GET", query(), null).statusCode());
            CLOCK.advance(1);
            boolean cleaned = false;
            long deadline = System.nanoTime() + Duration.ofSeconds(5).toNanos();
            while (!cleaned && System.nanoTime() < deadline) {
                var response = request(app, "GET", "admin/logs?eventClass=ADMIN", null);
                if (response.statusCode() == 200) for (var event : JSON.readTree(response.body()).path("items")) {
                    if (event.path("action").asString().equals("LOG_CLEANUP")
                            && event.path("parameters").path("executedAt").asString().equals(CLOCK.instant().toString())
                            && event.path("parameters").path("deleted").asInt() > 0) cleaned = true;
                }
                if (!cleaned) Thread.sleep(100);
            }
            assertTrue(cleaned, "A rotina agendada deve tornar o expurgo observável pela API");
            assertEquals(0, app.getBean(JdbcTemplate.class).queryForObject("SELECT count(*) FROM auth_audit_events WHERE action='CONSULTATION'", Integer.class));
        }
    }

}
