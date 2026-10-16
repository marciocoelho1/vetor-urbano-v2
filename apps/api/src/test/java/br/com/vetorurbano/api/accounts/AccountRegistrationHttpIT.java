package br.com.vetorurbano.api.accounts;

import static org.junit.jupiter.api.Assertions.*;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.*;
import org.springframework.boot.test.context.TestConfiguration;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import java.sql.DriverManager;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.server.context.WebServerApplicationContext;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
@ExtendWith(OutputCaptureExtension.class)
class AccountRegistrationHttpIT {
    @Container
    static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>(DockerImageName
            .parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));

    @BeforeEach
    void resetOnlyThisDisposableContainersAccountFixtures() throws Exception {
        try(var connection=DriverManager.getConnection(DB.getJdbcUrl(),DB.getUsername(),DB.getPassword());var statement=connection.createStatement()) {
            var result=statement.executeQuery("SELECT to_regclass('public.local_accounts') IS NOT NULL");
            result.next(); boolean migrated=result.getBoolean(1); result.close();
            if(migrated) statement.execute("TRUNCATE account_audit_events,account_confirmation_tokens,account_request_limits,local_accounts RESTART IDENTITY");
        }
    }
    private static final JsonMapper JSON=JsonMapper.builder().build();
    private final HttpClient http=HttpClient.newHttpClient();
    @TestConfiguration(proxyBeanMethods=false)
    static class TimeConfiguration {
        @Bean @Primary MutableClock testClock() { return new MutableClock(); }
    }
    static class MutableClock extends Clock {
        private volatile Instant now=Instant.parse("2026-10-15T18:00:00Z");
        void advance(Duration duration) { now=now.plus(duration); }
        @Override public Instant instant() { return now; }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
    }
    private ConfigurableApplicationContext start(String... extra) {
        var args=new ArrayList<>(List.of("--server.port=0", "--vetor.accounts.enabled=true", "--vetor.accounts.mailbox-port=0",
            "--spring.datasource.url="+DB.getJdbcUrl(), "--spring.datasource.username="+DB.getUsername(),
            "--spring.datasource.password="+DB.getPassword()));
        args.addAll(List.of(extra));
        return new SpringApplicationBuilder(br.com.vetorurbano.api.VetorUrbanoApiApplication.class,TimeConfiguration.class).run(args.toArray(String[]::new));
    }
    private HttpResponse<String> post(ConfigurableApplicationContext app,String path,Map<String,?> body) throws Exception {
        int port=((WebServerApplicationContext)app).getWebServer().getPort();
        var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/v1/accounts/"+path))
            .header("Content-Type","application/json").timeout(Duration.ofSeconds(15))
            .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body))).build();
        return http.send(request,HttpResponse.BodyHandlers.ofString());
    }
    private JsonNode mailbox(ConfigurableApplicationContext app) throws Exception {
        int port=app.getBean(LocalMailbox.class).port();
        var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/messages")).GET().build();
        return JSON.readTree(http.send(request,HttpResponse.BodyHandlers.ofString()).body());
    }
    private String lastToken(ConfigurableApplicationContext app,String email) throws Exception {
        String found=null;
        for(var message:mailbox(app)) if(message.path("recipient").asString().equals(email)) found=message.path("token").asString();
        assertNotNull(found,"Caixa local deve receber confirmação sintética.");
        return found;
    }
    private static Map<String,String> registration(String email) {
        return Map.of("displayName","Pessoa sintética","email",email,"password","Uma frase sintética longa 13");
    }
    @Test
    void confirmationIsSingleUseAndAccountAndHashesSurviveApplicationRestart() throws Exception {
        String token;
        try(var app=start()) {
            assertEquals(202,post(app,"registrations",registration("restart@example.test")).statusCode());
            token=lastToken(app,"restart@example.test");
            var response=post(app,"confirmations",Map.of("token",token));
            assertEquals(200,response.statusCode());
            assertTrue(response.body().contains("ACCOUNT_CONFIRMED"));
            assertFalse(response.body().contains("restart@example.test"));
            assertEquals(409,post(app,"confirmations",Map.of("token",token)).statusCode());
        }
        try(var restarted=start()) {
            assertEquals(409,post(restarted,"confirmations",Map.of("token",token)).statusCode());
        }
    }

    @Test
    void resendReplacesOnlyEligibleTokensAndExpiredTokensCannotConfirm() throws Exception {
        try(var app=start("--vetor.accounts.resends-per-hour=2")) {
            String email="resend@example.test";
            assertEquals(202,post(app,"registrations",registration(email)).statusCode());
            String first=lastToken(app,email);
            var time=app.getBean(MutableClock.class);
            time.advance(Duration.ofMinutes(15));
            var expired=post(app,"confirmations",Map.of("token",first));
            assertEquals(410,expired.statusCode());
            assertTrue(expired.body().contains("EXPIRED_CONFIRMATION"));
            assertEquals(202,post(app,"confirmation-requests",Map.of("email",email)).statusCode());
            String second=lastToken(app,email);
            assertTrue(!first.equals(second));
            assertEquals(410,post(app,"confirmations",Map.of("token",first)).statusCode());
            assertEquals(202,post(app,"confirmation-requests",Map.of("email",email)).statusCode());
            assertTrue(second.equals(lastToken(app,email)),"Cooldown não revoga token já enviado.");
            time.advance(Duration.ofSeconds(60));
            assertEquals(202,post(app,"confirmation-requests",Map.of("email",email)).statusCode());
            String third=lastToken(app,email);
            time.advance(Duration.ofSeconds(60));
            assertEquals(202,post(app,"confirmation-requests",Map.of("email",email)).statusCode());
            assertTrue(third.equals(lastToken(app,email)),"Limite por conta não revoga token atual.");
            assertEquals(200,post(app,"confirmations",Map.of("token",third)).statusCode());
            var known=post(app,"confirmation-requests",Map.of("email",email));
            var unknown=post(app,"confirmation-requests",Map.of("email","absent@example.test"));
            assertEquals(known.statusCode(),unknown.statusCode());
            assertEquals(known.body(),unknown.body());
            assertEquals(409,post(app,"confirmations",Map.of("token",third)).statusCode());
            assertEquals(400,post(app,"confirmations",Map.of("token","invalid")).statusCode());
            var outcomes=new HashSet<>(app.getBean(org.springframework.jdbc.core.JdbcTemplate.class)
                .queryForList("SELECT outcome FROM account_audit_events",String.class));
            assertTrue(outcomes.containsAll(Set.of("CREATED","SENT","EXPIRED","REPLACED","USED","INVALID","CONFIRMED","SUPPRESSED")));
        }
    }

    @Test
    void credentialsAreProtectedAndPrivilegeFieldsCannotChangeServerRole(CapturedOutput output) throws Exception {
        try(var app=start()) {
            String email="protected@example.test";
            for(var field:List.of("role","roles","profile","admin","status")) {
                var body=new HashMap<String,Object>(registration(email)); body.put(field,"ADMIN");
                assertEquals(400,post(app,"registrations",body).statusCode());
            }
            var accepted=post(app,"registrations",registration("  PROTECTED@example.test  "));
            assertEquals(202,accepted.statusCode());
            String token=lastToken(app,email);
            var duplicate=new HashMap<>(registration(email)); duplicate.put("displayName","Outro nome"); duplicate.put("password","Outra frase sintética longa 13");
            assertEquals(accepted.body(),post(app,"registrations",duplicate).body());
            assertEquals(1,mailbox(app).size());
            var jdbc=app.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
            var account=jdbc.queryForMap("SELECT id,password_hash,role,status,display_name FROM local_accounts WHERE email=?",email);
            String hash=(String)account.get("password_hash");
            assertTrue(hash.startsWith("pbkdf2-sha256$600000$"));
            assertFalse(hash.contains(registration(email).get("password")));
            assertTrue(app.getBean(AccountPassword.class).matches(registration(email).get("password"),hash));
            assertFalse(app.getBean(AccountPassword.class).matches(duplicate.get("password"),hash));
            assertEquals("USER",account.get("role")); assertEquals("PENDING",account.get("status"));
            assertEquals("Pessoa sintética",account.get("display_name"));
            var stored=jdbc.queryForObject("SELECT token_hash FROM account_confirmation_tokens WHERE account_id=?",String.class,account.get("id"));
            assertEquals(64,stored.length()); assertTrue(!stored.equals(token));
            String audit=jdbc.queryForList("SELECT * FROM account_audit_events").toString();
            assertFalse(audit.contains(token)); assertFalse(audit.contains(hash)); assertFalse(audit.contains(email));
            assertFalse(output.getAll().contains(token)); assertFalse(output.getAll().contains(registration(email).get("password")));
            assertFalse(output.getAll().contains(hash));
            assertEquals("no-store",accepted.headers().firstValue("Cache-Control").orElse(""));
            var bad=post(app,"registrations",Map.of("displayName","Pessoa", "email",email,"password","curta"));
            assertEquals(400,bad.statusCode()); assertFalse(bad.body().contains("curta"));
            assertEquals(400,post(app,"registrations",registration("synthetic@example.com")).statusCode());
        }
    }
    @Test
    void configuredAttemptLimitsPersistAndResetAfterWindow() throws Exception {
        try(var app=start("--vetor.accounts.requests-per-minute=2")) {
            assertEquals(400,post(app,"confirmations",Map.of("token","invalid")).statusCode());
            assertEquals(400,post(app,"confirmations",Map.of("token","invalid")).statusCode());
        }
        try(var restarted=start("--vetor.accounts.requests-per-minute=2")) {
            var limited=post(restarted,"confirmations",Map.of("token","invalid"));
            assertEquals(429,limited.statusCode());
            assertTrue(limited.body().contains("REQUEST_LIMIT"));
            assertEquals("60",limited.headers().firstValue("Retry-After").orElse(""));
            restarted.getBean(MutableClock.class).advance(Duration.ofMinutes(1));
            assertEquals(400,post(restarted,"confirmations",Map.of("token","invalid")).statusCode());
            assertEquals(202,post(restarted,"registrations",registration("limit@example.test")).statusCode());
            assertEquals(202,post(restarted,"registrations",registration("limit@example.test")).statusCode());
            assertEquals(429,post(restarted,"registrations",registration("other@example.test")).statusCode());
            assertEquals(202,post(restarted,"confirmation-requests",Map.of("email","absent@example.test")).statusCode());
            assertEquals(202,post(restarted,"confirmation-requests",Map.of("email","absent@example.test")).statusCode());
            assertEquals(429,post(restarted,"confirmation-requests",Map.of("email","absent@example.test")).statusCode());
        }
    }
    @Test
    void concurrentConfirmationHasExactlyOneWinnerAndNeverCreatesSession() throws Exception {
        try(var app=start()) {
            assertEquals(202,post(app,"registrations",registration("race@example.test")).statusCode());
            String token=lastToken(app,"race@example.test");
            var executor=java.util.concurrent.Executors.newFixedThreadPool(2);
            try {
                var responses=executor.invokeAll(List.<java.util.concurrent.Callable<HttpResponse<String>>>of(
                    ()->post(app,"confirmations",Map.of("token",token)), ()->post(app,"confirmations",Map.of("token",token))));
                var codes=new ArrayList<Integer>();
                for(var future:responses) { var response=future.get();codes.add(response.statusCode());assertTrue(response.headers().allValues("Set-Cookie").isEmpty()); }
                Collections.sort(codes); assertEquals(List.of(200,409),codes);
            } finally { executor.shutdownNow(); }
        }
    }

    @Test
    void pendingAccountAndResendLimitSurviveRestartWithoutPersistingMailboxContent() throws Exception {
        String token;
        try(var app=start("--vetor.accounts.resends-per-hour=1")) {
            assertEquals(202,post(app,"registrations",registration("pending@example.test")).statusCode());
            app.getBean(MutableClock.class).advance(Duration.ofSeconds(60));
            assertEquals(202,post(app,"confirmation-requests",Map.of("email","pending@example.test")).statusCode());
            token=lastToken(app,"pending@example.test");
        }
        try(var app=start("--vetor.accounts.resends-per-hour=1")) {
            app.getBean(MutableClock.class).advance(Duration.ofSeconds(120));
            assertEquals(0,mailbox(app).size());
            assertEquals(202,post(app,"confirmation-requests",Map.of("email","pending@example.test")).statusCode());
            assertEquals(0,mailbox(app).size());
            assertEquals(200,post(app,"confirmations",Map.of("token",token)).statusCode());
            assertEquals("CONFIRMED",app.getBean(org.springframework.jdbc.core.JdbcTemplate.class).queryForObject(
                "SELECT status FROM local_accounts WHERE email='pending@example.test'",String.class));
        }
    }
    @Test
    void unavailableDatabaseAndCorsDoNotExposePayloadsOrReportSuccess() throws Exception {
        try(var app=start()) {
            int port=((WebServerApplicationContext)app).getWebServer().getPort();
            String base="http://127.0.0.1:"+port;
            var preflight=HttpRequest.newBuilder(URI.create(base+"/api/v1/accounts/registrations"))
                .header("Origin","http://127.0.0.1:4201").header("Access-Control-Request-Method","POST")
                .header("Access-Control-Request-Headers","content-type").method("OPTIONS",HttpRequest.BodyPublishers.noBody()).build();
            var cors=http.send(preflight,HttpResponse.BodyHandlers.ofString());
            assertEquals(200,cors.statusCode());
            assertEquals("http://127.0.0.1:4201",cors.headers().firstValue("Access-Control-Allow-Origin").orElse(""));
            var foreign=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+app.getBean(LocalMailbox.class).port()+"/messages"))
                .header("Origin","https://foreign.test").GET().build();
            assertEquals(403,http.send(foreign,HttpResponse.BodyHandlers.ofString()).statusCode());
            var query=HttpRequest.newBuilder(URI.create(base+"/api/v1/occurrences?periodStart=2026-10-14T15:00:00Z&periodEnd=2026-10-15T15:00:00Z")).GET().build();
            assertEquals(200,http.send(query,HttpResponse.BodyHandlers.ofString()).statusCode());
            var malformed=HttpRequest.newBuilder(URI.create(base+"/api/v1/accounts/registrations")).header("Content-Type","application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{\"password\":\"rejected-synthetic-secret\"")).build();
            var invalid=http.send(malformed,HttpResponse.BodyHandlers.ofString());
            assertEquals(400,invalid.statusCode()); assertFalse(invalid.body().contains("rejected-synthetic-secret"));
            var docker=org.testcontainers.DockerClientFactory.instance().client();
            docker.pauseContainerCmd(DB.getContainerId()).exec();
            try {
                var response=post(app,"registrations",registration("unavailable@example.test"));
                assertEquals(503,response.statusCode()); assertTrue(response.body().contains("ACCOUNTS_UNAVAILABLE"));
                assertFalse(response.body().contains("unavailable@example.test")); assertFalse(response.body().contains("password"));
            } finally { docker.unpauseContainerCmd(DB.getContainerId()).exec(); }
            assertEquals(202,post(app,"registrations",registration("unavailable@example.test")).statusCode());
        }
    }

    @Test
    void tokenExpiringWhileConfirmationWaitsForAccountLockIsRejected() throws Exception {
        try(var app=start()) {
            String email="lock-expiry@example.test";
            assertEquals(202,post(app,"registrations",registration(email)).statusCode());
            String token=lastToken(app,email);
            var executor=java.util.concurrent.Executors.newSingleThreadExecutor();
            try(var connection=DriverManager.getConnection(DB.getJdbcUrl(),DB.getUsername(),DB.getPassword())) {
                connection.setAutoCommit(false);
                try(var statement=connection.createStatement()) {
                    statement.executeQuery("SELECT id FROM local_accounts WHERE email='lock-expiry@example.test' FOR UPDATE").close();
                }
                var response=executor.submit(()->post(app,"confirmations",Map.of("token",token)));
                try {
                    boolean waiting=false;
                    long deadline=System.nanoTime()+Duration.ofSeconds(2).toNanos();
                    while(System.nanoTime()<deadline) {
                        waiting=app.getBean(org.springframework.jdbc.core.JdbcTemplate.class).queryForObject(
                            "SELECT count(*)>0 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE 'SELECT status FROM local_accounts%'",Boolean.class);
                        if(waiting) break;
                        Thread.sleep(20);
                    }
                    assertTrue(waiting,"A confirmação deve estar aguardando o bloqueio real da conta.");
                    app.getBean(MutableClock.class).advance(Duration.ofMinutes(15));
                } finally { connection.commit(); }
                var result=response.get(10,java.util.concurrent.TimeUnit.SECONDS);
                assertEquals(410,result.statusCode());
                assertTrue(result.body().contains("EXPIRED_CONFIRMATION"));
            } finally { executor.shutdownNow(); }
        }
    }

    @Test
    void registrationUsesRealHttpAndDoesNotReturnSecretsOrGrantAdmin() throws Exception {
        try (var app = new SpringApplicationBuilder(br.com.vetorurbano.api.VetorUrbanoApiApplication.class)
                .run("--server.port=0", "--vetor.accounts.enabled=true", "--vetor.accounts.mailbox-port=0",
                    "--spring.datasource.url=" + DB.getJdbcUrl(), "--spring.datasource.username=" + DB.getUsername(),
                    "--spring.datasource.password=" + DB.getPassword())) {
            int port = ((WebServerApplicationContext) app).getWebServer().getPort();
            var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/v1/accounts/registrations"))
                .header("Content-Type", "application/json").timeout(Duration.ofSeconds(15))
                .POST(HttpRequest.BodyPublishers.ofString("{\"displayName\":\"Pessoa sintética\",\"email\":\"first@example.test\",\"password\":\"Uma frase sintética longa 13\"}")).build();
            var response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
            assertEquals(202, response.statusCode());
            assertTrue(response.body().contains("CONFIRMATION_PENDING"));
            assertFalse(response.body().contains("password"));
            assertFalse(response.body().contains("token"));
            assertFalse(response.body().contains("first@example.test"));
        }
    }
}
