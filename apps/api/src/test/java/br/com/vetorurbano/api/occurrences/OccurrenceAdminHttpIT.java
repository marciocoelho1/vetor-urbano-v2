package br.com.vetorurbano.api.occurrences;

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
 * Administração de ocorrências com PostgreSQL/PostGIS real: lista por última atualização e
 * alfabética com filtro de estado, edição de todos os campos com controle de versão, ações em lote e
 * exclusão lógica que exige a senha do administrador **uma vez** por lote. As ocorrências fictícias
 * permanecem intactas.
 */
@Testcontainers
class OccurrenceAdminHttpIT {
    private static final DockerImageName POSTGIS_IMAGE = DockerImageName.parse("postgis/postgis:17-3.5")
            .asCompatibleSubstituteFor("postgres");
    @Container private static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>(POSTGIS_IMAGE)
            .withDatabaseName("vetor_urbano_occurrence_admin_test").withUsername("vetor_occurrence_admin_test")
            .withPassword("vetor_occurrence_admin_test");

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String ADMIN_PASSWORD = "Frase Sintética de admin 25";
    private static final String USER_PASSWORD = "Frase Sintética de usuario 25";

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private Path key;

    private ConfigurableApplicationContext startApi() throws Exception {
        key = Files.createTempDirectory("vu25-mfa").resolve("mfa.key");
        return new SpringApplicationBuilder(br.com.vetorurbano.api.VetorUrbanoApiApplication.class)
                .profiles("local").run("--server.address=127.0.0.1", "--server.port=0",
                        "--vetor.accounts.enabled=true", "--vetor.accounts.mailbox-port=0",
                        "--vetor.auth.key-file=" + key, "--spring.datasource.url=" + DB.getJdbcUrl(),
                        "--spring.datasource.username=" + DB.getUsername(),
                        "--spring.datasource.password=" + DB.getPassword(),
                        "--vetor.collection.poll-seconds=86400");
    }

    @Test
    void listOrdersByLastUpdateOrAlphabeticallyAndFiltersByStatus() throws Exception {
        try (var app = startApi()) {
            assertEquals(401, request(app, "GET", "admin/occurrences", null, null).statusCode());
            var user = userSession(app);
            assertEquals(403, request(app, "GET", "admin/occurrences", null, user).statusCode());

            var admin = adminSession(app);
            var jdbc = app.getBean(JdbcTemplate.class);
            String older = occurrence(jdbc, "Alfa sem atualização", "ONGOING", "ACTIVE", null);
            String newer = occurrence(jdbc, "Zulu atualizada agora", "ONGOING", "ACTIVE",
                    Timestamp.from(Instant.parse("2026-10-22T10:00:00Z")));
            String concluded = occurrence(jdbc, "Bravo concluída", "CLOSED", "CONCLUDED", null);

            var byUpdateBody = JSON.readTree(request(app, "GET", "admin/occurrences?sort=last_update", null, admin)
                    .body());
            var byUpdate = ids(byUpdateBody.path("items"));
            assertTrue(byUpdate.indexOf(newer) < byUpdate.indexOf(older),
                    "a mais recentemente atualizada vem antes da mais antiga");
            assertTrue(byUpdateBody.path("counts").path("ACTIVE").asInt() >= 2);

            var alphabetical = JSON.readTree(request(app, "GET", "admin/occurrences?sort=alphabetical", null, admin)
                    .body());
            var titles = new ArrayList<String>();
            alphabetical.path("items").forEach(item -> titles.add(item.path("title").asString()));
            var sorted = new ArrayList<>(titles);
            sorted.sort(String.CASE_INSENSITIVE_ORDER);
            assertEquals(sorted.subList(0, 3), titles.subList(0, 3), "ordem alfabética respeitada");

            var concludedOnly = JSON.readTree(request(app, "GET", "admin/occurrences?status=CONCLUDED", null, admin)
                    .body());
            assertTrue(ids(concludedOnly.path("items")).contains(concluded));
            assertFalse(ids(concludedOnly.path("items")).contains(older));
            assertEquals(400, request(app, "GET", "admin/occurrences?sort=qualquer", null, admin).statusCode());
        }
    }

