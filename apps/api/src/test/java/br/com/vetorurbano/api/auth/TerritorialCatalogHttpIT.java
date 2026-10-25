package br.com.vetorurbano.api.auth;

import static org.junit.jupiter.api.Assertions.*;
import java.time.Clock;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;
import tools.jackson.databind.JsonNode;

/**
 * UXH-03 sobre HTTP e PostGIS real: ingestão versionada, cobertura calculada no servidor, ponto
 * interno igual ao ST_PointOnSurface persistido, isolamento ADMIN/MFA/CSRF e ausência de geometria
 * na listagem. Nenhuma Área de Risco é usada como substituto de território administrativo.
 */
@Testcontainers
class TerritorialCatalogHttpIT extends LocalAuthHttpSupport {
    @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>(
            DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    static final MutableClock CLOCK = new MutableClock();
    @TestConfiguration static class TimeConfig { @Bean @Primary Clock clock() { return CLOCK; } }
    @Override PostgreSQLContainer<?> database() { return DB; }
    @Override MutableClock clock() { return CLOCK; }
    @Override Class<?> timeConfiguration() { return TimeConfig.class; }

    static final String DATASET = "3f6f0f2e-0000-4000-8000-000000000001";
    static final String RIO = "3f6f0f2e-0000-4000-8000-000000000002";
    static final String NITEROI = "3f6f0f2e-0000-4000-8000-000000000003";
    /** Fora do recorte legal: existe no catálogo, mas não pode inflar «disponível». */
    static final String ANGRA = "3f6f0f2e-0000-4000-8000-000000000004";
    /** Sem geometria: prova que busca sem acento encontra o nome acentuado e que a pendência aparece. */
    static final String SAO_GONCALO = "3f6f0f2e-0000-4000-8000-000000000005";
    static final String RIO_POLYGON = "POLYGON((-43.5 -23.0,-43.0 -23.0,-43.0 -22.5,-43.5 -23.0))";
    /** Revisão 2 do Rio: geometria diferente, gravada sem aprovação. */
    static final String RIO_POLYGON_V2 = "POLYGON((-43.55 -23.05,-43.05 -23.05,-43.05 -22.55,-43.55 -23.05))";
    static final String OTHER_POLYGON = "POLYGON((-43.45 -22.95,-43.35 -22.95,-43.35 -22.85,-43.45 -22.95))";
    static final String FAKE_NILOPOLIS = "3f6f0f2e-0000-4000-8000-000000000006";
    static final String NILOPOLIS = "3f6f0f2e-0000-4000-8000-000000000007";
    static final String BAIRRO_CENTRO = "3f6f0f2e-0000-4000-8000-000000000008";
    static final String BAIRRO_PENDENTE = "3f6f0f2e-0000-4000-8000-000000000009";

    JdbcTemplate jdbc;
    UUID admin;
    byte[] secret;

    void ingest(ConfigurableApplicationContext app) {
        reset(app);
        jdbc.update("""
                INSERT INTO catalog_territories(id,level,official_code,name) VALUES
                    (?, 'MUNICIPALITY','3304557','Rio de Janeiro'),
                    (?, 'MUNICIPALITY','3303302','Niterói'),
                    (?, 'MUNICIPALITY','3300100','Angra dos Reis'),
                    (?, 'MUNICIPALITY','3304904','São Gonçalo')
                """, UUID.fromString(RIO), UUID.fromString(NITEROI), UUID.fromString(ANGRA),
                UUID.fromString(SAO_GONCALO));
        jdbc.update("""
                INSERT INTO catalog_territory_versions(territory_id,version,dataset_id,boundary,reference_date)
                VALUES (?,1,?,ST_SetSRID(ST_GeomFromText(?),4326),'2026-10-24')
                """, UUID.fromString(RIO), UUID.fromString(DATASET), RIO_POLYGON);
        jdbc.update("UPDATE catalog_territories SET revision=1 WHERE id=?", UUID.fromString(RIO));
    }

    /** Catálogo vazio com o conjunto de proveniência já gravado: base limpa para cada prova. */
    void reset(ConfigurableApplicationContext app) {
        jdbc = app.getBean(JdbcTemplate.class);
        jdbc.execute("TRUNCATE catalog_territory_versions, catalog_territories, catalog_datasets");
        jdbc.update("""
                INSERT INTO catalog_datasets(id,source,source_url,license,attribution,reference_date,obtained_at,checksum,limitations)
                VALUES (?,'IBGE — API de Malhas','https://servicodados.ibge.gov.br/api/v3/malhas/municipios/{code}',
                       'CC BY 4.0','IBGE — Malha Municipal Digital, produto derivado','2026-10-24',?,?,
                       'Recorte sintético de teste; não é medição de área.')
                """, UUID.fromString(DATASET), java.sql.Timestamp.from(CLOCK.instant()), "b".repeat(64));
    }

    /** Município com geometria e versão publicada; o ponto interno continua sendo derivado pelo banco. */
    void publishMunicipality(String id, String code, String name, String polygon) {
        jdbc.update("""
                INSERT INTO catalog_territories(id,level,official_code,name) VALUES (?, 'MUNICIPALITY',?,?)
                """, UUID.fromString(id), code, name);
        jdbc.update("""
                INSERT INTO catalog_territory_versions(territory_id,version,dataset_id,boundary,reference_date)
                VALUES (?,1,?,ST_SetSRID(ST_GeomFromText(?),4326),'2026-10-24')
                """, UUID.fromString(id), UUID.fromString(DATASET), polygon);
        jdbc.update("UPDATE catalog_territories SET revision=1,approved_version=1 WHERE id=?", UUID.fromString(id));
    }

    void administrator(ConfigurableApplicationContext app) throws Exception {
        admin = bootstrap(app);
        accept(login(app, "admin14@example.test"));
        // O cadastro do autenticador exige sessão já autenticada, então vem depois do login.
        secret = enrolledSecret(app, admin);
        accept(request(app, "POST", "auth/mfa/verification", Map.of("code", code(secret))));
    }

    /**
     * Mesma conta, novo login: recriar o ADMIN sintético colidiria com o e-mail já existente, e
     * repetir o mesmo código do autenticador é recusado (proteção contra reuso), então o relógio
     * avança uma janela de 30 s antes de gerar o código.
     */
    void signInAdmin(ConfigurableApplicationContext app) throws Exception {
        CLOCK.advance(30);
        accept(login(app, "admin14@example.test"));
        accept(request(app, "POST", "auth/mfa/verification", Map.of("code", code(secret))));
    }

    static JsonNode item(JsonNode body, String name) {
        for (JsonNode item : body.path("items")) if (name.equals(item.path("name").asString())) return item;
        return fail("item ausente na resposta: " + name);
    }

    @Test void publishesOnlyApprovedMunicipalitiesWithDerivedInternalPoint() throws Exception {
        try (var app = start()) {
            ingest(app);
            // Sem sessão não há catálogo: o endpoint é de leitura do aplicativo, não da internet aberta.
            assertEquals(401, request(app, "GET", "territories", null).statusCode());

            register(app, "catalog03@example.test", true);
            accept(login(app, "catalog03@example.test"));

            var before = request(app, "GET", "territories", null);
            assertEquals(200, before.statusCode(), before.body());
            var body = JSON.readTree(before.body());
            assertEquals(22, body.path("coverage").path("expected").asInt());
            assertEquals(0, body.path("coverage").path("available").asInt());
            assertEquals(22, body.path("coverage").path("pending").asInt());
            assertEquals("LEGAL_RECORTE", body.path("coverage").path("expectedSource").asString());
            assertEquals(4, body.path("items").size());
            // Revisão sem aprovação não é publicada: nada de «validated» por existir no banco.
            assertFalse(item(body, "Rio de Janeiro").path("validated").asBoolean());
            assertTrue(item(body, "Rio de Janeiro").path("internalPoint").isNull());
            assertTrue(body.findValues("geometry").isEmpty(), "listagem não carrega geometria");
            // Sem versão publicada não há conjunto do nível: nada de dataset emprestado de outro nível.
            assertTrue(body.path("dataset").isNull(), "catálogo sem versão aprovada não declara dataset");

            // Usuário comum não aprova, mesmo com CSRF válido.
            assertEquals(403, request(app, "POST", "admin/territories/" + RIO + "/approvals",
                    Map.of("expectedVersion", 1, "justification", "Não autorizado")).statusCode());

            administrator(app);
            assertEquals(403, request(app, "POST", "admin/territories/" + RIO + "/approvals",
                    Map.of("expectedVersion", 1, "justification", "Sem CSRF"), null, false).statusCode());
            var approval = request(app, "POST", "admin/territories/" + RIO + "/approvals",
                    Map.of("expectedVersion", 1, "justification", "Conferência sintética da malha municipal"));
            assertEquals(200, approval.statusCode(), approval.body());
            assertEquals(409, request(app, "POST", "admin/territories/" + RIO + "/approvals",
                    Map.of("expectedVersion", 1, "justification", "Repetida")).statusCode());

            cookie = null;
            csrf = null;
            accept(login(app, "catalog03@example.test"));
            var published = JSON.readTree(request(app, "GET", "territories", null).body());
            // Publicado: agora existe conjunto do nível, com proveniência declarada.
            assertEquals("IBGE — API de Malhas", published.path("dataset").path("source").asString());
            assertEquals("CC BY 4.0", published.path("dataset").path("license").asString());
            assertEquals("2026-10-24", published.path("dataset").path("referenceDate").asString());
            // Só o Rio está no recorte legal e aprovado; Angra existe no catálogo e não conta.
            assertEquals(1, published.path("coverage").path("available").asInt());
            assertEquals(21, published.path("coverage").path("pending").asInt());
            var rio = item(published, "Rio de Janeiro");
            assertEquals("3304557", rio.path("officialCode").asString());
            assertTrue(rio.path("validated").asBoolean());
            assertEquals(1, rio.path("version").asInt());
            assertFalse(item(published, "Niterói").path("validated").asBoolean());
            assertTrue(item(published, "Niterói").path("internalPoint").isNull());

            // Ponto interno: [lon, lat], idêntico ao ST_PointOnSurface persistido e dentro do polígono.
            var point = rio.path("internalPoint");
            assertEquals(2, point.size());
            var stored = jdbc.queryForObject("""
                    SELECT ST_X(internal_point) AS lon, ST_Y(internal_point) AS lat,
                           ST_X(ST_PointOnSurface(boundary)) AS surface_lon,
                           ST_Y(ST_PointOnSurface(boundary)) AS surface_lat,
                           ST_Contains(boundary, internal_point) AS inside
                    FROM catalog_territory_versions WHERE territory_id=?
                    """, (row, index) -> Map.of(
                    "lon", row.getDouble("lon"), "lat", row.getDouble("lat"),
                    "surfaceLon", row.getDouble("surface_lon"), "surfaceLat", row.getDouble("surface_lat"),
                    "inside", row.getBoolean("inside")), UUID.fromString(RIO));
            assertEquals((Double) stored.get("lon"), point.get(0).asDouble(), 1e-9);
            assertEquals((Double) stored.get("lat"), point.get(1).asDouble(), 1e-9);
            assertEquals((Double) stored.get("surfaceLon"), point.get(0).asDouble(), 1e-9);
            assertEquals((Double) stored.get("surfaceLat"), point.get(1).asDouble(), 1e-9);
            assertEquals(Boolean.TRUE, stored.get("inside"));

            // Filtro não encolhe a cobertura: ela é do recorte legal, não da lista devolvida.
            var filtered = JSON.readTree(request(app, "GET", "territories?q=niteroi", null).body());
            assertEquals(1, filtered.path("items").size());
            assertEquals("Niterói", filtered.path("items").get(0).path("name").asString());
            assertEquals(22, filtered.path("coverage").path("expected").asInt());
            assertEquals(1, filtered.path("coverage").path("available").asInt());
            var accented = JSON.readTree(request(app, "GET", "territories?q=Niter%C3%B3i", null).body());
            assertEquals(1, accented.path("items").size(), "termo com acento encontra o próprio nome");
            assertEquals("Niterói", accented.path("items").get(0).path("name").asString());
            var unaccented = JSON.readTree(request(app, "GET", "territories?q=goncalo", null).body());
            assertEquals(1, unaccented.path("items").size(), "sem acento encontra São Gonçalo");
            assertEquals("São Gonçalo", unaccented.path("items").get(0).path("name").asString());

            // Detalhe carrega geometria e histórico de versões.
            var detail = JSON.readTree(request(app, "GET", "territories/" + RIO, null).body());
            assertEquals("Polygon", detail.path("geometry").path("type").asString());
            assertEquals(1, detail.path("versions").size());
            assertEquals(DATASET, detail.path("versions").get(0).path("dataset").path("id").asString());

            assertEquals(404, request(app, "GET", "territories/" + UUID.randomUUID(), null).statusCode());
            assertEquals(400, request(app, "GET", "territories?level=ESTADO", null).statusCode());

            signInAdmin(app);
            var adminView = JSON.readTree(request(app, "GET", "admin/territories", null).body());
            assertEquals(4, adminView.path("items").size());
            assertEquals(DATASET, item(adminView, "Rio de Janeiro").path("dataset").path("id").asString());
            assertEquals(approvedCount(app), adminView.path("coverage").path("available").asInt());
            assertEquals(1, JSON.readTree(request(app, "GET", "admin/territories/datasets", null).body())
                    .path("items").size());
        }
    }

    private static int approvedCount(ConfigurableApplicationContext app) {
        return app.getBean(JdbcTemplate.class).queryForObject(
                "SELECT count(*) FROM catalog_territories WHERE approved_version IS NOT NULL", Integer.class);
    }

    @Test void emptyCatalogIsSuccessAndMissingGeometryStaysPending() throws Exception {
        try (var app = start()) {
            jdbc = app.getBean(JdbcTemplate.class);
            jdbc.execute("TRUNCATE catalog_territory_versions, catalog_territories, catalog_datasets");
            register(app, "catalog04@example.test", true);
            accept(login(app, "catalog04@example.test"));
            var response = request(app, "GET", "territories", null);
            // Catálogo publicado e vazio é 200 com lista vazia; falha de banco é que vira 503.
            assertEquals(200, response.statusCode(), response.body());
            var body = JSON.readTree(response.body());
            assertEquals(0, body.path("items").size());
            assertTrue(body.path("dataset").isNull());
            assertEquals(22, body.path("coverage").path("expected").asInt());
            assertEquals(22, body.path("coverage").path("pending").asInt());
            assertEquals(0, body.path("coverage").path("available").asInt());
        }
    }

    /**
     * Achado ALTO do @revisor: cobertura por identidade. Nome do recorte com código falso não infla
     * «disponível»; o código verdadeiro conta; `q` não mexe na conta e o recorte declara sua versão.
     */
    @Test void coverageCountsIbgeCodeNotName() throws Exception {
        try (var app = start()) {
            reset(app);
            publishMunicipality(FAKE_NILOPOLIS, "9999999", "Nilópolis", OTHER_POLYGON);
            register(app, "catalog05@example.test", true);
            accept(login(app, "catalog05@example.test"));

            var forged = JSON.readTree(request(app, "GET", "territories", null).body());
            assertEquals(0, forged.path("coverage").path("available").asInt(),
                    "nome do recorte com código fora do recorte não pode inflar a cobertura");
            assertEquals(22, forged.path("coverage").path("expected").asInt());
            assertEquals(22, forged.path("coverage").path("pending").asInt());
            assertEquals(2, forged.path("coverage").path("expectedRecorteVersion").asInt());
            // O território aparece (existe no catálogo); só não conta como cobertura do recorte.
            assertEquals("9999999", item(forged, "Nilópolis").path("officialCode").asString());

            publishMunicipality(NILOPOLIS, "3303203", "Nilópolis", OTHER_POLYGON);
            var real = JSON.readTree(request(app, "GET", "territories", null).body());
            assertEquals(1, real.path("coverage").path("available").asInt());
            assertEquals(21, real.path("coverage").path("pending").asInt());

            var filtered = JSON.readTree(request(app, "GET", "territories?q=zzz", null).body());
            assertEquals(0, filtered.path("items").size());
            assertEquals(1, filtered.path("coverage").path("available").asInt());
            assertEquals(22, filtered.path("coverage").path("expected").asInt());
        }
    }

    /** Bairro/RA/AP não têm recorte legal: esperado é null, e «disponível» não depende de `q`. */
    @Test void nonMunicipalLevelCoverageIgnoresTheFilter() throws Exception {
        try (var app = start()) {
            reset(app);
            jdbc.update("""
                    INSERT INTO catalog_territories(id,level,official_code,name) VALUES (?, 'MUNICIPALITY','3304557','Rio de Janeiro')
                    """, UUID.fromString(RIO));
            jdbc.update("""
                    INSERT INTO catalog_territories(id,level,official_code,parent_id,name) VALUES
                        (?, 'BAIRRO','001',?, 'Centro'),
                        (?, 'BAIRRO','002',?, 'Ilha do Governador')
                    """, UUID.fromString(BAIRRO_CENTRO), UUID.fromString(RIO),
                    UUID.fromString(BAIRRO_PENDENTE), UUID.fromString(RIO));
            jdbc.update("""
                    INSERT INTO catalog_territory_versions(territory_id,version,dataset_id,boundary,reference_date)
                    VALUES (?,1,?,ST_SetSRID(ST_GeomFromText(?),4326),'2026-10-24')
                    """, UUID.fromString(BAIRRO_CENTRO), UUID.fromString(DATASET), OTHER_POLYGON);
            jdbc.update("UPDATE catalog_territories SET revision=1,approved_version=1 WHERE id=?",
                    UUID.fromString(BAIRRO_CENTRO));

            register(app, "catalog06@example.test", true);
            accept(login(app, "catalog06@example.test"));

            var all = JSON.readTree(request(app, "GET", "territories?level=BAIRRO", null).body());
            assertEquals(2, all.path("items").size(), "o nível inteiro aparece, com e sem geometria");
            assertEquals(1, all.path("coverage").path("available").asInt());
            assertTrue(all.path("coverage").path("expected").isNull(), "sem recorte legal, esperado é desconhecido");
            assertTrue(all.path("coverage").path("pending").isNull());
            assertTrue(all.path("coverage").path("expectedRecorteVersion").isNull());
            assertEquals("SEM_RECORTE_LEGAL", all.path("coverage").path("expectedSource").asString());
            assertEquals(DATASET, all.path("dataset").path("id").asString());

            var filtered = JSON.readTree(request(app, "GET", "territories?level=BAIRRO&q=zzz", null).body());
            assertEquals(0, filtered.path("items").size());
            assertEquals(1, filtered.path("coverage").path("available").asInt(),
                    "cobertura de bairro é contada por consulta própria, não sobre a lista filtrada");
        }
    }

    /** Revisão sem aprovação não vaza histórico no detalhe público; o ADMIN continua vendo tudo. */
    @Test void publicDetailOnlyShowsApprovedVersionHistory() throws Exception {
        try (var app = start()) {
            reset(app);
            publishMunicipality(RIO, "3304557", "Rio de Janeiro", RIO_POLYGON);
            jdbc.update("""
                    INSERT INTO catalog_territory_versions(territory_id,version,dataset_id,boundary,reference_date)
                    VALUES (?,2,?,ST_SetSRID(ST_GeomFromText(?),4326),'2026-10-24')
                    """, UUID.fromString(RIO), UUID.fromString(DATASET), RIO_POLYGON_V2);
            jdbc.update("UPDATE catalog_territories SET revision=2 WHERE id=?", UUID.fromString(RIO));

            register(app, "catalog07@example.test", true);
            accept(login(app, "catalog07@example.test"));
            var detail = JSON.readTree(request(app, "GET", "territories/" + RIO, null).body());
            assertEquals(1, detail.path("versions").size(), "revisão não aprovada não vaza histórico");
            assertEquals(1, detail.path("versions").get(0).path("version").asInt());
            assertEquals(1, detail.path("version").asInt(), "publicado é a versão aprovada");

            administrator(app);
            var adminDetail = JSON.readTree(request(app, "GET", "admin/territories/" + RIO, null).body());
            assertEquals(2, adminDetail.path("versions").size(), "o ADMIN vê a revisão pendente");
        }
    }

    /** A listagem pública só carrega geometria quando pedida; o padrão continua sem polígono. */
    @Test void publicListingCarriesGeometryOnlyWhenAsked() throws Exception {
        try (var app = start()) {
            reset(app);
            publishMunicipality(RIO, "3304557", "Rio de Janeiro", RIO_POLYGON);
            jdbc.update("""
                    INSERT INTO catalog_territories(id,level,official_code,name) VALUES (?, 'MUNICIPALITY','3303302','Niterói')
                    """, UUID.fromString(NITEROI));

            register(app, "catalog08@example.test", true);
            accept(login(app, "catalog08@example.test"));

            var hidden = JSON.readTree(request(app, "GET", "territories", null).body());
            assertTrue(hidden.findValues("geometry").isEmpty(), "listagem não carrega geometria por padrão");

            var shown = JSON.readTree(request(app, "GET", "territories?includeGeometry=true", null).body());
            assertEquals("Polygon", item(shown, "Rio de Janeiro").path("geometry").path("type").asString());
            assertTrue(item(shown, "Niterói").path("geometry").isNull(),
                    "sem versão aprovada não há geometria a devolver");
        }
    }

    /**
     * Falha de banco nunca vira 200 vazio: o serviço responde 503 TERRITORY_CATALOG_UNAVAILABLE.
     * Método: renomeia a tabela do catálogo (DDL reversível) durante a prova e restaura no finally.
     */
    @Test void databaseFailureIsServiceUnavailableInsteadOfEmptyCatalog() throws Exception {
        try (var app = start()) {
            reset(app);
            register(app, "catalog09@example.test", true);
            accept(login(app, "catalog09@example.test"));

            jdbc.execute("ALTER TABLE catalog_territories RENAME TO catalog_territories_offline");
            try {
                var failure = request(app, "GET", "territories", null);
                assertEquals(503, failure.statusCode(), failure.body());
                assertEquals("TERRITORY_CATALOG_UNAVAILABLE",
                        JSON.readTree(failure.body()).path("code").asString());
            } finally {
                jdbc.execute("ALTER TABLE catalog_territories_offline RENAME TO catalog_territories");
            }

            var recovered = request(app, "GET", "territories", null);
            assertEquals(200, recovered.statusCode(), recovered.body());
            assertEquals(22, JSON.readTree(recovered.body()).path("coverage").path("expected").asInt());
        }
    }
}
