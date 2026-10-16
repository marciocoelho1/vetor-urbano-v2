package br.com.vetorurbano.api.auth;

import java.time.*;
import java.sql.Timestamp;
import java.util.*;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import br.com.vetorurbano.api.accounts.AccountPassword;
import tools.jackson.databind.json.JsonMapper;

/** Offline tool: explicit switch + private stdin. Never invoked by an HTTP route. */
public final class LocalAccountAdmin {
    private LocalAccountAdmin() {}
    public static void main(String[] args) throws Exception {
        if(args.length!=1||!args[0].equals("--synthetic-local-only")) throw new IllegalArgumentException("Exige ativação local explícita.");
        var input=JsonMapper.builder().build().readTree(System.in);
        if(input.path("email").asString().length()>254||!input.path("email").asString().matches("[a-z0-9._+%-]+@[a-z0-9.-]+\\.test")) throw new IllegalArgumentException("Identidade sintética inválida.");
        try(var app=new SpringApplicationBuilder(br.com.vetorurbano.api.VetorUrbanoApiApplication.class).web(WebApplicationType.NONE).profiles("local")
                .run("--vetor.accounts.enabled=true","--vetor.accounts.mailbox-port=0")) {
            var tx=new TransactionTemplate(app.getBean(org.springframework.transaction.PlatformTransactionManager.class));
            tx.executeWithoutResult(status->execute(app.getBean(JdbcTemplate.class),app.getBean(AuthService.class),app.getBean(AccountPassword.class),app.getBean(Clock.class),input));
        }
    }
    static void execute(JdbcTemplate jdbc,AuthService auth,AccountPassword password,Clock clock,tools.jackson.databind.JsonNode input) {
        String email=input.path("email").asString();
        if(input.path("action").asString().equals("create")) {
            String name=input.path("displayName").asString(),raw=input.path("password").asString();
            if(name.strip().length()<2||name.strip().length()>80||!AccountPassword.valid(raw))throw new IllegalArgumentException("Dados sintéticos inválidos.");
            UUID id=UUID.randomUUID();Timestamp now=Timestamp.from(clock.instant());
            jdbc.update("INSERT INTO local_accounts(id,display_name,email,password_hash,role,status,created_at,confirmed_at,last_sent_at,resend_window_start) VALUES(?,?,?,?,'ADMIN','CONFIRMED',?,?,?,?)",id,name.strip(),email,password.derive(raw),now,now,now,now);
            jdbc.update("INSERT INTO auth_audit_events(account_id,occurred_at,action,outcome) VALUES(?,?,'BOOTSTRAP','CREATED')",id,now);
        } else if(input.path("action").asString().equals("reset-mfa")) {
            var ids=jdbc.queryForList("SELECT id FROM local_accounts WHERE email=? AND role='ADMIN' FOR UPDATE",UUID.class,email);
            if(ids.size()!=1)throw new IllegalArgumentException("Administrador sintético não encontrado.");
            auth.revokeAll(ids.getFirst());
            jdbc.update("UPDATE local_accounts SET mfa_secret=NULL,mfa_enabled=false,mfa_counter=-1 WHERE id=?",ids.getFirst());
            jdbc.update("INSERT INTO auth_audit_events(account_id,occurred_at,action,outcome) VALUES(?,?,'MFA_RESET','RESET')",ids.getFirst(),Timestamp.from(clock.instant()));
        } else throw new IllegalArgumentException("Operação local inválida.");
    }
}
