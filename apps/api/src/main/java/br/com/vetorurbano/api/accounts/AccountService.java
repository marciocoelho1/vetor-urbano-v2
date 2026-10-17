package br.com.vetorurbano.api.accounts;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import br.com.vetorurbano.api.auth.AuthService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.*;

public class AccountService {
    /** Perfil da própria conta exposto ao titular; nunca contém hash, token ou dado de terceiro. */
    public record AccountProfile(String displayName,String email,String role,String pendingEmail,Instant pendingEmailExpiresAt) {}
    private final JdbcTemplate jdbc;
    private final AccountSettings settings;
    private final Clock clock;
    private final LocalMailbox mailbox;
    private final AccountPassword password;
    private final AuthService auth;
    private final SecureRandom random = new SecureRandom();
    /** Janela da contagem de reenvios, compartilhada por cadastro e recuperação; contadores são distintos. */
    private static final Duration RESEND_WINDOW=Duration.ofHours(1);
    private static final String INVALID_RECOVERY_LINK="Link de recuperação inválido. Solicite outro na caixa local.";
    public AccountService(JdbcTemplate jdbc, AccountSettings settings, Clock clock, LocalMailbox mailbox, AccountPassword password,
            AuthService auth) {
        this.jdbc=jdbc; this.settings=settings; this.clock=clock; this.mailbox=mailbox; this.password=password; this.auth=auth;
    }
    @Transactional
    public AccountResult register(Map<String,Object> input) {
        Instant now=clock.instant();
        if (!allow("REGISTRATION", now)) return limited("REGISTRATION",now);
        String name=text(input,"displayName"), email=email(input), secret=text(input,"password");
        if (!input.keySet().equals(Set.of("displayName","email","password")) || name==null || name.strip().length()<2
                || name.strip().length()>80 || email==null || !AccountPassword.valid(secret)) {
            audit(null,now,"REGISTRATION","REJECTED");
            return new AccountResult(400,"INVALID_REGISTRATION","Informe nome de 2 a 80 caracteres, e-mail sintético .test e senha de 15 a 128 caracteres não trivial. Somente nome, e-mail e senha são permitidos.");
        }
        // Derive for duplicate requests too; do not create a cheap account-existence timing branch.
        String encoded=password.derive(secret);
        now=clock.instant();
        UUID id=UUID.randomUUID();
        int inserted=jdbc.update("""
            INSERT INTO local_accounts(id,display_name,email,password_hash,created_at,last_sent_at,resend_window_start)
            VALUES (?,?,?,?,?,?,?) ON CONFLICT(email) DO NOTHING
            """,id,name.strip(),email,encoded,ts(now),ts(now),ts(now));
        if (inserted==1) { issue(id,email,now); audit(id,now,"REGISTRATION","CREATED"); }
        else audit(null,now,"REGISTRATION","ACCEPTED");
        return AccountResult.pending();
    }
    @Transactional
    public AccountResult confirm(Map<String,Object> input) {
        Instant now=clock.instant();
        if(!allow("CONFIRMATION",now)) return limited("CONFIRMATION",now);
        String token=text(input,"token");
        if(!input.keySet().equals(Set.of("token")) || token==null || !token.matches("[A-Za-z0-9_-]{43}")) {
            audit(null,now,"CONFIRMATION","INVALID");
            return new AccountResult(400,"INVALID_CONFIRMATION","Link de confirmação inválido. Confira a mensagem ou solicite reenvio.");
        }
        var ids=jdbc.queryForList("SELECT account_id FROM account_confirmation_tokens WHERE token_hash=?", UUID.class,digest(token));
        if(ids.isEmpty()) {
            audit(null,now,"CONFIRMATION","INVALID");
            return new AccountResult(400,"INVALID_CONFIRMATION","Link de confirmação inválido. Confira a mensagem ou solicite reenvio.");
        }
        UUID id=ids.getFirst();
        // Lock account first in both confirmation and resend, then re-read token state.
        jdbc.queryForObject("SELECT status FROM local_accounts WHERE id=? FOR UPDATE",String.class,id);
        var state=jdbc.queryForMap("SELECT consumed_at,revoked_at,expires_at FROM account_confirmation_tokens WHERE token_hash=? FOR UPDATE",digest(token));
        // Expiry must use validation time after any lock wait, not request-start time.
        now=clock.instant();
        if(state.get("consumed_at")!=null) {
            audit(id,now,"CONFIRMATION","USED");
            return new AccountResult(409,"USED_CONFIRMATION","Esta confirmação já foi utilizada. Ela não pode iniciar acesso ou ser reutilizada.");
        }
        if(state.get("revoked_at")!=null) {
            audit(id,now,"CONFIRMATION","REPLACED");
            return new AccountResult(410,"REPLACED_CONFIRMATION","Este link foi substituído por um reenvio. Use a mensagem mais recente.");
        }
        if(!now.isBefore(((Timestamp)state.get("expires_at")).toInstant())) {
            audit(id,now,"CONFIRMATION","EXPIRED");
            return new AccountResult(410,"EXPIRED_CONFIRMATION","Este link expirou. Solicite outra confirmação.");
        }
        jdbc.update("UPDATE account_confirmation_tokens SET consumed_at=? WHERE token_hash=?",ts(now),digest(token));
        jdbc.update("UPDATE local_accounts SET status='CONFIRMED', confirmed_at=? WHERE id=? AND status='PENDING'",ts(now),id);
        audit(id,now,"CONFIRMATION","CONFIRMED");
        return new AccountResult(200,"ACCOUNT_CONFIRMED","E-mail confirmado. Entre para acessar os módulos.");
    }

