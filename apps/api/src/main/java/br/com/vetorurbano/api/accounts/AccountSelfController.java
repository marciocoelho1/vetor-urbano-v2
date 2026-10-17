package br.com.vetorurbano.api.accounts;

import java.util.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import br.com.vetorurbano.api.auth.AuthController;

/**
 * Autoatendimento da própria conta (ticket 15B, E02). O caminho `/api/v1/account` **não** está na
 * lista liberada do {@code AccessBoundary}: ele exige sessão completa no servidor antes de chegar
 * aqui, e o identificador usado é o que a autorização gravou na requisição — nunca um id do cliente.
 * POSTs ainda exigem CSRF associado à sessão (conferido em {@code AuthService.requireConfirmation}).
 */
@RestController
@RequestMapping("/api/v1/account")
@Profile("local")
@ConditionalOnProperty(name="vetor.accounts.enabled",havingValue="true")
public class AccountSelfController {
    private final AccountService service;
    public AccountSelfController(AccountService service) { this.service=service; }

    @GetMapping(produces="application/json")
    ResponseEntity<Map<String,Object>> profile(HttpServletRequest request) {
        var account=account(request);
        var profile=account==null?null:service.profile(account);
        if(profile==null) return ResponseEntity.status(401).cacheControl(CacheControl.noStore())
            .body(Map.of("code","SESSION_REQUIRED","message","Entre para acessar a sua conta."));
        var body=new LinkedHashMap<String,Object>();
        body.put("code","ACCOUNT_PROFILE");
        body.put("message","Dados da própria conta.");
        body.put("displayName",profile.displayName());
        body.put("email",profile.email());
        body.put("role",profile.role());
        if(profile.pendingEmail()!=null) {
            body.put("pendingEmail",profile.pendingEmail());
            body.put("pendingEmailExpiresAt",profile.pendingEmailExpiresAt().toString());
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }

    @PostMapping(value="/display-name",consumes="application/json",produces="application/json")
    ResponseEntity<Map<String,String>> displayName(HttpServletRequest request,@RequestHeader(value="X-CSRF-Token",required=false) String csrf,
            @RequestBody Map<String,Object> body) {
        var account=account(request);
        if(account==null) return respond(sessionRequired());
        var confirmation=service.confirmSession(AuthController.token(request),csrf);
        if(confirmation.status()!=200) return AccountController.respond(confirmation);
        return AccountController.respond(service.changeDisplayName(account,body));
    }

    @PostMapping(value="/password",consumes="application/json",produces="application/json")
    ResponseEntity<Map<String,String>> password(HttpServletRequest request,@RequestHeader(value="X-CSRF-Token",required=false) String csrf,
            @RequestBody Map<String,Object> body) {
        var account=account(request);
        if(account==null) return respond(sessionRequired());
        var confirmation=service.confirmSensitive(AuthController.token(request),csrf,AccountService.text(body,"mfaCode"));
        if(confirmation.status()!=200) return AccountController.respond(confirmation);
        return AccountController.respond(service.changePassword(account,body));
    }

    @PostMapping(value="/email-changes",consumes="application/json",produces="application/json")
    ResponseEntity<Map<String,String>> emailChange(HttpServletRequest request,@RequestHeader(value="X-CSRF-Token",required=false) String csrf,
            @RequestBody Map<String,Object> body) {
        var account=account(request);
        if(account==null) return respond(sessionRequired());
        var confirmation=service.confirmSensitive(AuthController.token(request),csrf,AccountService.text(body,"mfaCode"));
        if(confirmation.status()!=200) return AccountController.respond(confirmation);
        return AccountController.respond(service.requestEmailChange(account,body));
    }

    /** Identificador gravado pela autorização do servidor; ausência significa que nada foi autorizado. */
    private static UUID account(HttpServletRequest request) {
        Object value=request.getAttribute("vu.account");
        if(!(value instanceof String text)) return null;
        try { return UUID.fromString(text); } catch (IllegalArgumentException exception) { return null; }
    }
    private static AccountResult sessionRequired() {
        return new AccountResult(401,"SESSION_REQUIRED","Entre para acessar a sua conta.");
    }
    private static ResponseEntity<Map<String,String>> respond(AccountResult result) {
        return AccountController.respond(result);
    }
}
