package br.com.vetorurbano.api.collection;

import static org.junit.jupiter.api.Assertions.*;

import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.*;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.server.context.WebServerApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;
import br.com.vetorurbano.api.accounts.AccountPassword;
import br.com.vetorurbano.api.auth.MfaVault;
import br.com.vetorurbano.api.auth.Totp;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Integração HTTP com PostgreSQL/PostGIS real. O provedor externo é substituído <b>no limite HTTP</b>
 * ({@link StubFogoCruzado}): um servidor local responde a forma observada da fonte, então migração,
 * paginação, cursor, idempotência, handoff à fila, autorização e minimização são exercitados de ponta
 * a ponta. Nenhuma chamada à fonte real acontece aqui.
 */
@Testcontainers
class CollectionHttpIT {
    private static final DockerImageName POSTGIS_IMAGE = DockerImageName.parse("postgis/postgis:17-3.5")
            .asCompatibleSubstituteFor("postgres");
    @Container private static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>(POSTGIS_IMAGE)
            .withDatabaseName("vetor_urbano_collection_test")
            .withUsername("vetor_collection_test")
            .withPassword("vetor_collection_test");

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String ADMIN_EMAIL = "admin20@example.test";
    private static final String ADMIN_PASSWORD = "Frase Sintética de admin 20";
    private static final String USER_EMAIL = "usuario20@example.test";
    private static final String USER_PASSWORD = "Frase Sintética de usuario 20";
    /** Valor sintético reconhecível: não pode aparecer em resposta, log nem banco da coleta. */
    private static final String SYNTHETIC_SECRET = "SEGREDO-SINTETICO-NAO-EXPOR-20";
    private static final String SOURCE_ID = "fogo-cruzado";

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private Path key;
    private Path credentials;

    @BeforeEach
    void prepare() throws Exception {
        key = Files.createTempDirectory("vu20-mfa").resolve("mfa.key");
        credentials = Files.createTempDirectory("vu20-credentials").resolve("fogo-cruzado.env");
        Files.writeString(credentials, "VETOR_FOGO_CRUZADO_EMAIL=" + ADMIN_EMAIL + "\n"
                + "VETOR_FOGO_CRUZADO_PASSWORD=" + SYNTHETIC_SECRET + "\n");
        try (var app = startApi(false)) {
            app.getBean(JdbcTemplate.class).execute(RESET_SQL);
        }
    }

    @AfterEach
    void cleanup() throws Exception {
        Files.deleteIfExists(credentials);
        Files.deleteIfExists(credentials.getParent());
        Files.deleteIfExists(key);
        Files.deleteIfExists(key.getParent());
    }

    private static final String RESET_SQL = """
            TRUNCATE collection_run_events,collection_items,collection_runs,collection_sources,
                occurrence_verifications,territorial_audit_events,territorial_approvals,territorial_versions,
                territorial_identities,correction_editor_audit,occurrence_editor_preparations,
                clipping_review_decisions,publication_versions,clipping_reviews,correction_decisions,
                correction_requests,correction_area_targets,occurrence_clippings,clippings,
                auth_audit_events,local_sessions,auth_request_limits,account_email_change_tokens,
                account_recovery_tokens,account_audit_events,account_confirmation_tokens,
                account_request_limits,source_audit_events,source_versions,source_access_configurations,
                historical_actors,local_accounts RESTART IDENTITY
            """;

    private ConfigurableApplicationContext startApi(boolean collectionEnabled, String... extra) {
        var args = new ArrayList<>(List.of("--server.address=127.0.0.1", "--server.port=0",
                "--vetor.accounts.enabled=true", "--vetor.accounts.mailbox-port=0", "--vetor.auth.key-file=" + key,
                "--spring.datasource.url=" + DB.getJdbcUrl() + "&socketTimeout=2",
                "--spring.datasource.hikari.connection-timeout=1500",
                "--spring.datasource.username=" + DB.getUsername(),
                "--spring.datasource.password=" + DB.getPassword(),
                "--vetor.collection.poll-seconds=86400",
                "--vetor.collection.page-size=2",
                "--vetor.collection.max-pages=200"));
        if (collectionEnabled) {
            args.add("--vetor.collection.enabled=true");
            args.add("--vetor.collection.credentials-file=" + credentials);
        }
        // Extras vêm por último para poderem sobrescrever os padrões acima.
        args.addAll(List.of(extra));
        return new SpringApplicationBuilder(br.com.vetorurbano.api.VetorUrbanoApiApplication.class)
                .profiles("local").run(args.toArray(String[]::new));
    }

    // ---------------------------------------------------------------- A: coleta completa

