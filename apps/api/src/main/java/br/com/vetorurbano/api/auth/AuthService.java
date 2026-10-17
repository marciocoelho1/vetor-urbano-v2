package br.com.vetorurbano.api.auth;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import br.com.vetorurbano.api.accounts.AccountPassword;

public class AuthService {
    public record Reply(int status,Map<String,Object> body,String cookie) {}
    public record Session(UUID account,String role,boolean verified,boolean enrolled,String token) {}
    private final JdbcTemplate jdbc;
    private final AccountPassword passwords;
    private final Clock clock;
    private final AuthSettings settings;
    private final MfaVault vault;
    private final String dummy;
    public AuthService(JdbcTemplate jdbc,AccountPassword passwords,Clock clock,AuthSettings settings,MfaVault vault) {
        this.jdbc=jdbc;this.passwords=passwords;this.clock=clock;this.settings=settings;this.vault=vault;
        this.dummy=passwords.derive(random());
    }
    public static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch(NoSuchAlgorithmException e) { throw new IllegalStateException(); }
    }
    private static String random() { byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes); }
    public static String csrf(String token) { return hash("csrf:"+token); }
    private Timestamp now() { return Timestamp.from(clock.instant()); }
    private Reply error(int status,String code,String message) { return new Reply(status,Map.of("code",code,"message",message),null); }
    private void audit(UUID id,String action,String outcome) { jdbc.update("INSERT INTO auth_audit_events(account_id,occurred_at,action,outcome) VALUES(?,?,?,?)",id,now(),action,outcome); }
    private boolean limit(String bucket,int maximum,Duration window) {
        var instant=now();
        int attempts=jdbc.queryForObject("""
            INSERT INTO auth_request_limits(bucket,window_start,attempts) VALUES(?,?,1)
            ON CONFLICT(bucket) DO UPDATE SET
            attempts=CASE WHEN auth_request_limits.window_start<=? THEN 1 ELSE auth_request_limits.attempts+1 END,
            window_start=CASE WHEN auth_request_limits.window_start<=? THEN EXCLUDED.window_start ELSE auth_request_limits.window_start END
            RETURNING attempts
            """,Integer.class,bucket,instant,Timestamp.from(clock.instant().minus(window)),Timestamp.from(clock.instant().minus(window)));
        return attempts<=maximum;
    }
    @Transactional
    public Reply login(Map<String,Object> body,String previous) {
        if(!body.keySet().equals(Set.of("email","password"))||!(body.get("email") instanceof String email)||!(body.get("password") instanceof String password)||email.length()>254||password.length()>512)
            return error(400,"INVALID_LOGIN","Informe e-mail e senha válidos.");
        String normalized=email.strip().toLowerCase(Locale.ROOT);
        if(!limit("login:global",settings.globalAttempts(),Duration.ofMinutes(1))||!limit("login:"+hash(normalized),settings.loginAttempts(),Duration.ofMinutes(5))) {
            audit(null,"LOGIN","LIMITED");return error(429,"ACCESS_LIMITED","Limite local atingido. Tente mais tarde.");
        }
        var rows=jdbc.queryForList("SELECT id,password_hash,status,role,mfa_enabled FROM local_accounts WHERE email=? FOR UPDATE",normalized);
        boolean valid=passwords.matches(password,rows.isEmpty()?dummy:(String)rows.getFirst().get("password_hash"));
        if(!valid||rows.isEmpty()||!rows.getFirst().get("status").equals("CONFIRMED")) {
            audit(null,"LOGIN","DENIED");return error(401,"INVALID_LOGIN","Credenciais inválidas ou conta não confirmada.");
        }
        var row=rows.getFirst(); UUID id=(UUID)row.get("id");
        if(previous!=null) jdbc.update("UPDATE local_sessions SET revoked_at=? WHERE token_hash=?",now(),hash(previous));
        audit(id,"LOGIN","ACCEPTED");
        return issue(id,(String)row.get("role"),false,(boolean)row.get("mfa_enabled"));
    }
    private Reply issue(UUID id,String role,boolean verified,boolean enrolled) {
        String token=random();
        jdbc.update("INSERT INTO local_sessions(token_hash,account_id,security_version,mfa_verified,created_at,last_seen_at) SELECT ?,id,security_version,?,?,? FROM local_accounts WHERE id=?",hash(token),verified,now(),now(),id);
        return new Reply(200,view(new Session(id,role,verified,enrolled,token)),token);
    }
    private Map<String,Object> view(Session session) {
        boolean full=session.role().equals("USER")||session.verified();
        return Map.of("code",full?"AUTHENTICATED":"MFA_REQUIRED","message",full?"Sessão autenticada.":"Confirme seu autenticador para continuar.",
            "accountId",session.account().toString(),"role",session.role(),"authenticated",full,"mfaEnrolled",session.enrolled(),"csrfToken",csrf(session.token()));
    }
    // Lock account first, then session; read time after both locks, including under concurrency.
    private Session session(String token) {
        if(token==null||!token.matches("[A-Za-z0-9_-]{43}")) return null;
        var ids=jdbc.queryForList("SELECT account_id FROM local_sessions WHERE token_hash=?",hash(token));
        if(ids.isEmpty()) return null;
        UUID id=(UUID)ids.getFirst().get("account_id");
        var account=jdbc.queryForMap("SELECT * FROM local_accounts WHERE id=? FOR UPDATE",id);
        var row=jdbc.queryForMap("SELECT * FROM local_sessions WHERE token_hash=? FOR UPDATE",hash(token));
        Instant instant=clock.instant();
        boolean partial=account.get("role").equals("ADMIN")&&!(boolean)row.get("mfa_verified");
        boolean expired=!instant.isBefore(((Timestamp)row.get("last_seen_at")).toInstant().plus(settings.inactivity()))
            ||!instant.isBefore(((Timestamp)row.get("created_at")).toInstant().plus(partial?settings.partialLifetime():settings.lifetime()));
        if(row.get("revoked_at")!=null||!row.get("security_version").equals(account.get("security_version"))||!account.get("status").equals("CONFIRMED")||expired) {
            if(row.get("revoked_at")==null) { jdbc.update("UPDATE local_sessions SET revoked_at=? WHERE token_hash=?",now(),hash(token));audit(id,"SESSION","EXPIRED_OR_REVOKED"); }
            return null;
        }
        jdbc.update("UPDATE local_sessions SET last_seen_at=? WHERE token_hash=?",now(),hash(token));
        return new Session(id,(String)account.get("role"),(boolean)row.get("mfa_verified"),(boolean)account.get("mfa_enabled"),token);
    }
    @Transactional public Reply status(String token) {
        var s=session(token);return s==null?error(401,"SESSION_REQUIRED","Entre para acessar os módulos."):new Reply(200,view(s),null);
    }
    @Transactional public Reply authorize(String token,boolean admin) {
        var s=session(token);
        if(s==null) { audit(null,"ACCESS","DENIED");return error(401,"SESSION_REQUIRED","Entre para acessar os módulos."); }
        if((admin&&!s.role().equals("ADMIN"))||(s.role().equals("ADMIN")&&!s.verified())) {
            audit(s.account(),"ACCESS","DENIED");return error(403,"ACCESS_DENIED","Acesso não concedido. Administração exige segundo fator.");
        }
        audit(s.account(),"ACCESS","GRANTED");return new Reply(200,view(s),null);
    }
    @Transactional public Reply logout(String token,String csrf) {
        var s=session(token);if(s==null)return error(401,"SESSION_REQUIRED","Sessão ausente ou expirada.");
        if(!validCsrf(token,csrf))return error(403,"CSRF_REQUIRED","Recarregue a sessão e tente novamente.");
        jdbc.update("UPDATE local_sessions SET revoked_at=? WHERE token_hash=?",now(),hash(token));audit(s.account(),"LOGOUT","REVOKED");
        return new Reply(200,Map.of("code","LOGGED_OUT","message","Sessão encerrada."),"");
    }
    public static boolean validCsrf(String token,String supplied) {
        return token!=null&&supplied!=null&&MessageDigest.isEqual(csrf(token).getBytes(StandardCharsets.US_ASCII),supplied.getBytes(StandardCharsets.US_ASCII));
    }
    @Transactional public Reply enroll(String token,String csrf) {
        var s=session(token);var denied=mfaPermission(s,csrf);if(denied!=null)return denied;
        if(s.enrolled())return error(409,"MFA_ALREADY_ACTIVE","Autenticador já ativado. Perda exige operação local restrita.");
        String encrypted=jdbc.queryForObject("SELECT mfa_secret FROM local_accounts WHERE id=?",String.class,s.account());
        if(encrypted==null) { byte[] secret=new byte[20];new SecureRandom().nextBytes(secret); encrypted=vault.encrypt(secret,s.account());
            jdbc.update("UPDATE local_accounts SET mfa_secret=? WHERE id=?",encrypted,s.account());audit(s.account(),"MFA_ENROLL","CREATED"); }
        return new Reply(200,Map.of("code","MFA_ENROLLMENT","message","Adicione a chave ao aplicativo autenticador e confirme um código.","secret",Totp.base32(vault.decrypt(encrypted,s.account()))),null);
    }
    private Reply mfaPermission(Session s,String csrf) {
        if(s==null)return error(401,"SESSION_REQUIRED","Sessão ausente ou expirada.");
        if(!s.role().equals("ADMIN"))return error(403,"ACCESS_DENIED","Capacidade exclusiva de Administrador.");
        if(!validCsrf(s.token(),csrf))return error(403,"CSRF_REQUIRED","Recarregue a sessão e tente novamente.");
        return null;
    }
    @Transactional public Reply verify(String token,String csrf,Map<String,Object> body) {
        var s=session(token);var denied=mfaPermission(s,csrf);if(denied!=null)return denied;
        if(!limit("mfa:"+s.account(),settings.mfaAttempts(),Duration.ofMinutes(5))) { audit(s.account(),"MFA","LIMITED");return error(429,"ACCESS_LIMITED","Limite local atingido. Tente mais tarde."); }
        var row=jdbc.queryForMap("SELECT mfa_secret,mfa_counter FROM local_accounts WHERE id=?",s.account());
        long accepted=-1;String code=body.size()==1&&body.get("code") instanceof String value?value:"";
        if(row.get("mfa_secret")!=null&&code.matches("[0-9]{6}")) {
            byte[] secret=vault.decrypt((String)row.get("mfa_secret"),s.account());
            long current=clock.instant().getEpochSecond()/30;
            for(long counter=current-1;counter<=current+1;counter++)
                if(counter>((Number)row.get("mfa_counter")).longValue()&&MessageDigest.isEqual(Totp.code(secret,counter).getBytes(StandardCharsets.US_ASCII),code.getBytes(StandardCharsets.US_ASCII))) accepted=counter;
            Arrays.fill(secret,(byte)0);
        }
        if(accepted<0) { audit(s.account(),"MFA","DENIED");return error(401,"INVALID_MFA","Código inválido, expirado ou já utilizado."); }
        jdbc.update("UPDATE local_accounts SET mfa_enabled=true,mfa_counter=? WHERE id=?",accepted,s.account());
        jdbc.update("UPDATE local_sessions SET revoked_at=? WHERE token_hash=?",now(),hash(token));
        audit(s.account(),"MFA","VERIFIED");return issue(s.account(),"ADMIN",true,true);
    }
    @Transactional public void auditQuery(UUID account, br.com.vetorurbano.api.occurrences.OccurrenceQuery query,
            br.com.vetorurbano.api.occurrences.OccurrenceQueryCounts counts) {
        auditUsage(account, "CONSULTATION", query, counts);
    }
    @Transactional public void auditReportGeneration(UUID account, br.com.vetorurbano.api.occurrences.OccurrenceQuery query,
            br.com.vetorurbano.api.occurrences.OccurrenceQueryCounts counts) {
        auditUsage(account, "REPORT_GENERATION", query, counts);
    }
    private void auditUsage(UUID account, String action, br.com.vetorurbano.api.occurrences.OccurrenceQuery query,
            br.com.vetorurbano.api.occurrences.OccurrenceQueryCounts counts) {
        var parameters=new LinkedHashMap<String,Object>();
        parameters.put("periodStart",query.periodStart()==null?null:query.periodStart().toString());parameters.put("periodEnd",query.periodEnd()==null?null:query.periodEnd().toString());
        parameters.put("categories",query.categories());parameters.put("types",query.types());parameters.put("subtypes",query.subtypes());
        parameters.put("municipalities",query.municipalities());parameters.put("neighborhoods",query.neighborhoods());parameters.put("sourceIds",query.sourceIds());
        parameters.put("situations",query.situations());parameters.put("hasText",query.text()!=null&&!query.text().isBlank());
        parameters.put("minReliability",query.minReliability());parameters.put("maxReliability",query.maxReliability());
        parameters.put("hasSpatialFilter",query.center()!=null||!query.bounds().isEmpty());
        parameters.put("occurrences",counts.occurrences());parameters.put("happenings",counts.happenings());
        String json=tools.jackson.databind.json.JsonMapper.builder().build().writeValueAsString(parameters);
        jdbc.update("INSERT INTO auth_audit_events(account_id,occurred_at,module,action,outcome,parameters) VALUES(?,?, 'query',?,'SUCCEEDED',?::jsonb)",account,now(),action,json);
    }
    /** Ticket 15 must call this within the password-change transaction. No public endpoint. */
    @Transactional public void revokeAll(UUID account) {
        jdbc.update("UPDATE local_accounts SET security_version=security_version+1 WHERE id=?",account);
        jdbc.update("UPDATE local_sessions SET revoked_at=? WHERE account_id=? AND revoked_at IS NULL",now(),account);
        audit(account,"REVOKE_ALL","REVOKED");
    }
}
