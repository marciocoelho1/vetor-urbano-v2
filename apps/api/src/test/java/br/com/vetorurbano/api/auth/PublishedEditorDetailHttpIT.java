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

/** Leitura do detalhe da edição de publicação: contrato HTTP observado diretamente. */
@Testcontainers
class PublishedEditorDetailHttpIT extends LocalAuthHttpSupport {
    @Container static final PostgreSQLContainer<?> DB=new PostgreSQLContainer<>(DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    static final MutableClock CLOCK=new MutableClock();
    @TestConfiguration static class TimeConfig { @Bean @Primary Clock clock(){return CLOCK;} }
    @Override PostgreSQLContainer<?> database(){return DB;}
    @Override MutableClock clock(){return CLOCK;}
    @Override Class<?> timeConfiguration(){return TimeConfig.class;}
    byte[] admin(org.springframework.context.ConfigurableApplicationContext app)throws Exception {
        UUID id=bootstrap(app);accept(login(app,"admin14@example.test"));byte[] secret=enrolledSecret(app,id);accept(request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))));return secret;
    }
    @Test void detailCarriesTheCurrentPreparationFields()throws Exception {
        try(var app=start()){
            String target=app.getBean(JdbcTemplate.class).queryForObject("SELECT id FROM occurrences WHERE publication_status='PUBLISHED' ORDER BY id LIMIT 1",String.class);
            register(app,"detail18@example.test",true);accept(login(app,"detail18@example.test"));
            var created=request(app,"POST","corrections",Map.of("targetKind","OCCURRENCE","targetId",target,"problemType","CONTEUDO","explanation","Explicação sintética","references","Referência sintética"));
            assertEquals(201,created.statusCode(),created.body());
            String id=JSON.readTree(created.body()).path("id").asString();
            cookie=null;csrf=null;admin(app);
            var detail=request(app,"GET","admin/corrections/"+id+"/publication",null);
            assertEquals(200,detail.statusCode(),detail.body());
            assertTrue(detail.body().contains("preparation_state"),detail.body());
            assertTrue(detail.body().contains("target_revision"),detail.body());
        }
    }
}
