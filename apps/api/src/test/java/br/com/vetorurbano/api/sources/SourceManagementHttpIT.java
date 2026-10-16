package br.com.vetorurbano.api.sources;

import static org.junit.jupiter.api.Assertions.*;

import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.server.context.WebServerApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import br.com.vetorurbano.api.accounts.AccountPassword;
import br.com.vetorurbano.api.auth.MfaVault;
import br.com.vetorurbano.api.auth.Totp;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Testcontainers
class SourceManagementHttpIT {
    private static final DockerImageName POSTGIS_IMAGE = DockerImageName.parse("postgis/postgis:17-3.5")
            .asCompatibleSubstituteFor("postgres");
    @Container private static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>(POSTGIS_IMAGE)
            .withDatabaseName("vetor_urbano_sources_test")
            .withUsername("vetor_sources_test")
            .withPassword("vetor_sources_test");
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String ADMIN_PASSWORD = "Frase Sintética de teste 16";
    private static final String USER_PASSWORD = "Frase Sintética de usuario 16";
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private Path key;

    @Test
    void publicProjectionAdminVersioningAuditPermissionsAndRestart() throws Exception {
        key = Files.createTempDirectory("vu16-mfa").resolve("mfa.key");
        try {
            UUID adminId;
            CookieSession fullAdmin;
            String createdId;
            List<String> originalClippingIds;
            try (var app = startApi()) {
                assertTrue(app.getBean(JdbcTemplate.class).queryForObject("SELECT postgis_full_version() IS NOT NULL", Boolean.class));
                var preflight = preflight(app, "PUT", "admin/sources/test-id");
                assertEquals(200, preflight.statusCode());
                assertEquals("http://127.0.0.1:4201", preflight.headers().firstValue("access-control-allow-origin").orElseThrow());
                assertTrue(preflight.headers().firstValue("access-control-allow-methods").orElse("").contains("PUT"));
                var visitorList = request(app, "GET", "sources", null, null, true);
                assertEquals(200, visitorList.statusCode());
                assertTrue(visitorList.headers().firstValue("cache-control").orElse("").contains("no-store"));
                assertFalse(visitorList.body().contains("rating"));
                assertFalse(visitorList.body().contains("ratingJustification"));
                assertEquals(401, request(app, "GET", "admin/sources", null, null, true).statusCode());
                assertEquals(401, request(app, "POST", "admin/sources", source(null, 4, "Fonte sem URL", "Canal Norte"), null, true).statusCode());
                assertEquals(401, request(app, "GET", "admin/sources/vu-demo-source-001", null, null, true).statusCode());
                assertEquals(401, request(app, "PUT", "admin/sources/vu-demo-source-001",
                        source(null, 4, "Visitante não pode editar", "Canal Norte", 1), null, true).statusCode());

                bootstrapAdmin(app);
                adminId = app.getBean(JdbcTemplate.class).queryForObject("SELECT id FROM local_accounts WHERE role='ADMIN'", UUID.class);
                var partial = login(app, "admin16@example.test", ADMIN_PASSWORD);
                assertEquals(200, partial.response().statusCode());
                byte[] mfaSecret = enroll(app, partial.session(), adminId);
                var partialList = request(app, "GET", "admin/sources", null, partial.session(), true);
                assertEquals(403, partialList.statusCode());
                assertEquals(403, request(app, "POST", "admin/sources",
                        source(null, 4, "ADMIN sem MFA não pode cadastrar", "Canal concreto"), partial.session(), true).statusCode());
                assertEquals(200, request(app, "GET", "sources", null, partial.session(), true).statusCode());
                var verified = request(app, "POST", "auth/mfa/verification",
                        Map.of("code", Totp.code(mfaSecret, Instant.now().getEpochSecond() / 30)), partial.session(), true);
                assertEquals(200, verified.statusCode());
                fullAdmin = session(verified);

                UUID userId = UUID.randomUUID();
                app.getBean(JdbcTemplate.class).update("""
                        INSERT INTO local_accounts (id, display_name, email, password_hash, role, status,
                            created_at, confirmed_at, last_sent_at, resend_window_start)
                        VALUES (?, 'Pessoa sintética', 'usuario16@example.test', ?, 'USER', 'CONFIRMED', now(), now(), now(), now())
                        """, userId, app.getBean(AccountPassword.class).derive(USER_PASSWORD));
                var user = login(app, "usuario16@example.test", USER_PASSWORD).session();
                assertEquals(403, request(app, "GET", "admin/sources", null, user, true).statusCode());
                assertEquals(403, request(app, "GET", "admin/sources/vu-demo-source-001", null, user, true).statusCode());
                assertEquals(403, request(app, "GET", "admin/sources/vu-demo-source-001/versions", null, user, true).statusCode());
                assertEquals(403, request(app, "POST", "admin/sources", source(null, 4, "Negada", "Canal concreto"), user, true).statusCode());
                assertEquals(403, request(app, "PUT", "admin/sources/vu-demo-source-001",
                        source(null, 4, "USER não pode editar", "Canal concreto", 1), user, true).statusCode());
                assertEquals(403, request(app, "POST", "admin/sources", source(null, 4, "Sem CSRF", "Canal concreto"), fullAdmin, false).statusCode());

                var queryBefore = request(app, "GET", "occurrences?periodStart=2026-10-14T15:00:00Z&periodEnd=2026-10-15T15:00:00Z", null, user, true);
                assertEquals(200, queryBefore.statusCode());
                originalClippingIds = clippingIds(JSON.readTree(queryBefore.body()), "vu-demo-occurrence-traffic-001");
                assertEquals(List.of("vu-demo-clipping-001", "vu-demo-clipping-002", "vu-demo-clipping-003"), originalClippingIds);

                var invalidUrl = source("https://example.test/canal?token=valor-sintetico", 4, "Inválida", "Canal concreto");
                assertEquals(400, request(app, "POST", "admin/sources", invalidUrl, fullAdmin, true).statusCode());

                var created = request(app, "POST", "admin/sources", source(null, 4, "Fonte sintética sem URL", "Canal concreto Zona Norte"), fullAdmin, true);
                assertEquals(201, created.statusCode());
                var initial = JSON.readTree(created.body());
                createdId = initial.path("id").asString();
                assertNotEquals("vu-demo-source-001", createdId);
                assertTrue(initial.path("url").isNull());
                assertEquals(1, initial.path("version").asInt());
                assertEquals(adminId.toString(), initial.path("authorId").asString());
                assertEquals(409, request(app, "PUT", "admin/sources/" + createdId,
                        source(null, 5, "Versão obsoleta", "Outro canal", 9), fullAdmin, true).statusCode());

                var update = request(app, "PUT", "admin/sources/" + createdId,
                        source(null, 5, "Fonte sintética revisada", "Canal concreto Centro", 1), fullAdmin, true);
                assertEquals(200, update.statusCode());
                var current = JSON.readTree(update.body());
                assertEquals(createdId, current.path("id").asString());
                assertEquals(2, current.path("version").asInt());
                assertEquals(5, current.path("rating").asInt());
                assertTrue(current.path("url").isNull());

                var history = request(app, "GET", "admin/sources/" + createdId + "/versions", null, fullAdmin, true);
                assertEquals(200, history.statusCode());
                var versions = JSON.readTree(history.body()).path("versions");
                assertEquals(2, versions.size());
                assertEquals("Fonte sintética revisada", versions.get(0).path("name").asString());
                assertEquals("Fonte sintética sem URL", versions.get(1).path("name").asString());
                assertNotEquals(versions.get(0).path("accessConfigurationRef").asString(), versions.get(1).path("accessConfigurationRef").asString());
                assertEquals(adminId.toString(), versions.get(0).path("authorId").asString());

                var renameExisting = request(app, "PUT", "admin/sources/vu-demo-source-001",
                        source("https://example.test/fontes/canal-a", 4, "Fonte A renomeada", "Canal Zona Sul", 1), fullAdmin, true);
                assertEquals(200, renameExisting.statusCode());
                assertEquals("vu-demo-source-001", JSON.readTree(renameExisting.body()).path("id").asString());
                var queryAfter = request(app, "GET", "occurrences?periodStart=2026-10-14T15:00:00Z&periodEnd=2026-10-15T15:00:00Z", null, user, true);
                var afterClippings = findOccurrence(JSON.readTree(queryAfter.body()), "vu-demo-occurrence-traffic-001").path("clippings");
                var afterIds = new ArrayList<String>(); afterClippings.forEach(clip -> afterIds.add(clip.path("id").asString()));
                assertEquals(originalClippingIds, afterIds);
                assertEquals("vu-demo-source-001", afterClippings.get(0).path("source").path("id").asString());
                assertTrue(afterClippings.toString().contains("Fonte A renomeada"));

                var publicAfter = request(app, "GET", "sources", null, null, true);
                JsonNode publicCreated = findByName(JSON.readTree(publicAfter.body()).path("items"), "Fonte sintética revisada");
                assertEquals("Fonte sintética revisada", publicCreated.path("name").asString());
                assertTrue(publicCreated.path("url").isNull());
                assertEquals(2, publicCreated.size());
                assertTrue(publicCreated.has("name"));
                assertTrue(publicCreated.has("url"));
                assertFalse(publicCreated.has("id"));
                assertFalse(publicCreated.has("channel"));
                assertFalse(publicAfter.body().contains("ratingJustification"));
                assertFalse(publicAfter.body().contains("accessConfigurationRef"));
                assertFalse(publicAfter.body().contains("Fonte sintética revisada" + "\",\"rating"));

                var audit = app.getBean(JdbcTemplate.class).queryForList("SELECT action, actor_id::text, before_snapshot::text, after_snapshot::text FROM source_audit_events ORDER BY id");
                assertEquals(3, audit.size());
                for (var event : audit) {
                    assertEquals(adminId.toString(), event.get("actor_id"));
                    String snapshots = Objects.toString(event.get("before_snapshot"), "") + Objects.toString(event.get("after_snapshot"), "");
                    assertFalse(snapshots.toLowerCase(Locale.ROOT).contains("password"));
                    assertFalse(snapshots.toLowerCase(Locale.ROOT).contains("secret"));
                }
                var editEvent = audit.stream().filter(event -> "UPDATE".equals(event.get("action"))
                        && Objects.toString(event.get("after_snapshot"), "").contains("Fonte A renomeada")).findFirst().orElseThrow();
                assertTrue(Objects.toString(editEvent.get("before_snapshot"), "").contains("Fonte demonstrativa A"));
                assertTrue(Objects.toString(editEvent.get("after_snapshot"), "").contains("accessConfigurationRef"));
                assertEquals(2, app.getBean(JdbcTemplate.class).queryForObject(
                        "SELECT count(*) FROM occurrence_clippings oc JOIN clippings c ON c.id=oc.clipping_id WHERE c.source_id='vu-demo-source-001'", Integer.class));
            }

            try (var restarted = startApi()) {
                assertEquals(200, request(restarted, "GET", "admin/sources/" + createdId + "/versions", null, fullAdmin, true).statusCode());
                var read = request(restarted, "GET", "sources", null, null, true);
                assertEquals(200, read.statusCode());
                assertEquals("Fonte sintética revisada", findByName(JSON.readTree(read.body()).path("items"), "Fonte sintética revisada").path("name").asString());
                assertEquals(2, restarted.getBean(JdbcTemplate.class).queryForObject(
                        "SELECT count(*) FROM clippings WHERE source_id='vu-demo-source-001'", Integer.class));

                restarted.getBean(JdbcTemplate.class).execute("TRUNCATE TABLE sources CASCADE");
                var empty = request(restarted, "GET", "sources", null, null, true);
                assertEquals(200, empty.statusCode());
                assertEquals(0, JSON.readTree(empty.body()).path("items").size());
                var emptyAdmin = request(restarted, "GET", "admin/sources", null, fullAdmin, true);
                assertEquals(200, emptyAdmin.statusCode());
                assertEquals(0, JSON.readTree(emptyAdmin.body()).path("items").size());

                var docker = org.testcontainers.DockerClientFactory.instance().client();
                docker.pauseContainerCmd(DB.getContainerId()).exec();
                try {
                    var unavailable = request(restarted, "GET", "sources", null, null, true);
                    assertEquals(503, unavailable.statusCode());
                    assertEquals("ACCESS_UNAVAILABLE", JSON.readTree(unavailable.body()).path("code").asString());
                    assertFalse(unavailable.body().contains("ratingJustification"));
                    var unavailableAdmin = request(restarted, "GET", "admin/sources", null, fullAdmin, true);
                    assertEquals(503, unavailableAdmin.statusCode());
                    assertFalse(unavailableAdmin.body().contains("ratingJustification"));
                } finally {
                    docker.unpauseContainerCmd(DB.getContainerId()).exec();
                }
                assertEquals(200, request(restarted, "GET", "sources", null, null, true).statusCode());
            }
        } finally {
            if (key != null) {
                Files.deleteIfExists(key);
                Files.deleteIfExists(key.getParent());
            }
        }
    }