    @Test
    void editChangesEveryFieldWithVersionControlAndKeepsHistory() throws Exception {
        try (var app = startApi()) {
            var admin = adminSession(app);
            var jdbc = app.getBean(JdbcTemplate.class);
            String id = occurrence(jdbc, "Ocorrência editável", "ONGOING", "ACTIVE", null);
            var body = draft(id, "Título editado pelo administrador", "Descrição editada e sustentada");
            body.put("expectedVersion", 1);

            var response = request(app, "PUT", "admin/occurrences/" + id, body, admin);
            assertEquals(200, response.statusCode(), response.body());
            var edited = JSON.readTree(response.body());
            assertEquals("Título editado pelo administrador", edited.path("title").asString());
            assertEquals(2, edited.path("revision").asInt());
            assertFalse(edited.path("updated_at").isNull(), "edição registra a última atualização");

            assertEquals("ADMIN_EDIT", jdbc.queryForObject("""
                    SELECT action FROM publication_versions WHERE occurrence_id=? ORDER BY version DESC LIMIT 1
                    """, String.class, id));
            assertEquals("OCCURRENCE_EDITED", jdbc.queryForObject("""
                    SELECT action FROM auth_audit_events WHERE module='occurrences' ORDER BY id DESC LIMIT 1
                    """, String.class));

            var stale = draft(id, "Tentativa com versão antiga", "Descrição sustentada");
            stale.put("expectedVersion", 1);
            assertEquals(409, request(app, "PUT", "admin/occurrences/" + id, stale, admin).statusCode(),
                    "versão antiga não sobrescreve decisão nova");
        }
    }

    @Test
    void bulkKeepsStatesAndDeletesOnlyWithOnePasswordCheckForTheWholeBatch() throws Exception {
        try (var app = startApi()) {
            var admin = adminSession(app);
            var jdbc = app.getBean(JdbcTemplate.class);
            String first = occurrence(jdbc, "Primeira em lote", "ONGOING", "ACTIVE", null);
            String second = occurrence(jdbc, "Segunda em lote", "ONGOING", "ACTIVE", null);
            String third = occurrence(jdbc, "Terceira em lote", "ONGOING", "ACTIVE", null);
            var ids = List.of(first, second, third);

            var concluded = request(app, "POST", "admin/occurrences/bulk",
                    Map.of("ids", ids, "action", "CONCLUDED"), admin);
            assertEquals(200, concluded.statusCode(), concluded.body());
            assertEquals(3, JSON.readTree(concluded.body()).path("affected").asInt());
            assertEquals(3, jdbc.queryForObject("""
                    SELECT count(*)::int FROM occurrences WHERE id IN (?,?,?) AND administrative_status='CONCLUDED'
                    """, Integer.class, first, second, third));
            assertEquals(3, jdbc.queryForObject("""
                    SELECT count(*)::int FROM occurrences WHERE id IN (?,?,?) AND updated_at IS NOT NULL
                    """, Integer.class, first, second, third));

            assertEquals(400, request(app, "POST", "admin/occurrences/bulk",
                    Map.of("ids", ids, "action", "DELETE"), admin).statusCode(), "sem senha não exclui");
            assertEquals(400, request(app, "POST", "admin/occurrences/bulk",
                    Map.of("ids", ids, "action", "DELETE", "password", "senha errada"), admin).statusCode(),
                    "senha errada é entrada inválida, não falta de permissão");
            assertEquals(3, jdbc.queryForObject("""
                    SELECT count(*)::int FROM occurrences WHERE id IN (?,?,?) AND administrative_status<>'DELETED'
                    """, Integer.class, first, second, third), "senha errada não exclui nada");

            var deleted = request(app, "POST", "admin/occurrences/bulk",
                    Map.of("ids", ids, "action", "DELETE", "password", ADMIN_PASSWORD), admin);
            assertEquals(200, deleted.statusCode(), deleted.body());
            assertEquals(3, JSON.readTree(deleted.body()).path("affected").asInt());
            assertEquals(3, jdbc.queryForObject("""
                    SELECT count(*)::int FROM occurrences WHERE id IN (?,?,?) AND administrative_status='DELETED'
                      AND deleted_at IS NOT NULL
                    """, Integer.class, first, second, third));
            assertEquals(3, jdbc.queryForObject("""
                    SELECT count(*)::int FROM publication_versions WHERE occurrence_id IN (?,?,?)
                    """, Integer.class, first, second, third), "exclusão lógica preserva o histórico");
            assertEquals("OCCURRENCE_BULK_DELETE", jdbc.queryForObject("""
                    SELECT action FROM auth_audit_events WHERE module='occurrences' ORDER BY id DESC LIMIT 1
                    """, String.class), "a exclusão em lote é auditada");

            var list = JSON.readTree(request(app, "GET", "admin/occurrences", null, admin).body());
            assertTrue(java.util.Collections.disjoint(ids(list.path("items")), ids),
                    "excluídas saem da lista administrativa");
            assertEquals(400, request(app, "POST", "admin/occurrences/bulk",
                    Map.of("ids", ids, "action", "ARQUIVAR"), admin).statusCode());
        }
    }


