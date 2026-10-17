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
class AuditHttpIT {
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
        try(var app=start()){app.getBean(JdbcTemplate.class).execute("TRUNCATE auth_audit_events,local_sessions,auth_request_limits,account_audit_events,account_confirmation_tokens,account_request_limits,source_audit_events,source_versions,source_access_configurations,local_accounts RESTART IDENTITY");}
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
    @Test void logsRequireAdministratorWithMfaAndExposeClassifiedEventsAfterRestart() throws Exception {
        try (var app = start()) {
            assertEquals(401, request(app, "GET", "admin/logs", null).statusCode());
            register(app, "logs19@example.test", true);
            accept(login(app, "logs19@example.test"));
            assertEquals(403, request(app, "GET", "admin/logs", null).statusCode());
            assertEquals(200, request(app, "GET", query(), null).statusCode());
            UUID admin = bootstrap(app);
            accept(login(app, "admin14@example.test"));
            assertEquals(403, request(app, "GET", "admin/logs", null).statusCode());
            byte[] secret = enrolledSecret(app, admin);
            accept(request(app, "POST", "auth/mfa/verification", Map.of("code", code(secret))));
            var response = request(app, "GET", "admin/logs?eventClass=USE", null);
            assertEquals(200, response.statusCode(), response.body());
            var body = JSON.readTree(response.body());
            assertTrue(body.path("items").isArray());
            assertTrue(body.path("items").toString().contains("CONSULTATION"));
            assertFalse(body.path("items").toString().contains("password"));
            assertEquals("USE", body.path("items").get(0).path("eventClass").asString());
            assertNotNull(body.path("items").get(0).get("actor"));
        }
        try (var restarted = start()) {
            var response = request(restarted, "GET", "admin/logs?eventClass=USE", null);
            assertEquals(200, response.statusCode());
            assertTrue(response.body().contains("CONSULTATION"));
        }
    }    @Test void retentionUsesEventTimeHidesExpiredAndCleanupPreservesVersions() throws Exception {
        try (var app = start("--vetor.audit.use-retention=10s", "--vetor.audit.security-retention=20s", "--vetor.audit.admin-retention=30s")) {
            UUID admin = bootstrap(app);
            accept(login(app, "admin14@example.test"));
            byte[] secret = enrolledSecret(app, admin);
            accept(request(app, "POST", "auth/mfa/verification", Map.of("code", code(secret))));
            assertEquals(200, request(app, "GET", query(), null).statusCode());
            var jdbc = app.getBean(JdbcTemplate.class);
            var source = request(app, "POST", "admin/sources", Map.of("name", "Fonte sintética 19", "channel", "Canal sintético", "territories", List.of("Rio de Janeiro"), "pillars", List.of("TRANSITO"), "accessMethod", "MANUAL", "rating", 3, "ratingJustification", "Avaliação sintética"));
            assertEquals(201, source.statusCode(), source.body());
            // Existing source writes use system time: fix the event fixture to the test clock.
            jdbc.update("UPDATE source_audit_events SET occurred_at=?", Timestamp.from(CLOCK.instant()));
            long versionCount = jdbc.queryForObject("SELECT count(*) FROM source_versions", Long.class);
            CLOCK.advance(10);
            var expiredUse = request(app, "GET", "admin/logs?eventClass=USE", null);
            assertEquals(200, expiredUse.statusCode());
            assertEquals(0, JSON.readTree(expiredUse.body()).path("items").size(), "Expiry is inclusive and enforced before physical cleanup");
            assertTrue(request(app, "GET", "admin/logs?eventClass=SECURITY", null).body().contains("LOGIN"));
            CLOCK.advance(10);
            assertFalse(request(app, "GET", "admin/logs?eventClass=SECURITY", null).body().contains("LOGIN"));
            assertTrue(request(app, "GET", "admin/logs?eventClass=ADMIN", null).body().contains("Fonte sintética 19"));
            CLOCK.advance(10);
            assertFalse(request(app, "GET", "admin/logs?eventClass=ADMIN", null).body().contains("Fonte sintética 19"));
            assertEquals(403, request(app, "POST", "admin/logs/cleanup", Map.of(), null, false).statusCode());
            var cleanup = request(app, "POST", "admin/logs/cleanup", Map.of());
            assertEquals(200, cleanup.statusCode(), cleanup.body());
            assertEquals(CLOCK.instant().toString(), JSON.readTree(cleanup.body()).path("executedAt").asString());
            assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM auth_audit_events WHERE action IN ('CONSULTATION','LOGIN')", Integer.class));
            assertEquals(versionCount, jdbc.queryForObject("SELECT count(*) FROM source_versions", Long.class));
            assertTrue(request(app, "GET", "admin/logs?eventClass=ADMIN", null).body().contains("LOG_CLEANUP"));
        }
    }
    @Test void paginationIsStableAndLegacyUsageParametersAreMinimized() throws Exception {
        try (var app = start()) {
            UUID admin = bootstrap(app);
            accept(login(app, "admin14@example.test"));
            byte[] secret = enrolledSecret(app, admin);
            accept(request(app, "POST", "auth/mfa/verification", Map.of("code", code(secret))));
            for (int index = 0; index < 53; index++) assertEquals(200, request(app, "GET", query(), null).statusCode());
            app.getBean(JdbcTemplate.class).update("UPDATE auth_audit_events SET parameters=parameters || '{\"text\":\"LOCAL_SECRETO\",\"longitude\":-43.19,\"password\":\"SEGREDO_TESTE\"}'::jsonb WHERE module='query'");
            var first = request(app, "GET", "admin/logs?eventClass=USE", null);
            assertEquals(200, first.statusCode());
            assertFalse(first.body().contains("LOCAL_SECRETO"));
            assertFalse(first.body().contains("longitude"));
            assertFalse(first.body().contains("SEGREDO_TESTE"));
            var body = JSON.readTree(first.body());
            assertEquals(50, body.path("items").size());
            assertTrue(body.path("hasMore").asBoolean());
            String cursor = java.net.URLEncoder.encode(body.path("nextCursor").asString(), java.nio.charset.StandardCharsets.UTF_8);
            assertEquals(200, request(app, "GET", query(), null).statusCode());
            var second = JSON.readTree(request(app, "GET", "admin/logs?eventClass=USE&cursor=" + cursor, null).body());
            assertEquals(3, second.path("items").size());
            var ids = new HashSet<String>();
            for (var item : body.path("items")) assertTrue(ids.add(item.path("id").asString()));
            for (var item : second.path("items")) assertTrue(ids.add(item.path("id").asString()));
            assertEquals(400, request(app, "GET", "admin/logs?eventClass=UNKNOWN", null).statusCode());
            assertEquals(400, request(app, "GET", "admin/logs?cursor=invalid", null).statusCode());
        }
    }
    @Test void scheduledCleanupDeletesEligibleUsageWithoutHumanIntervention() throws Exception {
        try (var app = start("--vetor.audit.use-retention=1s", "--vetor.audit.cleanup-delay=100", "--vetor.audit.cleanup-initial-delay=100")) {
            UUID admin = bootstrap(app);
            accept(login(app, "admin14@example.test"));
            byte[] secret = enrolledSecret(app, admin);
            accept(request(app, "POST", "auth/mfa/verification", Map.of("code", code(secret))));
            assertEquals(200, request(app, "GET", query(), null).statusCode());
            CLOCK.advance(1);
            boolean cleaned = false;
            long deadline = System.nanoTime() + Duration.ofSeconds(5).toNanos();
            while (!cleaned && System.nanoTime() < deadline) {
                var response = request(app, "GET", "admin/logs?eventClass=ADMIN", null);
                if (response.statusCode() == 200) for (var event : JSON.readTree(response.body()).path("items")) {
                    if (event.path("action").asString().equals("LOG_CLEANUP")
                            && event.path("parameters").path("executedAt").asString().equals(CLOCK.instant().toString())
                            && event.path("parameters").path("deleted").asInt() > 0) cleaned = true;
                }
                if (!cleaned) Thread.sleep(100);
            }
            assertTrue(cleaned, "A rotina agendada deve tornar o expurgo observável pela API");
            assertEquals(0, app.getBean(JdbcTemplate.class).queryForObject("SELECT count(*) FROM auth_audit_events WHERE action='CONSULTATION'", Integer.class));
        }
    }

}
