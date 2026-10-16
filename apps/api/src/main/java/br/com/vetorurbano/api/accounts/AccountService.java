package br.com.vetorurbano.api.accounts;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.*;

public class AccountService {
    private final JdbcTemplate jdbc;
    private final AccountSettings settings;
    private final Clock clock;
    private final LocalMailbox mailbox;
    private final AccountPassword password;
    private final SecureRandom random = new SecureRandom();
    public AccountService(JdbcTemplate jdbc, AccountSettings settings, Clock clock, LocalMailbox mailbox, AccountPassword password) {
        this.jdbc=jdbc; this.settings=settings; this.clock=clock; this.mailbox=mailbox; this.password=password;
    }
    @Transactional
    public AccountResult register(Map<String,Object> input) {
        Instant now=clock.instant();
        if (!allow("REGISTRATION", now)) return limited("REGISTRATION",now);
        String name=text(input,"displayName"), email=email(input), secret=text(input,"password");
        if (!input.keySet().equals(Set.of("displayName","email","password")) || name==null || name.strip().length()<2
                || name.strip().length()>80 || email==null || !validPassword(secret)) {
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
        return new AccountResult(200,"ACCOUNT_CONFIRMED","E-mail confirmado. Sua conta permanece sem sessão; o acesso será tratado no próximo incremento.");
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
        boolean reset=!now.isBefore(start.plus(Duration.ofHours(1)));
        int count=reset ? 0 : ((Number)account.get("resend_count")).intValue();
        if(!account.get("status").equals("PENDING") || now.isBefore(last.plus(settings.resendCooldown())) || count>=settings.resendsPerHour()) {
            audit(id,now,"RESEND","SUPPRESSED"); return AccountResult.pending();
        }
        jdbc.update("UPDATE account_confirmation_tokens SET revoked_at=? WHERE account_id=? AND consumed_at IS NULL AND revoked_at IS NULL",ts(now),id);
        jdbc.update("UPDATE local_accounts SET last_sent_at=?,resend_window_start=?,resend_count=? WHERE id=?",ts(now),ts(reset?now:start),count+1,id);
        issue(id,email,now); audit(id,now,"RESEND","SENT");
        return AccountResult.pending();
    }

    private boolean validPassword(String secret) {
        if(secret==null) return false;
        int length=secret.codePointCount(0,secret.length());
        return length>=15 && length<=128 && !Set.of("passwordpassword", "123456789012345", "senha senha senha", "vetor urbano vetor urbano").contains(secret.toLowerCase(Locale.ROOT));
    }
    private void issue(UUID id,String email,Instant now) {
        byte[] bytes=new byte[32]; random.nextBytes(bytes);
        String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expires=now.plus(settings.tokenTtl());
        jdbc.update("INSERT INTO account_confirmation_tokens(token_hash,account_id,created_at,expires_at) VALUES (?,?,?,?)",digest(token),id,ts(now),ts(expires));
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { mailbox.deliver(email,token,expires); }
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
