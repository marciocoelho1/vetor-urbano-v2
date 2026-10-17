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
import br.com.vetorurbano.api.accounts.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;
import tools.jackson.databind.JsonNode;

/**
 * Ticket 15C (E07/E09–E11/E19/ADR 0001): encerramento da própria conta com eliminação cadastral e
 * autoria histórica, além do encerramento autônomo de todas as sessões.
 * Fronteira real: HTTP → Java → PostgreSQL/PostGIS sintético, com sessão, CSRF e código MFA.
 */
@Testcontainers
@ExtendWith(OutputCaptureExtension.class)
class ClosureHttpIT extends LocalAuthHttpSupport {
    @Container static final PostgreSQLContainer<?> DB=new PostgreSQLContainer<>(DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    static final MutableClock CLOCK=new MutableClock();
    @TestConfiguration static class TimeConfig { @Bean @Primary Clock clock(){return CLOCK;} }
    @Override PostgreSQLContainer<?> database() { return DB; }
    @Override MutableClock clock() { return CLOCK; }
    @Override Class<?> timeConfiguration() { return TimeConfig.class; }

    private static final String ORIGINAL="Frase sintética para sessão 14";
    private static final String NEW_PASSWORD="Frase sintética encerrada 15";
    private static final String EMAIL="closure15@example.test";

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
    /** Abre uma sessão administrativa parcial isolada: o login revoga apenas a sessão anterior informada. */
    private String partialAdminSession(ConfigurableApplicationContext app)throws Exception {
        int port=((org.springframework.boot.web.server.context.WebServerApplicationContext)app).getWebServer().getPort();
        var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/v1/auth/login"))
            .header("Content-Type","application/json").timeout(Duration.ofSeconds(15))
            .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(
                Map.of("email","admin14@example.test","password",ORIGINAL)))).build();
        var response=http.send(request,HttpResponse.BodyHandlers.ofString());
        assertEquals(200,response.statusCode());
        assertEquals("MFA_REQUIRED",JSON.readTree(response.body()).path("code").asString());
        return response.headers().firstValue("set-cookie").orElseThrow().split(";",2)[0];
    }
    private int count(ConfigurableApplicationContext app,String sql,Object... args) {
        Integer value=app.getBean(JdbcTemplate.class).queryForObject(sql,Integer.class,args);
        return value==null?0:value;
    }
    /** Quantas colunas gravadas ainda apontam para o identificador eliminado (nenhuma esperada). */
    private int referencesTo(ConfigurableApplicationContext app,UUID id) {
        return count(app,"""
            SELECT count(*) FROM (
                SELECT account_id::text AS value FROM auth_audit_events
                UNION ALL SELECT account_id::text FROM account_audit_events
                UNION ALL SELECT account_id::text FROM local_sessions
                UNION ALL SELECT account_id::text FROM account_confirmation_tokens
                UNION ALL SELECT account_id::text FROM account_recovery_tokens
                UNION ALL SELECT account_id::text FROM account_email_change_tokens
                UNION ALL SELECT actor_id::text FROM source_audit_events
                UNION ALL SELECT created_by::text FROM source_access_configurations
                UNION ALL SELECT author_id::text FROM source_versions
                UNION ALL SELECT historical_actor_id::text FROM auth_audit_events
                UNION ALL SELECT historical_actor_id::text FROM account_audit_events
                UNION ALL SELECT historical_actor_id::text FROM source_audit_events
                UNION ALL SELECT historical_actor_id::text FROM source_versions
                UNION ALL SELECT historical_actor_id::text FROM source_access_configurations
                UNION ALL SELECT before_snapshot->>'authorId' FROM source_audit_events
                UNION ALL SELECT after_snapshot->>'authorId' FROM source_audit_events
            ) AS written WHERE value = ?
            """,id.toString());
    }

    @Test void encerramentoExigeSenhaAtualSemAlterarEstadoAntesEDesvinculaSemApagarFatos()throws Exception {
        try(var app=start()) {
            register(app,EMAIL,true);
            UUID account=app.getBean(JdbcTemplate.class).queryForObject("SELECT id FROM local_accounts WHERE email=?",UUID.class,EMAIL);
            String other=loginCookie(app,EMAIL,ORIGINAL);
            accept(login(app,EMAIL));
            // Fatos prévios: uso (USE) das consultas, link de recuperação e troca de e-mail pendente.
            assertEquals(200,request(app,"GET",query(),null).statusCode());
            assertEquals(202,request(app,"POST","accounts/recovery-requests",Map.of("email",EMAIL)).statusCode());
            assertEquals(202,request(app,"POST","account/email-changes",Map.of("currentPassword",ORIGINAL,"newEmail","closure15-novo@example.test")).statusCode());
            int securityBefore=count(app,"SELECT count(*) FROM auth_audit_events WHERE account_id=? AND event_class='SECURITY'",account);
            int useBefore=count(app,"SELECT count(*) FROM auth_audit_events WHERE account_id=? AND event_class='USE'",account);
            int accountEventsBefore=count(app,"SELECT count(*) FROM account_audit_events WHERE account_id=?",account);
            assertTrue(securityBefore>0&&useBefore>0,"Esperava eventos de uso e de segurança antes do encerramento");
            int occurrencesBefore=count(app,"SELECT count(*) FROM occurrences");
            int sourcesBefore=count(app,"SELECT count(*) FROM sources");

            // Corpo fora dos campos declarados, CSRF ausente e senha atual errada não alteram nada.
            assertEquals(400,request(app,"POST","account/closure",Map.of("currentPassword",ORIGINAL,"extra","1")).statusCode());
            assertEquals("INVALID_REQUEST",JSON.readTree(request(app,"POST","account/closure",Map.of("currentPassword",ORIGINAL,"extra","1")).body()).path("code").asString());
            assertEquals(403,request(app,"POST","account/closure",Map.of("currentPassword",ORIGINAL),null,false).statusCode());
            var wrong=request(app,"POST","account/closure",Map.of("currentPassword","senha errada de propósito"));
            assertEquals(400,wrong.statusCode());
            assertEquals("INVALID_CURRENT_PASSWORD",JSON.readTree(wrong.body()).path("code").asString());
            assertEquals(1,count(app,"SELECT count(*) FROM local_accounts WHERE id=?",account));
            assertEquals(200,sessionStatus(app,other));
            assertEquals(202,request(app,"POST","accounts/recovery-requests",Map.of("email",EMAIL)).statusCode());

            var closed=request(app,"POST","account/closure",Map.of("currentPassword",ORIGINAL));
            assertEquals(200,closed.statusCode());
            assertEquals("ACCOUNT_CLOSED",JSON.readTree(closed.body()).path("code").asString());

            // Eliminação cadastral: cadastro, sessões, links, limites e identificadores recuperáveis somem.
            var jdbc=app.getBean(JdbcTemplate.class);
            assertEquals(0,count(app,"SELECT count(*) FROM local_accounts WHERE email=?",EMAIL));
            assertEquals(0,count(app,"SELECT count(*) FROM local_sessions WHERE account_id=?",account));
            assertEquals(0,count(app,"SELECT count(*) FROM account_confirmation_tokens WHERE account_id=?",account));
            assertEquals(0,count(app,"SELECT count(*) FROM account_recovery_tokens WHERE account_id=?",account));
            assertEquals(0,count(app,"SELECT count(*) FROM account_email_change_tokens WHERE account_id=?",account));
            assertEquals(0,count(app,"SELECT count(*) FROM account_request_limits WHERE action LIKE '%'||?||'%'",account.toString()));
            assertEquals(0,count(app,"SELECT count(*) FROM auth_request_limits WHERE bucket LIKE '%'||?||'%'",account.toString()));
            assertEquals(0,referencesTo(app,account));
            assertEquals(401,sessionStatus(app,other));
            assertNull(loginCookie(app,EMAIL,ORIGINAL));

            // Uso eliminado (E10); segurança mantida e desligada por autor histórico distinto (E09/ADR).
            assertEquals(0,count(app,"SELECT count(*) FROM auth_audit_events WHERE event_class='USE'"));
            // E16/audit-local-v1: duas referências distintas — segurança/conta e autoria de domínio.
            assertEquals(2,count(app,"SELECT count(*) FROM historical_actors"));
            assertEquals(1,count(app,"SELECT count(DISTINCT role) FROM historical_actors"));
            assertEquals("USER",jdbc.queryForObject("SELECT role FROM historical_actors LIMIT 1",String.class));
            UUID residual=jdbc.queryForObject("SELECT historical_actor_id FROM account_audit_events WHERE action='ACCOUNT_CLOSURE' AND outcome='CLOSED'",UUID.class);
            assertNotEquals(account,residual,"O autor histórico não pode reutilizar o identificador eliminado");
            assertNotEquals(residual,jdbc.queryForObject("SELECT id FROM historical_actors WHERE id<>? ORDER BY id LIMIT 1",UUID.class,residual),
                "Segurança e autoria de domínio não podem compartilhar a referência residual");
            // Auditoria: nenhuma linha sobrevivente aponta para uma conta; o que resta do ator está
            // sob o autor histórico, e o uso individual foi eliminado (E10).
            int authLeft=count(app,"SELECT count(*) FROM auth_audit_events WHERE historical_actor_id=?",residual);
            assertTrue(authLeft>=securityBefore&&securityBefore>0,"A auditoria de segurança do ator não pode encolher no encerramento");
            assertEquals(0,count(app,"SELECT count(*) FROM auth_audit_events WHERE account_id IS NOT NULL"));
            assertEquals(authLeft,count(app,"SELECT count(*) FROM auth_audit_events WHERE account_id IS NULL AND historical_actor_id IS NOT NULL"));
            assertEquals(1,count(app,"SELECT count(*) FROM account_audit_events WHERE action='ACCOUNT_CLOSURE' AND outcome='CLOSED' AND historical_actor_id=?",residual));
            assertTrue(count(app,"SELECT count(*) FROM account_audit_events WHERE historical_actor_id=?",residual)>=accountEventsBefore);

            // Fatos coletivos preservados; a autoria histórica não guarda nome nem e-mail.
            assertEquals(occurrencesBefore,count(app,"SELECT count(*) FROM occurrences"));
            assertEquals(sourcesBefore,count(app,"SELECT count(*) FROM sources"));
            assertEquals(0,count(app,"SELECT count(*) FROM local_accounts"));

            var notice=lastMessage(app,EMAIL,"ACCOUNT_CLOSED");
            assertNotNull(notice,"Esperava aviso de encerramento no endereço da conta");
            assertTrue(notice.path("token").isNull()||notice.path("token").asString().isEmpty());
            assertEquals(0,secretsWritten(app,account.toString()));

            // E07: novo cadastro com o mesmo endereço não restaura a conta nem privilégios.
            register(app,EMAIL,true);
            UUID renewed=app.getBean(JdbcTemplate.class).queryForObject("SELECT id FROM local_accounts WHERE email=?",UUID.class,EMAIL);
            assertNotEquals(account,renewed);
            cookie=null;csrf=null;
            accept(login(app,EMAIL));
            assertEquals("USER",JSON.readTree(request(app,"GET","account",null).body()).path("role").asString());
            assertEquals(2,count(app,"SELECT count(*) FROM historical_actors"));
        }
    }

    @Test void encerramentoAdministrativoExigeCodigoEPreservaAutoriaHistoricaDasFontes()throws Exception {
        try(var app=start()) {
            UUID admin=bootstrap(app);
            accept(login(app,"admin14@example.test"));
            byte[] secret=enrolledSecret(app,admin);
            accept(request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))));
            String fullSession=cookie, fullCsrf=csrf;
            // Fato de domínio anterior: uma fonte criada pelo administrador (versão + configuração + auditoria).
            var created=request(app,"POST","admin/sources",source());
            assertEquals(201,created.statusCode());
            String sourceId=JSON.readTree(created.body()).path("id").asString();
            // Fato de segurança e fato administrativo determinísticos antes do encerramento.
            assertEquals(200,request(app,"GET","admin/logs?eventClass=SECURITY",null).statusCode());
            int versionsBefore=count(app,"SELECT count(*) FROM source_versions WHERE source_id=?",sourceId);
            int auditBefore=count(app,"SELECT count(*) FROM source_audit_events WHERE actor_id=?",admin);
            int securityBefore=count(app,"SELECT count(*) FROM auth_audit_events WHERE account_id=? AND event_class='SECURITY'",admin);
            int adminEventsBefore=count(app,"SELECT count(*) FROM auth_audit_events WHERE account_id=? AND event_class='ADMIN'",admin);
            assertTrue(versionsBefore>0&&auditBefore>0,"Esperava versões e auditoria de fonte antes do encerramento");
            assertTrue(securityBefore>0&&adminEventsBefore>0,"Esperava eventos de segurança e de administração antes do encerramento");

            // Código ausente ou errado não encerra a conta administrativa.
            assertEquals(401,request(app,"POST","account/closure",Map.of("currentPassword",ORIGINAL)).statusCode());
            var wrong=request(app,"POST","account/closure",Map.of("currentPassword",ORIGINAL,"mfaCode","000000"));
            assertEquals(401,wrong.statusCode());
            assertEquals("INVALID_MFA",JSON.readTree(wrong.body()).path("code").asString());
            assertEquals(1,count(app,"SELECT count(*) FROM local_accounts WHERE id=?",admin));

            CLOCK.advance(30);
            cookie=fullSession;csrf=fullCsrf;
            var closed=request(app,"POST","account/closure",Map.of("currentPassword",ORIGINAL,"mfaCode",code(secret)));
            assertEquals(200,closed.statusCode());
            assertEquals("ACCOUNT_CLOSED",JSON.readTree(closed.body()).path("code").asString());

            var jdbc=app.getBean(JdbcTemplate.class);
            assertEquals(0,count(app,"SELECT count(*) FROM local_accounts WHERE id=?",admin));
            assertEquals(0,referencesTo(app,admin));
            assertEquals(2,count(app,"SELECT count(*) FROM historical_actors"));
            assertEquals("ADMIN",jdbc.queryForObject("SELECT role FROM historical_actors LIMIT 1",String.class));
            UUID domainResidual=jdbc.queryForObject("SELECT historical_actor_id FROM source_versions WHERE source_id=?",UUID.class,sourceId);
            UUID securityResidual=jdbc.queryForObject("SELECT historical_actor_id FROM account_audit_events WHERE action='ACCOUNT_CLOSURE' AND outcome='CLOSED'",UUID.class);
            assertNotEquals(securityResidual,domainResidual,"A autoria de domínio não compartilha a referência de segurança (E16)");
            UUID residual=domainResidual;
            // Autoria preservada sob o residual — o mesmo autor histórico nos dois registros (E09/E16).
            assertEquals(auditBefore,count(app,"SELECT count(*) FROM source_audit_events WHERE historical_actor_id=? AND actor_id IS NULL",residual));
            // Os snapshots JSONB trocam o authorId da conta eliminada pela referência de domínio.
            assertEquals(0,count(app,"SELECT count(*) FROM source_audit_events WHERE after_snapshot->>'authorId'=?",admin.toString()));
            assertEquals(auditBefore,count(app,"SELECT count(*) FROM source_audit_events WHERE after_snapshot->>'authorId'=?",residual.toString()));
            assertEquals(1,count(app,"SELECT count(*) FROM source_access_configurations WHERE source_id=? AND created_by IS NULL AND historical_actor_id=?",sourceId,residual));
            assertEquals(count(app,"SELECT count(*) FROM source_versions WHERE source_id=? AND author_id IS NULL AND historical_actor_id=?",sourceId,residual),versionsBefore);
            // Segurança e administração sobrevivem, cada uma sob a sua referência (E16).
            assertTrue(count(app,"SELECT count(*) FROM auth_audit_events WHERE historical_actor_id=?",securityResidual)>=securityBefore
                    &&securityBefore>0,
                "Auditoria de segurança preservada sob o autor histórico de segurança");
            assertTrue(count(app,"SELECT count(*) FROM auth_audit_events WHERE historical_actor_id=?",domainResidual)>=adminEventsBefore
                    &&adminEventsBefore>0,
                "Auditoria administrativa preservada sob a referência de domínio");
            assertEquals(0,count(app,"SELECT count(*) FROM auth_audit_events WHERE event_class='USE'"));
            assertEquals(0,count(app,"SELECT count(*) FROM auth_audit_events WHERE account_id IS NOT NULL"));
            // A fonte, suas versões e sua auditoria continuam existindo e visíveis.
            assertEquals(versionsBefore,count(app,"SELECT count(*) FROM source_versions WHERE source_id=?",sourceId));
            assertEquals(auditBefore,count(app,"SELECT count(*) FROM source_audit_events WHERE source_id=?",sourceId));
            // A projeção pública não devolve o ID interno; o nome preservado é a evidência visível.
            var publicList=request(app,"GET","sources",null);
            assertEquals(200,publicList.statusCode());
            assertTrue(publicList.body().contains("Fonte sintética do encerramento"));
            assertFalse(publicList.body().contains(sourceId),"ID interno não pertence à projeção pública");
            assertNotNull(lastMessage(app,"admin14@example.test","ACCOUNT_CLOSED"));
        }
    }

    @Test void encerramentoAutonomoDeSessoesExigeSenhaRevogaTodoOAcessoERespeitaLimite()throws Exception {
        try(var app=start("--vetor.accounts.sensitive-attempts=3")) {
            register(app,EMAIL,true);
            String other=loginCookie(app,EMAIL,ORIGINAL);
            accept(login(app,EMAIL));
            String main=cookie;
            // Campo não declarado é recusado sem revogar nada.
            assertEquals(400,request(app,"POST","account/sessions/revocations",Map.of("all","1")).statusCode());
            assertEquals(200,sessionStatus(app,main));
            assertEquals(200,sessionStatus(app,other));
            // E19: senha atual obrigatória (decisão aprovada); senha errada não encerra sessão.
            var wrong=request(app,"POST","account/sessions/revocations",Map.of("currentPassword","senha errada de propósito"));
            assertEquals(400,wrong.statusCode());
            assertEquals("INVALID_CURRENT_PASSWORD",JSON.readTree(wrong.body()).path("code").asString());
            assertEquals(200,sessionStatus(app,main));
            assertEquals(200,sessionStatus(app,other));
            // Limite próprio de tentativas responde 429 (não 503) e não revoga sessões.
            assertEquals(400,request(app,"POST","account/sessions/revocations",Map.of("currentPassword","senha errada de propósito")).statusCode());
            assertEquals(400,request(app,"POST","account/sessions/revocations",Map.of("currentPassword","senha errada de propósito")).statusCode());
            var limited=request(app,"POST","account/sessions/revocations",Map.of("currentPassword","senha errada de propósito"));
            assertEquals(429,limited.statusCode());
            assertEquals("REQUEST_LIMIT",JSON.readTree(limited.body()).path("code").asString());
            assertEquals(200,sessionStatus(app,main));
            assertEquals(200,sessionStatus(app,other));
            assertTrue(count(app,"SELECT count(*) FROM account_audit_events WHERE action='SESSIONS_REVOKED' AND outcome='LIMITED'")>=1,
                "O limite atingido precisa ficar registrado");
            // Reaberto o limite, a senha correta encerra todas as sessões; a conta continua existindo.
            CLOCK.advance(301);
            var revoked=request(app,"POST","account/sessions/revocations",Map.of("currentPassword",ORIGINAL));
            assertEquals(200,revoked.statusCode());
            assertEquals("SESSIONS_REVOKED",JSON.readTree(revoked.body()).path("code").asString());
            assertEquals(401,sessionStatus(app,main));
            assertEquals(401,sessionStatus(app,other));
            assertEquals(1,count(app,"SELECT count(*) FROM local_accounts WHERE email=?",EMAIL));
            assertNotNull(loginCookie(app,EMAIL,ORIGINAL));
        }
    }

    @Test void revogacaoDeSessoesDoAdministradorExigeCodigoNovo()throws Exception {
        try(var app=start()) {
            UUID admin=bootstrap(app);
            accept(login(app,"admin14@example.test"));
            byte[] secret=enrolledSecret(app,admin);
            // A confirmação consome a sessão parcial usada; a sessão completa seguinte é a base da ação.
            accept(request(app,"POST","auth/mfa/verification",Map.of("code",code(secret))));
            String fullSession=cookie, fullCsrf=csrf;
            // Outro acesso administrativo ativo (parcial), aberto sem passar pelo cookie compartilhado.
            String partial=partialAdminSession(app);
            assertEquals(200,sessionStatus(app,partial));
            // Sem código, a ação é recusada e nenhuma sessão cai.
            cookie=fullSession;csrf=fullCsrf;
            var missing=request(app,"POST","account/sessions/revocations",Map.of("currentPassword",ORIGINAL));
            assertEquals(401,missing.statusCode());
            assertEquals("INVALID_MFA",JSON.readTree(missing.body()).path("code").asString());
            assertEquals(200,sessionStatus(app,partial));
            assertEquals(200,sessionStatus(app,fullSession));
            // Código novo encerra todas as sessões administrativas.
            CLOCK.advance(30);
            cookie=fullSession;csrf=fullCsrf;
            assertEquals(200,request(app,"POST","account/sessions/revocations",
                Map.of("currentPassword",ORIGINAL,"mfaCode",code(secret))).statusCode());
            assertEquals(401,sessionStatus(app,partial));
            assertEquals(401,sessionStatus(app,fullSession));
            assertEquals(1,count(app,"SELECT count(*) FROM local_accounts WHERE id=?",admin));
        }
    }

    @Test void encerramentoRespeitaLimiteProprioDeTentativas()throws Exception {
        try(var app=start("--vetor.accounts.sensitive-attempts=2")) {
            register(app,EMAIL,true);
            accept(login(app,EMAIL));
            for(int attempt=0;attempt<2;attempt++)
                assertEquals(400,request(app,"POST","account/closure",Map.of("currentPassword","senha errada de propósito")).statusCode());
            var limited=request(app,"POST","account/closure",Map.of("currentPassword","senha errada de propósito"));
            assertEquals(429,limited.statusCode());
            assertEquals("REQUEST_LIMIT",JSON.readTree(limited.body()).path("code").asString());
            assertEquals(1,count(app,"SELECT count(*) FROM local_accounts WHERE email=?",EMAIL));
        }
    }

    @Test void acoesDeEncerramentoExigemSessaoCompleta()throws Exception {
        try(var app=start()) {
            register(app,EMAIL,true);
            assertEquals(401,request(app,"POST","account/closure",Map.of("currentPassword",ORIGINAL)).statusCode());
            assertEquals(401,request(app,"POST","account/sessions/revocations",Map.of("currentPassword",ORIGINAL)).statusCode());
            assertEquals(1,count(app,"SELECT count(*) FROM local_accounts WHERE email=?",EMAIL));
        }
    }

    private static Map<String,Object> source() {
        var payload=new LinkedHashMap<String,Object>();
        payload.put("name","Fonte sintética do encerramento");
        payload.put("channel","Canal concreto sintético");
        payload.put("url",null);
        payload.put("territories",List.of("Rio de Janeiro"));
        payload.put("pillars",List.of("TRANSITO","CONTINGENCIA"));
        payload.put("accessMethod","MANUAL");
        payload.put("rating",4);
        payload.put("ratingJustification","Avaliação inteiramente sintética do encerramento.");
        return payload;
    }
}
