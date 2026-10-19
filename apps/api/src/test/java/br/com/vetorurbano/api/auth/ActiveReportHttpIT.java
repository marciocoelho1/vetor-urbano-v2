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
        }
    }
    @Test void configuredSyntheticEvidenceExpiresWithoutMutatingAnyRelatedEffect() throws Exception {
        try (var app = start("--vetor.active-reports.validity-by-type[ACIDENTE]=PT60S",
                "--vetor.active-reports.confirmations[old-confirmed].type=ACIDENTE",
                "--vetor.active-reports.confirmations[old-confirmed].confirmed-at=2026-10-15T18:00:00Z",
                "--vetor.active-reports.confirmations[old-confirmed].reference=synthetic-evidence-25")) {
            user(app);var jdbc=app.getBean(JdbcTemplate.class);fixture(jdbc);
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
            clock().advance(60);
            response=request(app,"GET",QUERY,null);assertEquals(200,response.statusCode(),response.body());
            items=JSON.readTree(response.body()).path("items");
            assertReportItems(items,Set.of("recent-closed","recent-ongoing"));
            assertEquals(2,jdbc.queryForObject("SELECT count(*) FROM occurrences WHERE id IN ('old-confirmed','old-unsupported') AND situation='ONGOING'",Integer.class));
        }
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
                    assertEquals("MISSING_CONFIGURATION",item.path("validity").asString());
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
