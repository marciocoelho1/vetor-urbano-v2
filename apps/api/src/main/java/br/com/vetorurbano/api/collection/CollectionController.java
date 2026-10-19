package br.com.vetorurbano.api.collection;

import java.util.Map;
import java.util.UUID;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.DataAccessException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.transaction.TransactionException;
import org.springframework.web.bind.annotation.*;
import br.com.vetorurbano.api.auth.AuthController;
import br.com.vetorurbano.api.auth.AuthService;

/**
 * Superfície administrativa da coleta. Exige ADMIN com MFA no servidor e CSRF nas escritas: sem
 * sessão completa o filtro de acesso responde 401, USER responde 403.
 */
@RestController
@RequestMapping("/api/v1/admin/collections")
@org.springframework.context.annotation.Profile("local")
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = "vetor.accounts.enabled", havingValue = "true")
public class CollectionController {
    private final CollectionService collections;

    public CollectionController(CollectionService collections) { this.collections = collections; }

    @GetMapping
    public ResponseEntity<Map<String, Object>> status() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(collections.status());
    }

    @GetMapping("/runs")
    public ResponseEntity<Map<String, Object>> runs() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("items", collections.runs(50)));
    }

    @PostMapping("/runs")
    public ResponseEntity<Map<String, Object>> start(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        requireCsrf(request);
        return ResponseEntity.accepted().cacheControl(CacheControl.noStore())
                .body(collections.startRun(body, actor(request)));
    }

    @PostMapping("/runs/{id}/pause")
    public ResponseEntity<Map<String, Object>> pause(@PathVariable UUID id, HttpServletRequest request) {
        requireCsrf(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(collections.pause(id, actor(request)));
    }

    @PostMapping("/runs/{id}/resume")
    public ResponseEntity<Map<String, Object>> resume(@PathVariable UUID id, HttpServletRequest request) {
        requireCsrf(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(collections.resume(id, actor(request)));
    }

    /** O JSON nunca inclui credencial, token nem atributo pessoal de vítima. */
    public record CollectionErrorResponse(String code, String message) {}

    private static UUID actor(HttpServletRequest request) {
        Object account = request.getAttribute("vu.account");
        if (!(account instanceof String id))
            throw new CollectionFailure(401, "SESSION_REQUIRED", "Entre para acessar a administração.");
        return UUID.fromString(id);
    }

    private static void requireCsrf(HttpServletRequest request) {
        if (!AuthService.validCsrf(AuthController.token(request), request.getHeader("X-CSRF-Token")))
            throw new CollectionFailure(403, "CSRF_REQUIRED", "Recarregue a sessão e tente novamente.");
    }

    @ExceptionHandler(CollectionFailure.class)
    ResponseEntity<CollectionErrorResponse> collectionFailure(CollectionFailure failure) {
        return ResponseEntity.status(failure.status()).cacheControl(CacheControl.noStore())
                .body(new CollectionErrorResponse(failure.code(), failure.getMessage()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<CollectionErrorResponse> invalidBody() {
        return ResponseEntity.badRequest().cacheControl(CacheControl.noStore())
                .body(new CollectionErrorResponse("INVALID_COLLECTION_RUN", "Revise o corpo da requisição da coleta."));
    }

    @ExceptionHandler({DataAccessException.class, TransactionException.class})
    ResponseEntity<CollectionErrorResponse> unavailable() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).cacheControl(CacheControl.noStore())
                .body(new CollectionErrorResponse("COLLECTION_UNAVAILABLE", "Serviço de coleta indisponível. Tente novamente."));
    }
}