    @Test
    void collectsAuthorisedItemsIntoTheReviewQueueWithoutPublishingAndWithoutLeakingAnything() throws Exception {
        try (var stub = new StubFogoCruzado(ADMIN_EMAIL, SYNTHETIC_SECRET)) {
            stub.cityNames = metropolitanCityNames();
            stub.occurrences = List.of(
                    StubFogoCruzado.occurrence(70001, "Rio de Janeiro", "COMPLEXO DO ALEMAO",
                            "2026-06-01T06:30:00.000Z", false, false, List.of("Dead", "Wounded"),
                            List.of("Civilian", "Civilian")),
                    StubFogoCruzado.occurrence(70002, "Rio de Janeiro", "COMPLEXO DO ALEMAO",
                            "2026-06-02T06:30:00.000Z", true, true, List.of("Dead"), List.of("Agent")),
                    StubFogoCruzado.occurrence(70003, "Niterói", "CENTRO",
                            "2026-06-03T06:30:00.000Z", false, false, List.of("Wounded"), List.of("Civilian")));

            var captured = new ArrayList<String>();
            var logs = attachLogCapture();
            try (var app = startApi(true, "--vetor.collection.source-base-url=" + stub.baseUrl())) {
                assertCollectionSchema(app);
                var admin = adminSession(app);

                assertEquals(401, request(app, "GET", "admin/collections", null, null, true).statusCode());
                assertEquals(401, request(app, "POST", "admin/collections/runs", Map.of(), null, true).statusCode());

                var before = request(app, "GET", "admin/collections", null, admin, true);
                assertEquals(200, before.statusCode());
                captured.add(before.body());
                var beforeBody = JSON.readTree(before.body());
                assertTrue(beforeBody.path("configured").asBoolean());
                assertNull(beforeBody.path("state").isNull() ? null : beforeBody.path("state").asString());
                var ficha = beforeBody.path("ficha");
                assertEquals("Instituto Fogo Cruzado", ficha.path("credit").asString());
                assertEquals("Fonte: Instituto Fogo Cruzado", ficha.path("attribution").asString());
                assertTrue(ficha.path("license").asString().contains("uso livre declarado pela fonte"));
                assertTrue(ficha.path("license").asString().contains("atribuição obrigatória"));
                assertEquals("2026-10-19", ficha.path("obtainedAt").asString());
                assertEquals("https://api.fogocruzado.org.br/docs", ficha.path("documentationUrl").asString());
                assertTrue(ficha.path("limitations").asString().contains("sem SLA"));
                // Contrapartida do termo: atribuição exigida também no estado da coleta.
                assertEquals("Fonte: Instituto Fogo Cruzado", beforeBody.path("attribution").asString());

                var started = request(app, "POST", "admin/collections/runs",
                        Map.of("kind", "BACKFILL", "from", "2026-06-01", "to", "2026-10-19"), admin, true);
                assertEquals(202, started.statusCode());
                captured.add(started.body());
                String runId = JSON.readTree(started.body()).path("id").asString();

                var finished = waitForRun(app, admin, runId, "SUCCEEDED_NEW_ITEMS");
                captured.add(finished.toString());
                assertEquals("BACKFILL", finished.path("kind").asString());
                assertEquals(2, finished.path("pagesDone").asInt());
                assertEquals(3, finished.path("itemsSeen").asInt());
                assertEquals(3, finished.path("itemsCreated").asInt());
                assertEquals(0, finished.path("itemsDuplicated").asInt());
                assertEquals(List.of("Petrópolis"), jsonStrings(finished.path("municipalitiesMissing")));

                var jdbc = app.getBean(JdbcTemplate.class);
                assertEquals(3, jdbc.queryForObject("SELECT count(*) FROM clippings WHERE source_id=?", Integer.class, SOURCE_ID));
                assertEquals(3, jdbc.queryForObject("SELECT count(*) FROM clipping_reviews WHERE state='PENDING'", Integer.class));
                assertEquals(3, jdbc.queryForObject("SELECT count(*) FROM collection_items WHERE source_id=?", Integer.class, SOURCE_ID));
                assertEquals(Set.of(SOURCE_ID + ":70001", SOURCE_ID + ":70002", SOURCE_ID + ":70003"),
                        new HashSet<>(jdbc.queryForList("SELECT reference FROM clippings WHERE source_id=?", String.class, SOURCE_ID)));
                // Nada é publicado: as ocorrências sintéticas da V1 permanecem as únicas.
                assertEquals(4, jdbc.queryForObject("SELECT count(*) FROM occurrences WHERE publication_status='PUBLISHED'", Integer.class));
                assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM occurrences WHERE publication_status='PENDING'", Integer.class));
                // Ficha de procedência antes de qualquer coleta real.
                String provenance = jdbc.queryForObject("SELECT provenance::text FROM sources WHERE id=?", String.class, SOURCE_ID);
                assertNotNull(provenance);
                assertTrue(provenance.contains("Instituto Fogo Cruzado"));
                assertTrue(provenance.contains("2026-10-19"));
                assertTrue(provenance.contains("https://api.fogocruzado.org.br/docs"));

                var state = request(app, "GET", "admin/collections", null, admin, true);
                captured.add(state.body());
                var stateBody = JSON.readTree(state.body());
                assertEquals("SUCCEEDED_NEW_ITEMS", stateBody.path("state").asString());
                assertEquals(1792409188L, stateBody.path("source").path("upstreamLastUpdateTimestamp").asLong());
                assertEquals(Instant.parse("2026-10-19T14:26:28Z"),
                        Instant.parse(stateBody.path("source").path("upstreamLastUpdate").asString()));
                assertEquals(3, stateBody.path("counters").path("itemsCreated").asInt());

                var history = request(app, "GET", "admin/collections/runs", null, admin, true);
                captured.add(history.body());
                assertEquals(1, JSON.readTree(history.body()).path("items").size());

                // A fila de revisão recebe a origem «Fogo Cruzado» com a referência da fonte.
                var queue = request(app, "GET", "admin/review-clippings", null, admin, true);
                assertEquals(200, queue.statusCode());
                captured.add(queue.body());
                var queueBody = JSON.readTree(queue.body());
                assertEquals(3, queueBody.path("items").size());
                for (var item : queueBody.path("items")) {
                    assertEquals("PENDING", item.path("state").asString());
                    assertEquals(SOURCE_ID, item.path("source_id").asString());
                    assertTrue(item.path("reference").asString().startsWith(SOURCE_ID + ":"));
                    // Atribuição exigida pela fonte no item devolvido à fila.
                    assertEquals("Fonte: Instituto Fogo Cruzado",
                            item.path("extracted").path("sourceAttribution").asString());
                    assertEquals("Instituto Fogo Cruzado", item.path("extracted").path("sourceCredit").asString());
                }
                var high = new ArrayList<JsonNode>();
                queueBody.path("items").forEach(item -> { if (item.path("priority").asString().equals("HIGH")) high.add(item); });
                assertEquals(1, high.size());
                assertEquals("OPERACAO_POLICIAL", high.getFirst().path("extracted").path("type").asString());

                // JSON sem credencial, sem token e sem atributo pessoal de vítima.
                String jsonResponses = String.join("\n", captured);
                assertNoSecret(jsonResponses);
                for (String forbidden : List.of("Adulto", "Masculino", "corporação sintética", "unidade sintética",
                        "partido sintético", "logradouro sintético", "serviceStatus", "coorporation"))
                    assertFalse(jsonResponses.contains(forbidden), "JSON expôs atributo pessoal: " + forbidden);
                assertNoSecret(String.join("\n", logLines(logs)));

                // A extração persistida também é minimizada.
                String extracted = jdbc.queryForObject("SELECT string_agg(extracted::text,' ') FROM clipping_reviews", String.class);
                assertNotNull(extracted);
                for (String forbidden : List.of("Adulto", "Masculino", "corporação sintética", "unidade sintética", "partido sintético"))
                    assertFalse(extracted.contains(forbidden));
                // A trilha append-only não guarda segredo.
                String events = jdbc.queryForObject("SELECT coalesce(string_agg(coalesce(detail::text,'')||' '||event,' '),'') FROM collection_run_events", String.class);
                assertFalse(events.contains(SYNTHETIC_SECRET));
                assertFalse(events.contains("stub-token-"));
            } finally {
                detachLogCapture(logs);
            }
        }
    }

