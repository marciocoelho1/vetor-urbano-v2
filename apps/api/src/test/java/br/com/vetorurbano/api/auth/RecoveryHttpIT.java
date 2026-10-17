package br.com.vetorurbano.api.auth;

import static org.junit.jupiter.api.Assertions.*;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.*;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.*;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.web.server.context.WebServerApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;
import tools.jackson.databind.JsonNode;

/**
 * Ticket 15, fatia de recuperação de acesso (E01/E15/E16).
 * Fronteira real: HTTP → Java → PostgreSQL/PostGIS sintético.
 */
@Testcontainers
@ExtendWith(OutputCaptureExtension.class)
class RecoveryHttpIT extends LocalAuthHttpSupport {
    @Container static final PostgreSQLContainer<?> DB=new PostgreSQLContainer<>(DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    static final MutableClock CLOCK=new MutableClock();
    @TestConfiguration static class TimeConfig { @Bean @Primary Clock clock(){return CLOCK;} }
    @Override PostgreSQLContainer<?> database() { return DB; }
    @Override MutableClock clock() { return CLOCK; }
    @Override Class<?> timeConfiguration() { return TimeConfig.class; }

    private static final String ORIGINAL="Frase sintética para sessão 14";
    private static final String RENEWED="Frase sintética redefinida 15";
    private static final String WEAK="curta demais";

    /** Login isolado: não altera o cookie/CSRF compartilhado do apoio. */
    private String loginCookie(ConfigurableApplicationContext app,String email,String password)throws Exception {
        var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port(app)+"/api/v1/auth/login"))
            .header("Content-Type","application/json").timeout(Duration.ofSeconds(15))
            .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(Map.of("email",email,"password",password)))).build();
        var response=http.send(request,HttpResponse.BodyHandlers.ofString());
        return response.statusCode()==200?response.headers().firstValue("set-cookie").orElseThrow().split(";",2)[0]:null;
    }
    private int sessionStatus(ConfigurableApplicationContext app,String session)throws Exception {
        var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port(app)+"/api/v1/auth/session"))
            .header("Cookie",session).GET().timeout(Duration.ofSeconds(15)).build();
        return http.send(request,HttpResponse.BodyHandlers.ofString()).statusCode();
    }
    private int port(ConfigurableApplicationContext app) { return ((WebServerApplicationContext)app).getWebServer().getPort(); }
    private String bodyOf(ConfigurableApplicationContext app,String email)throws Exception {
        var response=request(app,"POST","accounts/recovery-requests",Map.of("email",email));
        assertEquals(202,response.statusCode());
        return response.body();
    }
    private JsonNode messages(ConfigurableApplicationContext app)throws Exception {
        var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+app.getBean(br.com.vetorurbano.api.accounts.LocalMailbox.class).port()+"/messages")).GET().build();
        return JSON.readTree(http.send(request,HttpResponse.BodyHandlers.ofString()).body());
    }
    private JsonNode lastMessage(ConfigurableApplicationContext app,String email,String kind)throws Exception {
        JsonNode found=null;
        for(var message:messages(app)) if(message.path("recipient").asString().equals(email)&&message.path("kind").asString().equals(kind)) found=message;
        return found;
    }
    private int countMessages(ConfigurableApplicationContext app,String email,String kind)throws Exception {
        int count=0;
        for(var message:messages(app)) if(message.path("recipient").asString().equals(email)&&message.path("kind").asString().equals(kind)) count++;
        return count;
    }
    private String recoveryToken(ConfigurableApplicationContext app,String email,String kind)throws Exception {
        var message=lastMessage(app,email,kind);
        assertNotNull(message,"Esperava uma mensagem "+kind+" para "+email);
        return message.path("token").asString();
    }
    private HttpResponse<String> recover(ConfigurableApplicationContext app,String token,String password)throws Exception {
        return request(app,"POST","accounts/recoveries",Map.of("token",token,"password",password));
    }

    @Test void pedidoDeRecuperacaoNaoRevelaContaNemEncerraSessao()throws Exception {
        try(var app=start()) {
            register(app,"user15a@example.test",true);
            register(app,"pending15@example.test",false);
            String session=loginCookie(app,"user15a@example.test",ORIGINAL);
            assertNotNull(session);
            assertEquals(200,sessionStatus(app,session));

            String confirmed=bodyOf(app,"user15a@example.test");
            String unknown=bodyOf(app,"ninguem15@example.test");
            String pending=bodyOf(app,"pending15@example.test");

            // Respostas indistinguíveis: mesma mensagem para conta confirmada, pendente e inexistente.
            assertEquals(confirmed,unknown);
            assertEquals(confirmed,pending);
            assertFalse(confirmed.contains("example.test"));
            assertEquals("RECOVERY_PENDING",JSON.readTree(confirmed).path("code").asString());
            assertEquals(2,JSON.readTree(confirmed).size());

            // Somente a conta confirmada recebe link; o cadastro pendente já tem sua própria confirmação.
            assertEquals(1,countMessages(app,"user15a@example.test","RECOVERY"));
            assertEquals(1,countMessages(app,"user15a@example.test","CONFIRMATION"));
            var message=lastMessage(app,"user15a@example.test","RECOVERY");
            assertNotNull(message);
            assertTrue(message.path("link").asString().endsWith("recuperar="+message.path("token").asString()));
            assertEquals(CLOCK.instant().plus(Duration.ofMinutes(10)).toString(),message.path("expiresAt").asString());
            assertFalse(message.path("subject").asString().isBlank());
            assertNull(lastMessage(app,"pending15@example.test","RECOVERY"));
            assertNull(lastMessage(app,"ninguem15@example.test","RECOVERY"));

            // E01: solicitar o link não encerra sessões.
            assertEquals(200,sessionStatus(app,session));
        }
    }

    @Test void linkDeRecuperacaoEhUsoUnicoExpiraESubstituido()throws Exception {
        try(var app=start()) {
            register(app,"user15b@example.test",true);
            bodyOf(app,"user15b@example.test");
            String first=recoveryToken(app,"user15b@example.test","RECOVERY");

            assertEquals(400,recover(app,"0".repeat(43),RENEWED).statusCode());
            assertEquals("INVALID_RECOVERY",JSON.readTree(recover(app,"0".repeat(43),RENEWED).body()).path("code").asString());
            assertEquals(400,recover(app,"token-invalido",RENEWED).statusCode());

            CLOCK.advance(600);
            var expired=recover(app,first,RENEWED);
            assertEquals(410,expired.statusCode());
            assertEquals("EXPIRED_RECOVERY",JSON.readTree(expired.body()).path("code").asString());
            // Link expirado não altera credencial.
            assertNull(loginCookie(app,"user15b@example.test",RENEWED));

            CLOCK.advance(60);
            bodyOf(app,"user15b@example.test");
            String second=recoveryToken(app,"user15b@example.test","RECOVERY");
            assertNotEquals(first,second);
            var replaced=recover(app,first,RENEWED);
            assertEquals(410,replaced.statusCode());
            assertEquals("REPLACED_RECOVERY",JSON.readTree(replaced.body()).path("code").asString());

            assertEquals(200,recover(app,second,RENEWED).statusCode());
            var used=recover(app,second,RENEWED);
            assertEquals(409,used.statusCode());
            assertEquals("USED_RECOVERY",JSON.readTree(used.body()).path("code").asString());
        }
    }

    @Test void recuperacaoTrocaSenhaRevogaSessoesESobreviveAoServidorReiniciado(CapturedOutput output)throws Exception {
        try(var app=start()) {
            register(app,"user15c@example.test",true);
            register(app,"other15@example.test",true);
            String sessionA=loginCookie(app,"user15c@example.test",ORIGINAL);
            String sessionA2=loginCookie(app,"user15c@example.test",ORIGINAL);
            String sessionB=loginCookie(app,"other15@example.test",ORIGINAL);
            assertEquals(200,sessionStatus(app,sessionA));

            bodyOf(app,"user15c@example.test");
            String token=recoveryToken(app,"user15c@example.test","RECOVERY");

            // Senha fraca: recusa sem efeito — link continua utilizável e nada é revogado.
            var weak=recover(app,token,WEAK);
            assertEquals(400,weak.statusCode());
            assertEquals("INVALID_RECOVERY",JSON.readTree(weak.body()).path("code").asString());
            String sessionA3=loginCookie(app,"user15c@example.test",ORIGINAL);
            assertNotNull(sessionA3);
            assertEquals(200,sessionStatus(app,sessionA));

            assertEquals(200,recover(app,token,RENEWED).statusCode());
            // E01: recuperação concluída encerra todas as sessões anteriores e exige novo login.
            assertEquals(401,sessionStatus(app,sessionA));
            assertEquals(401,sessionStatus(app,sessionA2));
            assertEquals(401,sessionStatus(app,sessionA3));
            assertEquals(200,sessionStatus(app,sessionB));
            assertNull(loginCookie(app,"user15c@example.test",ORIGINAL));
            String sessionNew=loginCookie(app,"user15c@example.test",RENEWED);
            assertNotNull(sessionNew);
            assertEquals(200,sessionStatus(app,sessionNew));

            var jdbc=app.getBean(JdbcTemplate.class);
            assertEquals(3,jdbc.queryForObject("SELECT count(*) FROM local_sessions WHERE account_id=(SELECT id FROM local_accounts WHERE email='user15c@example.test') AND revoked_at IS NOT NULL",Integer.class));
            // Somente a sessão nova, criada depois da recuperação, segue ativa.
            assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM local_sessions WHERE account_id=(SELECT id FROM local_accounts WHERE email='user15c@example.test') AND revoked_at IS NULL",Integer.class));
            assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM account_audit_events WHERE action='RECOVERY' AND outcome='RECOVERED'",Integer.class));
            assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM account_audit_events WHERE action='RECOVERY_REQUEST' AND outcome='SENT'",Integer.class));
            assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM auth_audit_events WHERE action='REVOKE_ALL' AND outcome='REVOKED'",Integer.class));

            // E14: aviso transacional de alteração de senha, sem token.
            var notice=lastMessage(app,"user15c@example.test","RECOVERY_COMPLETED");
            assertNotNull(notice,"Esperava aviso de senha alterada");
            assertTrue(notice.path("token").isNull()||notice.path("token").asString().isEmpty());

            // Código de recuperação e senha nunca aparecem em log nem no que ficou gravado.
            assertEquals(0,secretsWritten(app,token));
            assertEquals(0,secretsWritten(app,RENEWED));
            assertFalse(output.getOut().contains(token));
            assertFalse(output.getOut().contains(RENEWED));
            assertFalse(output.getOut().contains(WEAK));

            // Uso único sobrevive a reinício: nova instância não reabilita o link consumido.
            try(var restarted=start()) {
                assertEquals(409,recover(restarted,token,RENEWED).statusCode());
            }
        }
    }

    @Test void campoNaoDeclaradoEhRecusadoSemConsumirLink()throws Exception {
        try(var app=start()) {
            register(app,"user15f@example.test",true);
            bodyOf(app,"user15f@example.test");
            String token=recoveryToken(app,"user15f@example.test","RECOVERY");
            var extra=request(app,"POST","accounts/recoveries",Map.of("token",token,"password",RENEWED,"role","ADMIN"));
            assertEquals(400,extra.statusCode());
            assertEquals("INVALID_REQUEST",JSON.readTree(extra.body()).path("code").asString());
            assertEquals(1,app.getBean(JdbcTemplate.class).queryForObject("SELECT count(*) FROM account_audit_events WHERE action='RECOVERY' AND outcome='REJECTED'",Integer.class));
            // O corpo recusado não consome o link: a conclusão válida ainda funciona.
            assertEquals(200,recover(app,token,RENEWED).statusCode());
            assertNotNull(loginCookie(app,"user15f@example.test",RENEWED));
        }
    }

    @Test void estadoDaContaEhRevalidadoNaConclusaoSemConsumirLink()throws Exception {
        try(var app=start()) {
            register(app,"user15g@example.test",true);
            bodyOf(app,"user15g@example.test");
            String token=recoveryToken(app,"user15g@example.test","RECOVERY");
            var jdbc=app.getBean(JdbcTemplate.class);
            String stored=jdbc.queryForObject("SELECT password_hash FROM local_accounts WHERE email='user15g@example.test'",String.class);
            // E15: concluir exige revalidar o estado da conta, não só o prazo do link.
            jdbc.update("UPDATE local_accounts SET status='PENDING',confirmed_at=NULL WHERE email='user15g@example.test'");
            var rejected=recover(app,token,RENEWED);
            assertEquals(400,rejected.statusCode());
            assertEquals("INVALID_RECOVERY",JSON.readTree(rejected.body()).path("code").asString());
            assertEquals(stored,jdbc.queryForObject("SELECT password_hash FROM local_accounts WHERE email='user15g@example.test'",String.class));
            assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM account_recovery_tokens WHERE consumed_at IS NOT NULL",Integer.class));
            jdbc.update("UPDATE local_accounts SET status='CONFIRMED',confirmed_at=now() WHERE email='user15g@example.test'");
            assertEquals(200,recover(app,token,RENEWED).statusCode());
            assertNotNull(loginCookie(app,"user15g@example.test",RENEWED));
        }
    }

    @Test void conclusaoEhUnicaSobConcorrencia()throws Exception {
        try(var app=start()) {
            register(app,"user15h@example.test",true);
            bodyOf(app,"user15h@example.test");
            String token=recoveryToken(app,"user15h@example.test","RECOVERY");
            var barrier=new java.util.concurrent.CyclicBarrier(2);
            java.util.List<Integer> statuses;
            try(var pool=java.util.concurrent.Executors.newFixedThreadPool(2)) {
                var futures=java.util.stream.IntStream.range(0,2).mapToObj(index->pool.submit(()->{
                    barrier.await(30,java.util.concurrent.TimeUnit.SECONDS);
                    return recover(app,token,RENEWED).statusCode();
                })).toList();
                statuses=new ArrayList<>();
                for(var future:futures) statuses.add(future.get(60,java.util.concurrent.TimeUnit.SECONDS));
            }
            Collections.sort(statuses);
            // Exatamente uma conclusão vence; a outra enxerga o link consumido.
            assertEquals(List.of(200,409),statuses);
            var jdbc=app.getBean(JdbcTemplate.class);
            assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM account_recovery_tokens WHERE consumed_at IS NOT NULL",Integer.class));
            assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM account_audit_events WHERE action='RECOVERY' AND outcome='RECOVERED'",Integer.class));
            assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM account_audit_events WHERE action='RECOVERY' AND outcome='USED'",Integer.class));
            assertNotNull(loginCookie(app,"user15h@example.test",RENEWED));
        }
    }

    @Test void recuperacaoPreservaSegundoFatorAdministrativo()throws Exception {
        try(var app=start()) {
            UUID admin=bootstrap(app);
            accept(login(app,"admin14@example.test"));
            byte[] secret=enrolledSecret(app,admin);
            accept(request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))));
            var jdbc=app.getBean(JdbcTemplate.class);
            String stored=jdbc.queryForObject("SELECT mfa_secret FROM local_accounts WHERE id=?",String.class,admin);
            assertEquals(202,request(app,"POST","accounts/recovery-requests",Map.of("email","admin14@example.test")).statusCode());
            String token=recoveryToken(app,"admin14@example.test","RECOVERY");
            assertEquals(200,recover(app,token,RENEWED).statusCode());
            // E01: a sessão verificada morre, mas o segundo fator continua exigido com o mesmo segredo.
            assertEquals(401,request(app,"GET","auth/session",null).statusCode());
            var partial=request(app,"POST","auth/login",Map.of("email","admin14@example.test","password",RENEWED));
            assertEquals(200,partial.statusCode());
            var body=JSON.readTree(partial.body());
            assertEquals("MFA_REQUIRED",body.path("code").asString());
            assertFalse(body.path("authenticated").asBoolean());
            assertEquals("ADMIN",body.path("role").asString());
            assertTrue(body.path("mfaEnrolled").asBoolean());
            assertEquals(stored,jdbc.queryForObject("SELECT mfa_secret FROM local_accounts WHERE id=?",String.class,admin));
            assertTrue(jdbc.queryForObject("SELECT mfa_enabled FROM local_accounts WHERE id=?",Boolean.class,admin));
            // O autenticador existente continua valendo: um código novo concede sessão completa.
            CLOCK.advance(30);
            cookie=partial.headers().firstValue("set-cookie").orElseThrow().split(";",2)[0];
            csrf=body.path("csrfToken").asString();
            var verified=request(app,"POST","auth/mfa/verification",Map.of("code",code(secret)));
            assertEquals(200,verified.statusCode());
            assertTrue(JSON.readTree(verified.body()).path("authenticated").asBoolean());
        }
    }

    @Test void reexpedicaoSuprimidaPreservaLinkAtivo()throws Exception {
        try(var app=start()) {
            register(app,"user15i@example.test",true);
            bodyOf(app,"user15i@example.test");
            String first=recoveryToken(app,"user15i@example.test","RECOVERY");
            // Repetição dentro do cooldown é suprimida: não gera mensagem nova e não revoga o link ativo.
            bodyOf(app,"user15i@example.test");
            assertEquals(1,countMessages(app,"user15i@example.test","RECOVERY"));
            assertEquals(1,app.getBean(JdbcTemplate.class).queryForObject("SELECT count(*) FROM account_audit_events WHERE action='RECOVERY_REQUEST' AND outcome='SUPPRESSED'",Integer.class));
            // O link anterior continua utilizável porque a repetição suprimida não o substituiu.
            assertEquals(200,recover(app,first,RENEWED).statusCode());
            assertNotNull(loginCookie(app,"user15i@example.test",RENEWED));
        }
    }

    @Test void pedidoDeRecuperacaoEhLimitado()throws Exception {
        try(var app=start("--vetor.accounts.requests-per-minute=2")) {
            register(app,"user15d@example.test",true);
            assertEquals(202,request(app,"POST","accounts/recovery-requests",Map.of("email","user15d@example.test")).statusCode());
            assertEquals(202,request(app,"POST","accounts/recovery-requests",Map.of("email","user15d@example.test")).statusCode());
            var limited=request(app,"POST","accounts/recovery-requests",Map.of("email","user15d@example.test"));
            assertEquals(429,limited.statusCode());
            assertEquals("REQUEST_LIMIT",JSON.readTree(limited.body()).path("code").asString());
            assertEquals("60",limited.headers().firstValue("Retry-After").orElse(""));
            assertEquals(1,app.getBean(JdbcTemplate.class).queryForObject("SELECT count(*) FROM account_audit_events WHERE action='RECOVERY_REQUEST' AND outcome='LIMITED'",Integer.class));
        }
    }
}
