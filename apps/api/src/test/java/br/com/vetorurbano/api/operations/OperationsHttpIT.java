package br.com.vetorurbano.api.operations;

import static org.junit.jupiter.api.Assertions.*;

import br.com.vetorurbano.api.accounts.AccountPassword;
import br.com.vetorurbano.api.auth.MfaVault;
import br.com.vetorurbano.api.auth.Totp;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.server.context.WebServerApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Ticket 22 com PostgreSQL/PostGIS real: o painel de operação distingue fonte não configurada,
 * falha de alimentação, sucesso sem novidades e fila/espera vazia; confirmações usam somente prazos
 * configurados explicitamente; USER recebe 403 no servidor e cada leitura é auditada sem conteúdo.
 */
@Testcontainers
class OperationsHttpIT {
    private static final DockerImageName POSTGIS_IMAGE = DockerImageName.parse("postgis/postgis:17-3.5")
            .asCompatibleSubstituteFor("postgres");
    @Container private static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>(POSTGIS_IMAGE)
            .withDatabaseName("vetor_urbano_operations_test")
            .withUsername("vetor_operations_test")
            .withPassword("vetor_operations_test");

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String ADMIN_EMAIL = "admin22@example.test";
    private static final String ADMIN_PASSWORD = "Frase Sintética de admin 22";
    private static final String USER_EMAIL = "usuario22@example.test";
    private static final String USER_PASSWORD = "Frase Sintética de usuario 22";
    private static final String SOURCE_ID = "fogo-cruzado";

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private Path key;

    @BeforeEach
    void prepare() throws Exception {
        key = Files.createTempDirectory("vu22-mfa").resolve("mfa.key");
        try (var app = startApi("--vetor.operations.expiry-window=24h")) {
            var jdbc = app.getBean(JdbcTemplate.class);
            jdbc.execute("""
                    TRUNCATE collection_backfill_windows,collection_run_events,collection_items,collection_runs,
                        collection_sources,occurrence_verifications,clipping_review_decisions,publication_versions,
                        clipping_reviews,occurrence_clippings,clippings,auth_audit_events,local_sessions,
                        auth_request_limits,account_email_change_tokens,account_recovery_tokens,
                        account_audit_events,account_confirmation_tokens,account_request_limits,
                        local_accounts RESTART IDENTITY CASCADE
                    """);
            // Fixtures desta suíte não vazam entre testes; as sementes sintéticas da V1 permanecem.
            jdbc.update("DELETE FROM occurrences WHERE id LIKE 'vu22-%'");
            jdbc.update("DELETE FROM sources WHERE id = 'fogo-cruzado'");
            jdbc.update("DELETE FROM clippings WHERE id LIKE 'vu22-%'");
        }
    }

    @AfterEach
    void cleanup() throws Exception {
        Files.deleteIfExists(key);
        Files.deleteIfExists(key.getParent());
    }

    private ConfigurableApplicationContext startApi(String... extra) {
        var args = new ArrayList<>(List.of("--server.address=127.0.0.1", "--server.port=0",
                "--vetor.accounts.enabled=true", "--vetor.accounts.mailbox-port=0",
                "--vetor.auth.key-file=" + key,
                "--spring.datasource.url=" + DB.getJdbcUrl() + "&socketTimeout=2",
                "--spring.datasource.hikari.connection-timeout=1500",
                "--spring.datasource.username=" + DB.getUsername(),
                "--spring.datasource.password=" + DB.getPassword(),
                "--vetor.collection.poll-seconds=86400"));
        for (String override : extra) {
            if (override.startsWith("--") && override.contains("=")) {
                String name = override.substring(2, override.indexOf('='));
                args.removeIf(argument -> argument.startsWith("--" + name + "="));
            }
            args.add(override);
        }
        return new SpringApplicationBuilder(br.com.vetorurbano.api.VetorUrbanoApiApplication.class)
                .profiles("local").run(args.toArray(String[]::new));
    }