    // ---------------------------------------------------------------- B: falha parcial, retomada e idempotência

    @Test
    void partialFailurePreservesResumptionAndReprocessingNeverDuplicates() throws Exception {
        try (var stub = new StubFogoCruzado(ADMIN_EMAIL, SYNTHETIC_SECRET)) {
            stub.cityNames = metropolitanCityNames();
            stub.occurrences = threeOccurrences();
            stub.pageStatuses.put(2, 500);

            try (var app = startApi(true, "--vetor.collection.source-base-url=" + stub.baseUrl())) {
                var admin = adminSession(app);
                var started = request(app, "POST", "admin/collections/runs", Map.of("kind", "RECENT"), admin, true);
                assertEquals(202, started.statusCode());
                String runId = JSON.readTree(started.body()).path("id").asString();

                var partial = waitForRun(app, admin, runId, "PARTIAL");
                assertEquals("UPSTREAM_UNAVAILABLE", partial.path("errorClass").asString());
                assertEquals(1, partial.path("pagesDone").asInt());
                assertEquals(2, partial.path("nextPage").asInt());
                assertEquals(2, partial.path("itemsCreated").asInt());

                var jdbc = app.getBean(JdbcTemplate.class);
                assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM clippings WHERE source_id=?", Integer.class, SOURCE_ID));
                assertEquals("UPSTREAM_UNAVAILABLE", jdbc.queryForObject(
                        "SELECT last_error_class FROM collection_sources WHERE source_id=?", String.class, SOURCE_ID));
                // Falha não vira zero nem apaga o que já foi encaminhado.
                assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM occurrences WHERE publication_status='PENDING'", Integer.class) - 1);

                stub.pageStatuses.clear();
                assertEquals(200, request(app, "POST", "admin/collections/runs/" + runId + "/resume", Map.of(), admin, true).statusCode());
                var resumed = waitForRun(app, admin, runId, "SUCCEEDED_NEW_ITEMS");
                assertEquals(2, resumed.path("pagesDone").asInt());
                assertEquals(3, resumed.path("itemsCreated").asInt());

                // Reprocessar a mesma publicação não duplica clipping nem review.
                var second = request(app, "POST", "admin/collections/runs", Map.of("kind", "RECENT"), admin, true);
                String secondId = JSON.readTree(second.body()).path("id").asString();
                var repeated = waitForRun(app, admin, secondId, "SUCCEEDED_NO_CHANGES");
                assertEquals(0, repeated.path("itemsCreated").asInt());
                assertEquals(3, repeated.path("itemsDuplicated").asInt());
                assertEquals(3, jdbc.queryForObject("SELECT count(*) FROM clippings WHERE source_id=?", Integer.class, SOURCE_ID));
                assertEquals(3, jdbc.queryForObject("SELECT count(*) FROM clipping_reviews", Integer.class));
                assertEquals(3, jdbc.queryForObject("SELECT count(*) FROM collection_items WHERE source_id=?", Integer.class, SOURCE_ID));

                // Mesmo município e mesmo bairro com referências distintas: dois itens, sem fusão.
                var references = jdbc.queryForList(
                        "SELECT reference FROM clippings WHERE source_id=? AND reference LIKE ? ORDER BY reference",
                        String.class, SOURCE_ID, "%70001%");
                assertEquals(List.of(SOURCE_ID + ":70001"), references);
                assertEquals(2, jdbc.queryForObject("""
                        SELECT count(*) FROM clippings c JOIN sources s ON s.id=c.source_id
                        WHERE c.source_id=? AND c.reference IN (?,?)
                        """, Integer.class, SOURCE_ID, SOURCE_ID + ":70001", SOURCE_ID + ":70002"));
            }
        }
    }

