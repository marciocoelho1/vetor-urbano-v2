package br.com.vetorurbano.api.occurrences;

import br.com.vetorurbano.api.corrections.CorrectionController;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Administração de ocorrências: lista com ordenação/filtro, edição de todos os campos e ações em
 * lote. O caminho sob {@code /api/v1/admin/} já responde 401 sem sessão e 403 para USER; toda escrita
 * exige CSRF e a exclusão exige a senha do administrador uma única vez por lote.
 */
@RestController
@RequestMapping("/api/v1/admin/occurrences")
@Profile("local")
@ConditionalOnProperty(name = "vetor.accounts.enabled", havingValue = "true")
public class OccurrenceAdminController {

    private final OccurrenceAdminService service;

    public OccurrenceAdminController(OccurrenceAdminService service) {
        this.service = service;
    }

    /** Lista administrativa nunca é cacheada: estado e última atualização mudam a cada ação. */
    @GetMapping
    public ResponseEntity<Object> list(@RequestParam(required = false) String sort,
            @RequestParam(required = false) String status, HttpServletRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(service.list(sort, status, CorrectionController.actor(request)));
    }

    @PutMapping("/{id}")
    public Object edit(@PathVariable String id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        CorrectionController.csrf(request);
        return service.edit(id, body, CorrectionController.actor(request));
    }

    /** Erro com motivo legível: sem isto a interface só teria a mensagem genérica do Spring. */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> status(ResponseStatusException failure) {
        var body = new LinkedHashMap<String, Object>();
        body.put("code", switch (failure.getStatusCode().value()) {
            case 404 -> "NOT_FOUND";
            case 409 -> "CONFLICT";
            case 400 -> "INVALID";
            default -> "FAILED";
        });
        body.put("message", failure.getReason() == null
                ? "Não foi possível concluir a ação administrativa." : failure.getReason());
        return ResponseEntity.status(failure.getStatusCode()).cacheControl(CacheControl.noStore()).body(body);
    }

    @PostMapping("/bulk")
    public Object bulk(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        CorrectionController.csrf(request);
        return service.bulk(body, CorrectionController.actor(request));
    }
}