    @Test
    void usersSeeOnlyActiveOccurrencesWhileAdministrationSeesEveryState() throws Exception {
        try (var app = startApi()) {
            var admin = adminSession(app);
            var user = userSession(app);
            var jdbc = app.getBean(JdbcTemplate.class);
            String active = occurrence(jdbc, "Visível ativa", "ONGOING", "ACTIVE", null);
            String inactive = occurrence(jdbc, "Oculta inativa", "ONGOING", "INACTIVE",
                    Timestamp.from(Instant.parse("2026-10-22T11:00:00Z")));
            String concluded = occurrence(jdbc, "Concluída histórica", "CLOSED", "CONCLUDED", null);
            String window = "periodStart=2026-10-10T00:00:00Z&periodEnd=2026-10-11T00:00:00Z";

            var live = ids(JSON.readTree(request(app, "GET", "occurrences?" + window, null, user).body())
                    .path("items"));
            assertTrue(live.contains(active), "ativa aparece para o usuário");
            assertFalse(live.contains(inactive), "inativa sai da consulta do usuário");
            assertFalse(live.contains(concluded), "concluída não é ocorrência vigente");

            var history = ids(JSON.readTree(request(app, "GET", "history/occurrences?" + window, null, user)
                    .body()).path("items"));
            assertTrue(history.contains(active));
            assertTrue(history.contains(concluded), "histórico continua mostrando concluídas");
            assertFalse(history.contains(inactive), "inativa não aparece nem no histórico do usuário");

            var adminList = ids(JSON.readTree(request(app, "GET", "admin/occurrences", null, admin).body())
                    .path("items"));
            assertTrue(adminList.contains(active));
            assertTrue(adminList.contains(inactive), "administração vê as inativas");
            assertTrue(adminList.contains(concluded), "administração vê as concluídas");
        }
    }


