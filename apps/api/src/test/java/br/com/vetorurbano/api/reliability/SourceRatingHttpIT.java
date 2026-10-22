package br.com.vetorurbano.api.reliability;

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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
 * Ticket 24 com PostgreSQL/PostGIS real: amostra insuficiente não muda nem rebaixa a fonte, erro do
 * sistema fica fora da amostra, correção pela fonte neutraliza a incorreta, a mudança vira nova
 * versão da fonte com sinalização de ocorrências sem tocar nas notas antigas, e o histórico de
 * verificações e decisões é imutável.
 */
@Testcontainers
class SourceRatingHttpIT {
    private static final DockerImageName POSTGIS_IMAGE = DockerImageName.parse("postgis/postgis:17-3.5")
            .asCompatibleSubstituteFor("postgres");
    @Container private static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>(POSTGIS_IMAGE)
            .withDatabaseName("vetor_urbano_source_rating_test").withUsername("vetor_source_rating_test")
            .withPassword("vetor_source_rating_test");

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String ADMIN_PASSWORD = "Frase Sintética de admin 24";
    private static final String USER_PASSWORD = "Frase Sintética de usuario 24";

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private Path key;

    private ConfigurableApplicationContext startApi() throws Exception {
        key = Files.createTempDirectory("vu24-mfa").resolve("mfa.key");
        return new SpringApplicationBuilder(br.com.vetorurbano.api.VetorUrbanoApiApplication.class)
                .profiles("local").run("--server.address=127.0.0.1", "--server.port=0",
                        "--vetor.accounts.enabled=true", "--vetor.accounts.mailbox-port=0",
                        "--vetor.auth.key-file=" + key, "--spring.datasource.url=" + DB.getJdbcUrl(),
                        "--spring.datasource.username=" + DB.getUsername(),
                        "--spring.datasource.password=" + DB.getPassword(),
                        "--vetor.collection.poll-seconds=86400");
    }

    @Test
    void insufficientSampleNeverChangesOrLowersTheRating() throws Exception {
        try (var app = startApi()) {
            var admin = adminSession(app);
            String source = createSource(admin, app, "Fonte com amostra curta 24", 4);
            for (int index = 0; index < 3; index++) {
                record(admin, app, source, "afirmacao-" + index, "DISPROVEN");
            }
            record(admin, app, source, "afirmacao-erro", "SYSTEM_ERROR");

            var recommendation = JSON.readTree(request(app, "GET",
                    "admin/source-ratings/" + source + "/recommendation", null, admin).body());
            assertEquals("INSUFFICIENT_SAMPLE", recommendation.path("recommendation").asString());
            assertEquals(3, recommendation.path("sample").path("applicable").asInt(),
                    "erro do sistema não entra na amostra aplicável");
            assertEquals(1, recommendation.path("sample").path("systemErrors").asInt());
            assertFalse(recommendation.path("canChange").asBoolean());
            assertTrue(recommendation.path("limitations").asString().contains("não rebaixa"));

            var refused = request(app, "POST", "admin/source-ratings/" + source + "/decisions",
                    Map.of("decision", "APPROVED", "justification", "Tentativa de rebaixar com amostra curta sintética"),
                    admin);
            assertEquals(409, refused.statusCode(), refused.body());
            assertEquals(4, currentRating(app, admin, source), "amostra insuficiente não altera a nota");
        }
    }