    @Test
    void panelRequiresAdministratorOnTheServerAndAuditsOnlyAggregates() throws Exception {
        try (var app = startApi("--vetor.operations.expiry-window=24h")) {
            var admin = adminSession(app);
            var user = userSession(app);

            assertEquals(401, request(app, "GET", "admin/operations", null, null).statusCode());
            var forbidden = request(app, "GET", "admin/operations", null, user);
            assertEquals(403, forbidden.statusCode(), "USER nunca lê o painel, mesmo por HTTP direto");
            assertFalse(forbidden.body().contains("sources"));

            var response = request(app, "GET", "admin/operations", null, admin);
            assertEquals(200, response.statusCode());
            assertEquals("no-store", response.headers().firstValue("Cache-Control").orElse(""));
            var body = JSON.readTree(response.body());

            assertEquals("NOT_CONFIGURED", body.path("sources").path("state").asString());
            assertEquals(0, body.path("sources").path("items").size());
            assertTrue(body.path("sources").path("detail").asString().contains("não é falha"));
            assertEquals("EMPTY", body.path("queue").path("state").asString());
            assertEquals(0, body.path("queue").path("pending").asInt());
            assertTrue(body.path("queue").path("label").asString().contains("vazia"));
            assertEquals("CONFIGURED", body.path("confirmations").path("state").asString());
            assertEquals(86400, body.path("confirmations").path("windowSeconds").asInt());
            assertTrue(response.body().contains("não comprova coleta real"));

            var jdbc = app.getBean(JdbcTemplate.class);
            var audit = jdbc.queryForMap("""
                    SELECT module, action, outcome, event_class, parameters::text AS parameters
                    FROM auth_audit_events WHERE action='OPERATIONS_VIEW' ORDER BY id DESC LIMIT 1
                    """);
            assertEquals("operations", audit.get("module"));
            assertEquals("ADMIN", audit.get("event_class"));
            assertEquals("SUCCEEDED", audit.get("outcome"));
            String parameters = (String) audit.get("parameters");
            assertTrue(parameters.contains("\"sources\": 0"), parameters);
            assertTrue(parameters.contains("\"pendingReviews\": 0"), parameters);
            assertFalse(parameters.contains("Colisão demonstrativa"),
                    "a auditoria guarda contagens, nunca conteúdo de ocorrência");
        }
    }

