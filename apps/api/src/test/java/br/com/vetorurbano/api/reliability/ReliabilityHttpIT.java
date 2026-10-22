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
 * Ticket 23 com PostgreSQL/PostGIS real: a regra v1 usa a maior nota de fonte independente com
 * referência, reprodução conta uma vez pela origem, «não informado» e «não se aplica» têm efeitos
 * distintos, essencial ausente e conflito essencial bloqueiam a publicação da nota, a avaliação se
 * reproduz pela mesma versão e uma nova versão de regra não reescreve a nota histórica.
 */
@Testcontainers
class ReliabilityHttpIT {
    private static final DockerImageName POSTGIS_IMAGE = DockerImageName.parse("postgis/postgis:17-3.5")
            .asCompatibleSubstituteFor("postgres");
    @Container private static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>(POSTGIS_IMAGE)
            .withDatabaseName("vetor_urbano_reliability_test").withUsername("vetor_reliability_test")
            .withPassword("vetor_reliability_test");

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String ADMIN_PASSWORD = "Frase Sintética de admin 23";
    private static final String USER_PASSWORD = "Frase Sintética de usuario 23";

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private Path key;

    private ConfigurableApplicationContext startApi() throws Exception {
        key = Files.createTempDirectory("vu23-mfa").resolve("mfa.key");
        return new SpringApplicationBuilder(br.com.vetorurbano.api.VetorUrbanoApiApplication.class)
                .profiles("local").run("--server.address=127.0.0.1", "--server.port=0",
                        "--vetor.accounts.enabled=true", "--vetor.accounts.mailbox-port=0",
                        "--vetor.auth.key-file=" + key, "--spring.datasource.url=" + DB.getJdbcUrl(),
                        "--spring.datasource.username=" + DB.getUsername(),
                        "--spring.datasource.password=" + DB.getPassword(),
                        "--vetor.collection.poll-seconds=86400");
    }

    @Test
    void referenceIsHighestIndependentSourceAndReproductionCountsOnce() throws Exception {
        try (var app = startApi()) {
            var admin = adminSession(app);
            var user = userSession(app);
            var jdbc = app.getBean(JdbcTemplate.class);
            String original = createSource(admin, app, "Fonte original sintética 23", 4);
            String reproduction = createSource(admin, app, "Fonte que reproduz 23", 5);
            String independent = createSource(admin, app, "Fonte independente 23", 3);
            String occurrence = insertOccurrence(jdbc, "Colisão com vítima na Avenida Brasil", "Descrição sintética sustentada",
                    "Centro", "UNKNOWN", "TERRITORY");
            Instant at = Instant.parse("2026-10-10T12:00:00Z");
            String originalClipping = clipping(jdbc, original, "Colisão na Avenida Brasil", "vu23-original", at);
            link(jdbc, occurrence, originalClipping);
            link(jdbc, occurrence, clipping(jdbc, reproduction, "Colisão na Avenida Brasil", "vu23-copia",
                    at.plusSeconds(1800)));
            link(jdbc, occurrence, clipping(jdbc, independent, "Transtorno após colisão na Avenida Brasil",
                    "vu23-independente", at.plusSeconds(5400)));

            var evaluated = JSON.readTree(evaluate(admin, app, occurrence).body());
            assertEquals(4, evaluated.path("note").asInt(),
                    "reprodução com nota 5 não vira referência: a origem (nota 4) é que vale");
            assertEquals(4, evaluated.path("factors").path("quality").path("value").asInt());
            assertEquals("INFORMED", evaluated.path("factors").path("quality").path("status").asString());
            assertEquals(1, evaluated.path("factors").path("corroboration").path("count").asInt(),
                    "a fonte que reproduz não corrobora de forma independente");
            assertEquals(0.0, evaluated.path("factors").path("corroboration").path("bonus").asDouble());
            var reproductions = evaluated.path("context").path("reproductions");
            assertEquals(1, reproductions.size());
            assertEquals(originalClipping, reproductions.get(0).path("reproductionOf").asString(),
                    "a reprodução aponta para o clipping de origem");
            assertEquals(2, evaluated.path("context").path("sources").size(),
                    "só as origens independentes entram no contexto da avaliação");
            assertEquals("RECORDED", evaluated.path("state").asString(),
                    "avaliação nasce registrada, sem publicar nota");

            assertEquals(200, publishNote(admin, app, occurrence, 1).statusCode());
            assertEquals(4, publicNote(app, user, occurrence));
        }
    }

