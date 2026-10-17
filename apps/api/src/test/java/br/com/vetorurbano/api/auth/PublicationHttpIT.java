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

@Testcontainers
class PublicationHttpIT extends LocalAuthHttpSupport {
    @Container static final PostgreSQLContainer<?> DB=new PostgreSQLContainer<>(DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    static final MutableClock CLOCK=new MutableClock();
    @TestConfiguration static class TimeConfig { @Bean @Primary Clock clock(){return CLOCK;} }
    @Override PostgreSQLContainer<?> database(){return DB;}
    @Override MutableClock clock(){return CLOCK;}
    @Override Class<?> timeConfiguration(){return TimeConfig.class;}
    byte[] admin(org.springframework.context.ConfigurableApplicationContext app)throws Exception {
        UUID id=bootstrap(app);accept(login(app,"admin14@example.test"));byte[] secret=enrolledSecret(app,id);accept(request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))));return secret;
    }
    static Map<String,Object> fact(){
        var result=new LinkedHashMap<String,Object>(Map.of("title","Efeito sintético revisado","description","Interrupção factual sustentada na referência sintética","category","CONTINGENCIA","type","ENERGIA","subtype","NAO_INFORMADO","situation","UNKNOWN","reliability",3,"municipality","Rio de Janeiro","neighborhood","Centro","locationPrecision","TERRITORY"));result.put("occurredAt","2026-10-15T12:00:00Z");return result;
    }
    @Test void reviewRequiresAdminAndServerCoreAndIsIdempotent()throws Exception {
        try(var app=start()) {
            assertEquals(401,request(app,"GET","admin/review-clippings",null).statusCode());
            register(app,"review17@example.test",true);accept(login(app,"review17@example.test"));
            assertEquals(403,request(app,"GET","admin/review-clippings",null).statusCode());
            cookie=null;csrf=null;admin(app);
            var queue=request(app,"GET","admin/review-clippings",null);
            assertEquals(200,queue.statusCode(),queue.body());
        }
    }
    String clipping(org.springframework.context.ConfigurableApplicationContext app,boolean conflict)throws Exception {
        String id="review17-"+UUID.randomUUID();var jdbc=app.getBean(JdbcTemplate.class);
        jdbc.update("INSERT INTO clippings(id,source_id,title,reference,source_published_at,collected_at) VALUES(?,'vu-demo-source-001','Original sintético',?,now(),now())",id,"fixture:"+id);
        jdbc.update("INSERT INTO clipping_reviews(clipping_id,original_text,extracted,priority,essential_conflict,queued_at) VALUES(?,'Original sintético: interrupção no Centro',?::jsonb,'HIGH',?,?)",id,JSON.writeValueAsString(fact()),conflict,java.sql.Timestamp.from(CLOCK.instant().minusSeconds(7200)));
        return id;
    }
    Map<String,Object> create(String key){var body=new LinkedHashMap<String,Object>();body.put("decisionKey",key);body.put("expectedVersion",1);body.put("action","CREATE");body.put("reason","Original conferido e núcleo sustentado");body.put("happeningId","vu-demo-happening-001");body.put("draft",fact());return body;}
    @Test void validatesMandatoryCoreAndEssentialConflictBeforePublishingAndReplaysPersistedDecision()throws Exception {
        String id,key=UUID.randomUUID().toString(),occurrence;
        Map<String,Object> body=create(key);
        try(var app=start()){
            admin(app);id=clipping(app,true);String path="admin/review-clippings/"+id+"/decisions";
            var queue=request(app,"GET","admin/review-clippings?priority=HIGH&order=wait",null);assertTrue(queue.body().contains("7200"));
            assertEquals(403,request(app,"POST",path,body,null,false).statusCode());
            assertEquals(400,request(app,"POST",path,body).statusCode());
            body.put("conflictResolution","Horário e local conferidos em referência independente sintética");
            var incomplete=new LinkedHashMap<>(fact());incomplete.remove("occurredAt");incomplete.put("reliability",5);body.put("draft",incomplete);
            assertEquals(400,request(app,"POST",path,body).statusCode());
            incomplete.put("occurredAt","2026-10-15T12:00:00Z");incomplete.put("locationPrecision","POINT");
            assertEquals(400,request(app,"POST",path,body).statusCode());body.put("draft",fact());
            var published=request(app,"POST",path,body);assertEquals(200,published.statusCode(),published.body());
            occurrence=JSON.readTree(published.body()).path("occurrence_id").asString();assertFalse(occurrence.isBlank());
            assertEquals(published.body(),request(app,"POST",path,body).body());
            var competing=new LinkedHashMap<>(body);competing.put("decisionKey",UUID.randomUUID().toString());assertEquals(409,request(app,"POST",path,competing).statusCode());
            assertTrue(request(app,"GET",query(),null).body().contains(occurrence));
            assertTrue(request(app,"GET","admin/review-clippings/"+id+"/history",null).body().contains("PUBLISHED")||request(app,"GET","admin/review-clippings/"+id+"/history",null).body().contains("APPROVED"));
        }
        try(var app=start()) {assertEquals(200,request(app,"POST","admin/review-clippings/"+id+"/decisions",body).statusCode());}
    }
    @Test void associationDoesNotCreateOccurrenceAndPendingDiscardRequireReasons()throws Exception {
        try(var app=start()){
            admin(app);int before=JSON.readTree(request(app,"GET",query(),null).body()).path("counts").path("occurrences").asInt();String id=clipping(app,false);String path="admin/review-clippings/"+id+"/decisions";
            var body=new LinkedHashMap<String,Object>(Map.of("decisionKey",UUID.randomUUID().toString(),"expectedVersion",1,"action","PENDING","reason",""));
            assertEquals(400,request(app,"POST",path,body).statusCode());body.put("reason","Falta conferência do original");
            assertEquals(200,request(app,"POST",path,body).statusCode());
            body.put("expectedVersion",2);body.put("decisionKey",UUID.randomUUID().toString());body.put("action","ASSOCIATE");body.put("occurrenceId","vu-demo-occurrence-traffic-001");body.put("expectedOccurrenceVersion",1);body.put("reason","Referência do mesmo fato já publicado");
            var result=request(app,"POST",path,body);assertEquals(200,result.statusCode(),result.body());
            var publicRead=JSON.readTree(request(app,"GET",query(),null).body());
            assertEquals(before,publicRead.path("counts").path("occurrences").asInt());assertTrue(publicRead.toString().contains(id));
            String discard=clipping(app,false);var dismiss=Map.<String,Object>of("decisionKey",UUID.randomUUID().toString(),"expectedVersion",1,"action","DISMISS","reason","Publicação sintética não sustenta ocorrência");
            assertEquals(200,request(app,"POST","admin/review-clippings/"+discard+"/decisions",dismiss).statusCode());
            assertFalse(request(app,"GET",query(),null).body().contains(discard));
        }
    }

    @Test void concurrentReplayPublishesOnceAndClosureKeepsHistoricalAuthorship()throws Exception {
        try(var app=start()) {
            byte[] secret=admin(app);String id=clipping(app,false),path="admin/review-clippings/"+id+"/decisions";
            var command=create(UUID.randomUUID().toString());
            var first=java.util.concurrent.CompletableFuture.supplyAsync(()->{try{return request(app,"POST",path,command);}catch(Exception ex){throw new RuntimeException(ex);}});
            var second=java.util.concurrent.CompletableFuture.supplyAsync(()->{try{return request(app,"POST",path,command);}catch(Exception ex){throw new RuntimeException(ex);}});
            var one=first.get();var two=second.get();assertEquals(200,one.statusCode());assertEquals(one.body(),two.body());
            CLOCK.advance(30);
            assertEquals(200,request(app,"POST","account/closure",Map.of("currentPassword","Frase sintética para sessão 14","mfaCode",code(secret))).statusCode());
            cookie=null;csrf=null;admin(app);
            var history=JSON.readTree(request(app,"GET","admin/review-clippings/"+id+"/history",null).body());
            assertEquals(1,history.size());assertTrue(history.get(0).path("author_id").isNull());assertFalse(history.get(0).path("historical_actor_id").isNull());
        }
    }

    @Test void oneClippingPublishesSeveralEffectsWithMunicipalityOnlyWithoutInventingCoordinates()throws Exception {
        try(var app=start()){
            admin(app);String id=clipping(app,false);var body=create(UUID.randomUUID().toString());
            var municipal=new LinkedHashMap<>(fact());municipal.remove("neighborhood");municipal.put("title","Efeito somente municipal");
            var related=new LinkedHashMap<>(fact());related.put("type","ARVORE");related.put("title","Árvore sintética do mesmo contexto");
            body.put("draft",municipal);body.put("additionalEffects",List.of(related));
            var result=request(app,"POST","admin/review-clippings/"+id+"/decisions",body);assertEquals(200,result.statusCode(),result.body());
            var ids=JSON.readTree(result.body()).path("occurrence_ids");assertEquals(2,ids.size());
            var read=JSON.readTree(request(app,"GET",query(),null).body());int found=0;String context=null;
            for(var item:read.path("items"))if(item.path("id").asString().equals(ids.get(0).asString())||item.path("id").asString().equals(ids.get(1).asString())){
                found++;assertTrue(item.path("coordinates").isNull());if(context==null)context=item.path("happeningId").asString();else assertEquals(context,item.path("happeningId").asString());
                if(item.path("title").asString().equals("Efeito somente municipal"))assertEquals("Não informado",item.path("neighborhood").asString());
            }
            assertEquals(2,found);
        }
    }

}