    // ---------------------------------------------------------------- C: pausa e retomada

    @Test
    void pauseStopsAtTheCursorAndResumeContinuesFromIt() throws Exception {
        try (var stub = new StubFogoCruzado(ADMIN_EMAIL, SYNTHETIC_SECRET)) {
            stub.cityNames = metropolitanCityNames();
            stub.occurrences = threeOccurrences();
            stub.holdPage = 2;
            stub.holdLatch = new CountDownLatch(1);

            try (var app = startApi(true, "--vetor.collection.source-base-url=" + stub.baseUrl())) {
                var admin = adminSession(app);
                var started = request(app, "POST", "admin/collections/runs", Map.of("kind", "RECENT"), admin, true);
                assertEquals(202, started.statusCode());
                String runId = JSON.readTree(started.body()).path("id").asString();
                awaitPageRequest(stub, 2);

                var paused = new AtomicReference<HttpResponse<String>>();
                var pausing = Thread.ofVirtual().start(() -> {
                    try {
                        paused.set(request(app, "POST", "admin/collections/runs/" + runId + "/pause", Map.of(), admin, true));
                    } catch (Exception failure) {
                        throw new IllegalStateException(failure);
                    }
                });
                Thread.sleep(300);
                stub.releasePage();
                pausing.join(Duration.ofSeconds(30));

                assertEquals(200, paused.get().statusCode());
                var pausedBody = JSON.readTree(paused.get().body());
                assertEquals("PAUSED", pausedBody.path("state").asString());
                assertEquals(2, pausedBody.path("pagesDone").asInt());
                assertEquals(3, pausedBody.path("nextPage").asInt());

                var state = request(app, "GET", "admin/collections", null, admin, true);
                assertEquals("PAUSED", JSON.readTree(state.body()).path("state").asString());
                assertNull(JSON.readTree(state.body()).path("source").path("lastErrorClass").isNull()
                        ? null : JSON.readTree(state.body()).path("source").path("lastErrorClass").asString());

                var resumed = request(app, "POST", "admin/collections/runs/" + runId + "/resume", Map.of(), admin, true);
                assertEquals(200, resumed.statusCode());
                var finished = waitForRun(app, admin, runId, "SUCCEEDED_NEW_ITEMS");
                assertEquals(3, finished.path("pagesDone").asInt());
                assertEquals(3, finished.path("itemsCreated").asInt());
                assertEquals(0, finished.path("itemsDuplicated").asInt());
                assertEquals(3, app.getBean(JdbcTemplate.class).queryForObject(
                        "SELECT count(*) FROM clippings WHERE source_id=?", Integer.class, SOURCE_ID));
            }
        }
    }

    // ---------------------------------------------------------------- D: autorização

