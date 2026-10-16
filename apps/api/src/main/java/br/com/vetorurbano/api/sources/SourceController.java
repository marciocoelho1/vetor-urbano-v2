package br.com.vetorurbano.api.sources;

import java.net.URI;
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
import br.com.vetorurbano.api.auth.AuthService;
import br.com.vetorurbano.api.auth.AuthController;

@RestController
@RequestMapping("/api/v1")
public class SourceController {
    private final SourceService sources;

    public SourceController(SourceService sources) { this.sources = sources; }

    @GetMapping("/sources")
    public ResponseEntity<PublicSourcesResponse> publicSources() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(sources.publicSources());
    }

    @GetMapping("/admin/sources")
    public ResponseEntity<SourceAdminListResponse> list() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(sources.list());
    }

    @PostMapping("/admin/sources")
    public ResponseEntity<SourceDetails> create(@RequestBody SourceWriteRequest body,
            @RequestHeader(value = "X-CSRF-Token", required = false) String csrf, HttpServletRequest request) {
        requireCsrf(csrf, request);
        SourceDetails created = sources.create(body, actor(request));
        return ResponseEntity.created(URI.create("/api/v1/admin/sources/" + created.id()))
                .cacheControl(CacheControl.noStore()).body(created);
    }

    @GetMapping("/admin/sources/{id}/versions")
    public ResponseEntity<SourceHistoryResponse> history(@PathVariable String id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(sources.history(id));
    }

    @GetMapping("/admin/sources/{id}")
    public ResponseEntity<SourceDetails> find(@PathVariable String id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(sources.find(id));
    }

    @PutMapping("/admin/sources/{id}")
    public ResponseEntity<SourceDetails> update(@PathVariable String id, @RequestBody SourceWriteRequest body,
            @RequestHeader(value = "X-CSRF-Token", required = false) String csrf, HttpServletRequest request) {
        requireCsrf(csrf, request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(sources.update(id, body, actor(request)));
    }

    private static UUID actor(HttpServletRequest request) {
        Object account = request.getAttribute("vu.account");
        if (!(account instanceof String id)) throw new SourceFailure(401, "SESSION_REQUIRED", "Entre para acessar a administração.");
        return UUID.fromString(id);
    }

    private static void requireCsrf(String csrf, HttpServletRequest request) {
        if (!AuthService.validCsrf(AuthController.token(request), csrf))
            throw new SourceFailure(403, "CSRF_REQUIRED", "Recarregue a sessão e tente novamente.");
    }

    @ExceptionHandler(SourceFailure.class)
    ResponseEntity<SourceErrorResponse> sourceFailure(SourceFailure failure) {
        return ResponseEntity.status(failure.status()).cacheControl(CacheControl.noStore())
                .body(new SourceErrorResponse(failure.code(), failure.getMessage()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<SourceErrorResponse> invalidBody() {
        var body = new SourceErrorResponse("INVALID_SOURCE", "Revise o corpo da requisição da fonte.");
        return ResponseEntity.badRequest().cacheControl(CacheControl.noStore()).body(body);
    }

    @ExceptionHandler({DataAccessException.class, TransactionException.class})
    ResponseEntity<SourceErrorResponse> unavailable() {
        var body = new SourceErrorResponse("ACCESS_UNAVAILABLE", "Serviço de fontes indisponível. Tente novamente.");
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).cacheControl(CacheControl.noStore()).body(body);
    }
}