    @Test
    void failedFeedAndSuccessfulRunWithoutNewItemsStayDistinctStates() throws Exception {
        try (var app = startApi("--vetor.operations.expiry-window=24h")) {
            var admin = adminSession(app);
            var jdbc = app.getBean(JdbcTemplate.class);
            Instant now = Instant.now();
            jdbc.update("""
                    INSERT INTO sources (id, public_name, provenance) VALUES (?, 'Fogo Cruzado (API v2)', ?::jsonb)
                    """, SOURCE_ID, """
                    {"credit":"Instituto Fogo Cruzado","attribution":"Fonte: Instituto Fogo Cruzado"}
                    """);
            jdbc.update("""
                    INSERT INTO collection_sources (source_id, window_start, poll_seconds, page_size, max_pages,
                        paused, last_attempt_at, last_error_class, created_at, updated_at)
                    VALUES (?, DATE '2026-06-01', 86400, 100, 20, false, ?, 'RATE_LIMITED', ?, ?)
                    """, SOURCE_ID, Timestamp.from(now), Timestamp.from(now), Timestamp.from(now));
            insertRun(jdbc, "FAILED", "RATE_LIMITED", now.minusSeconds(120), now.minusSeconds(60));

            var failing = JSON.readTree(request(app, "GET", "admin/operations", null, admin).body());
            var source = failing.path("sources").path("items").get(0);
            assertEquals("FAILING", source.path("assessment").asString());
            assertEquals("RATE_LIMITED", source.path("lastErrorClass").asString());
            assertTrue(source.path("assessmentLabel").asString().contains("limite de taxa"));
            assertEquals("FAILED", source.path("lastRun").path("state").asString());
            assertEquals("Instituto Fogo Cruzado", source.path("credit").asString());
            assertFalse(failing.toString().contains("\"occurrences\""),
                    "falha de conector nunca é apresentada como contagem de ocorrências");

            jdbc.update("""
                    UPDATE collection_sources SET last_attempt_at=?, last_success_at=?, last_error_class=NULL,
                        updated_at=? WHERE source_id=?
                    """, Timestamp.from(now), Timestamp.from(now), Timestamp.from(now), SOURCE_ID);
            insertRun(jdbc, "SUCCEEDED_NO_CHANGES", null, now, now);

            var succeeded = JSON.readTree(request(app, "GET", "admin/operations", null, admin).body());
            var healthy = succeeded.path("sources").path("items").get(0);
            assertEquals("UP_TO_DATE_NO_NEW_ITEMS", healthy.path("assessment").asString());
            assertTrue(healthy.path("assessmentLabel").asString().contains("Sem novidades"));
            assertNotEquals(source.path("assessmentLabel").asString(),
                    healthy.path("assessmentLabel").asString());
            assertEquals(0, healthy.path("lastRun").path("itemsCreated").asInt());
            assertEquals("CONFIGURED", succeeded.path("sources").path("state").asString());

            jdbc.update("UPDATE collection_sources SET paused=true WHERE source_id=?", SOURCE_ID);
            var paused = JSON.readTree(request(app, "GET", "admin/operations", null, admin).body());
            assertEquals("PAUSED", paused.path("sources").path("items").get(0).path("assessment").asString());
        }
    }

    @Test
    void reviewQueueShowsWaitAndHighPriorityWhilePending() throws Exception {
        try (var app = startApi("--vetor.operations.expiry-window=24h")) {
            var admin = adminSession(app);
            var jdbc = app.getBean(JdbcTemplate.class);
            Instant now = Instant.now();
            jdbc.update("""
                    INSERT INTO clippings (id, source_id, title, reference, source_published_at, collected_at)
                    VALUES ('vu22-clip', 'vu-demo-source-001', 'Publicação sintética 22', 'vu22:1', ?, ?)
                    """, Timestamp.from(now.minusSeconds(7500)), Timestamp.from(now.minusSeconds(7200)));
            jdbc.update("""
                    INSERT INTO clipping_reviews (clipping_id, original_text, extracted, priority, state, queued_at)
                    VALUES ('vu22-clip', 'Texto sintético', '{}'::jsonb, 'HIGH', 'PENDING', ?)
                    """, Timestamp.from(now.minusSeconds(7200)));

            var body = JSON.readTree(request(app, "GET", "admin/operations", null, admin).body());
            var queue = body.path("queue");
            assertEquals("HAS_PENDING", queue.path("state").asString());
            assertEquals(1, queue.path("pending").asInt());
            assertEquals(1, queue.path("highPriority").asInt());
            assertTrue(queue.path("longestWaitSeconds").asLong() >= 7000,
                    "a espera é medida a partir do instante de geração: " + queue.path("longestWaitSeconds"));
            assertNotNull(queue.path("oldestQueuedAt").asString());
            assertTrue(queue.path("label").asString().contains("aguardando revisão"));
        }
    }

