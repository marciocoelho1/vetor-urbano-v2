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

@Testcontainers
class SessionHttpIT {
    @Container static final PostgreSQLContainer<?> DB=new PostgreSQLContainer<>(DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    static final JsonMapper JSON=JsonMapper.builder().build();
    static final MutableClock CLOCK=new MutableClock();
    static class MutableClock extends Clock {
        volatile Instant time=Instant.parse("2026-10-15T18:00:00Z");
        void advance(long seconds){time=time.plusSeconds(seconds);}
        public Instant instant(){return time;}public ZoneId getZone(){return ZoneOffset.UTC;}public Clock withZone(ZoneId zone){return this;}
    }
    @TestConfiguration static class TimeConfig { @Bean @Primary Clock clock(){return CLOCK;} }
    private final HttpClient http=HttpClient.newHttpClient();
    private String cookie,csrf;
    private Path key;
    @BeforeEach void reset()throws Exception {
        CLOCK.time=Instant.parse("2026-10-15T18:00:00Z");key=Files.createTempDirectory("vu14-key").resolve("mfa.key");
        try(var app=start()){app.getBean(JdbcTemplate.class).execute("TRUNCATE auth_audit_events,local_sessions,auth_request_limits,account_audit_events,account_confirmation_tokens,account_request_limits,local_accounts RESTART IDENTITY");}
        cookie=null;csrf=null;
    }
    ConfigurableApplicationContext start(String... extra) {
        var args=new ArrayList<>(List.of("--server.port=0","--vetor.accounts.enabled=true","--vetor.accounts.mailbox-port=0","--vetor.auth.key-file="+key,
            "--spring.datasource.url="+DB.getJdbcUrl()+"&socketTimeout=2","--spring.datasource.username="+DB.getUsername(),"--spring.datasource.password="+DB.getPassword()));
        args.addAll(List.of(extra));return new SpringApplicationBuilder(br.com.vetorurbano.api.VetorUrbanoApiApplication.class,TimeConfig.class).run(args.toArray(String[]::new));
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
        tx.executeWithoutResult(status->LocalAccountAdmin.execute(app.getBean(JdbcTemplate.class),app.getBean(AuthService.class),app.getBean(AccountPassword.class),CLOCK,input));
        return app.getBean(JdbcTemplate.class).queryForObject("SELECT id FROM local_accounts WHERE role='ADMIN'",UUID.class);
    }
    byte[] enrolledSecret(ConfigurableApplicationContext app,UUID id)throws Exception {
        assertEquals(200,request(app,"POST","auth/mfa/enrollment",Map.of()).statusCode());
        String encrypted=app.getBean(JdbcTemplate.class).queryForObject("SELECT mfa_secret FROM local_accounts WHERE id=?",String.class,id);
        return app.getBean(MfaVault.class).decrypt(encrypted,id);
    }
    String code(byte[] secret){return Totp.code(secret,CLOCK.instant().getEpochSecond()/30);}
    static String query(){return "occurrences?periodStart=2026-10-14T15:00:00Z&periodEnd=2026-10-15T15:00:00Z";}
    @Test void loginConfirmedOnlyServerBoundaryCsrfLogoutAndRole()throws Exception {
        try(var app=start()) {
            int port=((WebServerApplicationContext)app).getWebServer().getPort();
            var preflight=http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/v1/auth/session"))
                .header("Origin","http://127.0.0.1:4201").header("Access-Control-Request-Method","GET")
                .header("Access-Control-Request-Headers","content-type,x-csrf-token").method("OPTIONS",HttpRequest.BodyPublishers.noBody()).build(),HttpResponse.BodyHandlers.ofString());
            for(String alias:List.of("/ap%69/v1/occurrences","/api//v1/occurrences","/api/v1/accounts/../occurrences","/api/v1/occurrences;ignored")) {
                var direct=http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+alias)).GET().build(),HttpResponse.BodyHandlers.ofString());
                assertEquals(401,direct.statusCode(),"Alias de caminho não pode ignorar autorização: "+alias);
            }
            assertEquals(200,preflight.statusCode());
            assertTrue(preflight.headers().firstValue("Access-Control-Allow-Headers").orElse("").toLowerCase(Locale.ROOT).contains("x-csrf-token"));
            assertTrue(preflight.headers().firstValue("Access-Control-Allow-Methods").orElse("").contains("GET"));
            assertEquals("true",preflight.headers().firstValue("Access-Control-Allow-Credentials").orElse(""));
            assertEquals(401,request(app,"GET",query(),null).statusCode());cookie="vu_session=invalid";
            assertEquals(401,request(app,"GET",query(),null).statusCode());cookie=null;
            register(app,"pending14@example.test",false);assertEquals(401,login(app,"pending14@example.test").statusCode());
            register(app,"user14@example.test",true);
            assertEquals(401,request(app,"POST","auth/login",Map.of("email","user14@example.test","password","errada")).statusCode());
            var response=login(app,"user14@example.test");accept(response);
            String setCookie=response.headers().firstValue("set-cookie").orElseThrow();
            assertTrue(setCookie.contains("HttpOnly"));assertTrue(setCookie.contains("SameSite=Strict"));assertTrue(setCookie.contains("Path=/api/v1"));
            assertEquals(200,request(app,"GET",query(),null).statusCode());
            var event=app.getBean(JdbcTemplate.class).queryForMap("SELECT account_id,parameters FROM auth_audit_events WHERE module='query' ORDER BY id DESC LIMIT 1");
            assertNotNull(event.get("account_id"));assertTrue(event.get("parameters").toString().contains("periodStart"));
            assertFalse(event.get("parameters").toString().contains("password"));
            assertEquals(200,request(app,"GET","auth/access/history",null).statusCode());
            assertEquals(403,request(app,"GET","auth/access/sources",null).statusCode());
            assertEquals(403,request(app,"POST","auth/mfa/enrollment",Map.of()).statusCode());
            assertEquals(403,request(app,"POST","auth/logout",Map.of(),null,false).statusCode());
            assertEquals(403,request(app,"POST","auth/logout",Map.of(),"https://evil.test",true).statusCode());
            assertEquals(200,request(app,"GET",query(),null).statusCode());
            assertEquals(200,request(app,"POST","auth/logout",Map.of()).statusCode());
            assertEquals(401,request(app,"GET",query(),null).statusCode());
            assertEquals(401,request(app,"POST","auth/logout",Map.of()).statusCode());
            assertEquals(403,request(app,"POST","auth/login",Map.of("email","user14@example.test","password","anything"),"https://evil.test",true).statusCode());
        }
    }
    @Test void sessionPersistsAcrossRestartAndSecurityVersionRevokesAll()throws Exception {
        UUID id;
        try(var app=start()) {
            register(app,"restart14@example.test",true);accept(login(app,"restart14@example.test"));
            id=app.getBean(JdbcTemplate.class).queryForObject("SELECT id FROM local_accounts WHERE email='restart14@example.test'",UUID.class);
            var hashes=app.getBean(JdbcTemplate.class).queryForList("SELECT token_hash FROM local_sessions",String.class);
            assertFalse(hashes.contains(cookie.substring("vu_session=".length())));
        }
        try(var app=start()) {
            accept(request(app,"GET","auth/session",null));assertEquals(200,request(app,"GET",query(),null).statusCode());
            app.getBean(AuthService.class).revokeAll(id);assertEquals(401,request(app,"GET",query(),null).statusCode());
        }
        try(var app=start()){assertEquals(401,request(app,"GET","auth/session",null).statusCode());}
    }
    @Test void inactivityAndAbsoluteExpiryUseClockAtExactBoundary()throws Exception {
        try(var app=start("--vetor.auth.lifetime=2h")) {
            register(app,"clock14@example.test",true);accept(login(app,"clock14@example.test"));
            CLOCK.advance(3599);assertEquals(200,request(app,"GET",query(),null).statusCode());
            CLOCK.advance(3600);assertEquals(401,request(app,"GET",query(),null).statusCode());
            accept(login(app,"clock14@example.test"));
            for(int i=0;i<3;i++){CLOCK.advance(1800);assertEquals(200,request(app,"GET",query(),null).statusCode());}
            CLOCK.advance(1800);assertEquals(401,request(app,"GET",query(),null).statusCode());
        }
    }
    @Test void adminRequiresMfaEnrollmentActivationReplayExpiryAndRotatesSession()throws Exception {
        UUID id;byte[] secret;String oldCookie;
        try(var app=start()) {
            id=bootstrap(app);accept(login(app,"admin14@example.test"));
            assertFalse(JSON.readTree(request(app,"GET","auth/session",null).body()).path("authenticated").asBoolean());
            assertEquals(403,request(app,"GET",query(),null).statusCode());
            assertEquals(403,request(app,"GET","auth/access/sources",null).statusCode());
            assertEquals(403,request(app,"POST","auth/mfa/enrollment",Map.of(),null,false).statusCode());
            secret=enrolledSecret(app,id);
            String first=request(app,"POST","auth/mfa/enrollment",Map.of()).body();
            assertTrue(first.equals(request(app,"POST","auth/mfa/enrollment",Map.of()).body()));
            assertEquals(401,request(app,"POST","auth/mfa/verification",Map.of("code","invalid")).statusCode());
            assertEquals(401,request(app,"POST","auth/mfa/verification",Map.of("code",Totp.code(secret,CLOCK.instant().getEpochSecond()/30-2))).statusCode());
            oldCookie=cookie;accept(request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))));
            assertFalse(oldCookie.equals(cookie));assertEquals(200,request(app,"GET","auth/access/sources",null).statusCode());
            assertEquals(200,request(app,"GET",query(),null).statusCode());
            assertEquals(409,request(app,"POST","auth/mfa/enrollment",Map.of()).statusCode());
            String full=cookie;cookie=oldCookie;assertEquals(401,request(app,"GET",query(),null).statusCode());cookie=full;
        }
        try(var app=start()) {
            assertEquals(200,request(app,"GET","auth/access/sources",null).statusCode());
            accept(login(app,"admin14@example.test"));assertEquals(403,request(app,"GET",query(),null).statusCode());
            assertEquals(401,request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))).statusCode());
            CLOCK.advance(30);accept(request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))));
            String dump=app.getBean(JdbcTemplate.class).queryForList("SELECT mfa_secret FROM local_accounts").toString();
            assertFalse(dump.contains(Totp.base32(secret)));
            String audit=app.getBean(JdbcTemplate.class).queryForList("SELECT * FROM auth_audit_events").toString();
            assertFalse(audit.contains("admin14@example.test"));assertFalse(audit.contains(Totp.base32(secret)));
        }
    }
    @Test void partialExpiryPersistentAttemptLimitsAndLocalLossReset()throws Exception {
        try(var app=start("--vetor.auth.mfa-attempts=2","--vetor.auth.login-attempts=2")) {
            UUID id=bootstrap(app);accept(login(app,"admin14@example.test"));byte[] secret=enrolledSecret(app,id);
            assertEquals(401,request(app,"POST","auth/mfa/verification",Map.of("code","wrong")).statusCode());
            assertEquals(401,request(app,"POST","auth/mfa/verification",Map.of("code","wrong")).statusCode());
            assertEquals(429,request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))).statusCode());
            CLOCK.advance(300);assertEquals(401,request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))).statusCode());
            accept(login(app,"admin14@example.test"));accept(request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))));
            var reset=JSON.readTree("{\"action\":\"reset-mfa\",\"email\":\"admin14@example.test\"}");
            new TransactionTemplate(app.getBean(org.springframework.transaction.PlatformTransactionManager.class)).executeWithoutResult(s->LocalAccountAdmin.execute(app.getBean(JdbcTemplate.class),app.getBean(AuthService.class),app.getBean(AccountPassword.class),CLOCK,reset));
            assertEquals(401,request(app,"GET",query(),null).statusCode());
            accept(login(app,"admin14@example.test"));assertEquals(403,request(app,"GET",query(),null).statusCode());
            assertFalse(JSON.readTree(request(app,"GET","auth/session",null).body()).path("mfaEnrolled").asBoolean());
            assertEquals(401,request(app,"POST","auth/login",Map.of("email","absent@example.test","password","wrong")).statusCode());
            assertEquals(401,request(app,"POST","auth/login",Map.of("email","absent@example.test","password","wrong")).statusCode());
        }
        try(var app=start("--vetor.auth.login-attempts=2")) {
            assertEquals(429,request(app,"POST","auth/login",Map.of("email","absent@example.test","password","wrong")).statusCode());
            CLOCK.advance(300);assertEquals(401,request(app,"POST","auth/login",Map.of("email","absent@example.test","password","wrong")).statusCode());
        }
    }
    @Test void partialSessionAndMfaLimitSurviveRestartAndConcurrentCodeIsConsumedOnce()throws Exception {
        byte[] secret;
        try(var app=start("--vetor.auth.mfa-attempts=2")) {
            UUID id=bootstrap(app);accept(login(app,"admin14@example.test"));secret=enrolledSecret(app,id);
            assertEquals(401,request(app,"POST","auth/mfa/verification",Map.of("code","invalid")).statusCode());
            assertEquals(401,request(app,"POST","auth/mfa/verification",Map.of("code","invalid")).statusCode());
        }
        try(var app=start("--vetor.auth.mfa-attempts=2")) {
            assertEquals(403,request(app,"GET",query(),null).statusCode());
            assertEquals(429,request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))).statusCode());
            CLOCK.advance(300);accept(login(app,"admin14@example.test"));
            int port=((WebServerApplicationContext)app).getWebServer().getPort();
            var req=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/v1/auth/mfa/verification"))
                .header("Cookie",cookie).header("X-CSRF-Token",csrf).header("Content-Type","application/json")
                .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(Map.of("code",code(secret))))).build();
            var first=http.sendAsync(req,HttpResponse.BodyHandlers.ofString());
            var second=http.sendAsync(req,HttpResponse.BodyHandlers.ofString());
            var codes=List.of(first.get().statusCode(),second.get().statusCode());
            assertEquals(1,codes.stream().filter(n->n==200).count());
            assertEquals(1,codes.stream().filter(n->n==401).count());
            assertEquals(401,request(app,"GET",query(),null).statusCode());
        }
    }
    @Test void unavailableDatabaseNeverGrantsAccessAndRecovers()throws Exception {
        try(var app=start()) {
            register(app,"outage14@example.test",true);accept(login(app,"outage14@example.test"));
            var docker=org.testcontainers.DockerClientFactory.instance().client();docker.pauseContainerCmd(DB.getContainerId()).exec();
            try {
                assertEquals(503,request(app,"GET",query(),null).statusCode());
                assertEquals(503,request(app,"GET","auth/session",null).statusCode());
                assertEquals(503,login(app,"outage14@example.test").statusCode());
            } finally {docker.unpauseContainerCmd(DB.getContainerId()).exec();}
            assertEquals(200,request(app,"GET",query(),null).statusCode());
        }
    }
}