    @Test
    void requiresAdminWithMfaAndCsrfAndDeniesUser() throws Exception {
        try (var stub = new StubFogoCruzado(ADMIN_EMAIL, SYNTHETIC_SECRET)) {
            stub.cityNames = metropolitanCityNames();
            stub.occurrences = threeOccurrences();
            try (var app = startApi(true, "--vetor.collection.source-base-url=" + stub.baseUrl())) {
                var jdbc = app.getBean(JdbcTemplate.class);
                bootstrapAdmin(app);
                UUID adminId = jdbc.queryForObject("SELECT id FROM local_accounts WHERE role='ADMIN'", UUID.class);
                UUID userId = UUID.randomUUID();
                jdbc.update("""
                        INSERT INTO local_accounts (id, display_name, email, password_hash, role, status,
                            created_at, confirmed_at, last_sent_at, resend_window_start)
                        VALUES (?, 'Pessoa sintética', ?, ?, 'USER', 'CONFIRMED', now(), now(), now(), now())
                        """, userId, USER_EMAIL, app.getBean(AccountPassword.class).derive(USER_PASSWORD));

                var partial = login(app, ADMIN_EMAIL, ADMIN_PASSWORD);
                assertEquals(200, partial.response().statusCode());
                byte[] secret = enroll(app, partial.session(), adminId);
                // ADMIN sem segundo fator não administra a coleta.
                assertEquals(403, request(app, "GET", "admin/collections", null, partial.session(), true).statusCode());
                assertEquals(403, request(app, "POST", "admin/collections/runs", Map.of(), partial.session(), true).statusCode());

                var verified = request(app, "POST", "auth/mfa/verification",
                        Map.of("code", Totp.code(secret, Instant.now().getEpochSecond() / 30)), partial.session(), true);
                assertEquals(200, verified.statusCode());
                var admin = session(verified);

                var user = login(app, USER_EMAIL, USER_PASSWORD).session();
                assertEquals(403, request(app, "GET", "admin/collections", null, user, true).statusCode());
                assertEquals(403, request(app, "GET", "admin/collections/runs", null, user, true).statusCode());
                assertEquals(403, request(app, "POST", "admin/collections/runs", Map.of("kind", "RECENT"), user, true).statusCode());
                assertEquals(403, request(app, "POST", "admin/collections/runs/" + UUID.randomUUID() + "/pause", Map.of(), user, true).statusCode());

                // Escrita exige CSRF.
                var noCsrf = request(app, "POST", "admin/collections/runs", Map.of("kind", "RECENT"), admin, false);
                assertEquals(403, noCsrf.statusCode());
                assertEquals("CSRF_REQUIRED", JSON.readTree(noCsrf.body()).path("code").asString());
                assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM collection_runs", Integer.class));

                // Execução inexistente responde 404 explícito, nunca 200.
                assertEquals(404, request(app, "POST", "admin/collections/runs/" + UUID.randomUUID() + "/resume",
                        Map.of(), admin, true).statusCode());
            }
        }
    }

    // ---------------------------------------------------------------- D2: identidade da fonte, nunca proximidade

    @Test
    void samePlaceWithDistinctReferencesStaysTwoSeparateReviewItemsAndNeverMerges() throws Exception {
        try (var stub = new StubFogoCruzado(ADMIN_EMAIL, SYNTHETIC_SECRET)) {
            stub.cityNames = List.of("Rio de Janeiro");
            var first = StubFogoCruzado.occurrence(70001, "Rio de Janeiro", "COMPLEXO DO ALEMAO",
                    "2026-06-01T06:30:00.000Z", false, false, List.of("Dead"), List.of("Civilian"));
            // A segunda declara um registro relacionado — semelhança declarada pela fonte, não
            // identidade. Mesmo bairro e mesma cidade não podem fundir os dois itens.
            String secondText = StubFogoCruzado.occurrence(70002, "Rio de Janeiro", "COMPLEXO DO ALEMAO",
                    "2026-06-01T06:35:00.000Z", false, false, List.of("Wounded"), List.of("Civilian")).toString();
            String patched = secondText.replace("\"relatedRecord\": \"\"", "\"relatedRecord\": \"70001\"")
                    .replace("\"relatedRecord\":\"\"", "\"relatedRecord\":\"70001\"");
            assertNotEquals(secondText, patched, "o fixture precisa declarar o registro relacionado");
            var second = JSON.readTree(patched);
            stub.occurrences = List.of(first, second);

            try (var app = startApi(true, "--vetor.collection.source-base-url=" + stub.baseUrl())) {
                var admin = adminSession(app);
                var started = request(app, "POST", "admin/collections/runs", Map.of("kind", "RECENT"), admin, true);
                String runId = JSON.readTree(started.body()).path("id").asString();
                var finished = waitForRun(app, admin, runId, "SUCCEEDED_NEW_ITEMS");
                assertEquals(2, finished.path("itemsCreated").asInt());

                var jdbc = app.getBean(JdbcTemplate.class);
                assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM clippings WHERE source_id=?", Integer.class, SOURCE_ID));
                assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM clipping_reviews", Integer.class));
                assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM collection_items WHERE source_id=?", Integer.class, SOURCE_ID));
                // Nada foi fundido nem publicado: a associação é decisão humana, nunca proximidade.
                assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM occurrence_clippings", Integer.class));
                assertEquals(4, jdbc.queryForObject("SELECT count(*) FROM occurrences WHERE publication_status='PUBLISHED'", Integer.class));
                assertEquals(List.of(SOURCE_ID + ":70001", SOURCE_ID + ":70002"), jdbc.queryForList(
                        "SELECT reference FROM clippings WHERE source_id=? ORDER BY reference", String.class, SOURCE_ID));
                assertEquals("70001", jdbc.queryForObject("""
                        SELECT extracted->>'relatedRecord' FROM clipping_reviews r JOIN clippings c ON c.id=r.clipping_id
                        WHERE c.reference=?
                        """, String.class, SOURCE_ID + ":70002"));
            }
        }
    }