    @Test
    void missingEssentialBlocksPublicationEvenWithHighNoteAndNotApplicableDiffersFromNotInformed() throws Exception {
        try (var app = startApi()) {
            var admin = adminSession(app);
            assertEquals(401, request(app, "POST", "admin/reliability/occurrences/x/evaluations",
                    Map.of("evaluationKey", UUID.randomUUID().toString()), null).statusCode());
            var user = userSession(app);
            assertEquals(403, request(app, "POST", "admin/reliability/occurrences/x/evaluations",
                    Map.of("evaluationKey", UUID.randomUUID().toString()), user).statusCode());

            var jdbc = app.getBean(JdbcTemplate.class);
            String source = createSource(admin, app, "Fonte de nota alta 23", 5);
            String broken = insertOccurrence(jdbc, "Ocorrência sem detalhe essencial", "", "Centro", "UNKNOWN", "TERRITORY");
            link(jdbc, broken, clipping(jdbc, source, "Falha sintética sem detalhe", "vu23-sem-detalhe",
                    Instant.parse("2026-10-10T09:00:00Z")));
            var blocked = JSON.readTree(evaluate(admin, app, broken).body());
            assertEquals(5, blocked.path("note").asInt(), "a nota bruta seria alta");
            assertTrue(strings(blocked.path("blocking")).contains("ESSENTIAL_NOT_INFORMED:description"), blocked.toString());
            var refused = publishNote(admin, app, broken, 1);
            assertEquals(409, refused.statusCode(), "nota alta não publica com essencial ausente");
            assertEquals("RECORDED", jdbc.queryForObject(
                    "SELECT state FROM occurrence_reliability_evaluations WHERE occurrence_id=?", String.class, broken));
            assertEquals(3, publicNote(app, user, broken), "sem nota publicada, o público continua vendo a nota anterior");

            String applicable = insertOccurrence(jdbc, "Ocorrência com campo não aplicável", "Descrição sintética sustentada",
                    "Não se aplica", "UNKNOWN", "TERRITORY");
            link(jdbc, applicable, clipping(jdbc, createSource(admin, app, "Fonte aplicável 23", 4),
                    "Evento sintético sem bairro definido", "vu23-nao-se-aplica", Instant.parse("2026-10-10T10:00:00Z")));
            var allowed = JSON.readTree(evaluate(admin, app, applicable).body());
            assertTrue(strings(allowed.path("blocking")).isEmpty(), allowed.toString());
            var statuses = allowed.path("factors").path("completeness").path("fieldStatus");
            assertEquals("NOT_APPLICABLE", statuses.path("neighborhood").asString());
            assertEquals("NOT_INFORMED", statuses.path("situation").asString());
            assertEquals(200, publishNote(admin, app, applicable, 1).statusCode());
            var publicBody = publicBody(app, user, applicable);
            assertEquals(4, publicNote(app, user, applicable));
            for (String secret : List.of("factors", "formula", "rating", "neutralBase")) {
                assertFalse(publicBody.contains(secret), "projeção pública não expõe " + secret);
            }
        }
    }

