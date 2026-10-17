package br.com.vetorurbano.api.accounts;

import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/accounts")
@Profile("local")
@ConditionalOnProperty(name="vetor.accounts.enabled", havingValue="true")
public class AccountController {
    private final AccountService service;
    public AccountController(AccountService service) { this.service=service; }
    @PostMapping(value="/registrations", consumes="application/json", produces="application/json")
    public ResponseEntity<Map<String,String>> register(@RequestBody Map<String,Object> input) {
        return respond(service.register(input));
    }
    @PostMapping(value="/confirmations", consumes="application/json", produces="application/json")
    public ResponseEntity<Map<String,String>> confirm(@RequestBody Map<String,Object> input) {
        return respond(service.confirm(input));
    }
    @PostMapping(value="/confirmation-requests", consumes="application/json", produces="application/json")
    public ResponseEntity<Map<String,String>> resend(@RequestBody Map<String,Object> input) {
        return respond(service.resend(input));
    }
    @PostMapping(value="/recovery-requests", consumes="application/json", produces="application/json")
    public ResponseEntity<Map<String,String>> requestRecovery(@RequestBody Map<String,Object> input) {
        return respond(service.requestRecovery(input));
    }
    @PostMapping(value="/recoveries", consumes="application/json", produces="application/json")
    public ResponseEntity<Map<String,String>> recover(@RequestBody Map<String,Object> input) {
        return respond(service.recover(input));
    }
    @PostMapping(value="/email-changes/confirmations", consumes="application/json", produces="application/json")
    public ResponseEntity<Map<String,String>> confirmEmailChange(@RequestBody Map<String,Object> input) {
        return respond(service.confirmEmailChange(input));
    }
    static ResponseEntity<Map<String,String>> respond(AccountResult result) {
        var response=ResponseEntity.status(result.status()).cacheControl(CacheControl.noStore());
        if(result.status()==429) response.header("Retry-After","60");
        return response.body(Map.of("code",result.code(),"message",result.message()));
    }
}
