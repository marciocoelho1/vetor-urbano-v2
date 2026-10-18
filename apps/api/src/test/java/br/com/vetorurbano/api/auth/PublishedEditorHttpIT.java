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

/**
 * Ticket 18 over real HTTP and PostgreSQL/PostGIS: a prepared correction does not touch the published
 * version until an ADMIN approves it, a withdrawal removes the register from every later read while the
 * internal trail survives, and a stale or competing decision is refused instead of silently overwriting.
 */
@Testcontainers
class PublishedEditorHttpIT extends LocalAuthHttpSupport {
    @Container static final PostgreSQLContainer<?> DB=new PostgreSQLContainer<>(DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    static final MutableClock CLOCK=new MutableClock();
    @TestConfiguration static class TimeConfig { @Bean @Primary Clock clock(){return CLOCK;} }
    @Override PostgreSQLContainer<?> database(){return DB;}
    @Override MutableClock clock(){return CLOCK;}
    @Override Class<?> timeConfiguration(){return TimeConfig.class;}
    byte[] admin(org.springframework.context.ConfigurableApplicationContext app)throws Exception {
        UUID id=bootstrap(app);accept(login(app,"admin14@example.test"));byte[] secret=enrolledSecret(app,id);accept(request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))));return secret;
    }
    String publishedId(org.springframework.context.ConfigurableApplicationContext app){
        return app.getBean(JdbcTemplate.class).queryForObject("SELECT id FROM occurrences WHERE publication_status='PUBLISHED' AND occurred_at IS NOT NULL ORDER BY id LIMIT 1",String.class);
    }
    int revision(org.springframework.context.ConfigurableApplicationContext app,String id){
        return app.getBean(JdbcTemplate.class).queryForObject("SELECT revision FROM occurrences WHERE id=?",Integer.class,id);
    }
    int version(org.springframework.context.ConfigurableApplicationContext app,UUID id){
        return app.getBean(JdbcTemplate.class).queryForObject("SELECT version FROM correction_requests WHERE id=?",Integer.class,id);
    }
    String state(org.springframework.context.ConfigurableApplicationContext app,UUID id){
        return app.getBean(JdbcTemplate.class).queryForObject("SELECT state FROM correction_requests WHERE id=?",String.class,id);
    }
    String title(org.springframework.context.ConfigurableApplicationContext app,String id){
        return app.getBean(JdbcTemplate.class).queryForObject("SELECT title FROM occurrences WHERE id=?",String.class,id);
    }
    UUID correction(org.springframework.context.ConfigurableApplicationContext app,String target,String problem)throws Exception {
        var created=request(app,"POST","corrections",Map.of("targetKind","OCCURRENCE","targetId",target,"problemType",problem,"explanation","Título sintético divergente do publicado","references","conferência sintética"));
        assertEquals(201,created.statusCode(),created.body());
        return UUID.fromString(JSON.readTree(created.body()).path("id").asString());
    }
    void review(org.springframework.context.ConfigurableApplicationContext app,UUID id)throws Exception {
        assertEquals(200,request(app,"POST","admin/corrections/"+id+"/decisions",Map.of("expectedVersion",version(app,id),"state","IN_REVIEW","reason","Conferência administrativa iniciada")).statusCode());
    }
    Map<String,Object> proposal(String title){var body=new LinkedHashMap<String,Object>();body.put("title",title);body.put("description","Descrição corrigida com evidência sintética");return body;}
    /** Cópia fiel do registro publicado: usada para provar que uma proposta idêntica não é aceita. */
    Map<String,Object> publishedFact(org.springframework.context.ConfigurableApplicationContext app,String id){
        var current=app.getBean(JdbcTemplate.class).queryForMap("SELECT title,description FROM occurrences WHERE id=?",id);
        var body=new LinkedHashMap<String,Object>();body.put("title",current.get("title"));body.put("description",current.get("description"));return body;
    }
    Map<String,Object> preparation(String action,Map<String,Object> changes,int expectedVersion){
        var body=new LinkedHashMap<String,Object>();body.put("action",action);body.put("changes",changes);body.put("reason","Conferência administrativa sustentada");body.put("evidence","Evidência independente sintética");
        body.put("essentialReason",action.equals("RETRACTION")?"FATO_INCORRETO":null);
        body.put("expectedVersion",expectedVersion);return body;
    }
    Map<String,Object> decision(String decision,int expectedVersion){return Map.of("decision",decision,"reason","Decisão administrativa sustentada","expectedVersion",expectedVersion);}

    @Test void approvalAppendsAVersionOnlyAfterExplicitReviewAndNeverFromPreparation()throws Exception {
        String occurrence;UUID id;
        try(var app=start()){
            assertEquals(401,request(app,"GET","admin/corrections/"+UUID.randomUUID()+"/publication",null).statusCode());
            register(app,"editor18a@example.test",true);accept(login(app,"editor18a@example.test"));
            occurrence=publishedId(app);
            id=correction(app,occurrence,"CONTEUDO");
            assertEquals(403,request(app,"POST","admin/corrections/"+id+"/publication/preparations",preparation("CORRECTION",proposal("Título corrigido"),revision(app,occurrence))).statusCode());
            assertEquals(403,request(app,"GET","admin/corrections/"+id+"/publication",null).statusCode());
            cookie=null;csrf=null;admin(app);
            assertEquals(404,request(app,"GET","admin/corrections/"+UUID.randomUUID()+"/publication",null).statusCode());
            assertEquals(200,request(app,"GET","admin/corrections/"+id+"/publication",null).statusCode());
            // Approval before the administrative review is a document error, not an application.
            // A proposta que não move nenhum campo publicado é recusada como documento, sem aplicar nada.
            var unchangedProposal=publishedFact(app,occurrence);
            assertEquals(400,request(app,"POST","admin/corrections/"+id+"/publication/preparations",preparation("CORRECTION",unchangedProposal,revision(app,occurrence))).statusCode());
            review(app,id);
            var unknown=request(app,"POST","admin/corrections/"+id+"/publication/preparations",preparation("CORRECTION",proposal("Título corrigido"),revision(app,occurrence)+4));
            assertEquals(409,unknown.statusCode(),unknown.body());
            var catalog=request(app,"POST","admin/corrections/"+id+"/publication/preparations",preparation("CORRECTION",Map.of("type","ROUBO","category","CONTINGENCIA"),revision(app,occurrence)));
            assertEquals(400,catalog.statusCode(),catalog.body());
            var prepared=request(app,"POST","admin/corrections/"+id+"/publication/preparations",preparation("CORRECTION",proposal("Título corrigido sintético"),revision(app,occurrence)));
            assertEquals(200,prepared.statusCode(),prepared.body());
            assertEquals("PREPARED",JSON.readTree(prepared.body()).path("preparation_state").asString());
            assertEquals("Título corrigido sintético",JSON.readTree(prepared.body()).path("changes").path("title").asString());
            // Preparation alone leaves the consultable version exactly as published.
            assertEquals(1,revision(app,occurrence));
            assertEquals(200,request(app,"GET","admin/corrections/"+id,null).statusCode());
            assertEquals(409,request(app,"POST","admin/corrections/"+id+"/publication/decisions",decision("APPROVE",version(app,id)+5)).statusCode());
            var approved=request(app,"POST","admin/corrections/"+id+"/publication/decisions",decision("APPROVE",version(app,id)));
            assertEquals(200,approved.statusCode(),approved.body());
            assertEquals("APPLIED",JSON.readTree(approved.body()).path("preparation").asString());
            assertEquals(2,JSON.readTree(approved.body()).path("occurrenceVersion").asInt());
            assertEquals(2,revision(app,occurrence));
            assertTrue(approved.body().contains("Título corrigido sintético"),approved.body());
            assertEquals("COMPLETED",state(app,id));
            assertTrue(request(app,"GET",query(),null).body().contains("Título corrigido sintético"));
            // A decided preparation is never applied twice, and the audit trail keeps both snapshots.
            assertEquals(409,request(app,"POST","admin/corrections/"+id+"/publication/decisions",decision("APPROVE",version(app,id))).statusCode());
            var trail=app.getBean(JdbcTemplate.class).queryForList("SELECT action,before_snapshot::text AS before,after_snapshot::text AS after FROM correction_editor_audit WHERE request_id=?",id);
            assertEquals(1,trail.size());assertTrue(trail.getFirst().get("before").toString().contains(occurrence));
            assertTrue(trail.getFirst().get("after").toString().contains("Título corrigido sintético"));
        }
        try(var app=start()){
            assertEquals(2,revision(app,occurrence));
            assertEquals("Título corrigido sintético",title(app,occurrence));
        }
    }

    @Test void retractionRemovesTheRegisterFromEveryLaterReadAndTheOldAddressExplainsItself()throws Exception {
        String occurrence;UUID id;
        try(var app=start()){
            admin(app);occurrence=publishedId(app);id=correction(app,occurrence,"CONTEUDO");review(app,id);
            var withoutEvidence=request(app,"POST","admin/corrections/"+id+"/publication/preparations",Map.of("action","RETRACTION","changes",Map.of(),"reason","Erro essencial demonstrado","evidence","","essentialReason","FATO_INCORRETO","expectedVersion",revision(app,occurrence)));
            assertEquals(400,withoutEvidence.statusCode(),withoutEvidence.body());
            var unknownReason=request(app,"POST","admin/corrections/"+id+"/publication/preparations",Map.of("action","RETRACTION","changes",Map.of(),"reason","Erro essencial demonstrado","evidence","Evidência sintética","essentialReason","INVENTADA","expectedVersion",revision(app,occurrence)));
            assertEquals(400,unknownReason.statusCode(),unknownReason.body());
            var mixed=request(app,"POST","admin/corrections/"+id+"/publication/preparations",Map.of("action","RETRACTION","changes",Map.of("title","Não deveria aplicar"),"reason","Erro essencial demonstrado","evidence","Evidência sintética","essentialReason","FATO_INCORRETO","expectedVersion",revision(app,occurrence)));
            assertEquals(400,mixed.statusCode(),mixed.body());
            var retraction=request(app,"POST","admin/corrections/"+id+"/publication/preparations",Map.of("action","RETRACTION","changes",Map.of(),"reason","Erro essencial demonstrado","evidence","Duas referências independentes sintéticas","essentialReason","FATO_INCORRETO","expectedVersion",revision(app,occurrence)));
            assertEquals(200,retraction.statusCode(),retraction.body());
            assertTrue(request(app,"GET",query(),null).body().contains(occurrence));
            assertEquals(200,request(app,"POST","admin/corrections/"+id+"/publication/decisions",decision("APPROVE",version(app,id))).statusCode());
            assertFalse(request(app,"GET",query(),null).body().contains(occurrence));
            assertFalse(request(app,"GET","history/occurrences?periodStart=2026-10-14T15:00:00Z&periodEnd=2026-10-15T15:00:00Z",null).body().contains(occurrence));
            var direct=request(app,"GET","occurrences/"+occurrence,null);
            assertEquals(200,direct.statusCode(),direct.body());
            assertEquals("UNAVAILABLE",JSON.readTree(direct.body()).path("status").asString());
            assertTrue(JSON.readTree(direct.body()).path("unavailable").asBoolean());
            assertNotNull(JSON.readTree(direct.body()).path("withdrawnAt"));
            assertFalse(direct.body().contains("description"));
            // A withdrawn register accepts no new preparation and no repeat withdrawal.
            assertEquals(409,request(app,"POST","admin/corrections/"+id+"/publication/preparations",preparation("CORRECTION",proposal("Outro título"),revision(app,occurrence))).statusCode());
        }
    }

    @Test void competingDecisionsAreBothPreservedAndTheNewerProposalIsTheOneApplied()throws Exception {
        UUID first;UUID second;String occurrence;
        try(var app=start()){
            occurrence=publishedId(app);
            register(app,"holder18@example.test",true);accept(login(app,"holder18@example.test"));
            first=correction(app,occurrence,"CONTEUDO");second=correction(app,occurrence,"DATA");
            cookie=null;csrf=null;admin(app);
            review(app,first);review(app,second);
            var firstPrepared=request(app,"POST","admin/corrections/"+first+"/publication/preparations",preparation("CORRECTION",proposal("Primeira proposta"),revision(app,occurrence)));
            assertEquals(200,firstPrepared.statusCode(),firstPrepared.body());
            var secondPrepared=request(app,"POST","admin/corrections/"+second+"/publication/preparations",preparation("CORRECTION",proposal("Segunda proposta"),revision(app,occurrence)));
            assertEquals(200,secondPrepared.statusCode(),secondPrepared.body());
            var refused=request(app,"POST","admin/corrections/"+first+"/publication/decisions",decision("APPROVE",version(app,first)));
            assertEquals(409,refused.statusCode(),refused.body());
            // A recusa não aplica nada: a versão publicada continua a mesma e as duas preparações seguem legíveis.
            assertEquals(1,revision(app,occurrence));
            assertEquals(200,request(app,"GET","admin/corrections/"+first+"/publication",null).statusCode());
            assertEquals(200,request(app,"GET","admin/corrections/"+second+"/publication",null).statusCode());
            assertEquals(200,request(app,"POST","admin/corrections/"+second+"/publication/decisions",decision("DISCARD",version(app,second))).statusCode());
            assertEquals(200,request(app,"POST","admin/corrections/"+first+"/publication/decisions",decision("APPROVE",version(app,first))).statusCode());
            assertEquals("Primeira proposta",title(app,occurrence));
        }
    }
}