    @Test
    void sameVersionReproducesAndNewRuleNeverRewritesHistoricalNote() throws Exception {
        try (var app = startApi()) {
            var admin = adminSession(app);
            var user = userSession(app);
            var jdbc = app.getBean(JdbcTemplate.class);
            String occurrence = insertOccurrence(jdbc, "Ocorrência sem fonte de suporte", "Descrição sintética sustentada",
                    "Centro", "UNKNOWN", "TERRITORY");

            var first = JSON.readTree(evaluate(admin, app, occurrence).body());
            assertEquals(3, first.path("note").asInt(), "sem fonte com referência vale o centro da escala, nunca zero");
            assertTrue(first.path("factors").path("quality").path("neutralBaseUsed").asBoolean());
            var reproduction = JSON.readTree(request(app, "GET",
                    "admin/reliability/occurrences/" + occurrence + "/evaluations/1/reproduction", null, admin).body());
            assertTrue(reproduction.path("reproduced").asBoolean(), reproduction.toString());
            assertEquals(0, reproduction.path("differences").size());

            assertEquals(200, request(app, "POST", "admin/reliability/rules", ruleVersion2(), admin).statusCode());
            var second = JSON.readTree(evaluate(admin, app, occurrence).body());
            assertEquals(2, second.path("evaluationVersion").asInt());
            assertEquals(4, second.path("note").asInt(), "regra v2 altera a nota de uma nova avaliação");
            assertEquals(2, second.path("ruleVersion").asInt());
            assertEquals(3, JSON.readTree(request(app, "GET",
                    "admin/reliability/occurrences/" + occurrence + "/evaluations/1/reproduction", null, admin).body())
                    .path("recomputedNote").asInt(), "a versão 1 continua reproduzindo a nota antiga");

            assertEquals(200, publishNote(admin, app, occurrence, 1).statusCode());
            assertEquals(3, publicNote(app, user, occurrence));
            assertEquals(200, publishNote(admin, app, occurrence, 2).statusCode());
            assertEquals(4, publicNote(app, user, occurrence), "a nota publicada mais recente é a que vale");
            assertEquals(3, jdbc.queryForObject("""
                    SELECT note::int FROM occurrence_reliability_evaluations WHERE occurrence_id=? AND evaluation_version=1
                    """, Integer.class, occurrence), "nota histórica preservada, não trocada em silêncio");

            var immutable = assertThrows(Exception.class, () -> jdbc.update(
                    "UPDATE occurrence_reliability_evaluations SET note=5 WHERE occurrence_id=? AND evaluation_version=1",
                    occurrence));
            assertTrue(String.valueOf(immutable.getMessage()).contains("immutable"), immutable.getMessage());
        }
    }

    @Test
    void essentialConflictBlocksAndUntraceableDetailNeverRaisesTheNote() throws Exception {
        try (var app = startApi()) {
            var admin = adminSession(app);
            var jdbc = app.getBean(JdbcTemplate.class);
            String source = createSource(admin, app, "Fonte em conflito 23", 5);
            String conflict = insertOccurrence(jdbc, "Ocorrência com conflito essencial", "Descrição sintética sustentada",
                    "Centro", "UNKNOWN", "TERRITORY");
            link(jdbc, conflict, clipping(jdbc, source, "Versões divergentes do mesmo fato", "vu23-conflito",
                    Instant.parse("2026-10-11T08:00:00Z")));
            jdbc.update("""
                    INSERT INTO clipping_reviews (clipping_id, original_text, extracted, priority, essential_conflict, queued_at)
                    SELECT id, 'Texto original sintético', '{}'::jsonb, 'HIGH', true, now()
                    FROM clippings WHERE source_id=? AND reference='vu23-conflito'
                    """, source);
            var evaluated = JSON.readTree(evaluate(admin, app, conflict).body());
            assertTrue(strings(evaluated.path("blocking")).contains("ESSENTIAL_CONFLICT_UNRESOLVED"), evaluated.toString());
            assertEquals(409, publishNote(admin, app, conflict, 1).statusCode());

            String untraceable = createSource(admin, app, "Fonte sem referência 23", 5);
            String occurrence = insertOccurrence(jdbc, "Ocorrência só com detalhe sem referência",
                    "Descrição sintética sustentada", "Centro", "UNKNOWN", "TERRITORY");
            link(jdbc, occurrence, clipping(jdbc, untraceable, "Detalhe sem referência rastreável", null,
                    Instant.parse("2026-10-11T09:00:00Z")));
            var result = JSON.readTree(evaluate(admin, app, occurrence).body());
            assertEquals(3, result.path("note").asInt(), "detalhe sem referência não eleva a nota");
            assertEquals("NOT_INFORMED", result.path("factors").path("quality").path("status").asString());
            assertTrue(strings(result.path("blocking")).isEmpty());
        }
    }