    // ---------------------------------------------------------------- E2: vazamento em caminho de erro

    @Test
    void authenticationFailureNeverLeaksTheCredentialInErrorsLogsOrDatabase() throws Exception {
        try (var stub = new StubFogoCruzado(ADMIN_EMAIL, SYNTHETIC_SECRET)) {
            stub.cityNames = metropolitanCityNames();
            stub.occurrences = threeOccurrences();
            stub.rejectLogin = true;
            try (var app = startApi(true, "--vetor.collection.source-base-url=" + stub.baseUrl())) {
                var captured = new ArrayList<String>();
                var logs = attachLogCapture();
                try {
                    var admin = adminSession(app);
                    var started = request(app, "POST", "admin/collections/runs", Map.of("kind", "RECENT"), admin, true);
                    captured.add(started.body());
                    String runId = JSON.readTree(started.body()).path("id").asString();

                    var failed = waitForRun(app, admin, runId, "FAILED");
                    assertEquals("AUTH_FAILED", failed.path("errorClass").asString());
                    captured.add(failed.toString());
                    captured.add(request(app, "GET", "admin/collections", null, admin, true).body());
                    captured.add(request(app, "GET", "admin/collections/runs", null, admin, true).body());
                    captured.add(request(app, "POST", "admin/collections/runs/" + runId + "/resume", Map.of(), admin, true).body());

                    var jdbc = app.getBean(JdbcTemplate.class);
                    assertEquals("AUTH_FAILED", jdbc.queryForObject(
                            "SELECT last_error_class FROM collection_sources WHERE source_id=?", String.class, SOURCE_ID));
                    // Falha de autenticação não cria item e não apaga nada.
                    assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM clippings WHERE source_id=?", Integer.class, SOURCE_ID));
                    assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM collection_items", Integer.class));

                    // Falha de renovação no meio da execução segue o mesmo caminho: 401 em uso.
                    stub.rejectLogin = false;
                    stub.rejectFirstAuthorisedRequest = true;
                    stub.rejectRefresh = true;
                    stub.pageStatuses.clear();
                    var second = request(app, "POST", "admin/collections/runs", Map.of("kind", "RECENT"), admin, true);
                    String secondId = JSON.readTree(second.body()).path("id").asString();
                    var renewedFailure = waitForRun(app, admin, secondId, "FAILED");
                    assertEquals("AUTH_FAILED", renewedFailure.path("errorClass").asString());
                    captured.add(renewedFailure.toString());

                    String recorded = recordedText(jdbc);
                    assertNoSecret(String.join("\n", captured));
                    assertNoSecret(String.join("\n", logLines(logs)));
                    assertNoSecret(recorded);
                } finally {
                    detachLogCapture(logs);
                }
            }
        }
    }

    /** Todo texto gravado pelas tabelas da coleta e pelo cadastro de fontes da fatia. */
    private static String recordedText(JdbcTemplate jdbc) {
        return jdbc.queryForObject("""
                SELECT coalesce(string_agg(content, ' '), '') FROM (
                    SELECT coalesce(state,'')||' '||coalesce(error_class,'')||' '||coalesce(error_detail,'') AS content FROM collection_runs
                    UNION ALL SELECT coalesce(event,'')||' '||coalesce(detail::text,'') FROM collection_run_events
                    UNION ALL SELECT coalesce(public_name,'')||' '||coalesce(provenance::text,'') FROM sources
                    UNION ALL SELECT coalesce(last_error_class,'')||' '||coalesce(upstream_last_update_state_id,'') FROM collection_sources
                    UNION ALL SELECT coalesce(title,'')||' '||coalesce(reference,'') FROM clippings
                    UNION ALL SELECT coalesce(original_text,'')||' '||coalesce(extracted::text,'') FROM clipping_reviews
                ) AS recorded
                """, String.class);
    }

    // ---------------------------------------------------------------- E: não configurado e proteção de borda

