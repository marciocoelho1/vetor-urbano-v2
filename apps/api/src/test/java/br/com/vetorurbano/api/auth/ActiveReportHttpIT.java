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

/** Synthetic confirmations and durations only; real USER session, HTTP and PostGIS. */
@Testcontainers
class ActiveReportHttpIT extends LocalAuthHttpSupport {
    @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>(DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    static final MutableClock CLOCK = new MutableClock();
    @TestConfiguration static class TimeConfig {
        @Bean @Primary Clock clock() { return CLOCK; }
        @Bean @Primary
        @org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name="synthetic.policy-failure",havingValue="true")
        br.com.vetorurbano.api.occurrences.ActiveReportQueryService.ValidityPolicy failingPolicy() {
            return (effect, at) -> { throw new IllegalStateException("Synthetic policy failure"); };
        }
    }
    @Override PostgreSQLContainer<?> database() { return DB; }
    @Override MutableClock clock() { return CLOCK; }
    @Override Class<?> timeConfiguration() { return TimeConfig.class; }
    static final String QUERY = "active-reports?longitude=-43.1915&latitude=-22.9033&radiusMeters=5000";

    void fixture(JdbcTemplate jdbc) {
        jdbc.update("DELETE FROM occurrence_clippings");
        jdbc.execute("TRUNCATE occurrence_verifications");
        jdbc.update("DELETE FROM publication_versions");
        jdbc.update("DELETE FROM occurrences");
        for (var id : List.of("recent-closed", "recent-ongoing", "old-confirmed", "old-unsupported")) {
            jdbc.update("""
                INSERT INTO occurrences(id,happening_id,title,description,category,occurrence_type,subtype,situation,
                reliability_score,municipality,neighborhood,location_precision,location,occurred_at,publication_status)
                VALUES(?,'vu-demo-happening-001',?,'Sintético 25','TRANSITO','ACIDENTE','COLISAO',?,3,
                'Rio de Janeiro','Centro','POINT',ST_SetSRID(ST_MakePoint(-43.1915,-22.9033),4326),?::timestamptz,'PUBLISHED')
                """, id, id, id.equals("recent-closed") ? "CLOSED" : "ONGOING",
                id.startsWith("recent") ? "2026-10-15T17:00:00Z" : "2026-10-10T12:00:00Z");
        }
    }
    void user(org.springframework.context.ConfigurableApplicationContext app) throws Exception {
        register(app,"active25@example.test",true); accept(login(app,"active25@example.test"));
    }
    @Test void policyFailureIsUnavailableNotEmptyOrInternalError() throws Exception {
        try(var app=start("--synthetic.policy-failure=true")) {
            user(app);fixture(app.getBean(JdbcTemplate.class));
            var response=request(app,"GET",QUERY,null);
            assertEquals(503,response.statusCode(),response.body());
            assertEquals("QUERY_UNAVAILABLE",JSON.readTree(response.body()).path("error").path("code").asString());
            for (var endpoint : List.of("occurrences", "history/occurrences")) {
                var check = request(app, "GET", endpoint + "?situation=ONGOING&checkUpdates=true", null);
                assertEquals(503, check.statusCode(), check.body());
                assertEquals("QUERY_UNAVAILABLE", JSON.readTree(check.body()).path("error").path("code").asString());
                assertFalse(JSON.readTree(check.body()).has("revision"));
            }
        }
    }
    @Test void configuredSyntheticEvidenceExpiresWithoutMutatingAnyRelatedEffect() throws Exception {
        try (var app = start()) {
            user(app);var jdbc=app.getBean(JdbcTemplate.class);fixture(jdbc);
            var admin=bootstrap(app);accept(login(app,"admin14@example.test"));
            byte[] secret=enrolledSecret(app,admin);accept(request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))));
            assertEquals(200,request(app,"POST","active-reports/old-confirmed/verification",Map.of("effectVersion",1,"verificationVersion",0,"situation","ONGOING","confirmedAt",clock().instant().minusSeconds(7140).toString(),"evidence","synthetic-evidence-25")).statusCode());
            var response=request(app,"GET",QUERY,null);assertEquals(200,response.statusCode(),response.body());
            var items=JSON.readTree(response.body()).path("items");
            assertReportItems(items,Set.of("recent-closed","recent-ongoing","old-confirmed"));
            boolean found=false;
            for(var item:items) if(item.path("occurrence").path("id").asString().equals("old-confirmed")) {
                found=true;assertEquals("CONFIRMED",item.path("validity").asString());
                assertEquals("ONGOING",item.path("effectiveSituation").asString());
                assertEquals("OUTSIDE",item.path("occurrence").path("temporalMatch").asString());
            }
            assertTrue(found);
            var beforeExpiry = JSON.readTree(request(app, "GET", "history/occurrences?checkUpdates=true", null).body()).path("revision").asString();
            var fullBeforeExpiry = JSON.readTree(request(app, "GET", "history/occurrences", null).body());
            assertEquals(beforeExpiry, fullBeforeExpiry.path("revision").asString());
            clock().advance(60);
            var afterExpiry = JSON.readTree(request(app, "GET", "history/occurrences?checkUpdates=true", null).body()).path("revision").asString();
            assertFalse(beforeExpiry.equals(afterExpiry), "expiry changes the public projection without a database write");
            assertEquals("ONGOING", findOccurrence(fullBeforeExpiry.path("items"), "old-confirmed").path("effectiveSituation").asString());
            assertEquals("UNKNOWN", findOccurrence(JSON.readTree(request(app, "GET", "history/occurrences", null).body()).path("items"), "old-confirmed").path("effectiveSituation").asString());
            response=request(app,"GET",QUERY,null);assertEquals(200,response.statusCode(),response.body());
            items=JSON.readTree(response.body()).path("items");
            assertReportItems(items,Set.of("recent-closed","recent-ongoing"));
            assertEquals(2,jdbc.queryForObject("SELECT count(*) FROM occurrences WHERE id IN ('old-confirmed','old-unsupported') AND situation='ONGOING'",Integer.class));
        }
    }
    @Test void persistedConfirmationRequiresEvidenceAndRejectsStaleVersion() throws Exception {
        try(var app=start()) {
            user(app);var jdbc=app.getBean(JdbcTemplate.class);fixture(jdbc);
            var admin=bootstrap(app);accept(login(app,"admin14@example.test"));
            byte[] secret=enrolledSecret(app,admin);accept(request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))));
            String path="active-reports/recent-ongoing/verification";
            var command=new HashMap<String,Object>(Map.of("effectVersion",1,"verificationVersion",0,"situation","ONGOING","confirmedAt",clock().instant().toString(),"evidence",""));
            assertEquals(400,request(app,"POST",path,command).statusCode());
            command.put("evidence","Registro humano sintético por efeito 25");
            var response=request(app,"POST",path,command);assertEquals(200,response.statusCode(),response.body());
            assertEquals(409,request(app,"POST",path,command).statusCode());
            assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM occurrence_verifications",Integer.class));
            var reports=JSON.readTree(request(app,"GET",QUERY,null).body()).path("items");
            for(var item:reports) if(item.path("occurrence").path("id").asString().equals("recent-ongoing")) {
                assertEquals("CONFIRMED",item.path("validity").asString());
                assertEquals(clock().instant().toString(),item.path("verification").path("confirmedAt").asString());
                assertTrue(item.path("verification").path("appliesToCurrentVersion").asBoolean());
            }
            clock().advance(7200);
            accept(login(app,"admin14@example.test"));accept(request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))));
            reports=JSON.readTree(request(app,"GET",QUERY,null).body()).path("items");
            for(var item:reports) if(item.path("occurrence").path("id").asString().equals("recent-ongoing")) {
                assertEquals("EXPIRED",item.path("validity").asString());
                assertEquals("UNKNOWN",item.path("effectiveSituation").asString());
                assertEquals("ONGOING",item.path("occurrence").path("situation").asString());
            }
            assertEquals(1,JSON.readTree(request(app,"GET","active-reports/expired",null).body()).size());
            var strict=request(app,"GET","occurrences?situation=ONGOING",null);assertEquals(200,strict.statusCode());
            assertEquals(0,JSON.readTree(strict.body()).path("items").size());
            var unknown=request(app,"GET","history/occurrences?situation=UNKNOWN",null);assertEquals(200,unknown.statusCode());
            assertEquals(3,JSON.readTree(unknown.body()).path("items").size());


            command.put("verificationVersion",1);
            command.put("confirmedAt",clock().instant().toString());
            assertEquals(400,request(app,"POST",path,command).statusCode());
            command.put("evidence","Nova revisão humana sintética por efeito");
            jdbc.update("UPDATE occurrences SET revision=revision+1 WHERE id='recent-ongoing'");
            assertEquals(409,request(app,"POST",path,command).statusCode());
            var edited=request(app,"GET","occurrences/recent-ongoing",null);assertEquals(200,edited.statusCode());
            var editedView=JSON.readTree(edited.body()).path("occurrence");
            assertEquals("ONGOING",editedView.path("situation").asString());assertEquals("UNKNOWN",editedView.path("effectiveSituation").asString());
            assertFalse(editedView.path("verification").path("appliesToCurrentVersion").asBoolean());
        }
    }
    @Test void authorConfirmationDetachesIrreversiblyOnClosure() throws Exception {
        try(var app=start()) {
            user(app);var jdbc=app.getBean(JdbcTemplate.class);fixture(jdbc);
            var actor=jdbc.queryForObject("SELECT id FROM local_accounts WHERE email='active25@example.test'",UUID.class);
            jdbc.update("INSERT INTO publication_versions(occurrence_id,version,action,reason,after_snapshot,author_id,occurred_at) VALUES('recent-ongoing',1,'PUBLISHED','Fixture de autoria','{}',?,?)",actor,java.sql.Timestamp.from(clock().instant()));
            var command=new HashMap<String,Object>(Map.of("effectVersion",1,"verificationVersion",0,"situation","ONGOING","confirmedAt",clock().instant().plusSeconds(1).toString(),"evidence","Evidência humana específica da ocorrência"));
            String path="active-reports/recent-ongoing/verification";
            assertEquals(400,request(app,"POST",path,command).statusCode());
            command.put("confirmedAt",clock().instant().toString());
            assertEquals(403,request(app,"POST",path,command,null,false).statusCode());
            var response=request(app,"POST",path,command);assertEquals(200,response.statusCode(),response.body());
            var history=JSON.readTree(response.body()).path("history");assertEquals(1,history.size());
            assertEquals("USER",history.get(0).path("actor_role").asString());
            var closed=request(app,"POST","account/closure",Map.of("currentPassword","Frase sintética para sessão 14"));
            assertEquals(200,closed.statusCode(),closed.body());
            assertNull(jdbc.queryForObject("SELECT author_id FROM occurrence_verifications",UUID.class));
            var residual=jdbc.queryForObject("SELECT historical_actor_id FROM occurrence_verifications",UUID.class);
            assertNotNull(residual);assertNotEquals(actor,residual);
            assertFalse(jdbc.queryForObject("SELECT to_jsonb(v)::text FROM occurrence_verifications v",String.class).contains(actor.toString()));
            for(var table:jdbc.queryForList("SELECT tablename FROM pg_tables WHERE schemaname='public'",String.class)) {
                assertFalse(Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.\""+table+"\" t WHERE to_jsonb(t)::text LIKE ?)",Boolean.class,"%"+actor+"%")),table);
            }
        }
    }
    @Test void concurrentHumanDecisionsKeepOneWinnerAndRelatedEffectIndependent() throws Exception {
        try(var app=start()) {
            user(app);var jdbc=app.getBean(JdbcTemplate.class);fixture(jdbc);
            assertEquals(403,request(app,"GET","active-reports/recent-ongoing/verification",null).statusCode());
            var admin=bootstrap(app);accept(login(app,"admin14@example.test"));
            assertEquals(403,request(app,"GET","active-reports/expired",null).statusCode());
            byte[] secret=enrolledSecret(app,admin);accept(request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))));
            var command=Map.<String,Object>of("effectVersion",1,"verificationVersion",0,"situation","CLOSED","confirmedAt",clock().instant().toString(),"evidence","Resolução humana sintética específica deste efeito");
            try(var pool=java.util.concurrent.Executors.newFixedThreadPool(2)) {
                var first=pool.submit(()->request(app,"POST","active-reports/recent-ongoing/verification",command));
                var second=pool.submit(()->request(app,"POST","active-reports/recent-ongoing/verification",command));
                assertEquals(Set.of(200,409),Set.of(first.get().statusCode(),second.get().statusCode()));
            }
            var result=request(app,"GET","active-reports/recent-ongoing/verification",null);assertEquals(200,result.statusCode());
            var decision=JSON.readTree(result.body());assertEquals("CLOSED",decision.path("situation").asString());
            assertEquals(2,decision.path("revision").asInt());assertEquals(1,decision.path("history").size());
            assertEquals(2,decision.path("history").get(0).path("effect_version").asInt());
            assertEquals("ONGOING",jdbc.queryForObject("SELECT situation FROM occurrences WHERE id='old-unsupported'",String.class));
        }
    }
    @Test void everyApprovedDurationExpiresInclusivelyWithoutExtendingUnsupportedTypes() throws Exception {
        try(var app=start()) {
            user(app);var jdbc=app.getBean(JdbcTemplate.class);fixture(jdbc);
            var admin=bootstrap(app);accept(login(app,"admin14@example.test"));
            byte[] secret=enrolledSecret(app,admin);accept(request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))));
            var durations=Map.ofEntries(Map.entry("CONGESTIONAMENTO",1800),Map.entry("DISPAROS",1800),
                Map.entry("ACIDENTE",7200),Map.entry("OPERACAO_POLICIAL",7200),Map.entry("INTERDICAO",7200),Map.entry("SEMAFOROS",7200),Map.entry("ALAGAMENTO",7200),Map.entry("INCENDIO",7200),
                Map.entry("DESLIZAMENTO",21600),Map.entry("ARVORE",21600),Map.entry("ENERGIA",21600),Map.entry("AGUA",21600),Map.entry("OBRAS",86400),
                Map.entry("ROUBO",0),Map.entry("FURTO",0),Map.entry("CONFRONTO",0));
            var expected=new HashSet<>(Set.of("recent-closed","recent-ongoing"));
            for(var entry:durations.entrySet()) {
                String id="duration-"+entry.getKey();
                jdbc.update("""
                    INSERT INTO occurrences(id,happening_id,title,description,category,occurrence_type,subtype,situation,reliability_score,municipality,neighborhood,location_precision,location,occurred_at,publication_status)
                    SELECT ?,happening_id,?,description,category,?,subtype,situation,reliability_score,municipality,neighborhood,location_precision,location,occurred_at,publication_status FROM occurrences WHERE id='old-unsupported'
                    """,id,id,entry.getKey());
                var at=clock().instant().minusSeconds(Math.max(0,entry.getValue()-1));
                var response=request(app,"POST","active-reports/"+id+"/verification",Map.of("effectVersion",1,"verificationVersion",0,"situation","ONGOING","confirmedAt",at.toString(),"evidence","Revisão humana sintética de "+id));
                assertEquals(200,response.statusCode(),response.body());
                if(entry.getValue()>0) expected.add(id);
            }
            var response=request(app,"GET",QUERY,null);assertEquals(200,response.statusCode());
            assertReportItems(JSON.readTree(response.body()).path("items"),expected);
            clock().advance(1);
            response=request(app,"GET",QUERY,null);assertEquals(200,response.statusCode());
            assertReportItems(JSON.readTree(response.body()).path("items"),Set.of("recent-closed","recent-ongoing"));
            assertEquals(13,JSON.readTree(request(app,"GET","active-reports/expired",null).body()).size());
            assertEquals(16,jdbc.queryForObject("SELECT count(*) FROM occurrences WHERE id LIKE 'duration-%' AND situation='ONGOING'",Integer.class));
        }
    }
    @Test void approvedNonExtendedTypeIsLabelledAsDecisionNotAsMissingConfiguration() throws Exception {
        try(var app=start()) {
            user(app);var jdbc=app.getBean(JdbcTemplate.class);fixture(jdbc);
            var admin=bootstrap(app);accept(login(app,"admin14@example.test"));
            byte[] secret=enrolledSecret(app,admin);accept(request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))));
            for(var type:List.of("ROUBO","TIPO_NAO_CATALOGADO")) {
                String id="not-window-"+type;
                jdbc.update("""
                    INSERT INTO occurrences(id,happening_id,title,description,category,occurrence_type,subtype,situation,reliability_score,municipality,neighborhood,location_precision,location,occurred_at,publication_status)
                    SELECT ?,happening_id,?,description,category,?,subtype,'ONGOING',reliability_score,municipality,neighborhood,location_precision,location,?::timestamptz,publication_status FROM occurrences WHERE id='old-unsupported'
                    """,id,id,type,clock().instant().minusSeconds(3600).toString());
                assertEquals(200,request(app,"POST","active-reports/"+id+"/verification",Map.of("effectVersion",1,"verificationVersion",0,"situation","ONGOING","confirmedAt",clock().instant().toString(),"evidence","Revisão humana sintética de "+id)).statusCode());
            }
            var items=JSON.readTree(request(app,"GET",QUERY,null).body()).path("items");
            var seen=new HashMap<String,String>();
            var effective=new HashMap<String,String>();
            for(var item:items) {
                var id=item.path("occurrence").path("id").asString();
                if(id.startsWith("not-window-")) {
                    seen.put(id,item.path("validity").asString());
                    effective.put(id,item.path("effectiveSituation").asString());
                }
            }
            // Approved decision: roubo has no automatic window, which is not a missing configuration.
            assertEquals("NO_APPROVED_EXTENSION",seen.get("not-window-ROUBO"));
            assertEquals("UNKNOWN",effective.get("not-window-ROUBO"));
            assertEquals("MISSING_CONFIGURATION",seen.get("not-window-TIPO_NAO_CATALOGADO"));
            for(var item:JSON.readTree(request(app,"GET","active-reports/expired",null).body()))
                assertFalse(item.path("id").asString().startsWith("not-window-"),"tipo sem janela não aparece como expirado");
            assertNull(jdbc.queryForObject("SELECT expires_at FROM occurrence_verifications WHERE occurrence_id='not-window-ROUBO'",java.sql.Timestamp.class));
        }
    }
    private static tools.jackson.databind.JsonNode findOccurrence(tools.jackson.databind.JsonNode items, String id) {
        for (var item : items) if (id.equals(item.path("id").asString())) return item;
        throw new AssertionError("Missing occurrence " + id);
    }

    void assertReportItems(tools.jackson.databind.JsonNode items, Set<String> expectedIds) {
        var ids=new HashSet<String>();
        for(var item:items) {
            var id=item.path("occurrence").path("id").asString();
            assertTrue(ids.add(id),"Duplicate occurrence: "+id);
            if(id.equals("recent-closed")) {
                assertEquals("CLOSED",item.path("occurrence").path("situation").asString());
                assertEquals("CLOSED",item.path("effectiveSituation").asString());
            }
            if(id.equals("recent-ongoing")) {
                assertEquals("ONGOING",item.path("occurrence").path("situation").asString());
                assertEquals("UNKNOWN",item.path("effectiveSituation").asString());
            }
        }
        assertEquals(expectedIds,ids);
    }
    @Test void requiresUserSessionValidatesInputAndSeparatesEmptyFromDatabaseFailure() throws Exception {
        try (var app = start()) {
            assertEquals(401,request(app,"GET",QUERY,null).statusCode());
            user(app); fixture(app.getBean(JdbcTemplate.class));
            var result=request(app,"GET",QUERY,null); assertEquals(200,result.statusCode(),result.body());
            assertEquals("no-store",result.headers().firstValue("cache-control").orElseThrow());
            var data=JSON.readTree(result.body()); assertEquals("2026-10-15T18:00:00Z",data.path("evaluatedAt").asString());
            assertEquals(2,data.path("items").size());
            var ids = new HashSet<String>();
            for (var item : data.path("items")) ids.add(item.path("occurrence").path("id").asString());
            assertEquals(Set.of("recent-closed", "recent-ongoing"),ids);
            assertEquals(403,request(app,"GET","admin/logs",null).statusCode());
            for (var item : data.path("items")) {
                if (item.path("occurrence").path("id").asString().equals("recent-ongoing")) {
                    assertEquals("ONGOING",item.path("occurrence").path("situation").asString());
                    assertEquals("UNKNOWN",item.path("effectiveSituation").asString());
                    assertEquals("MISSING_EVIDENCE",item.path("validity").asString());
                }
            }
            for (String bad : List.of("active-reports",QUERY.replace("5000","5001"), QUERY.replace("5000","0"), QUERY.replace("5000","1.5"), QUERY.replace("-22.9033","91"),QUERY.replace("-43.1915","NaN"),QUERY+"&longitude=0"))
                assertEquals(400,request(app,"GET",bad,null).statusCode(),bad);
            var empty=request(app,"GET","active-reports?longitude=0&latitude=0&radiusMeters=1",null);
            assertEquals(200,empty.statusCode()); assertTrue(JSON.readTree(empty.body()).path("items").isEmpty());
            var jdbc=app.getBean(JdbcTemplate.class); jdbc.execute("ALTER TABLE occurrences RENAME TO occurrences_unavailable");
            try { assertEquals(503,request(app,"GET",QUERY,null).statusCode()); }
            finally { jdbc.execute("ALTER TABLE occurrences_unavailable RENAME TO occurrences"); }
            var userId=jdbc.queryForObject("SELECT id FROM local_accounts WHERE email='active25@example.test' AND role='USER'",UUID.class);
            assertNotNull(userId);
            var storedEvents=jdbc.queryForList("SELECT id,account_id,module,event_class,outcome,parameters::text AS parameters FROM auth_audit_events WHERE action='ACTIVE_REPORT_QUERY' ORDER BY id");
            assertEquals(2,storedEvents.size());
            var expectedParameters=List.of(JSON.readTree("{\"hasSpatialFilter\":true,\"occurrences\":2}"),
                    JSON.readTree("{\"hasSpatialFilter\":true,\"occurrences\":0}"));
            var expectedByEventId=new HashMap<String,tools.jackson.databind.JsonNode>();
            for(int i=0;i<storedEvents.size();i++) {
                var event=storedEvents.get(i);
                assertEquals(userId,event.get("account_id"));
                assertEquals("query",event.get("module"));assertEquals("USE",event.get("event_class"));
                assertEquals("SUCCEEDED",event.get("outcome"));
                var params=JSON.readTree((String)event.get("parameters"));
                assertEquals(expectedParameters.get(i),params);
                expectedByEventId.put("access-"+event.get("id"),expectedParameters.get(i));
            }
            var admin=bootstrap(app);accept(login(app,"admin14@example.test"));
            byte[] secret=enrolledSecret(app,admin);accept(request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))));
            var logs=request(app,"GET","admin/logs?eventClass=USE",null);assertEquals(200,logs.statusCode());
            var projectedIds=new HashSet<String>();
            for(var event:JSON.readTree(logs.body()).path("items")) if(event.path("action").asString().equals("ACTIVE_REPORT_QUERY")) {
                var eventId=event.path("id").asString();assertTrue(projectedIds.add(eventId));
                assertTrue(expectedByEventId.containsKey(eventId));
                assertEquals(userId.toString(),event.path("actor").asString());
                assertEquals("SUCCEEDED",event.path("outcome").asString());
                assertEquals(expectedByEventId.get(eventId),event.path("parameters"));
                assertEquals("query",event.path("module").asString());assertEquals("USE",event.path("eventClass").asString());
                var params=event.path("parameters");assertTrue(params.path("hasSpatialFilter").asBoolean());
                assertFalse(params.toString().contains("-43.1915"));assertFalse(params.toString().contains("5000"));
                assertFalse(params.has("longitude"));assertFalse(params.has("latitude"));assertFalse(params.has("radiusMeters"));assertFalse(params.has("bounds"));
            }
            assertEquals(expectedByEventId.keySet(),projectedIds);
        }
    }
}
