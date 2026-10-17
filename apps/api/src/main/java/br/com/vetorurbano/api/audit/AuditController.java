package br.com.vetorurbano.api.audit;

import java.util.Map;
import java.util.UUID;
import jakarta.servlet.http.HttpServletRequest;
import br.com.vetorurbano.api.auth.AuthController;
import br.com.vetorurbano.api.auth.AuthService;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.TransactionException;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("local")
@ConditionalOnProperty(name = "vetor.accounts.enabled", havingValue = "true")
@RequestMapping("/api/v1/admin/logs")
public class AuditController {
    private final AuditService service;
    public AuditController(AuditService service) { this.service = service; }
    @GetMapping
    public Map<String, Object> list(@RequestParam(required = false) String eventClass,
            @RequestParam(required = false) String cursor, HttpServletRequest request) {
        return service.list(eventClass, cursor, UUID.fromString((String) request.getAttribute("vu.account")));
    }
    @PostMapping("/cleanup")
    public ResponseEntity<?> cleanup(HttpServletRequest request, @RequestHeader(value = "X-CSRF-Token", required = false) String csrf) {
        if (!AuthService.validCsrf(AuthController.token(request), csrf))
            return ResponseEntity.status(403).body(Map.of("code", "CSRF_REQUIRED", "message", "Recarregue a sessão e tente novamente."));
        return ResponseEntity.ok(service.cleanup(UUID.fromString((String) request.getAttribute("vu.account"))));
    }
    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<?> invalid() { return ResponseEntity.badRequest().body(Map.of("code", "INVALID_LOG_FILTER", "message", "Revise os filtros dos registros.")); }
    @ExceptionHandler({DataAccessException.class, TransactionException.class})
    ResponseEntity<?> unavailable() { return ResponseEntity.status(503).body(Map.of("code", "AUDIT_UNAVAILABLE", "message", "Registros indisponíveis. Tente novamente.")); }
}