    @Test
    void disabledOrUncredentialedCollectionIsNotConfiguredAndNeverAFailureOrEmpty() throws Exception {
        CookieSession admin;
        try (var app = startApi(false)) {
            admin = adminSession(app);
            var state = request(app, "GET", "admin/collections", null, admin, true);
            assertEquals(200, state.statusCode());
            var body = JSON.readTree(state.body());
            assertEquals("NOT_CONFIGURED", body.path("state").asString());
            assertFalse(body.path("configured").asBoolean());
            assertEquals("COLLECTION_DISABLED", body.path("reason").asString());
            assertNull(body.path("lastRun").isNull() ? null : body.path("lastRun").asString());
            var refused = request(app, "POST", "admin/collections/runs", Map.of("kind", "RECENT"), admin, true);
            assertEquals(409, refused.statusCode());
            assertEquals("NOT_CONFIGURED", JSON.readTree(refused.body()).path("code").asString());
            assertEquals(0, app.getBean(JdbcTemplate.class).queryForObject("SELECT count(*) FROM collection_runs", Integer.class));
        }

        try (var app = startApi(true, "--vetor.collection.credentials-file=" + credentials + ".ausente")) {
            // A mesma sessão de ADMIN serve à segunda instância: a sessão vive no banco.
            var body = JSON.readTree(request(app, "GET", "admin/collections", null, admin, true).body());
            assertEquals("NOT_CONFIGURED", body.path("state").asString());
            assertEquals("CREDENTIALS_MISSING", body.path("reason").asString());
        }
    }

    @Test
    void edgeProtectionBlockIsItsOwnClassDistinctFromAuthRateAndServerErrors() throws Exception {
        try (var stub = new StubFogoCruzado(ADMIN_EMAIL, SYNTHETIC_SECRET)) {
            stub.cityNames = metropolitanCityNames();
            stub.occurrences = threeOccurrences();
            try (var app = startApi(true, "--vetor.collection.source-base-url=" + stub.baseUrl(),
                    "--vetor.collection.user-agent=Java-http-client/21")) {
                var admin = adminSession(app);
                var started = request(app, "POST", "admin/collections/runs", Map.of("kind", "RECENT"), admin, true);
                String runId = JSON.readTree(started.body()).path("id").asString();

                var failed = waitForRun(app, admin, runId, "FAILED");
                assertEquals("UPSTREAM_BLOCKED", failed.path("errorClass").asString());
                assertNotEquals("AUTH_FAILED", failed.path("errorClass").asString());
                assertEquals("UPSTREAM_BLOCKED", app.getBean(JdbcTemplate.class).queryForObject(
                        "SELECT last_error_class FROM collection_sources WHERE source_id=?", String.class, SOURCE_ID));
                assertEquals(0, app.getBean(JdbcTemplate.class).queryForObject(
                        "SELECT count(*) FROM clippings WHERE source_id=?", Integer.class, SOURCE_ID));
            }
        }
    }

    // ---------------------------------------------------------------- fixtures

    private static List<JsonNode> threeOccurrences() {
        return List.of(
                StubFogoCruzado.occurrence(70001, "Rio de Janeiro", "COMPLEXO DO ALEMAO",
                        "2026-06-01T06:30:00.000Z", false, false, List.of("Dead"), List.of("Civilian")),
                StubFogoCruzado.occurrence(70002, "Rio de Janeiro", "COMPLEXO DO ALEMAO",
                        "2026-06-02T06:30:00.000Z", true, false, List.of("Wounded"), List.of("Agent")),
                StubFogoCruzado.occurrence(70003, "Niterói", "CENTRO",
                        "2026-06-03T06:30:00.000Z", false, false, List.of("Dead", "Wounded"),
                        List.of("Civilian", "Civilian")));
    }

    /** As 22 do recorte legal menos Petrópolis: a fonte lista 21 cidades do RJ. */
    private static List<String> metropolitanCityNames() {
        return MetropolitanMunicipalities.current().municipalities().stream()
                .filter(name -> !name.equals("Petrópolis")).toList();
    }

    private static List<String> jsonStrings(JsonNode array) {
        List<String> values = new ArrayList<>();
        array.forEach(node -> values.add(node.asString()));
        return values;
    }

    private static void assertNoSecret(String text) {
        assertFalse(text.contains(SYNTHETIC_SECRET), "resposta ou log expôs a credencial");
        assertFalse(text.contains("stub-token-"), "resposta ou log expôs o token da fonte");
    }