    @Test
    void createsOccurrenceWithoutClippingAndPublishesItAsActive() throws Exception {
        try (var app = startApi()) {
            var admin = adminSession(app);
            var user = userSession(app);
            var jdbc = app.getBean(JdbcTemplate.class);
            var body = draft("vu25-manual", "Relato direto do administrador",
                    "Fato presenciado e registrado sem clipping");
            body.put("happeningTitle", "Acontecimento criado no cadastro manual");

            var response = request(app, "POST", "admin/occurrences", body, admin);
            assertEquals(201, response.statusCode(), response.body());
            var created = JSON.readTree(response.body());
            String id = created.path("id").asString();
            assertEquals("ACTIVE", created.path("administrative_status").asString());
            assertEquals(0, jdbc.queryForObject("""
                    SELECT count(*)::int FROM occurrence_clippings WHERE occurrence_id=?
                    """, Integer.class, id), "cadastro manual não exige clipping");

            assertEquals("ADMIN_CREATE", jdbc.queryForObject("""
                    SELECT action FROM publication_versions WHERE occurrence_id=? ORDER BY version DESC LIMIT 1
                    """, String.class, id));
            var live = ids(JSON.readTree(request(app, "GET",
                    "occurrences?periodStart=2026-10-10T00:00:00Z&periodEnd=2026-10-11T00:00:00Z", null, user)
                    .body()).path("items"));
            assertTrue(live.contains(id), "a ocorrência cadastrada aparece para o usuário");

            var missing = draft("vu25-manual", "Sem acontecimento", "Fato sem acontecimento informado");
            assertEquals(400, request(app, "POST", "admin/occurrences", missing, admin).statusCode());
        }
    }

    // --- fixtures ---

    private String occurrence(JdbcTemplate jdbc, String title, String situation, String status,
            Timestamp updatedAt) {
        String id = "vu25-" + UUID.randomUUID();
        String happening = "vu25-happening-" + UUID.randomUUID();
        jdbc.update("INSERT INTO happenings (id, title, description) VALUES (?, ?, ?)", happening, title,
                "Contexto sintético da administração de ocorrências");
        jdbc.update("""
                INSERT INTO occurrences (id, happening_id, title, description, category, occurrence_type, subtype,
                    situation, reliability_score, municipality, neighborhood, location_precision, occurred_at,
                    publication_status, administrative_status, updated_at)
                VALUES (?, ?, ?, 'Descrição sintética sustentada', 'TRANSITO', 'ACIDENTE', 'COLISAO', ?, 3,
                    'Rio de Janeiro', 'Centro', 'TERRITORY', TIMESTAMPTZ '2026-10-10 12:00:00Z', 'PUBLISHED', ?, ?)
                """, id, happening, title, situation, status, updatedAt);
        jdbc.update("""
                INSERT INTO publication_versions (occurrence_id, version, action, reason, after_snapshot, occurred_at)
                VALUES (?, 1, 'INITIAL', 'Fixture sintética da administração', '{}'::jsonb, now())
                """, id);
        return id;
    }

    private static Map<String, Object> draft(String id, String title, String description) {
        var body = new LinkedHashMap<String, Object>();
        body.put("title", title);
        body.put("description", description);
        body.put("category", "TRANSITO");
        body.put("type", "ACIDENTE");
        body.put("subtype", "COLISAO");
        body.put("situation", "ONGOING");
        body.put("reliability", 3);
        body.put("municipality", "Rio de Janeiro");
        body.put("neighborhood", "Centro");
        body.put("locationPrecision", "TERRITORY");
        body.put("occurredAt", "2026-10-10T12:00:00Z");
        return body;
    }

    private static List<String> ids(JsonNode items) {
        var values = new ArrayList<String>();
        items.forEach(item -> values.add(item.path("id").asString()));
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
        String email = "admin25-" + id + "@example.test";
        app.getBean(JdbcTemplate.class).update("""
                INSERT INTO local_accounts (id, display_name, email, password_hash, role, status,
                    created_at, confirmed_at, last_sent_at, resend_window_start)
                VALUES (?, 'Administrador sintético 25', ?, ?, 'ADMIN', 'CONFIRMED', ?, ?, ?, ?)
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
        String email = "usuario25-" + id + "@example.test";
        app.getBean(JdbcTemplate.class).update("""
                INSERT INTO local_accounts (id, display_name, email, password_hash, role, status,
                    created_at, confirmed_at, last_sent_at, resend_window_start)
                VALUES (?, 'Usuário sintético 25', ?, ?, 'USER', 'CONFIRMED', ?, ?, ?, ?)
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
