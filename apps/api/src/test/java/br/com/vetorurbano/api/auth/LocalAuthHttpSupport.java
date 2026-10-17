package br.com.vetorurbano.api.auth;

import static org.junit.jupiter.api.Assertions.*;
import java.net.URI;
import java.net.http.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.nio.file.*;
import org.junit.jupiter.api.*;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.web.server.context.WebServerApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import br.com.vetorurbano.api.accounts.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

abstract class LocalAuthHttpSupport {
    static final JsonMapper JSON=JsonMapper.builder().build();
    abstract PostgreSQLContainer<?> database();
    abstract MutableClock clock();
    abstract Class<?> timeConfiguration();
    static class MutableClock extends Clock {
        volatile Instant time=Instant.parse("2026-10-15T18:00:00Z");
        void advance(long seconds){time=time.plusSeconds(seconds);}
        public Instant instant(){return time;} public ZoneId getZone(){return ZoneOffset.UTC;} public Clock withZone(ZoneId zone){return this;}
    }
    final HttpClient http=HttpClient.newHttpClient();
    String cookie,csrf;
    Path key;
    @BeforeEach void reset()throws Exception {
        clock().time=Instant.parse("2026-10-15T18:00:00Z");key=Files.createTempDirectory("vu-auth-key").resolve("mfa.key");
        try(var app=start()){app.getBean(JdbcTemplate.class).execute("TRUNCATE auth_audit_events,local_sessions,auth_request_limits,account_audit_events,account_confirmation_tokens,account_request_limits,source_audit_events,source_versions,source_access_configurations,local_accounts RESTART IDENTITY");}
        cookie=null;csrf=null;
    }
    ConfigurableApplicationContext start(String... extra) {
        var args=new ArrayList<>(List.of("--server.port=0","--vetor.accounts.enabled=true","--vetor.accounts.mailbox-port=0","--vetor.auth.key-file="+key,
            "--spring.datasource.url="+database().getJdbcUrl()+"&socketTimeout=2","--spring.datasource.username="+database().getUsername(),"--spring.datasource.password="+database().getPassword()));
        args.addAll(List.of(extra));return new SpringApplicationBuilder(br.com.vetorurbano.api.VetorUrbanoApiApplication.class,timeConfiguration()).run(args.toArray(String[]::new));
    }
    HttpResponse<String> request(ConfigurableApplicationContext app,String method,String path,Map<String,?> body)throws Exception {
        return request(app,method,path,body,null,true);
    }
    HttpResponse<String> request(ConfigurableApplicationContext app,String method,String path,Map<String,?> body,String origin,boolean sendCsrf)throws Exception {
        int port=((WebServerApplicationContext)app).getWebServer().getPort();
        var builder=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/v1/"+path)).timeout(Duration.ofSeconds(15)).header("Content-Type","application/json");
        if(cookie!=null)builder.header("Cookie",cookie);if(csrf!=null&&sendCsrf)builder.header("X-CSRF-Token",csrf);if(origin!=null)builder.header("Origin",origin);
        builder.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)));
        return http.send(builder.build(),HttpResponse.BodyHandlers.ofString());
    }
    void accept(HttpResponse<String> response)throws Exception {
        assertEquals(200,response.statusCode());
        response.headers().firstValue("set-cookie").ifPresent(value->cookie=value.split(";",2)[0]);
        var body=JSON.readTree(response.body());if(body.has("csrfToken"))csrf=body.path("csrfToken").asString();
    }
    void register(ConfigurableApplicationContext app,String email,boolean confirmed)throws Exception {
        assertEquals(202,request(app,"POST","accounts/registrations",Map.of("displayName","Pessoa 14","email",email,"password","Frase sintética para sessão 14")).statusCode());
        if(confirmed) {
            int port=app.getBean(LocalMailbox.class).port();
            var messages=JSON.readTree(http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/messages")).GET().build(),HttpResponse.BodyHandlers.ofString()).body());
            String token=null;for(var message:messages)if(message.path("recipient").asString().equals(email))token=message.path("token").asString();
            assertEquals(200,request(app,"POST","accounts/confirmations",Map.of("token",Objects.requireNonNull(token))).statusCode());
        }
    }
    HttpResponse<String> login(ConfigurableApplicationContext app,String email)throws Exception {return request(app,"POST","auth/login",Map.of("email",email,"password","Frase sintética para sessão 14"));}
    UUID bootstrap(ConfigurableApplicationContext app)throws Exception {
        var input=JSON.readTree(JSON.writeValueAsString(Map.of("action","create","email","admin14@example.test","displayName","Admin sintético","password","Frase sintética para sessão 14")));
        var tx=new TransactionTemplate(app.getBean(org.springframework.transaction.PlatformTransactionManager.class));
        tx.executeWithoutResult(status->LocalAccountAdmin.execute(app.getBean(JdbcTemplate.class),app.getBean(AuthService.class),app.getBean(AccountPassword.class),clock(),input));
        return app.getBean(JdbcTemplate.class).queryForObject("SELECT id FROM local_accounts WHERE role='ADMIN'",UUID.class);
    }
    byte[] enrolledSecret(ConfigurableApplicationContext app,UUID id)throws Exception {
        assertEquals(200,request(app,"POST","auth/mfa/enrollment",Map.of()).statusCode());
        String encrypted=app.getBean(JdbcTemplate.class).queryForObject("SELECT mfa_secret FROM local_accounts WHERE id=?",String.class,id);
        return app.getBean(MfaVault.class).decrypt(encrypted,id);
    }
    String code(byte[] secret){return Totp.code(secret,clock().instant().getEpochSecond()/30);}
    static String query(){return "occurrences?periodStart=2026-10-14T15:00:00Z&periodEnd=2026-10-15T15:00:00Z";}
}
