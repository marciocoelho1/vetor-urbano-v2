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

/** Ticket 26: real HTTP boundary and disposable PostGIS, no territorial SQL fixtures. */
@Testcontainers
class TerritorialHttpIT extends LocalAuthHttpSupport {
    @Container static final PostgreSQLContainer<?> DB=new PostgreSQLContainer<>(DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    static final MutableClock CLOCK=new MutableClock();
    @TestConfiguration static class TimeConfig { @Bean @Primary Clock clock(){return CLOCK;} }
    @Override PostgreSQLContainer<?> database(){return DB;}
    @Override MutableClock clock(){return CLOCK;}
    @Override Class<?> timeConfiguration(){return TimeConfig.class;}

    static Map<String,Object> draft(int expected,String name) {
        var body=new LinkedHashMap<String,Object>();
        body.put("expectedVersion",expected);body.put("name",name);body.put("indicatedGroup",null);
        body.put("sourceId",null);body.put("evidenceReference","Documento sintético 26, página 4");
        body.put("referenceDate",null);body.put("limitations","Simulação sem validação operacional");
        body.put("geometry",Map.of("type","Polygon","coordinates",List.of(List.of(List.of(-43,-23),List.of(-42,-23),List.of(-42,-22),List.of(-43,-23)))));
        body.put("justification","Conferência sintética dos detalhes territoriais");return body;
    }
    UUID admin; byte[] secret;
    void administrator(org.springframework.context.ConfigurableApplicationContext app)throws Exception {
        admin=bootstrap(app);accept(login(app,"admin14@example.test"));
        secret=enrolledSecret(app,admin);accept(request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))));
    }
    @Test void protectsWritesAndPublishesOnlyExplicitlyApprovedSnapshots()throws Exception {
        try(var app=start()) {
            String id=UUID.randomUUID().toString(),path="admin/risk-areas/"+id;
            assertEquals(401,request(app,"GET","risk-areas",null).statusCode());
            register(app,"territory26@example.test",true);accept(login(app,"territory26@example.test"));
            assertEquals(403,request(app,"POST",path+"/versions",draft(0,"Área 1")).statusCode());
            assertEquals(403,request(app,"POST",path+"/approvals",Map.of("expectedVersion",1,"justification","Não autorizado")).statusCode());
            admin=bootstrap(app);accept(login(app,"admin14@example.test"));
            assertEquals(403,request(app,"GET","admin/risk-areas",null).statusCode());
            assertEquals(403,request(app,"POST",path+"/versions",draft(0,"Área 1")).statusCode());
            secret=enrolledSecret(app,admin);accept(request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))));
            assertEquals(403,request(app,"POST",path+"/versions",draft(0,"Área 1"),null,false).statusCode());
            var response=request(app,"POST",path+"/versions",draft(0,"Área 1"));
            assertEquals(200,response.statusCode(),response.body());
            var first=JSON.readTree(response.body());assertEquals(id,first.path("territoryId").asString());
            assertEquals(1,first.path("version").asInt());assertTrue(first.path("referenceDate").isNull());
            assertTrue(first.path("indicatedGroup").isNull());assertTrue(first.path("approvedVersion").isNull());assertFalse(first.path("recordedAt").isNull());
            assertEquals(admin.toString(),first.path("actor").asString());assertEquals("ADMIN",first.path("actorRole").asString());
            assertTrue(JSON.readTree(request(app,"GET","risk-areas",null).body()).path("items").isEmpty());
            var approval=Map.<String,Object>of("expectedVersion",1,"justification","Publicação sintética explicitamente conferida");
            assertEquals(403,request(app,"POST",path+"/approvals",approval,null,false).statusCode());
            response=request(app,"POST",path+"/approvals",approval);assertEquals(200,response.statusCode(),response.body());
            assertEquals(409,request(app,"POST",path+"/approvals",approval).statusCode());
            var second=draft(1,"Área 2");second.put("referenceDate","2019-03-04");
            second.put("geometry",Map.of("type","MultiPolygon","coordinates",List.of(List.of(List.of(List.of(0,0),List.of(1,0),List.of(1,1),List.of(0,0))))));
            response=request(app,"POST",path+"/versions",second);assertEquals(200,response.statusCode(),response.body());
            var common=request(app,"GET","risk-areas",null);assertTrue(common.body().contains("Área 1"));assertFalse(common.body().contains("Área 2"));
            assertFalse(common.body().contains("actor"));assertFalse(common.body().contains("justification"));
            assertEquals(409,request(app,"POST",path+"/versions",second).statusCode());
            assertEquals(409,request(app,"POST",path+"/approvals",approval).statusCode());
            response=request(app,"POST",path+"/approvals",Map.of("expectedVersion",2,"justification","Aprovar revisão sustentada"));assertEquals(200,response.statusCode(),response.body());
            var items=JSON.readTree(request(app,"GET","risk-areas",null).body()).path("items");
            assertEquals("Área 2",items.get(0).path("name").asString());assertEquals("2019-03-04",items.get(0).path("referenceDate").asString());
            var history=JSON.readTree(request(app,"GET",path,null).body()).path("items");assertEquals(2,history.size());
            assertEquals("Área 1",history.get(0).path("name").asString());assertTrue(history.get(0).path("referenceDate").isNull());
            assertEquals("MultiPolygon",history.get(1).path("geometry").path("type").asString());
            assertTrue(request(app,"GET","admin/logs?eventClass=ADMIN",null).body().contains("TERRITORY_APPROVED"));
            cookie=null;csrf=null;accept(login(app,"territory26@example.test"));
            assertEquals(403,request(app,"GET","admin/risk-areas",null).statusCode());
            assertEquals(403,request(app,"GET",path,null).statusCode());
            var userResponse=request(app,"GET","risk-areas",null);
            assertEquals(200,userResponse.statusCode(),userResponse.body());
            var userItem=JSON.readTree(userResponse.body()).path("items").get(0);
            assertEquals(id,userItem.path("territoryId").asString());
            assertEquals(2,userItem.path("version").asInt());
            assertEquals("Área 2",userItem.path("name").asString());
            assertEquals("2019-03-04",userItem.path("referenceDate").asString());
            assertFalse(userItem.has("actor"));assertFalse(userItem.has("justification"));
        }
    }
    @Test void refusesDisputedWithoutSpecificEvidenceAndRollsBackInvalidGeometry()throws Exception {
        try(var app=start()) {
            administrator(app);String path="admin/risk-areas/"+UUID.randomUUID();
            var body=draft(0,"Área de divergência");body.put("indicatedGroup","Disputado");body.put("evidenceReference",null);
            assertEquals(400,request(app,"POST",path+"/versions",body).statusCode());
            body.put("indicatedGroup",null);body.put("geometry",Map.of("type","Point","coordinates",List.of(0,0)));
            assertEquals(400,request(app,"POST",path+"/versions",body).statusCode());
            assertTrue(JSON.readTree(request(app,"GET",path,null).body()).path("items").isEmpty());
            body=draft(0,"Área de divergência");body.put("indicatedGroup","Disputado");
            var response=request(app,"POST",path+"/versions",body);assertEquals(200,response.statusCode(),response.body());
            assertEquals("Disputado",JSON.readTree(response.body()).path("indicatedGroup").asString());
        }
    }
    @Test void concurrentRevisionsAndApprovalsHaveOneWinnerAndKeepProjectionConsistent()throws Exception {
        try(var app=start()) {
            administrator(app);String path="admin/risk-areas/"+UUID.randomUUID();
            try(var pool=java.util.concurrent.Executors.newFixedThreadPool(2)) {
                var gate=new java.util.concurrent.CountDownLatch(1);
                java.util.concurrent.Callable<Integer> append=()->{gate.await();return request(app,"POST",path+"/versions",draft(0,"Concorrente")).statusCode();};
                var first=pool.submit(append);var second=pool.submit(append);gate.countDown();
                var codes=new ArrayList<>(List.of(first.get(),second.get()));Collections.sort(codes);assertEquals(List.of(200,409),codes);
                var approveGate=new java.util.concurrent.CountDownLatch(1);
                java.util.concurrent.Callable<Integer> approve=()->{approveGate.await();return request(app,"POST",path+"/approvals",Map.of("expectedVersion",1,"justification","Decisão concorrente")).statusCode();};
                first=pool.submit(approve);second=pool.submit(approve);approveGate.countDown();
                codes=new ArrayList<>(List.of(first.get(),second.get()));Collections.sort(codes);assertEquals(List.of(200,409),codes);
            }
            var history=JSON.readTree(request(app,"GET",path,null).body()).path("items");assertEquals(1,history.size());
            assertEquals(1,history.get(0).path("approvedVersion").asInt());
            var common=JSON.readTree(request(app,"GET","risk-areas",null).body()).path("items");assertEquals(1,common.size());
            assertEquals(1,common.get(0).path("version").asInt());
        }
    }
    @Test void sourceVersionAndKnownReferenceStayIndependentOfLaterCatalogueEdits()throws Exception {
        try(var app=start()) {
            administrator(app);
            var source=new LinkedHashMap<String,Object>();
            source.put("name","Fonte original 26");source.put("channel","Canal sintético");source.put("url","https://fonte26.example.test/documento");
            source.put("territories",List.of("Rio de Janeiro"));source.put("pillars",List.of("TRANSITO"));
            source.put("accessMethod","MANUAL");source.put("rating",4);source.put("ratingJustification","Avaliação sintética sem dados reais");
            var created=request(app,"POST","admin/sources",source);assertEquals(201,created.statusCode(),created.body());
            String sourceId=JSON.readTree(created.body()).path("id").asString();
            String path="admin/risk-areas/"+UUID.randomUUID();var body=draft(0,"Fonte preservada");
            body.put("sourceId",sourceId);body.put("referenceDate","2019-03-04");
            var response=request(app,"POST",path+"/versions",body);assertEquals(200,response.statusCode(),response.body());
            source.put("expectedVersion",1);source.put("name","Fonte renomeada 26");source.put("url",null);
            var updated=request(app,"PUT","admin/sources/"+sourceId,source);assertEquals(200,updated.statusCode(),updated.body());
            assertEquals(200,request(app,"POST",path+"/approvals",Map.of("expectedVersion",1,"justification","Preservar referência consultada")).statusCode());
            var saved=JSON.readTree(request(app,"GET","risk-areas",null).body()).path("items").get(0);
            assertEquals(sourceId,saved.path("sourceId").asString());assertEquals("Fonte original 26",saved.path("sourceName").asString());
            assertEquals("https://fonte26.example.test/documento",saved.path("sourceUrl").asString());
            assertEquals("2019-03-04",saved.path("referenceDate").asString());
            assertEquals("Documento sintético 26, página 4",saved.path("evidenceReference").asString());
            assertEquals("Simulação sem validação operacional",saved.path("limitations").asString());
        }
    }
    @Test void projectionFailureRollsBackApprovalAndAuditWithoutPublishingPartialState()throws Exception {
        try(var app=start()) {
            administrator(app);String path="admin/risk-areas/"+UUID.randomUUID();
            assertEquals(200,request(app,"POST",path+"/versions",draft(0,"Transação indivisível")).statusCode());
            var jdbc=app.getBean(JdbcTemplate.class);
            jdbc.execute("CREATE FUNCTION reject_test_projection() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic projection failure' USING ERRCODE='23514'; END $$");
            jdbc.execute("CREATE TRIGGER reject_test_projection BEFORE INSERT ON correction_area_targets FOR EACH ROW EXECUTE FUNCTION reject_test_projection()");
            var approval=Map.<String,Object>of("expectedVersion",1,"justification","Não publicar parcialmente");
            try {
                assertEquals(400,request(app,"POST",path+"/approvals",approval).statusCode());
                assertTrue(JSON.readTree(request(app,"GET",path,null).body()).path("items").get(0).path("approvedVersion").isNull());
                assertTrue(JSON.readTree(request(app,"GET","risk-areas",null).body()).path("items").isEmpty());
                assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM territorial_approvals",Integer.class));
                assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM territorial_audit_events WHERE action='TERRITORY_APPROVED'",Integer.class));
            } finally {
                jdbc.execute("DROP TRIGGER reject_test_projection ON correction_area_targets");jdbc.execute("DROP FUNCTION reject_test_projection()");
            }
            assertEquals(200,request(app,"POST",path+"/approvals",approval).statusCode());
        }
    }
    @Test void malformedPolygonIsAClientErrorAndDoesNotConsumeIdentity()throws Exception {
        try(var app=start()) {
            administrator(app);String path="admin/risk-areas/"+UUID.randomUUID();
            var body=draft(0,"Geometria inválida");
            body.put("geometry",Map.of("type","Polygon","coordinates",List.of(List.of(List.of(0,0),List.of(1,0),List.of(1,1)))));
            var response=request(app,"POST",path+"/versions",body);assertEquals(400,response.statusCode(),response.body());
            assertEquals(200,request(app,"POST",path+"/versions",draft(0,"Sem versão consumida")).statusCode());
        }
    }
    @Test void closureDetachesDomainAuthorshipWithoutResidualLoginUuid()throws Exception {
        try(var app=start()) {
            administrator(app);String path="admin/risk-areas/"+UUID.randomUUID();
            assertEquals(200,request(app,"POST",path+"/versions",draft(0,"Área preservada")).statusCode());
            assertEquals(200,request(app,"POST",path+"/approvals",Map.of("expectedVersion",1,"justification","Aprovação a preservar")).statusCode());
            clock().advance(30);
            var response=request(app,"POST","account/closure",Map.of("currentPassword","Frase sintética para sessão 14","mfaCode",code(secret)));
            assertEquals(200,response.statusCode(),response.body());
            var jdbc=app.getBean(JdbcTemplate.class);
            for(String table:List.of("territorial_versions","territorial_approvals","territorial_audit_events","correction_area_targets","auth_audit_events"))
                assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM "+table+" t WHERE to_jsonb(t)::text LIKE ?",Integer.class,"%"+admin+"%"),table);
            assertEquals(1,jdbc.queryForObject("SELECT count(DISTINCT historical_actor_id) FROM territorial_versions",Integer.class));
            UUID domain=jdbc.queryForObject("SELECT historical_actor_id FROM territorial_versions",UUID.class);
            assertEquals(domain,jdbc.queryForObject("SELECT historical_actor_id FROM territorial_approvals",UUID.class));
            assertNotEquals(domain,jdbc.queryForObject("SELECT historical_actor_id FROM account_audit_events WHERE action='ACCOUNT_CLOSURE'",UUID.class));
            cookie=null;csrf=null;register(app,"after26@example.test",true);accept(login(app,"after26@example.test"));
            assertTrue(request(app,"GET","risk-areas",null).body().contains("Área preservada"));
            var eliminated=admin;
            for(String table:jdbc.queryForList("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'spatial_ref_sys'",String.class))
                assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM \""+table+"\" t WHERE to_jsonb(t)::text LIKE ?",Integer.class,"%"+eliminated+"%"),table);
            administrator(app);
            var history=JSON.readTree(request(app,"GET",path,null).body()).path("items");
            assertTrue(history.get(0).path("actor").isNull());assertEquals(domain.toString(),history.get(0).path("historicalActor").asString());
            var logs=request(app,"GET","admin/logs?eventClass=ADMIN",null);
            assertEquals(200,logs.statusCode(),logs.body());assertFalse(logs.body().contains(eliminated.toString()));
            boolean found=false;
            for(var event:JSON.readTree(logs.body()).path("items"))if(event.path("action").asString().equals("TERRITORY_APPROVED")) {
                found=true;assertTrue(event.path("actor").isNull());assertEquals(domain.toString(),event.path("historicalActor").asString());
                assertEquals("ADMIN",event.path("eventClass").asString());
                assertFalse(event.path("parameters").toString().contains("geometry"));
                assertEquals("Área preservada",event.path("parameters").path("after").path("name").asString());
            }
            assertTrue(found,"Logs devem projetar a decisão territorial com autoria histórica");
        }
    }

    @Test void editsFieldsWithoutResendingGeometryAndInheritsTheBoundary()throws Exception {
        try(var app=start()) {
            administrator(app);
            String id=UUID.randomUUID().toString(),path="admin/risk-areas/"+id;
            assertEquals(200,request(app,"POST",path+"/versions",draft(0,"Área original")).statusCode());
            var fields=new LinkedHashMap<String,Object>();
            fields.put("expectedVersion",1);fields.put("name","Área renomeada");
            fields.put("indicatedGroup","CV");fields.put("sourceId",null);
            fields.put("evidenceReference","Ofício sintético 12");fields.put("referenceDate","2026-09-30");
            fields.put("limitations","Grupo indicado pode mudar sem aviso prévio");
            fields.put("justification","Edição de campos da área sem alterar a geometria vigente");
            var response=request(app,"POST",path+"/versions",fields);
            assertEquals(200,response.statusCode(),response.body());
            var version=JSON.readTree(response.body());
            assertEquals("Área renomeada",version.path("name").asString());
            assertEquals("CV",version.path("indicatedGroup").asString());
            assertEquals("Polygon",version.path("geometry").path("type").asString(),
                    "geometria ausente é herdada da versão vigente, sem reenvio");
            // Aprovação continua sendo decisão explícita: editar campo não publica sozinho.
            assertEquals(200,request(app,"POST",path+"/approvals",
                    Map.of("expectedVersion",2,"justification","Aprovada após edição de campos")).statusCode());
            var publicItems=JSON.readTree(request(app,"GET","risk-areas",null).body()).path("items");
            assertEquals("Área renomeada",publicItems.get(0).path("name").asString());
            assertEquals("2026-09-30",publicItems.get(0).path("referenceDate").asString());
        }
    }
}