    @Test
    void confirmationsListOnlyConfiguredDeadlinesAndFlagMissingConfiguration() throws Exception {
        try (var app = startApi("--vetor.operations.expiry-window=24h")) {
            var admin = adminSession(app);
            var jdbc = app.getBean(JdbcTemplate.class);
            Instant now = Instant.now();
            insertOngoingOccurrence(jdbc, "vu22-expiring", "INTERDICAO", now.minusSeconds(3600),
                    now.plusSeconds(7200));
            insertOngoingOccurrence(jdbc, "vu22-expired", "INTERDICAO", now.minusSeconds(9000),
                    now.minusSeconds(1800));
            insertOngoingOccurrence(jdbc, "vu22-no-deadline", "ROUBO", null, null);

            var body = JSON.readTree(request(app, "GET", "admin/operations", null, admin).body());
            var confirmations = body.path("confirmations");
            assertEquals("CONFIGURED", confirmations.path("state").asString());
            assertEquals(1, confirmations.path("expiring").size(), confirmations.toString());
            assertEquals("vu22-expiring", confirmations.path("expiring").get(0).path("occurrenceId").asString());
            assertEquals(1L, confirmations.path("expired").asLong());
            assertEquals(List.of("ROUBO"), strings(confirmations.path("typesWithoutAutomaticExtension")));
            assertTrue(confirmations.path("typesWithoutDeadline").isEmpty(),
                    "ROUBO tem decisão aprovada de não prorrogar, não ausência de configuração");
        }

        try (var app = startApi("--vetor.operations.expiry-window=")) {
            var admin = adminSession(app, "admin22-sem-janela@example.test");
            var confirmations = JSON.readTree(request(app, "GET", "admin/operations", null, admin).body())
                    .path("confirmations");
            assertEquals("NOT_CONFIGURED", confirmations.path("state").asString());
            assertTrue(confirmations.path("windowSeconds").isNull());
            assertEquals(0, confirmations.path("expiring").size());
            assertTrue(confirmations.path("detail").asString().contains("vetor.operations.expiry-window"));
        }
    }

    private void insertOngoingOccurrence(JdbcTemplate jdbc, String id, String type, Instant confirmedAt,
            Instant expiresAt) {
        Instant now = Instant.now();
        jdbc.update("""
                INSERT INTO happenings (id, title, description) VALUES ('vu22-happening', 'Acontecimento 22',
                    'Contexto sintético do painel de operação.')
                ON CONFLICT (id) DO NOTHING
                """);
        jdbc.update("""
                INSERT INTO occurrences (id, happening_id, title, description, category, occurrence_type, subtype,
                    situation, reliability_score, municipality, neighborhood, location_precision, location,
                    occurred_at, occurred_from, occurred_until, publication_status, revision)
                VALUES (?, 'vu22-happening', 'Ocorrência sintética 22', 'Fato sintético para o painel.',
                    'SEGURANCA', ?, 'NAO_INFORMADO', 'ONGOING', 3, 'Rio de Janeiro', 'Centro', 'POINT',
                    ST_SetSRID(ST_MakePoint(-43.19, -22.90), 4326)::GEOGRAPHY,
                    ?, NULL, NULL, 'PUBLISHED', 1)
                """, id, type, Timestamp.from(now.minusSeconds(86400)));
        UUID author = jdbc.queryForObject("SELECT id FROM local_accounts WHERE role='ADMIN' LIMIT 1", UUID.class);
        if (confirmedAt == null) {
            return;
        }
        jdbc.update("""
                INSERT INTO occurrence_verifications (occurrence_id, verification_version, effect_version,
                    previous_situation, situation, evidence, confirmed_at, recorded_at, expires_at,
                    author_id, actor_role)
                VALUES (?, 1, 1, 'ONGOING', 'ONGOING', 'Evidência sintética do teste 22', ?, ?, ?, ?, 'ADMIN')
                """, id, Timestamp.from(confirmedAt), Timestamp.from(confirmedAt), Timestamp.from(expiresAt),
                author);
    }