    @Transactional
    public AccountResult resend(Map<String,Object> input) {
        Instant now=clock.instant();
        if(!allow("RESEND",now)) return limited("RESEND",now);
        String email=email(input);
        if(!input.keySet().equals(Set.of("email")) || email==null) {
            audit(null,now,"RESEND","REJECTED"); return AccountResult.invalid();
        }
        var accounts=jdbc.queryForList("SELECT id,status,last_sent_at,resend_window_start,resend_count FROM local_accounts WHERE email=? FOR UPDATE",email);
        if(accounts.isEmpty()) { audit(null,now,"RESEND","SUPPRESSED"); return AccountResult.pending(); }
        var account=accounts.getFirst();
        now=clock.instant();
        UUID id=(UUID)account.get("id");
        Instant last=((Timestamp)account.get("last_sent_at")).toInstant();
        Instant start=((Timestamp)account.get("resend_window_start")).toInstant();
        boolean reset=!now.isBefore(start.plus(RESEND_WINDOW));
        int count=reset ? 0 : ((Number)account.get("resend_count")).intValue();
        if(!account.get("status").equals("PENDING") || now.isBefore(last.plus(settings.resendCooldown())) || count>=settings.resendsPerHour()) {
            audit(id,now,"RESEND","SUPPRESSED"); return AccountResult.pending();
        }
        revokeActiveLinks("account_confirmation_tokens",id,now);
        jdbc.update("UPDATE local_accounts SET last_sent_at=?,resend_window_start=?,resend_count=? WHERE id=?",ts(now),ts(reset?now:start),count+1,id);
        issue(id,email,now); audit(id,now,"RESEND","SENT");
        return AccountResult.pending();
    }