    private ConfigurableApplicationContext startApi() {
        return new SpringApplicationBuilder(br.com.vetorurbano.api.VetorUrbanoApiApplication.class)
                .profiles("local")
                .run("--server.address=127.0.0.1", "--server.port=0", "--vetor.accounts.enabled=true",
                        "--vetor.accounts.mailbox-port=0", "--vetor.auth.key-file=" + key,
                        "--spring.datasource.url=" + DB.getJdbcUrl() + "&socketTimeout=2",
                        "--spring.datasource.hikari.connection-timeout=1500",
                        "--spring.datasource.username=" + DB.getUsername(),
                        "--spring.datasource.password=" + DB.getPassword());
    }

    private void bootstrapAdmin(ConfigurableApplicationContext app) throws Exception {
        UUID id = UUID.randomUUID();
        Timestamp now = Timestamp.from(Instant.now());
        var jdbc = app.getBean(JdbcTemplate.class);
        jdbc.update("""
                INSERT INTO local_accounts (id, display_name, email, password_hash, role, status,
                    created_at, confirmed_at, last_sent_at, resend_window_start)
                VALUES (?, 'Administrador sintético', 'admin16@example.test', ?, 'ADMIN', 'CONFIRMED', ?, ?, ?, ?)
                """, id, app.getBean(AccountPassword.class).derive(ADMIN_PASSWORD), now, now, now, now);
        jdbc.update("INSERT INTO auth_audit_events(account_id,occurred_at,action,outcome) VALUES(?,?,'BOOTSTRAP','CREATED')", id, now);
    }

