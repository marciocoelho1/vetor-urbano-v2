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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import br.com.vetorurbano.api.accounts.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;
import tools.jackson.databind.JsonNode;

/**
 * Ticket 15B (E02/E14/E15): alterações autenticadas da própria conta.
 * Fronteira real: HTTP → Java → PostgreSQL/PostGIS sintético, com sessão, CSRF e código MFA.
 */
@Testcontainers
@ExtendWith(OutputCaptureExtension.class)
class SelfServiceHttpIT extends LocalAuthHttpSupport {
    @Container static final PostgreSQLContainer<?> DB=new PostgreSQLContainer<>(DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    static final MutableClock CLOCK=new MutableClock();
    @TestConfiguration static class TimeConfig { @Bean @Primary Clock clock(){return CLOCK;} }
    @Override PostgreSQLContainer<?> database() { return DB; }
    @Override MutableClock clock() { return CLOCK; }
    @Override Class<?> timeConfiguration() { return TimeConfig.class; }

    private static final String ORIGINAL="Frase sintética para sessão 14";
    private static final String RENEWED="Frase sintética alterada 15";

    /** Login isolado: devolve o cookie sem mexer no cookie/CSRF compartilhado. */
    private String loginCookie(ConfigurableApplicationContext app,String email,String password)throws Exception {
        int port=((org.springframework.boot.web.server.context.WebServerApplicationContext)app).getWebServer().getPort();
        var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/v1/auth/login"))
            .header("Content-Type","application/json").timeout(Duration.ofSeconds(15))
            .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(Map.of("email",email,"password",password)))).build();
        var response=http.send(request,HttpResponse.BodyHandlers.ofString());
        return response.statusCode()==200?response.headers().firstValue("set-cookie").orElseThrow().split(";",2)[0]:null;
    }
    private int sessionStatus(ConfigurableApplicationContext app,String session)throws Exception {
        int port=((org.springframework.boot.web.server.context.WebServerApplicationContext)app).getWebServer().getPort();
        var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/v1/auth/session"))
            .header("Cookie",session).GET().timeout(Duration.ofSeconds(15)).build();
        return http.send(request,HttpResponse.BodyHandlers.ofString()).statusCode();
    }
    private JsonNode messages(ConfigurableApplicationContext app)throws Exception {
        var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+app.getBean(LocalMailbox.class).port()+"/messages")).GET().build();
        return JSON.readTree(http.send(request,HttpResponse.BodyHandlers.ofString()).body());
    }
    private JsonNode lastMessage(ConfigurableApplicationContext app,String email,String kind)throws Exception {
        JsonNode found=null;
        for(var message:messages(app)) if(message.path("recipient").asString().equals(email)&&message.path("kind").asString().equals(kind)) found=message;
        return found;
    }
    private String changeToken(ConfigurableApplicationContext app,String email)throws Exception {
        var message=lastMessage(app,email,"EMAIL_CHANGE_CONFIRMATION");
        assertNotNull(message,"Esperava confirmação de troca para "+email);
        return message.path("token").asString();
    }
    private HttpResponse<String> confirmChange(ConfigurableApplicationContext app,String token)throws Exception {
        return request(app,"POST","accounts/email-changes/confirmations",Map.of("token",token));
    }
    private String emailOf(ConfigurableApplicationContext app,String email) {
        return app.getBean(JdbcTemplate.class).queryForObject("SELECT email FROM local_accounts WHERE email=?",String.class,email);
    }

    @Test void perfilExigeSessaoCompletaESemDadoSensivel()throws Exception {
        try(var app=start()) {
            register(app,"self15a@example.test",true);
            assertEquals(401,request(app,"GET","account",null).statusCode());
            accept(login(app,"self15a@example.test"));
            var profile=request(app,"GET","account",null);
            assertEquals(200,profile.statusCode());
            var body=JSON.readTree(profile.body());
            assertEquals("ACCOUNT_PROFILE",body.path("code").asString());
            assertEquals("self15a@example.test",body.path("email").asString());
            assertEquals("Pessoa 14",body.path("displayName").asString());
            assertEquals("USER",body.path("role").asString());
            assertTrue(body.path("pendingEmail").isMissingNode());
            assertFalse(profile.body().contains("password"));
            assertFalse(profile.body().contains("pbkdf2"));
            assertEquals("no-store",profile.headers().firstValue("Cache-Control").orElse(""));
            // ADMIN parcial não alcança o autoatendimento; o servidor recusa antes do serviço.
            UUID admin=bootstrap(app);
            cookie=null;csrf=null;
            accept(login(app,"admin14@example.test"));
            assertEquals(403,request(app,"GET","account",null).statusCode());
            assertEquals(403,request(app,"POST","account/display-name",Map.of("displayName","Outro nome")).statusCode());
            assertEquals("Admin sintético",app.getBean(JdbcTemplate.class).queryForObject("SELECT display_name FROM local_accounts WHERE id=?",String.class,admin));
        }
    }

    /** Mesma derivação do serviço (SHA-256 em hexadecimal) para inspecionar token_hash. */
    private static String digest(String value) {
        try {
            return java.util.HexFormat.of().formatHex(
                java.security.MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    @Test void nomeMudaEmSessaoSemEncerrarEAceitaSomenteCamposDeclarados()throws Exception {
        try(var app=start()) {
            register(app,"self15b@example.test",true);
            String session=loginCookie(app,"self15b@example.test",ORIGINAL);
            accept(login(app,"self15b@example.test"));
            assertNotNull(csrf);
            assertEquals(400,request(app,"POST","account/display-name",Map.of("displayName","A")).statusCode());
            assertEquals(400,request(app,"POST","account/display-name",Map.of("displayName","Pessoa sintética 15","role","ADMIN")).statusCode());
            assertEquals("INVALID_REQUEST",JSON.readTree(request(app,"POST","account/display-name",Map.of("displayName","Pessoa sintética 15","role","ADMIN")).body()).path("code").asString());
            assertEquals(200,request(app,"POST","account/display-name",Map.of("displayName","Pessoa sintética 15")).statusCode());
            assertEquals("Pessoa sintética 15",JSON.readTree(request(app,"GET","account",null).body()).path("displayName").asString());
            // E02: o nome muda sem desconectar.
            assertEquals(200,sessionStatus(app,session));
            // CSRF ausente é recusado e nada muda.
            assertEquals(403,request(app,"POST","account/display-name",Map.of("displayName","Outro"),null,false).statusCode());
            assertEquals("Pessoa sintética 15",JSON.readTree(request(app,"GET","account",null).body()).path("displayName").asString());
        }
    }

    @Test void senhaExigeAtualRevogaSessoesELinksErespeitaLimite()throws Exception {
        try(var app=start("--vetor.accounts.sensitive-attempts=3")) {
            register(app,"self15c@example.test",true);
            String first=loginCookie(app,"self15c@example.test",ORIGINAL);
            String second=loginCookie(app,"self15c@example.test",ORIGINAL);
            accept(login(app,"self15c@example.test"));
            // Link de recuperação pendente deve cair quando a senha muda (E02).
            assertEquals(202,request(app,"POST","accounts/recovery-requests",Map.of("email","self15c@example.test")).statusCode());
            String recovery=lastMessage(app,"self15c@example.test","RECOVERY").path("token").asString();
            // Pendência de troca de e-mail também deve cair quando a senha muda (E02).
            assertEquals(202,request(app,"POST","account/email-changes",Map.of("currentPassword",ORIGINAL,"newEmail","self15c-novo@example.test")).statusCode());
            String emailToken=lastMessage(app,"self15c-novo@example.test","EMAIL_CHANGE_CONFIRMATION").path("token").asString();
            var pending=app.getBean(JdbcTemplate.class).queryForMap("SELECT consumed_at,revoked_at FROM account_email_change_tokens WHERE token_hash=?",digest(emailToken));
            assertNull(pending.get("consumed_at"));assertNull(pending.get("revoked_at"));

            var wrong=request(app,"POST","account/password",Map.of("currentPassword","errada de propósito","newPassword",RENEWED,"mfaCode",""));
            assertEquals(400,wrong.statusCode());
            assertEquals("INVALID_CURRENT_PASSWORD",JSON.readTree(wrong.body()).path("code").asString());
            assertNotNull(loginCookie(app,"self15c@example.test",ORIGINAL));
            assertEquals(200,sessionStatus(app,first));

            assertEquals(400,request(app,"POST","account/password",Map.of("currentPassword",ORIGINAL,"newPassword","curta")).statusCode());
            assertNotNull(loginCookie(app,"self15c@example.test",ORIGINAL));

            assertEquals(200,request(app,"POST","account/password",Map.of("currentPassword",ORIGINAL,"newPassword",RENEWED)).statusCode());
            assertEquals(401,sessionStatus(app,first));
            assertEquals(401,sessionStatus(app,second));
            assertNull(loginCookie(app,"self15c@example.test",ORIGINAL));
            assertNotNull(loginCookie(app,"self15c@example.test",RENEWED));
            var jdbc=app.getBean(JdbcTemplate.class);
            assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM account_audit_events WHERE action='PASSWORD_CHANGE' AND outcome='CHANGED'",Integer.class));
            assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM auth_audit_events WHERE action='REVOKE_ALL'",Integer.class));
            var notice=lastMessage(app,"self15c@example.test","PASSWORD_CHANGED");
            assertNotNull(notice);
            assertTrue(notice.path("token").isNull()||notice.path("token").asString().isEmpty());
            // O link de recuperação pendente foi revogado pela troca de senha.
            assertEquals(410,request(app,"POST","accounts/recoveries",Map.of("token",recovery,"password","Outra frase sintética longa 15")).statusCode());
            // A troca de e-mail pendente também cai: confirmá-la depois responde link substituído.
            var dropped=request(app,"POST","accounts/email-changes/confirmations",Map.of("token",emailToken));
            assertEquals(410,dropped.statusCode());
            assertEquals("REPLACED_EMAIL_CHANGE",JSON.readTree(dropped.body()).path("code").asString());
            var afterPassword=app.getBean(JdbcTemplate.class).queryForMap("SELECT consumed_at,revoked_at FROM account_email_change_tokens WHERE token_hash=?",digest(emailToken));
            assertNull(afterPassword.get("consumed_at"));assertNotNull(afterPassword.get("revoked_at"));
            // Senha e código nunca aparecem em claro no que ficou gravado.
            assertEquals(0,secretsWritten(app,RENEWED));
            assertEquals(0,secretsWritten(app,recovery));
            assertEquals(0,secretsWritten(app,emailToken));
        }
    }

    @Test void limitePorContaDaSenhaAtualEhAplicado()throws Exception {
        try(var app=start("--vetor.accounts.sensitive-attempts=3")) {
            register(app,"self15d@example.test",true);
            accept(login(app,"self15d@example.test"));
            for(int attempt=0;attempt<3;attempt++)
                assertEquals(400,request(app,"POST","account/password",Map.of("currentPassword","errada de propósito","newPassword",RENEWED)).statusCode());
            var limited=request(app,"POST","account/password",Map.of("currentPassword","errada de propósito","newPassword",RENEWED));
            assertEquals(429,limited.statusCode());
            assertEquals("REQUEST_LIMIT",JSON.readTree(limited.body()).path("code").asString());
            assertEquals("60",limited.headers().firstValue("Retry-After").orElse(""));
            assertNotNull(loginCookie(app,"self15d@example.test",ORIGINAL));
        }
    }

    @Test void trocaDeEmailSoValeAposConfirmacaoNoNovoEndereco()throws Exception {
        try(var app=start()) {
            register(app,"self15e@example.test",true);
            register(app,"taken15@example.test",true);
            String session=loginCookie(app,"self15e@example.test",ORIGINAL);
            accept(login(app,"self15e@example.test"));

            // Senha atual exigida; endereço de outra conta, igual ao atual ou inválido recebem resposta neutra.
            assertEquals(400,request(app,"POST","account/email-changes",Map.of("currentPassword","errada de propósito","newEmail","novo15e@example.test")).statusCode());
            var taken=request(app,"POST","account/email-changes",Map.of("currentPassword",ORIGINAL,"newEmail","taken15@example.test"));
            assertEquals(400,taken.statusCode());
            assertEquals("INVALID_EMAIL_CHANGE",JSON.readTree(taken.body()).path("code").asString());
            assertEquals(400,request(app,"POST","account/email-changes",Map.of("currentPassword",ORIGINAL,"newEmail","self15e@example.test")).statusCode());
            assertEquals(400,request(app,"POST","account/email-changes",Map.of("currentPassword",ORIGINAL,"newEmail","invalido@exemplo.com")).statusCode());
            assertNull(lastMessage(app,"novo15e@example.test","EMAIL_CHANGE_CONFIRMATION"));

            var requested=request(app,"POST","account/email-changes",Map.of("currentPassword",ORIGINAL,"newEmail","novo15e@example.test"));
            assertEquals(202,requested.statusCode());
            assertEquals("EMAIL_CHANGE_PENDING",JSON.readTree(requested.body()).path("code").asString());
            // E14: confirmação ao novo endereço e aviso ao antigo, sem link que reverta.
            var confirmation=lastMessage(app,"novo15e@example.test","EMAIL_CHANGE_CONFIRMATION");
            assertNotNull(confirmation);
            assertEquals(CLOCK.instant().plus(Duration.ofMinutes(10)).toString(),confirmation.path("expiresAt").asString());
            assertTrue(confirmation.path("link").asString().endsWith("trocar-email="+confirmation.path("token").asString()));
            var notice=lastMessage(app,"self15e@example.test","EMAIL_CHANGE_REQUEST_NOTICE");
            assertNotNull(notice);
            assertTrue(notice.path("token").isNull()||notice.path("token").asString().isEmpty());
            assertTrue(notice.path("link").isNull()||notice.path("link").asString().isEmpty());
            // O endereço atual continua valendo enquanto pendente, e o perfil anuncia a pendência.
            assertEquals("self15e@example.test",emailOf(app,"self15e@example.test"));
            assertEquals(200,sessionStatus(app,session));
            assertNotNull(loginCookie(app,"self15e@example.test",ORIGINAL));
            var profile=JSON.readTree(request(app,"GET","account",null).body());
            assertEquals("novo15e@example.test",profile.path("pendingEmail").asString());
            assertEquals("self15e@example.test",profile.path("email").asString());

            // Link inválido, expirado e substituído não alteram nada.
            assertEquals(400,confirmChange(app,"0".repeat(43)).statusCode());
            var token=changeToken(app,"novo15e@example.test");
            CLOCK.advance(600);
            var expired=confirmChange(app,token);
            assertEquals(410,expired.statusCode());
            assertEquals("EXPIRED_EMAIL_CHANGE",JSON.readTree(expired.body()).path("code").asString());
            assertEquals("self15e@example.test",emailOf(app,"self15e@example.test"));
            CLOCK.advance(60);
            assertEquals(202,request(app,"POST","account/email-changes",Map.of("currentPassword",ORIGINAL,"newEmail","outro15e@example.test")).statusCode());
            String replacement=changeToken(app,"outro15e@example.test");
            var replaced=confirmChange(app,token);
            assertEquals(410,replaced.statusCode());
            assertEquals("REPLACED_EMAIL_CHANGE",JSON.readTree(replaced.body()).path("code").asString());

            // Conflito de endereço revalidado na conclusão: nada muda.
            register(app,"outro15e@example.test",true);
            var conflict=confirmChange(app,replacement);
            assertEquals(409,conflict.statusCode());
            assertEquals("EMAIL_TAKEN",JSON.readTree(conflict.body()).path("code").asString());
            assertEquals("self15e@example.test",emailOf(app,"self15e@example.test"));

            CLOCK.advance(61);
            assertEquals(202,request(app,"POST","account/email-changes",Map.of("currentPassword",ORIGINAL,"newEmail","final15e@example.test")).statusCode());
            String finalToken=changeToken(app,"final15e@example.test");
            assertEquals(200,confirmChange(app,finalToken).statusCode());
            assertEquals("final15e@example.test",emailOf(app,"final15e@example.test"));
            // E02: troca efetivada revoga todas as sessões e exige novo login.
            assertEquals(401,sessionStatus(app,session));
            assertNull(loginCookie(app,"self15e@example.test",ORIGINAL));
            assertNotNull(loginCookie(app,"final15e@example.test",ORIGINAL));
            assertEquals(409,confirmChange(app,finalToken).statusCode());
            assertNotNull(lastMessage(app,"final15e@example.test","EMAIL_CHANGED"));
            assertNotNull(lastMessage(app,"self15e@example.test","EMAIL_CHANGE_NOTICE"));
            assertEquals(0,secretsWritten(app,finalToken));
        }
    }

    @Test void administradorExigeCodigoNovoParaSensivelEDepoisExigeNovoLogin()throws Exception {
        try(var app=start()) {
            UUID admin=bootstrap(app);
            accept(login(app,"admin14@example.test"));
            byte[] secret=enrolledSecret(app,admin);
            accept(request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))));
            String fullSession=cookie, fullCsrf=csrf;
            // E02: nome de exibição não exige código; senha e e-mail exigem.
            assertEquals(200,request(app,"POST","account/display-name",Map.of("displayName","Admin sintético 15")).statusCode());
            var missing=request(app,"POST","account/password",Map.of("currentPassword",ORIGINAL,"newPassword",RENEWED));
            assertEquals(401,missing.statusCode());
            assertEquals("INVALID_MFA",JSON.readTree(missing.body()).path("code").asString());
            var wrong=request(app,"POST","account/password",Map.of("currentPassword",ORIGINAL,"newPassword",RENEWED,"mfaCode","000000"));
            assertEquals(401,wrong.statusCode());
            assertNotNull(loginCookie(app,"admin14@example.test",ORIGINAL));
            // Código novo, na sessão administrativa completa, troca a senha e encerra as sessões.
            CLOCK.advance(30);
            cookie=fullSession;csrf=fullCsrf;
            var accepted=request(app,"POST","account/password",Map.of("currentPassword",ORIGINAL,"newPassword",RENEWED,"mfaCode",code(secret)));
            assertEquals(200,accepted.statusCode());
            assertEquals("PASSWORD_CHANGED",JSON.readTree(accepted.body()).path("code").asString());
            assertEquals(401,sessionStatus(app,fullSession));
            // O segundo fator continua exigido para entrar de novo, e o código usado não se repete.
            var partial=request(app,"POST","auth/login",Map.of("email","admin14@example.test","password",RENEWED));
            assertEquals(200,partial.statusCode());
            assertEquals("MFA_REQUIRED",JSON.readTree(partial.body()).path("code").asString());
            assertFalse(JSON.readTree(partial.body()).path("authenticated").asBoolean());
            cookie=partial.headers().firstValue("set-cookie").orElseThrow().split(";",2)[0];
            csrf=JSON.readTree(partial.body()).path("csrfToken").asString();
            CLOCK.advance(30);
            assertEquals(200,request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))).statusCode());
        }
    }
}