    /** Gera um token de posse de 32 bytes em base64url; só o SHA-256 é persistido. */
    private String freshToken() {
        byte[] bytes=new byte[32]; random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    /** Revoga links ainda ativos da tabela indicada; repetição suprimida não chama este caminho. */
    private void revokeActiveLinks(String table,UUID id,Instant now) {
        jdbc.update("UPDATE "+table+" SET revoked_at=? WHERE account_id=? AND consumed_at IS NULL AND revoked_at IS NULL",ts(now),id);
    }
    private void issue(UUID id,String email,Instant now) {
        String token=freshToken();
        Instant expires=now.plus(settings.tokenTtl());
        jdbc.update("INSERT INTO account_confirmation_tokens(token_hash,account_id,created_at,expires_at) VALUES (?,?,?,?)",digest(token),id,ts(now),ts(expires));
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { mailbox.deliverConfirmation(email,token,expires); }
        });
    }

    /**
     * E01/E15: pedido de recuperação. Resposta indistinguível entre conta confirmada, pendente,
     * inexistente e pedido suprimido por limite; nunca revela existência de conta e não encerra sessões.
     * A reexpedição usa os mesmos valores locais do cadastro (cooldown e limite por hora), mas com
     * contador e janela próprios (`RECOVERY_REQUEST` e as colunas `recovery_*`); a repetição suprimida
     * não revoga o link ativo.
     */
    @Transactional
    public AccountResult requestRecovery(Map<String,Object> input) {
        Instant now=clock.instant();
        if(!allow("RECOVERY_REQUEST",now)) return limited("RECOVERY_REQUEST",now);
        String email=email(input);
        if(!input.keySet().equals(Set.of("email"))||email==null) {
            audit(null,now,"RECOVERY_REQUEST","REJECTED");
            return AccountResult.invalid();
        }
        var accounts=jdbc.queryForList("SELECT id,status,recovery_sent_at,recovery_window_start,recovery_count FROM local_accounts WHERE email=? FOR UPDATE",email);
        if(accounts.isEmpty()) { audit(null,now,"RECOVERY_REQUEST","SUPPRESSED"); return AccountResult.recoveryPending(); }
        var account=accounts.getFirst();
        now=clock.instant();
        UUID id=(UUID)account.get("id");
        if(!account.get("status").equals("CONFIRMED")) { audit(id,now,"RECOVERY_REQUEST","SUPPRESSED"); return AccountResult.recoveryPending(); }
        Instant windowStart=account.get("recovery_window_start")==null?now:((Timestamp)account.get("recovery_window_start")).toInstant();
        boolean reset=!now.isBefore(windowStart.plus(RESEND_WINDOW));
        int count=reset?0:((Number)account.get("recovery_count")).intValue();
        Instant sentAt=account.get("recovery_sent_at")==null?null:((Timestamp)account.get("recovery_sent_at")).toInstant();
        if((sentAt!=null&&now.isBefore(sentAt.plus(settings.resendCooldown())))||count>=settings.resendsPerHour()) {
            audit(id,now,"RECOVERY_REQUEST","SUPPRESSED"); return AccountResult.recoveryPending();
        }
        revokeActiveLinks("account_recovery_tokens",id,now);
        jdbc.update("UPDATE local_accounts SET recovery_sent_at=?,recovery_window_start=?,recovery_count=? WHERE id=?",ts(now),ts(reset?now:windowStart),count+1,id);
        issueRecovery(id,email,now);
        audit(id,now,"RECOVERY_REQUEST","SENT");
        return AccountResult.recoveryPending();
    }

    /**
     * E01/E15: conclusão da recuperação. Uso único; prazo e estado da conta são revalidados depois do
     * bloqueio. Troca a senha, revoga links pendentes e todas as sessões e exige novo login.
     */
    @Transactional
    public AccountResult recover(Map<String,Object> input) {
        Instant now=clock.instant();
        if(!allow("RECOVERY",now)) return limited("RECOVERY",now);
        String token=text(input,"token"), secret=text(input,"password");
        if(!input.keySet().equals(Set.of("token","password"))) {
            audit(null,now,"RECOVERY","REJECTED");
            return AccountResult.invalid();
        }
        if(token==null||!token.matches("[A-Za-z0-9_-]{43}")||!AccountPassword.valid(secret)) {
            audit(null,now,"RECOVERY","INVALID");
            return new AccountResult(400,"INVALID_RECOVERY","Link de recuperação inválido ou senha fora do exigido (15 a 128 caracteres não trivial). Nada foi alterado.");
        }
        var ids=jdbc.queryForList("SELECT account_id FROM account_recovery_tokens WHERE token_hash=?",UUID.class,digest(token));
        if(ids.isEmpty()) {
            audit(null,now,"RECOVERY","INVALID");
            return new AccountResult(400,"INVALID_RECOVERY",INVALID_RECOVERY_LINK);
        }
        UUID id=ids.getFirst();
        // Derivação cara fora do bloqueio; prazo e estado são reavaliados depois de bloquear conta e token.
        String encoded=password.derive(secret);
        var account=jdbc.queryForMap("SELECT status,email FROM local_accounts WHERE id=? FOR UPDATE",id);
        var state=jdbc.queryForMap("SELECT consumed_at,revoked_at,expires_at FROM account_recovery_tokens WHERE token_hash=? FOR UPDATE",digest(token));
        now=clock.instant();
        if(state.get("consumed_at")!=null) {
            audit(id,now,"RECOVERY","USED");
            return new AccountResult(409,"USED_RECOVERY","Este link de recuperação já foi utilizado e não pode ser reaproveitado.");
        }
        if(state.get("revoked_at")!=null) {
            audit(id,now,"RECOVERY","REPLACED");
            return new AccountResult(410,"REPLACED_RECOVERY","Este link foi substituído por um pedido mais recente. Use a mensagem mais nova.");
        }
        if(!now.isBefore(((Timestamp)state.get("expires_at")).toInstant())) {
            audit(id,now,"RECOVERY","EXPIRED");
            return new AccountResult(410,"EXPIRED_RECOVERY","Este link de recuperação expirou. Solicite outro na caixa local.");
        }
        if(!account.get("status").equals("CONFIRMED")) {
            audit(id,now,"RECOVERY","REJECTED");
            return new AccountResult(400,"INVALID_RECOVERY",INVALID_RECOVERY_LINK);
        }
        String email=(String)account.get("email");
        jdbc.update("UPDATE account_recovery_tokens SET consumed_at=? WHERE token_hash=?",ts(now),digest(token));
        jdbc.update("UPDATE local_accounts SET password_hash=? WHERE id=?",encoded,id);
        revokePendingLinks(id,now);
        auth.revokeAll(id);
        Instant completedAt=now;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                mailbox.deliverNotice(email,"RECOVERY_COMPLETED","Senha sintética alterada por recuperação",
                    "A senha desta conta foi alterada pela recuperação de acesso em "+completedAt+" (UTC). Todas as sessões anteriores foram encerradas. "
                    + "Se não foi você, use a recuperação novamente e conteste com o operador local.");
            }
        });
        audit(id,now,"RECOVERY","RECOVERED");
        return new AccountResult(200,"PASSWORD_RECOVERED","Senha redefinida. Todas as sessões anteriores foram encerradas; entre novamente com a nova senha.");
    }

    /** E01: revoga links pendentes de posse da conta sem apagar histórico nem fatos coletivos. */
    private void revokePendingLinks(UUID id,Instant now) {
        revokeActiveLinks("account_recovery_tokens",id,now);
        revokeActiveLinks("account_confirmation_tokens",id,now);
        // E02: troca de e-mail pendente também cai quando a senha muda ou a recuperação conclui.
        revokeActiveLinks("account_email_change_tokens",id,now);
    }

    /**
     * E02/E03: traduz a confirmação de ação sensível do módulo de acesso (sessão completa, CSRF e,
     * para Administrador, código novo do autenticador) para a resposta do módulo de contas. Nada é
     * alterado quando a confirmação não é aceita.
     */
    @Transactional
    public AccountResult confirmSensitive(String sessionToken,String csrf,String code) {
        var reply=auth.requireConfirmation(sessionToken,csrf,code);
        if(reply.status()==200) return new AccountResult(200,"CONFIRMED","Confirmação aceita.");
        return new AccountResult(reply.status(),String.valueOf(reply.body().get("code")),String.valueOf(reply.body().get("message")));
    }

    /**
     * E07/E09–E11/E19/ADR 0001 (CA24): encerramento da própria conta. Elimina o cadastro ativo e os
     * vínculos recuperáveis (tokens, sessões, limites e uso individual), preserva os fatos coletivos
     * e substitui a autoria por referência histórica nova — irreversível e sem correspondência com a
     * identidade eliminada. Novo cadastro com o mesmo endereço começa sem histórico nem privilégios.
     */
    @Transactional
    public AccountResult closeAccount(UUID account,Map<String,Object> input) {
        Instant now=clock.instant();
        if(!Set.of(Set.of("currentPassword"),Set.of("currentPassword","mfaCode")).contains(input.keySet())) {
            audit(account,now,"ACCOUNT_CLOSURE","REJECTED");
            return AccountResult.invalid();
        }
        String current=text(input,"currentPassword");
        if(!allowFor("ACCOUNT_CLOSURE:"+account,settings.sensitiveAttempts(),Duration.ofMinutes(5),now)) {
            audit(account,now,"ACCOUNT_CLOSURE","LIMITED");
            return limited("ACCOUNT_CLOSURE",now);
        }
        var rows=jdbc.queryForList("SELECT password_hash,email,role,status FROM local_accounts WHERE id=?",account);
        if(rows.isEmpty()||current==null||!password.matches(current,(String)rows.getFirst().get("password_hash"))) {
            audit(account,now,"ACCOUNT_CLOSURE","INVALID");
            return new AccountResult(400,"INVALID_CURRENT_PASSWORD","Senha atual incorreta. Nada foi encerrado.");
        }
        if(!rows.getFirst().get("status").equals("CONFIRMED")) {
            audit(account,now,"ACCOUNT_CLOSURE","REJECTED");
            return new AccountResult(400,"INVALID_CLOSURE","Esta conta não pode ser encerrada agora. Nada foi alterado.");
        }
        String email=(String)rows.getFirst().get("email"), role=String.valueOf(rows.getFirst().get("role"));
        // E16/audit-local-v1: segurança/conta e autoria de domínio usam referências históricas
        // distintas, para não correlacionar uso administrativo com autoria de domínio — cada uma
        // expira pelo seu próprio prazo. Nenhuma das duas é derivada do identificador de login.
        UUID securityResidual=UUID.randomUUID(), domainResidual=UUID.randomUUID();
        jdbc.update("INSERT INTO historical_actors(id,role,closed_at) VALUES (?,?,?)",securityResidual,role,ts(now));
        jdbc.update("INSERT INTO historical_actors(id,role,closed_at) VALUES (?,?,?)",domainResidual,role,ts(now));
        notice(email,"ACCOUNT_CLOSED","Conta sintética encerrada",
            "Esta conta local foi encerrada a pedido do próprio titular em "+now+" (UTC). O cadastro e os vínculos de acesso foram eliminados; "
            + "os registros coletivos e a autoria histórica dos atos administrativos foram preservados sem ligação recuperável com a identidade encerrada. "
            + "Um novo cadastro com este endereço começa sem histórico e sem privilégios.");
        // E10: uso individual eliminado. E09/E16: segurança e administração preservam o fato, com autor histórico.
        jdbc.update("DELETE FROM auth_audit_events WHERE account_id=? AND event_class='USE'",account);
        jdbc.update("UPDATE auth_audit_events SET account_id=NULL,historical_actor_id=? WHERE account_id=? AND event_class='SECURITY'",securityResidual,account);
        jdbc.update("UPDATE auth_audit_events SET account_id=NULL,historical_actor_id=? WHERE account_id=? AND event_class='ADMIN'",domainResidual,account);
        jdbc.update("UPDATE account_audit_events SET account_id=NULL,historical_actor_id=? WHERE account_id=?",securityResidual,account);
        jdbc.update("UPDATE source_audit_events SET actor_id=NULL,historical_actor_id=? WHERE actor_id=?",domainResidual,account);
        jdbc.update("UPDATE source_access_configurations SET created_by=NULL,historical_actor_id=? WHERE created_by=?",domainResidual,account);
        jdbc.update("UPDATE source_versions SET author_id=NULL,historical_actor_id=? WHERE author_id=?",domainResidual,account);
        // Os snapshots JSONB de auditoria de fonte embutem o authorId do autor; ele também passa ao
        // autor histórico de domínio, senão o identificador de login sobreviveria legível no registro.
        for(String column:List.of("before_snapshot","after_snapshot"))
            jdbc.update("UPDATE source_audit_events SET "+column+" = jsonb_set("+column+", '{authorId}', to_jsonb(?::text)) WHERE "+column+"->>'authorId' = ?",
                domainResidual.toString(),account.toString());
        // Identificadores recuperáveis: tokens, sessões e chaves de limite individual (a do login é
        // derivada do endereço, então precisa de remoção explícita).
        jdbc.update("DELETE FROM account_confirmation_tokens WHERE account_id=?",account);
        jdbc.update("DELETE FROM account_recovery_tokens WHERE account_id=?",account);
        jdbc.update("DELETE FROM account_email_change_tokens WHERE account_id=?",account);
        jdbc.update("DELETE FROM local_sessions WHERE account_id=?",account);
        jdbc.update("DELETE FROM account_request_limits WHERE action LIKE '%:'||?",account.toString());
        jdbc.update("DELETE FROM auth_request_limits WHERE bucket LIKE '%:'||?",account.toString());
        jdbc.update("DELETE FROM auth_request_limits WHERE bucket=?",AuthService.loginBucket(email));
        jdbc.update("INSERT INTO account_audit_events(account_id,historical_actor_id,occurred_at,action,outcome) VALUES (NULL,?,?,?,?)",
            securityResidual,ts(now),"ACCOUNT_CLOSURE","CLOSED");
        // Eliminação cadastral: nome, e-mail, credencial e fator deixam de existir (E07, sem reativação).
        jdbc.update("DELETE FROM local_accounts WHERE id=?",account);
        return new AccountResult(200,"ACCOUNT_CLOSED",
            "Conta encerrada. O acesso foi eliminado e os registros coletivos foram preservados sem ligação com a identidade encerrada.");
    }

    /**
     * E19: encerra todas as sessões da conta; a conta continua válida e o próximo acesso exige novo
     * login. Exige a senha atual — e, para Administrador, código novo do autenticador (conferido
     * antes, pelo módulo de acesso).
     */
    @Transactional
    public AccountResult revokeSessions(UUID account,Map<String,Object> input) {
        Instant now=clock.instant();
        if(!Set.of(Set.of("currentPassword"),Set.of("currentPassword","mfaCode")).contains(input.keySet())) {
            audit(account,now,"SESSIONS_REVOKED","REJECTED");
            return AccountResult.invalid();
        }
        String current=text(input,"currentPassword");
        if(!allowFor("SESSION_REVOCATION:"+account,settings.sensitiveAttempts(),Duration.ofMinutes(5),now)) {
            audit(account,now,"SESSIONS_REVOKED","LIMITED");
            return limited("SESSIONS_REVOKED",now);
        }
        var rows=jdbc.queryForList("SELECT password_hash FROM local_accounts WHERE id=?",account);
        if(rows.isEmpty()||current==null||!password.matches(current,(String)rows.getFirst().get("password_hash"))) {
            audit(account,now,"SESSIONS_REVOKED","INVALID");
            return new AccountResult(400,"INVALID_CURRENT_PASSWORD","Senha atual incorreta. Nenhuma sessão foi encerrada.");
        }
        auth.revokeAll(account);
        audit(account,now,"SESSIONS_REVOKED","REVOKED");
        return new AccountResult(200,"SESSIONS_REVOKED","Todas as sessões foram encerradas. Entre novamente para continuar.");
    }

    /** E02: sessão completa e CSRF, sem código do autenticador — basta para o nome de exibição. */
    @Transactional
    public AccountResult confirmSession(String sessionToken,String csrf) {
        var reply=auth.requireSession(sessionToken,csrf);
        if(reply.status()==200) return new AccountResult(200,"CONFIRMED","Confirmação aceita.");
        return new AccountResult(reply.status(),String.valueOf(reply.body().get("code")),String.valueOf(reply.body().get("message")));
    }

    /** Perfil da própria conta. Devolve `null` se a conta não estiver confirmada. */
    public AccountProfile profile(UUID account) {
        var rows=jdbc.queryForList("SELECT display_name,email,role,status FROM local_accounts WHERE id=?",account);
        if(rows.isEmpty()||!rows.getFirst().get("status").equals("CONFIRMED")) return null;
        var row=rows.getFirst();
        var pending=jdbc.queryForList("SELECT pending_email,expires_at FROM account_email_change_tokens WHERE account_id=? AND consumed_at IS NULL AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1",account);
        String pendingEmail=null; Instant pendingExpires=null;
        if(!pending.isEmpty()) {
            var candidate=pending.getFirst();
            pendingExpires=((Timestamp)candidate.get("expires_at")).toInstant();
            if(clock.instant().isBefore(pendingExpires)) pendingEmail=(String)candidate.get("pending_email");
        }
        return new AccountProfile((String)row.get("display_name"),(String)row.get("email"),(String)row.get("role"),pendingEmail,pendingExpires);
    }

    /** E02: nome de exibição muda em sessão autenticada e a sessão continua válida. */
    @Transactional
    public AccountResult changeDisplayName(UUID account,Map<String,Object> input) {
        Instant now=clock.instant();
        String name=text(input,"displayName");
        if(!input.keySet().equals(Set.of("displayName"))) {
            audit(account,now,"DISPLAY_NAME","REJECTED");
            return AccountResult.invalid();
        }
        if(name==null||name.strip().length()<2||name.strip().length()>80) {
            audit(account,now,"DISPLAY_NAME","REJECTED");
            return new AccountResult(400,"INVALID_DISPLAY_NAME","Informe nome de exibição de 2 a 80 caracteres. Nada foi alterado.");
        }
        jdbc.update("UPDATE local_accounts SET display_name=? WHERE id=?",name.strip(),account);
        audit(account,now,"DISPLAY_NAME","CHANGED");
        return new AccountResult(200,"DISPLAY_NAME_CHANGED","Nome de exibição atualizado. A sessão continua válida.");
    }

    /**
     * E02: troca de senha. Exige senha atual (o código MFA do Administrador é conferido antes, pelo
     * módulo de acesso). Efetivar revoga todas as sessões e links pendentes e exige novo login.
     * A derivação cara acontece fora do bloqueio; o estado é revalidado depois de bloquear.
     */
    @Transactional
    public AccountResult changePassword(UUID account,Map<String,Object> input) {
        Instant now=clock.instant();
        if(!Set.of(Set.of("currentPassword","newPassword"),Set.of("currentPassword","newPassword","mfaCode")).contains(input.keySet())) {
            audit(account,now,"PASSWORD_CHANGE","REJECTED");
            return AccountResult.invalid();
        }
        String current=text(input,"currentPassword"), next=text(input,"newPassword");
        if(!allowFor("PASSWORD_CHANGE:"+account,settings.sensitiveAttempts(),Duration.ofMinutes(5),now)) {
            audit(account,now,"PASSWORD_CHANGE","LIMITED");
            return limited("PASSWORD_CHANGE",now);
        }
        var rows=jdbc.queryForList("SELECT password_hash FROM local_accounts WHERE id=?",account);
        if(rows.isEmpty()||current==null||!password.matches(current,(String)rows.getFirst().get("password_hash"))) {
            audit(account,now,"PASSWORD_CHANGE","INVALID");
            return new AccountResult(400,"INVALID_CURRENT_PASSWORD","Senha atual incorreta. Nada foi alterado.");
        }
        if(!AccountPassword.valid(next)) {
            audit(account,now,"PASSWORD_CHANGE","INVALID");
            return new AccountResult(400,"INVALID_NEW_PASSWORD","A nova senha deve ter 15 a 128 caracteres e não pode ser trivial. Nada foi alterado.");
        }
        String encoded=password.derive(next);
        var state=jdbc.queryForList("SELECT status,email FROM local_accounts WHERE id=? FOR UPDATE",account);
        if(state.isEmpty()||!state.getFirst().get("status").equals("CONFIRMED")) {
            audit(account,now,"PASSWORD_CHANGE","REJECTED");
            return new AccountResult(400,"INVALID_PASSWORD_CHANGE","Esta conta não pode ser alterada agora. Nada foi alterado.");
        }
        String email=(String)state.getFirst().get("email");
        jdbc.update("UPDATE local_accounts SET password_hash=? WHERE id=?",encoded,account);
        revokePendingLinks(account,now);
        auth.revokeAll(account);
        Instant changedAt=now;
        notice(email,"PASSWORD_CHANGED","Senha sintética alterada",
            "A senha desta conta foi alterada em "+changedAt+" (UTC) a partir de uma sessão autenticada. Todas as sessões anteriores foram encerradas. "
            + "Se não foi você, use a recuperação de acesso e conteste com o operador local.");
        audit(account,now,"PASSWORD_CHANGE","CHANGED");
        return new AccountResult(200,"PASSWORD_CHANGED","Senha alterada. Todas as sessões foram encerradas; entre novamente com a nova senha.");
    }

    /**
     * E02/E14/E15: pedido de troca de e-mail. Exige senha atual (e código MFA do Administrador,
     * conferido antes). O endereço atual continua valendo; o novo só substitui após confirmação no
     * próprio endereço. A reexpedição efetiva substitui o pedido anterior sem renovar o token antigo.
     */
    @Transactional
    public AccountResult requestEmailChange(UUID account,Map<String,Object> input) {
        Instant now=clock.instant();
        if(!Set.of(Set.of("currentPassword","newEmail"),Set.of("currentPassword","newEmail","mfaCode")).contains(input.keySet())) {
            audit(account,now,"EMAIL_CHANGE_REQUEST","REJECTED");
            return AccountResult.invalid();
        }
        String current=text(input,"currentPassword"), next=email(input,"newEmail");
        if(!allowFor("EMAIL_CHANGE_REQUEST:"+account,settings.sensitiveAttempts(),Duration.ofMinutes(5),now)) {
            audit(account,now,"EMAIL_CHANGE_REQUEST","LIMITED");
            return limited("EMAIL_CHANGE_REQUEST",now);
        }
        var rows=jdbc.queryForList("SELECT password_hash,email,email_change_sent_at,email_change_window_start,email_change_count FROM local_accounts WHERE id=?",account);
        if(rows.isEmpty()||current==null||!password.matches(current,(String)rows.getFirst().get("password_hash"))) {
            audit(account,now,"EMAIL_CHANGE_REQUEST","INVALID");
            return new AccountResult(400,"INVALID_CURRENT_PASSWORD","Senha atual incorreta. Nada foi alterado.");
        }
        String oldEmail=(String)rows.getFirst().get("email");
        // Endereço inválido, igual ao atual ou já usado por outra conta recebem a mesma resposta neutra.
        if(next==null||next.equals(oldEmail)||jdbc.queryForObject("SELECT count(*) FROM local_accounts WHERE email=? AND id<>?",Integer.class,next,account)>0) {
            audit(account,now,"EMAIL_CHANGE_REQUEST","INVALID");
            return new AccountResult(400,"INVALID_EMAIL_CHANGE","Não foi possível iniciar a troca para este endereço. Confira o endereço ou use outro. Nada foi alterado.");
        }
        // Relógio relido após a verificação cara da senha: os carimbos do pedido (janela, expiração)
        // usam o instante pós-espera; o audit da recusa anterior usa o instante da entrada de propósito.
        now=clock.instant();
        var state=jdbc.queryForList("SELECT status,email_change_sent_at,email_change_window_start,email_change_count FROM local_accounts WHERE id=? FOR UPDATE",account);
        if(state.isEmpty()||!state.getFirst().get("status").equals("CONFIRMED")) {
            audit(account,now,"EMAIL_CHANGE_REQUEST","REJECTED");
            return new AccountResult(400,"INVALID_EMAIL_CHANGE","Esta conta não pode ser alterada agora. Nada foi alterado.");
        }
        var row=state.getFirst();
        now=clock.instant();
        Instant windowStart=row.get("email_change_window_start")==null?now:((Timestamp)row.get("email_change_window_start")).toInstant();
        boolean reset=!now.isBefore(windowStart.plus(RESEND_WINDOW));
        int count=reset?0:((Number)row.get("email_change_count")).intValue();
        Instant sentAt=row.get("email_change_sent_at")==null?null:((Timestamp)row.get("email_change_sent_at")).toInstant();
        if((sentAt!=null&&now.isBefore(sentAt.plus(settings.resendCooldown())))||count>=settings.resendsPerHour()) {
            audit(account,now,"EMAIL_CHANGE_REQUEST","SUPPRESSED");
            return new AccountResult(429,"REQUEST_LIMIT","Já existe um pedido recente de troca de e-mail. Aguarde e use a mensagem mais nova. Nada foi alterado.");
        }
        revokeActiveLinks("account_email_change_tokens",account,now);
        jdbc.update("UPDATE local_accounts SET email_change_sent_at=?,email_change_window_start=?,email_change_count=? WHERE id=?",ts(now),ts(reset?now:windowStart),count+1,account);
        issueEmailChange(account,next,oldEmail,now);
        audit(account,now,"EMAIL_CHANGE_REQUEST","SENT");
        return new AccountResult(202,"EMAIL_CHANGE_PENDING","Confirmação pendente no novo endereço. O e-mail atual continua valendo até a confirmação; o link vale dez minutos e serve uma única vez.");
    }

    /**
     * E02/E14/E15: confirmação do novo endereço. Público por posse do link (o endereço pendente vem do
     * próprio token, nunca do cliente). Concluir revoga sessões e links pendentes e exige novo login.
     */
    @Transactional
    public AccountResult confirmEmailChange(Map<String,Object> input) {
        Instant now=clock.instant();
        if(!allow("EMAIL_CHANGE",now)) return limited("EMAIL_CHANGE",now);
        String token=text(input,"token");
        if(!input.keySet().equals(Set.of("token"))||token==null||!token.matches("[A-Za-z0-9_-]{43}")) {
            audit(null,now,"EMAIL_CHANGE","INVALID");
            return new AccountResult(400,"INVALID_EMAIL_CHANGE","Link de troca de e-mail inválido. Nada foi alterado.");
        }
        var ids=jdbc.queryForList("SELECT account_id FROM account_email_change_tokens WHERE token_hash=?",UUID.class,digest(token));
        if(ids.isEmpty()) {
            audit(null,now,"EMAIL_CHANGE","INVALID");
            return new AccountResult(400,"INVALID_EMAIL_CHANGE","Link de troca de e-mail inválido. Nada foi alterado.");
        }
        UUID id=ids.getFirst();
        var state=jdbc.queryForList("SELECT status,email FROM local_accounts WHERE id=? FOR UPDATE",id);
        var tokenState=jdbc.queryForMap("SELECT pending_email,consumed_at,revoked_at,expires_at FROM account_email_change_tokens WHERE token_hash=? FOR UPDATE",digest(token));
        now=clock.instant();
        if(tokenState.get("consumed_at")!=null) {
            audit(id,now,"EMAIL_CHANGE","USED");
            return new AccountResult(409,"USED_EMAIL_CHANGE","Este link de troca já foi utilizado. Nada foi alterado.");
        }
        if(tokenState.get("revoked_at")!=null) {
            audit(id,now,"EMAIL_CHANGE","REPLACED");
            return new AccountResult(410,"REPLACED_EMAIL_CHANGE","Este link foi substituído por um pedido mais recente. Use a mensagem mais nova.");
        }
        if(!now.isBefore(((Timestamp)tokenState.get("expires_at")).toInstant())) {
            audit(id,now,"EMAIL_CHANGE","EXPIRED");
            return new AccountResult(410,"EXPIRED_EMAIL_CHANGE","Este link de troca de e-mail expirou. Peça outro na área da conta.");
        }
        if(state.isEmpty()||!state.getFirst().get("status").equals("CONFIRMED")) {
            audit(id,now,"EMAIL_CHANGE","REJECTED");
            return new AccountResult(400,"INVALID_EMAIL_CHANGE","Esta conta não pode ser alterada agora. Nada foi alterado.");
        }
        String previous=(String)state.getFirst().get("email"), pending=(String)tokenState.get("pending_email");
        if(jdbc.queryForObject("SELECT count(*) FROM local_accounts WHERE email=? AND id<>?",Integer.class,pending,id)>0) {
            audit(id,now,"EMAIL_CHANGE","CONFLICT");
            return new AccountResult(409,"EMAIL_TAKEN","Não foi possível concluir a troca para este endereço. Nada foi alterado; peça a troca novamente.");
        }
        jdbc.update("UPDATE local_accounts SET email=? WHERE id=?",pending,id);
        jdbc.update("UPDATE account_email_change_tokens SET consumed_at=? WHERE token_hash=?",ts(now),digest(token));
        revokePendingLinks(id,now);
        auth.revokeAll(id);
        Instant changedAt=now;
        // E14: conclusão vai ao endereço novo; aviso ao antigo, sem qualquer link que reverta a troca.
        notice(pending,"EMAIL_CHANGED","E-mail sintético da conta atualizado",
            "O e-mail desta conta passou a ser este endereço em "+changedAt+" (UTC). Todas as sessões anteriores foram encerradas; entre novamente com o novo endereço. "
            + "Se não foi você, use a recuperação de acesso e conteste com o operador local.");
        notice(previous,"EMAIL_CHANGE_NOTICE","Aviso: o e-mail da conta foi trocado",
            "O e-mail desta conta foi trocado em "+changedAt+" (UTC) a partir de uma sessão autenticada. Este aviso não altera nem reverte a troca. "
            + "Se não foi você, conteste com o operador local usando a recuperação de acesso.");
        audit(id,now,"EMAIL_CHANGE","CHANGED");
        return new AccountResult(200,"EMAIL_CHANGED","E-mail atualizado. Todas as sessões foram encerradas; entre novamente com o novo endereço.");
    }

    private void issueEmailChange(UUID id,String pending,String oldEmail,Instant now) {
        String token=freshToken();
        Instant expires=now.plus(settings.recoveryTtl());
        jdbc.update("INSERT INTO account_email_change_tokens(token_hash,account_id,pending_email,created_at,expires_at) VALUES (?,?,?,?,?)",digest(token),id,pending,ts(now),ts(expires));
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                mailbox.deliverEmailChange(pending,token,expires);
                mailbox.deliverNotice(oldEmail,"EMAIL_CHANGE_REQUEST_NOTICE","Aviso: troca de e-mail solicitada",
                    "Foi solicitada a troca do e-mail desta conta para outro endereço em "+now+" (UTC). Este aviso não permite reverter a troca por clique e o endereço atual continua valendo até a confirmação. "
                    + "Se não foi você, altere a senha e conteste com o operador local.");
            }
        });
    }
    /** Aviso transacional entregue só depois do commit, sem token e sem senha (E14). */
    private void notice(String email,String kind,String subject,String body) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { mailbox.deliverNotice(email,kind,subject,body); }
        });
    }
    private void issueRecovery(UUID id,String email,Instant now) {
        String token=freshToken();
        Instant expires=now.plus(settings.recoveryTtl());
        jdbc.update("INSERT INTO account_recovery_tokens(token_hash,account_id,created_at,expires_at) VALUES (?,?,?,?)",digest(token),id,ts(now),ts(expires));
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { mailbox.deliverRecovery(email,token,expires); }
        });
    }
    private boolean allow(String action, Instant now) {
        return allowFor(action,settings.requestsPerMinute(),Duration.ofSeconds(60),now);
    }
    /** Limite persistente por chave: a janela reinicia quando expira (mesmo mecanismo do cadastro). */
    private boolean allowFor(String bucket,int maximum,Duration window,Instant now) {
        Integer attempts=jdbc.queryForObject("""
            INSERT INTO account_request_limits(action,window_start,attempts) VALUES (?,?,1)
            ON CONFLICT(action) DO UPDATE SET
              window_start = CASE WHEN account_request_limits.window_start <= ? THEN EXCLUDED.window_start ELSE account_request_limits.window_start END,
              attempts = CASE WHEN account_request_limits.window_start <= ? THEN 1 ELSE account_request_limits.attempts + 1 END
            RETURNING attempts
            """,Integer.class,bucket,ts(now),ts(now.minus(window)),ts(now.minus(window)));
        return attempts!=null && attempts<=maximum;
    }
    private AccountResult limited(String action,Instant now) {
        audit(null,now,action,"LIMITED");
        return new AccountResult(429,"REQUEST_LIMIT","Limite local de tentativas atingido. Aguarde até um minuto e tente novamente.");
    }
    private void audit(UUID id,Instant now,String action,String outcome) {
        jdbc.update("INSERT INTO account_audit_events(account_id,occurred_at,action,outcome) VALUES (?,?,?,?)",id,ts(now),action,outcome);
    }
    private static Timestamp ts(Instant value) { return Timestamp.from(value); }
    static String text(Map<String,Object> input,String key) { return input.get(key) instanceof String value ? value : null; }
    private static String email(Map<String,Object> input) { return email(input,"email"); }
    static String email(Map<String,Object> input,String key) {
        String value=text(input,key);
        if(value==null) return null;
        value=value.strip().toLowerCase(Locale.ROOT);
        return value.length()<=254 && value.matches("[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\\.test") ? value : null;
    }
    static String digest(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch(NoSuchAlgorithmException exception) { throw new IllegalStateException("SHA-256 indisponível."); }
    }
}