    // --- fixtures ---

    private String createSource(CookieSession admin, ConfigurableApplicationContext app, String name, int rating)
            throws Exception {
        var body = new LinkedHashMap<String, Object>();
        body.put("name", name);
        body.put("channel", "Canal sintético 23");
        body.put("url", "https://example.test/" + UUID.randomUUID());
        body.put("territories", List.of("Rio de Janeiro"));
        body.put("pillars", List.of("TRANSITO", "CONTINGENCIA"));
        body.put("accessMethod", "MANUAL");
        body.put("rating", rating);
        body.put("ratingJustification", "Avaliação inteiramente sintética da fonte para o teste 23.");
        var response = request(app, "POST", "admin/sources", body, admin);
        assertEquals(201, response.statusCode(), response.body());
        return JSON.readTree(response.body()).path("id").asString();
    }

    private String insertOccurrence(JdbcTemplate jdbc, String title, String description, String neighborhood,
            String situation, String precision) {
        String id = "vu23-" + UUID.randomUUID();
        String happening = "vu23-happening-" + UUID.randomUUID();
        jdbc.update("INSERT INTO happenings (id, title, description) VALUES (?, ?, ?)", happening, title,
                "Contexto sintético do teste 23");
        jdbc.update("""
                INSERT INTO occurrences (id, happening_id, title, description, category, occurrence_type, subtype,
                    situation, reliability_score, municipality, neighborhood, location_precision, occurred_at,
                    publication_status)
                VALUES (?, ?, ?, ?, 'TRANSITO', 'ACIDENTE', 'COLISAO', ?, 3, 'Rio de Janeiro', ?, ?,
                    TIMESTAMPTZ '2026-10-10 12:00:00Z', 'PUBLISHED')
                """, id, happening, title, description, situation, neighborhood, precision);
        return id;
    }