    private void insertRun(JdbcTemplate jdbc, String state, String errorClass, Instant startedAt, Instant finishedAt) {
        jdbc.update("""
                INSERT INTO collection_runs (id, source_id, kind, window_start, window_end, next_page, take, max_pages,
                    pages_done, items_seen, items_created, items_duplicated, state, error_class, started_at, finished_at,
                    updated_at)
                VALUES (?, ?, 'RECENT', DATE '2026-06-01', DATE '2026-10-22', 2, 100, 20, 1, 0, 0, 0, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), SOURCE_ID, state, errorClass, Timestamp.from(startedAt),
                Timestamp.from(finishedAt), Timestamp.from(finishedAt));
    }

    private HttpResponse<String> request(ConfigurableApplicationContext app, String method, String path,
            Map<String, ?> body, CookieSession session) throws Exception {
        int port = ((WebServerApplicationContext) app).getWebServer().getPort();
        var builder = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/v1/" + path))
                .timeout(Duration.ofSeconds(20)).header("Accept", "application/json");
        if (body != null) {
            builder.header("Content-Type", "application/json");
        }
        if (session != null) {
            builder.header("Cookie", session.cookie()).header("X-CSRF-Token", session.csrf());
        }
        builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)));
        return http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private CookieSession adminSession(ConfigurableApplicationContext app) throws Exception {
        return adminSession(app, ADMIN_EMAIL);
    }

    private CookieSession adminSession(ConfigurableApplicationContext app, String email) throws Exception {
        UUID id = UUID.randomUUID();
        Timestamp now = Timestamp.from(Instant.now());
        app.getBean(JdbcTemplate.class).update("""
                INSERT INTO local_accounts (id, display_name, email, password_hash, role, status,
                    created_at, confirmed_at, last_sent_at, resend_window_start)
                VALUES (?, 'Administrador sintético 22', ?, ?, 'ADMIN', 'CONFIRMED', ?, ?, ?, ?)
                """, id, email, app.getBean(AccountPassword.class).derive(ADMIN_PASSWORD), now, now, now, now);
        var partial = login(app, email, ADMIN_PASSWORD);
        assertEquals(200, partial.response().statusCode());
        var enrolled = request(app, "POST", "auth/mfa/enrollment", Map.of(), partial.session());
        assertEquals(200, enrolled.statusCode());
        String encrypted = app.getBean(JdbcTemplate.class).queryForObject(
                "SELECT mfa_secret FROM local_accounts WHERE id=?", String.class, id);
        byte[] secret = app.getBean(MfaVault.class).decrypt(encrypted, id);
        var verified = request(app, "POST", "auth/mfa/verification",
                Map.of("code", Totp.code(secret, Instant.now().getEpochSecond() / 30)), partial.session());
        assertEquals(200, verified.statusCode());
        return session(verified);
    }

    private CookieSession userSession(ConfigurableApplicationContext app) throws Exception {
        UUID id = UUID.randomUUID();
        Timestamp now = Timestamp.from(Instant.now());
        app.getBean(JdbcTemplate.class).update("""
                INSERT INTO local_accounts (id, display_name, email, password_hash, role, status,
                    created_at, confirmed_at, last_sent_at, resend_window_start)
                VALUES (?, 'Usuário sintético 22', ?, ?, 'USER', 'CONFIRMED', ?, ?, ?, ?)
                """, id, USER_EMAIL, app.getBean(AccountPassword.class).derive(USER_PASSWORD), now, now, now, now);
        var login = login(app, USER_EMAIL, USER_PASSWORD);
        assertEquals(200, login.response().statusCode());
        return login.session();
    }

    private LoginResult login(ConfigurableApplicationContext app, String email, String password) throws Exception {
        var response = request(app, "POST", "auth/login", Map.of("email", email, "password", password), null);
        return new LoginResult(response, session(response));
    }

    private static CookieSession session(HttpResponse<String> response) throws Exception {
        String cookie = response.headers().firstValue("set-cookie").orElseThrow().split(";", 2)[0];
        String csrf = JSON.readTree(response.body()).path("csrfToken").asString();
        return new CookieSession(cookie, csrf);
    }

    private static List<String> strings(JsonNode array) {
        var values = new ArrayList<String>();
        array.forEach(node -> values.add(node.asString()));
        return values;
    }

    private record CookieSession(String cookie, String csrf) {}
    private record LoginResult(HttpResponse<String> response, CookieSession session) {}
}
