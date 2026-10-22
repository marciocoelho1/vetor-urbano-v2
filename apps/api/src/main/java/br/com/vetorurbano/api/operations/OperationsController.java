package br.com.vetorurbano.api.operations;

import br.com.vetorurbano.api.auth.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DataAccessException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Ticket 22: painel de operação somente leitura. O filtro de acesso já responde 401 sem sessão e
 * 403 para USER, porque o caminho está sob {@code /api/v1/admin/}; a leitura é auditada como ato
 * administrativo, sem copiar conteúdo de ocorrência.
 */
@RestController
@RequestMapping("/api/v1/admin/operations")
@org.springframework.context.annotation.Profile("local")
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
        name = "vetor.accounts.enabled", havingValue = "true")
public class OperationsController {

    private final OperationsPanelService panel;
    private final AuthService auth;

    public OperationsController(OperationsPanelService panel, AuthService auth) {
        this.panel = panel;
        this.auth = auth;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> read(HttpServletRequest request) {
        var body = panel.panel();
        auth.auditOperationsView(account(request), sourcesCount(body), pendingReviews(body),
                expiringCount(body));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }

    private static UUID account(HttpServletRequest request) {
        if (!(request.getAttribute("vu.account") instanceof String id)) {
            throw new IllegalStateException("O filtro de acesso deveria ter autenticado a sessão.");
        }
        return UUID.fromString(id);
    }

    @SuppressWarnings("unchecked")
    private static int sourcesCount(Map<String, Object> body) {
        var sources = (Map<String, Object>) body.get("sources");
        return ((java.util.List<Object>) sources.get("items")).size();
    }

    @SuppressWarnings("unchecked")
    private static int pendingReviews(Map<String, Object> body) {
        var queue = (Map<String, Object>) body.get("queue");
        return ((Number) queue.get("pending")).intValue();
    }

    @SuppressWarnings("unchecked")
    private static int expiringCount(Map<String, Object> body) {
        var confirmations = (Map<String, Object>) body.get("confirmations");
        return ((java.util.List<Object>) confirmations.get("expiring")).size();
    }

    public record PanelErrorResponse(String code, String message) {}

    @ExceptionHandler({DataAccessException.class, org.springframework.transaction.TransactionException.class})
    ResponseEntity<PanelErrorResponse> unavailable() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).cacheControl(CacheControl.noStore())
                .body(new PanelErrorResponse("OPERATIONS_UNAVAILABLE",
                        "Painel de operação indisponível. Tente novamente."));
    }
}
