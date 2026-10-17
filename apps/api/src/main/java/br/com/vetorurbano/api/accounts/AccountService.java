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
        Integer attempts=jdbc.queryForObject("""
            INSERT INTO account_request_limits(action,window_start,attempts) VALUES (?,?,1)
            ON CONFLICT(action) DO UPDATE SET
              window_start = CASE WHEN account_request_limits.window_start <= ? THEN EXCLUDED.window_start ELSE account_request_limits.window_start END,
              attempts = CASE WHEN account_request_limits.window_start <= ? THEN 1 ELSE account_request_limits.attempts + 1 END
            RETURNING attempts
            """,Integer.class,action,ts(now),ts(now.minusSeconds(60)),ts(now.minusSeconds(60)));
        return attempts!=null && attempts<=settings.requestsPerMinute();
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
    private static String email(Map<String,Object> input) {
        String value=text(input,"email");
        if(value==null) return null;
        value=value.strip().toLowerCase(Locale.ROOT);
        return value.length()<=254 && value.matches("[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\\.test") ? value : null;
    }
    static String digest(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch(NoSuchAlgorithmException exception) { throw new IllegalStateException("SHA-256 indisponível."); }
    }
}