    @Test
    void downgradeBecomesNewVersionFlagsOccurrencesAndKeepsOldNotes() throws Exception {
        try (var app = startApi()) {
            var admin = adminSession(app);
            var jdbc = app.getBean(JdbcTemplate.class);
            String source = createSource(admin, app, "Fonte com incorretas 24", 4);
            String occurrence = publishedOccurrenceLinkedTo(jdbc, source, 4);
            for (int index = 0; index < 4; index++) {
                record(admin, app, source, "incorreta-" + index, "DISPROVEN");
            }
            for (int index = 0; index < 5; index++) {
                record(admin, app, source, "confirmada-" + index, "CONFIRMED");
            }
            record(admin, app, source, "inconclusiva-0", "INCONCLUSIVE");
            record(admin, app, source, "erro-sistema", "SYSTEM_ERROR");

            var recommendation = JSON.readTree(request(app, "GET",
                    "admin/source-ratings/" + source + "/recommendation", null, admin).body());
            assertEquals("DOWNGRADE", recommendation.path("recommendation").asString());
            assertTrue(recommendation.path("canChange").asBoolean());
            assertEquals(10, recommendation.path("sample").path("applicable").asInt());

            var decided = request(app, "POST", "admin/source-ratings/" + source + "/decisions",
                    Map.of("decision", "APPROVED",
                            "justification", "Quatro de dez afirmações demonstraram-se incorretas na janela."),
                    admin);
            assertEquals(200, decided.statusCode(), decided.body());
            var body = JSON.readTree(decided.body());
            assertEquals(4, body.path("previousRating").asInt());
            assertEquals(3, body.path("appliedRating").asInt());
            assertEquals(1, body.path("flaggedOccurrences").asInt());
            assertEquals(3, currentRating(app, admin, source), "a fonte recebe nova versão com a nota decidida");
            assertEquals(2, jdbc.queryForObject("SELECT current_version FROM sources WHERE id=?", Integer.class,
                    source));
            assertEquals(4, jdbc.queryForObject("SELECT reliability_score::int FROM occurrences WHERE id=?",
                    Integer.class, occurrence), "a nota da ocorrência não é trocada em silêncio");
            assertEquals("DOWNGRADE", jdbc.queryForObject(
                    "SELECT recommendation FROM source_rating_decisions WHERE source_id=?", String.class, source));

            var flags = JSON.readTree(request(app, "GET", "admin/source-ratings/" + source + "/flags", null, admin)
                    .body());
            assertEquals(1, flags.path("items").size());
            assertEquals(occurrence, flags.path("items").get(0).path("occurrence_id").asString());
            long flagId = flags.path("items").get(0).path("id").asLong();
            assertEquals(200, request(app, "POST", "admin/source-ratings/flags/" + flagId + "/resolution", Map.of(),
                    admin).statusCode());
            assertEquals(409, request(app, "POST", "admin/source-ratings/flags/" + flagId + "/resolution", Map.of(),
                    admin).statusCode(), "sinal resolvido não é reescrito");
        }
    }

    @Test
    void systemErrorAndCorrectionByTheSourceDoNotCountAgainstIt() throws Exception {
        try (var app = startApi()) {
            var admin = adminSession(app);
            var jdbc = app.getBean(JdbcTemplate.class);
            String source = createSource(admin, app, "Fonte corrigida 24", 3);
            record(admin, app, source, "corrigida-0", "DISPROVEN");
            record(admin, app, source, "corrigida-0", "CORRECTED_BY_SOURCE");
            for (int index = 0; index < 19; index++) {
                record(admin, app, source, "confirmada-" + index, "CONFIRMED");
            }
            record(admin, app, source, "erro-1", "SYSTEM_ERROR");
            record(admin, app, source, "erro-2", "SYSTEM_ERROR");

            var recommendation = JSON.readTree(request(app, "GET",
                    "admin/source-ratings/" + source + "/recommendation", null, admin).body());
            assertEquals(0, recommendation.path("sample").path("disproven").asInt(),
                    "correção pela fonte neutraliza a incorreta anterior; erro do sistema não conta");
            assertEquals(20, recommendation.path("sample").path("applicable").asInt());
            assertEquals("UPGRADE", recommendation.path("recommendation").asString());

            var decided = request(app, "POST", "admin/source-ratings/" + source + "/decisions",
                    Map.of("decision", "APPROVED",
                            "justification", "Vinte verificações aplicáveis na janela sem nenhuma incorreta."), admin);
            assertEquals(200, decided.statusCode(), decided.body());
            assertEquals(4, currentRating(app, admin, source));

            var immutableVerification = assertThrows(Exception.class, () -> jdbc.update(
                    "UPDATE source_statement_verifications SET result='DISPROVEN' WHERE source_id=?", source));
            assertTrue(String.valueOf(immutableVerification.getMessage()).contains("immutable"),
                    immutableVerification.getMessage());
            var immutableDecision = assertThrows(Exception.class, () -> jdbc.update(
                    "DELETE FROM source_rating_decisions WHERE source_id=?", source));
            assertTrue(String.valueOf(immutableDecision.getMessage()).contains("immutable"),
                    immutableDecision.getMessage());
        }
    }

    // --- fixtures ---