    private byte[] enroll(ConfigurableApplicationContext app, CookieSession partial, UUID id) throws Exception {
        var response = request(app, "POST", "auth/mfa/enrollment", Map.of(), partial, true);
        assertEquals(200, response.statusCode());
        String encrypted = app.getBean(JdbcTemplate.class).queryForObject("SELECT mfa_secret FROM local_accounts WHERE id=?", String.class, id);
        return app.getBean(MfaVault.class).decrypt(encrypted, id);
    }

    private LoginResult login(ConfigurableApplicationContext app, String email, String password) throws Exception {
        var response = request(app, "POST", "auth/login", Map.of("email", email, "password", password), null, true);
        return new LoginResult(response, session(response));
    }

    private HttpResponse<String> request(ConfigurableApplicationContext app, String method, String path,
            Map<String, ?> body, CookieSession session, boolean withCsrf) throws Exception {
        int port = ((WebServerApplicationContext) app).getWebServer().getPort();
        var builder = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/v1/" + path))
                .timeout(Duration.ofSeconds(15)).header("Accept", "application/json");
        if (body != null) builder.header("Content-Type", "application/json");
        if (session != null) {
            builder.header("Cookie", session.cookie());
            if (withCsrf) builder.header("X-CSRF-Token", session.csrf());
        }
        builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)));
        return http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> preflight(ConfigurableApplicationContext app, String method, String path) throws Exception {
        int port = ((WebServerApplicationContext) app).getWebServer().getPort();
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/v1/" + path))
                .timeout(Duration.ofSeconds(5)).header("Origin", "http://127.0.0.1:4201")
                .header("Access-Control-Request-Method", method)
                .header("Access-Control-Request-Headers", "content-type,x-csrf-token")
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody()).build();
        return http.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private static CookieSession session(HttpResponse<String> response) throws Exception {
        String cookie = response.headers().firstValue("set-cookie").orElseThrow().split(";", 2)[0];
        String csrf = JSON.readTree(response.body()).path("csrfToken").asString();
        return new CookieSession(cookie, csrf);
    }

    private static Map<String, Object> source(String url, int rating, String name, String channel) {
        return source(url, rating, name, channel, 0);
    }

    private static Map<String, Object> source(String url, int rating, String name, String channel, int expectedVersion) {
        var result = new LinkedHashMap<String, Object>();
        result.put("name", name); result.put("channel", channel); result.put("url", url);
        result.put("territories", List.of("Rio de Janeiro")); result.put("pillars", List.of("TRANSITO", "CONTINGENCIA"));
        result.put("accessMethod", "MANUAL"); result.put("rating", rating);
        result.put("ratingJustification", "Avaliação inteiramente sintética para testar versões.");
        if (expectedVersion > 0) result.put("expectedVersion", expectedVersion);
        return result;
    }

    private static JsonNode findByName(JsonNode items, String name) {
        for (var item : items) if (item.path("name").asString().equals(name)) return item;
        throw new AssertionError("Fonte pública ausente na resposta HTTP.");
    }

    private static JsonNode findOccurrence(JsonNode response, String id) {
        for (var item : response.path("items")) if (item.path("id").asString().equals(id)) return item;
        throw new AssertionError("Ocorrência ausente na resposta HTTP.");
    }

    private static List<String> clippingIds(JsonNode response, String occurrenceId) {
        JsonNode occurrences = response.path("items");
        for (var occurrence : occurrences) if (occurrence.path("id").asString().equals(occurrenceId)) {
            var ids = new ArrayList<String>(); occurrence.path("clippings").forEach(clipping -> ids.add(clipping.path("id").asString())); return List.copyOf(ids);
        }
        throw new AssertionError("Ocorrência sintética ausente na resposta.");
    }

    private record CookieSession(String cookie, String csrf) {}
    private record LoginResult(HttpResponse<String> response, CookieSession session) {}
}