    private String clipping(JdbcTemplate jdbc, String sourceId, String title, String reference, Instant publishedAt) {
        String id = "vu23-clipping-" + UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clippings (id, source_id, title, reference, source_published_at, collected_at)
                VALUES (?, ?, ?, ?, ?, now())
                """, id, sourceId, title, reference, Timestamp.from(publishedAt));
        return id;
    }

    private void link(JdbcTemplate jdbc, String occurrenceId, String clippingId) {
        jdbc.update("INSERT INTO occurrence_clippings (occurrence_id, clipping_id) VALUES (?, ?)", occurrenceId,
                clippingId);
    }

    /** Consulta pública por janela: é ela que expõe a nota, sem fórmula nem fatores. */
    private int publicNote(ConfigurableApplicationContext app, CookieSession session, String occurrenceId)
            throws Exception {
        for (var item : JSON.readTree(publicBody(app, session, occurrenceId)).path("items")) {
            if (item.path("id").asString().equals(occurrenceId)) {
                return item.path("reliability").asInt();
            }
        }
        throw new AssertionError("Ocorrência ausente na consulta pública: " + occurrenceId);
    }

    private String publicBody(ConfigurableApplicationContext app, CookieSession session, String occurrenceId)
            throws Exception {
        var response = request(app, "GET",
                "occurrences?periodStart=2026-10-10T00:00:00Z&periodEnd=2026-10-11T00:00:00Z", null, session);
        assertEquals(200, response.statusCode(), response.body());
        return response.body();
    }

    private String reproductionReference(JdbcTemplate jdbc, String occurrenceId, String reproductionSourceId) {
        return jdbc.queryForObject("""
                SELECT c.id FROM occurrence_clippings oc JOIN clippings c ON c.id = oc.clipping_id
                WHERE oc.occurrence_id=? AND c.source_id=? ORDER BY c.reference
                """, String.class, occurrenceId, reproductionSourceId);
    }

    private HttpResponse<String> evaluate(CookieSession admin, ConfigurableApplicationContext app, String occurrence)
            throws Exception {
        return request(app, "POST", "admin/reliability/occurrences/" + occurrence + "/evaluations",
                Map.of("evaluationKey", UUID.randomUUID().toString()), admin);
    }

    private HttpResponse<String> publishNote(CookieSession admin, ConfigurableApplicationContext app, String occurrence,
            int version) throws Exception {
        return request(app, "POST",
                "admin/reliability/occurrences/" + occurrence + "/evaluations/" + version + "/publication", Map.of(),
                admin);
    }

    /** Regra v2 de exemplo: só a base neutra muda, para provar que a nota nova é explícita e versionada. */
    private static Map<String, Object> ruleVersion2() {
        var bonus = new LinkedHashMap<String, Object>();
        bonus.put("1", 0.0);
        bonus.put("2", 0.5);
        bonus.put("3", 1.0);
        var fields = new ArrayList<Map<String, Object>>();
        for (String field : List.of("title", "description", "category", "type", "municipality", "locationPrecision",
                "temporal")) {
            fields.add(Map.of("field", field, "allowsNotInformed", false, "allowsNotApplicable", false));
        }
        fields.add(Map.of("field", "situation", "allowsNotInformed", true, "allowsNotApplicable", true));
        var parameters = new LinkedHashMap<String, Object>();
        parameters.put("schemaVersion", 2);
        parameters.put("noteRange", List.of(1, 5));
        parameters.put("neutralBase", 4);
        parameters.put("neutralBaseReason", "Versão sintética de teste: centro da escala deslocado para 4.");
        parameters.put("corroborationBonus", bonus);
        parameters.put("corroborationCap", 3);
        parameters.put("divergenceAsBlocking", true);
        parameters.put("rounding", "HALF_UP");
        parameters.put("reproductionWindowMinutes", 120);
        parameters.put("notInformedValues", List.of("NAO_INFORMADO", "Não informado", "DESCONHECIDO"));
        parameters.put("notApplicableValues", List.of("NAO_SE_APLICA", "Não se aplica"));
        parameters.put("essentialFields", fields);
        var body = new LinkedHashMap<String, Object>();
        body.put("version", 2);
        body.put("parameters", parameters);
        body.put("summary", "Versão sintética de teste para provar que a nota histórica não muda sem nova avaliação.");
        return body;
    }

    private static List<String> strings(JsonNode array) {
        var values = new ArrayList<String>();
        array.forEach(node -> values.add(node.asString()));
        return values;
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
        String email = "admin23-" + id + "@example.test";
        app.getBean(JdbcTemplate.class).update("""
                INSERT INTO local_accounts (id, display_name, email, password_hash, role, status,
                    created_at, confirmed_at, last_sent_at, resend_window_start)
                VALUES (?, 'Administrador sintético 23', ?, ?, 'ADMIN', 'CONFIRMED', ?, ?, ?, ?)
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

    private CookieSession userSession(ConfigurableApplicationContext app) throws Exception {
        UUID id = UUID.randomUUID();
        Timestamp now = Timestamp.from(Instant.now());
        String email = "usuario23-" + id + "@example.test";
        app.getBean(JdbcTemplate.class).update("""
                INSERT INTO local_accounts (id, display_name, email, password_hash, role, status,
                    created_at, confirmed_at, last_sent_at, resend_window_start)
                VALUES (?, 'Usuário sintético 23', ?, ?, 'USER', 'CONFIRMED', ?, ?, ?, ?)
                """, id, email, app.getBean(AccountPassword.class).derive(USER_PASSWORD), now, now, now, now);
        var login = login(app, email, USER_PASSWORD);
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

    private record CookieSession(String cookie, String csrf) {}
    private record LoginResult(HttpResponse<String> response, CookieSession session) {}
}