    private String createSource(CookieSession admin, ConfigurableApplicationContext app, String name, int rating)
            throws Exception {
        var body = new LinkedHashMap<String, Object>();
        body.put("name", name);
        body.put("channel", "Canal sintético 24");
        body.put("url", "https://example.test/" + UUID.randomUUID());
        body.put("territories", List.of("Rio de Janeiro"));
        body.put("pillars", List.of("TRANSITO", "CONTINGENCIA"));
        body.put("accessMethod", "MANUAL");
        body.put("rating", rating);
        body.put("ratingJustification", "Avaliação inteiramente sintética da fonte para o teste 24.");
        var response = request(app, "POST", "admin/sources", body, admin);
        assertEquals(201, response.statusCode(), response.body());
        return JSON.readTree(response.body()).path("id").asString();
    }

    private String publishedOccurrenceLinkedTo(JdbcTemplate jdbc, String sourceId, int note) {
        String occurrence = "vu24-" + UUID.randomUUID();
        String happening = "vu24-happening-" + UUID.randomUUID();
        String clipping = "vu24-clipping-" + UUID.randomUUID();
        jdbc.update("INSERT INTO happenings (id, title, description) VALUES (?, ?, ?)", happening,
                "Ocorrência associada à fonte 24", "Contexto sintético do teste 24");
        jdbc.update("""
                INSERT INTO occurrences (id, happening_id, title, description, category, occurrence_type, subtype,
                    situation, reliability_score, municipality, neighborhood, location_precision, occurred_at,
                    publication_status)
                VALUES (?, ?, 'Ocorrência vinculada à fonte 24', 'Descrição sintética sustentada', 'TRANSITO',
                    'ACIDENTE', 'COLISAO', 'UNKNOWN', ?, 'Rio de Janeiro', 'Centro', 'TERRITORY',
                    TIMESTAMPTZ '2026-10-12 12:00:00Z', 'PUBLISHED')
                """, occurrence, happening, note);
        jdbc.update("""
                INSERT INTO clippings (id, source_id, title, reference, source_published_at, collected_at)
                VALUES (?, ?, 'Clipping vinculado à fonte 24', ?, ?, now())
                """, clipping, sourceId, "vu24-ref-" + clipping,
                Timestamp.from(Instant.parse("2026-10-12T11:00:00Z")));
        jdbc.update("INSERT INTO occurrence_clippings (occurrence_id, clipping_id) VALUES (?, ?)", occurrence,
                clipping);
        return occurrence;
    }

    private void record(CookieSession admin, ConfigurableApplicationContext app, String sourceId, String key,
            String result) throws Exception {
        var response = request(app, "POST", "admin/source-ratings/" + sourceId + "/verifications",
                Map.of("statementKey", key, "statementExcerpt", "Afirmação sintética " + key, "result", result,
                        "note", "Verificação sintética do teste 24."),
                admin);
        assertEquals(200, response.statusCode(), response.body());
    }

    private int currentRating(ConfigurableApplicationContext app, CookieSession admin, String sourceId)
            throws Exception {
        return JSON.readTree(request(app, "GET", "admin/sources/" + sourceId, null, admin).body())
                .path("rating").asInt();
    }

    // --- sessão e HTTP ---

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
        UUID id = UUID.randomUUID();
        Timestamp now = Timestamp.from(Instant.now());
        String email = "admin24-" + id + "@example.test";
        app.getBean(JdbcTemplate.class).update("""
                INSERT INTO local_accounts (id, display_name, email, password_hash, role, status,
                    created_at, confirmed_at, last_sent_at, resend_window_start)
                VALUES (?, 'Administrador sintético 24', ?, ?, 'ADMIN', 'CONFIRMED', ?, ?, ?, ?)
                """, id, email, app.getBean(AccountPassword.class).derive(ADMIN_PASSWORD), now, now, now, now);
        var partial = login(app, email, ADMIN_PASSWORD);
        assertEquals(200, partial.response().statusCode());
        assertEquals(200, request(app, "POST", "auth/mfa/enrollment", Map.of(), partial.session()).statusCode());
        String encrypted = app.getBean(JdbcTemplate.class).queryForObject(
                "SELECT mfa_secret FROM local_accounts WHERE id=?", String.class, id);
        byte[] secret = app.getBean(MfaVault.class).decrypt(encrypted, id);
        var verified = request(app, "POST", "auth/mfa/verification",
                Map.of("code", Totp.code(secret, Instant.now().getEpochSecond() / 30)), partial.session());
        assertEquals(200, verified.statusCode());
        return session(verified);
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

    private record CookieSession(String cookie, String csrf) {}
    private record LoginResult(HttpResponse<String> response, CookieSession session) {}
}