    private void assertCollectionSchema(ConfigurableApplicationContext app) {
        var jdbc = app.getBean(JdbcTemplate.class);
        for (String table : List.of("collection_sources", "collection_runs", "collection_run_events", "collection_items")) {
            assertEquals(1, jdbc.queryForObject(
                    "SELECT count(*) FROM information_schema.tables WHERE table_name=?", Integer.class, table),
                    "migração V15 não aplicou " + table);
        }
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM information_schema.columns WHERE table_name='sources' AND column_name='provenance'", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history WHERE version='15'", Integer.class));
    }

    private void awaitPageRequest(StubFogoCruzado stub, int page) throws Exception {
        long deadline = System.nanoTime() + Duration.ofSeconds(20).toNanos();
        while (System.nanoTime() < deadline) {
            synchronized (stub.lastQueries) {
                if (stub.lastQueries.stream().anyMatch(query -> query.contains("page=" + page))) return;
            }
            Thread.sleep(25);
        }
        fail("a página " + page + " não foi solicitada à fonte dentro do prazo");
    }

    // ---------------------------------------------------------------- infraestrutura de teste

    private JsonNode waitForRun(ConfigurableApplicationContext app, CookieSession session, String runId,
            String expectedState) throws Exception {
        long deadline = System.nanoTime() + Duration.ofSeconds(45).toNanos();
        JsonNode last = null;
        while (System.nanoTime() < deadline) {
            var response = request(app, "GET", "admin/collections/runs", null, session, true);
            assertEquals(200, response.statusCode());
            for (var item : JSON.readTree(response.body()).path("items"))
                if (item.path("id").asString().equals(runId)) last = item;
            if (last != null && last.path("state").asString().equals(expectedState)) return last;
            if (last != null && List.of("FAILED", "PARTIAL", "PAUSED", "SUCCEEDED_NO_CHANGES", "SUCCEEDED_NEW_ITEMS")
                    .contains(last.path("state").asString()) && !last.path("state").asString().equals(expectedState))
                fail("execução terminou em " + last.path("state").asString() + " e não em " + expectedState + ": " + last);
            Thread.sleep(50);
        }
        fail("execução " + runId + " não atingiu " + expectedState + " no prazo; último estado: " + last);
        return null;
    }

    private HttpResponse<String> request(ConfigurableApplicationContext app, String method, String path,
            Map<String, ?> body, CookieSession session, boolean withCsrf) throws Exception {
        int port = ((WebServerApplicationContext) app).getWebServer().getPort();
        var builder = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/v1/" + path))
                .timeout(Duration.ofSeconds(20)).header("Accept", "application/json");
        if (body != null) builder.header("Content-Type", "application/json");
        if (session != null) {
            builder.header("Cookie", session.cookie());
            if (withCsrf) builder.header("X-CSRF-Token", session.csrf());
        }
        builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)));
        return http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private CookieSession adminSession(ConfigurableApplicationContext app) throws Exception {
        bootstrapAdmin(app);
        UUID adminId = app.getBean(JdbcTemplate.class).queryForObject("SELECT id FROM local_accounts WHERE role='ADMIN'", UUID.class);
        var partial = login(app, ADMIN_EMAIL, ADMIN_PASSWORD);
        assertEquals(200, partial.response().statusCode());
        byte[] secret = enroll(app, partial.session(), adminId);
        var verified = request(app, "POST", "auth/mfa/verification",
                Map.of("code", Totp.code(secret, Instant.now().getEpochSecond() / 30)), partial.session(), true);
        assertEquals(200, verified.statusCode());
        return session(verified);
    }

    private void bootstrapAdmin(ConfigurableApplicationContext app) {
        UUID id = UUID.randomUUID();
        Timestamp now = Timestamp.from(Instant.now());
        app.getBean(JdbcTemplate.class).update("""
                INSERT INTO local_accounts (id, display_name, email, password_hash, role, status,
                    created_at, confirmed_at, last_sent_at, resend_window_start)
                VALUES (?, 'Administrador sintético', ?, ?, 'ADMIN', 'CONFIRMED', ?, ?, ?, ?)
                """, id, ADMIN_EMAIL, app.getBean(AccountPassword.class).derive(ADMIN_PASSWORD), now, now, now, now);
    }

    private byte[] enroll(ConfigurableApplicationContext app, CookieSession partial, UUID id) throws Exception {
        var response = request(app, "POST", "auth/mfa/enrollment", Map.of(), partial, true);
        assertEquals(200, response.statusCode());
        String encrypted = app.getBean(JdbcTemplate.class).queryForObject(
                "SELECT mfa_secret FROM local_accounts WHERE id=?", String.class, id);
        return app.getBean(MfaVault.class).decrypt(encrypted, id);
    }

    private LoginResult login(ConfigurableApplicationContext app, String email, String password) throws Exception {
        var response = request(app, "POST", "auth/login", Map.of("email", email, "password", password), null, true);
        return new LoginResult(response, session(response));
    }

    private static CookieSession session(HttpResponse<String> response) throws Exception {
        String cookie = response.headers().firstValue("set-cookie").orElseThrow().split(";", 2)[0];
        String csrf = JSON.readTree(response.body()).path("csrfToken").asString();
        return new CookieSession(cookie, csrf);
    }

    private static ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent> attachLogCapture() {
        var root = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
        var appender = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        appender.start();
        root.addAppender(appender);
        return appender;
    }

    private static void detachLogCapture(ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent> appender) {
        var root = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
        root.detachAppender(appender);
    }

    private static List<String> logLines(ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent> appender) {
        List<String> lines = new ArrayList<>();
        for (var event : List.copyOf(appender.list)) lines.add(event.getFormattedMessage());
        return lines;
    }

    private record CookieSession(String cookie, String csrf) {}
    private record LoginResult(HttpResponse<String> response, CookieSession session) {}
}
