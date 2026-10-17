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
class CorrectionHttpIT extends LocalAuthHttpSupport {
    @Container static final PostgreSQLContainer<?> DB=new PostgreSQLContainer<>(DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    static final MutableClock CLOCK=new MutableClock();
    @TestConfiguration static class TimeConfig { @Bean @Primary Clock clock(){return CLOCK;} }
    @Override PostgreSQLContainer<?> database(){return DB;}
    @Override MutableClock clock(){return CLOCK;}
    @Override Class<?> timeConfiguration(){return TimeConfig.class;}
    static Map<String,Object> draft(String kind,String id){return Map.of("targetKind",kind,"targetId",id,"problemType","LOCAL","explanation","Local sintético precisa de conferência","references","Referência sintética 27");}
    @Test void privateIntakeValidatesTargetPersistsAndDoesNotChangePublication()throws Exception {
        String id;
        try(var app=start()) {
            assertEquals(401,request(app,"POST","corrections",draft("OCCURRENCE","vu-demo-occurrence-traffic-001")).statusCode());
            register(app,"correction27@example.test",true);accept(login(app,"correction27@example.test"));
            assertEquals(403,request(app,"POST","corrections",draft("OCCURRENCE","vu-demo-occurrence-traffic-001"),null,false).statusCode());
            assertEquals(400,request(app,"POST","corrections",draft("OCCURRENCE","missing")).statusCode());
            assertEquals(400,request(app,"POST","corrections",draft("AREA","experimental-id")).statusCode());
            var response=request(app,"POST","corrections",draft("OCCURRENCE","vu-demo-occurrence-traffic-001"));
            assertEquals(201,response.statusCode(),response.body());id=JSON.readTree(response.body()).path("id").asString();
            assertEquals("RECEIVED",JSON.readTree(response.body()).path("state").asString());
            assertEquals(403,request(app,"GET","admin/corrections",null).statusCode());
            var jdbc=app.getBean(JdbcTemplate.class);
            assertEquals("Colisão demonstrativa",jdbc.queryForObject("SELECT title FROM occurrences WHERE id='vu-demo-occurrence-traffic-001'",String.class));
            register(app,"other27@example.test",true);accept(login(app,"other27@example.test"));
            assertFalse(request(app,"GET","corrections",null).body().contains(id));
            assertEquals(404,request(app,"GET","corrections/"+id,null).statusCode());
        }
        try(var app=start()){accept(login(app,"correction27@example.test"));assertEquals(200,request(app,"GET","corrections/"+id,null).statusCode());}
    }
    @Test void adminMfaDecisionsRequireReasonsVersionAndPreserveClosedRequesterPrivacy()throws Exception {
        try(var app=start()) {
            register(app,"close27@example.test",true);accept(login(app,"close27@example.test"));
            String id=JSON.readTree(request(app,"POST","corrections",draft("OCCURRENCE","vu-demo-occurrence-traffic-001")).body()).path("id").asString();
            assertEquals(200,request(app,"POST","account/closure",Map.of("currentPassword","Frase sintética para sessão 14")).statusCode());
            cookie=null;csrf=null;
            UUID admin=bootstrap(app);accept(login(app,"admin14@example.test"));
            assertEquals(403,request(app,"GET","admin/corrections",null).statusCode());
            byte[] secret=enrolledSecret(app,admin);accept(request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))));
            var details=request(app,"GET","admin/corrections/"+id,null);
            assertEquals(200,details.statusCode(),details.body());
            assertTrue(details.body().contains("Local sintético precisa"));assertTrue(details.body().contains("Referência sintética 27"));assertFalse(details.body().contains("close27@example.test"));assertTrue(details.body().contains("privacy_review_required"));
            assertEquals(200,request(app,"POST","admin/corrections/"+id+"/minimization",Map.of("expectedVersion",1,"factualSummary","Local sintético precisa de conferência","factualReferences","Referência factual 27")).statusCode());
            assertEquals(400,request(app,"POST","admin/corrections/"+id+"/decisions",Map.of("expectedVersion",1,"state","IN_REVIEW","reason","")).statusCode());
            assertEquals(200,request(app,"POST","admin/corrections/"+id+"/decisions",Map.of("expectedVersion",2,"state","IN_REVIEW","reason","Conferência factual iniciada")).statusCode());
            assertEquals(409,request(app,"POST","admin/corrections/"+id+"/decisions",Map.of("expectedVersion",1,"state","IN_REVIEW","reason","Reenvio antigo")).statusCode());
            assertEquals(400,request(app,"POST","admin/corrections/"+id+"/decisions",Map.of("expectedVersion",3,"state","COMPLETED","reason","Correção inexistente","appliedVersion",999)).statusCode());
            assertEquals(200,request(app,"POST","admin/corrections/"+id+"/decisions",Map.of("expectedVersion",3,"state","NOT_APPLICABLE","reason","Referência confirma o registro original")).statusCode());
            app.getBean(JdbcTemplate.class).update("INSERT INTO correction_area_targets(id,version,name,evidence_reference,validated_by,validated_at) VALUES('area27',1,'Área sintética','fixture-27',?,now())",admin);
            var area=request(app,"POST","corrections",draft("AREA","area27"));assertEquals(201,area.statusCode());
            String areaId=JSON.readTree(area.body()).path("id").asString();
            assertEquals(200,request(app,"POST","admin/corrections/"+areaId+"/decisions",Map.of("expectedVersion",1,"state","IN_REVIEW","reason","Conferindo versão validada")).statusCode());
            var completed=request(app,"POST","admin/corrections/"+areaId+"/decisions",Map.of("expectedVersion",2,"state","COMPLETED","reason","Versão validada confirmada","appliedVersion",1));
            assertEquals(200,completed.statusCode(),completed.body());assertEquals(1,JSON.readTree(completed.body()).path("applied_version").asInt());
        }
    }

}
