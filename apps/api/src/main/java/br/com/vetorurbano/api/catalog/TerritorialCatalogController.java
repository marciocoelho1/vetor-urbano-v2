package br.com.vetorurbano.api.catalog;

import java.util.Map;
import java.util.UUID;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import br.com.vetorurbano.api.corrections.CorrectionController;

/**
 * Catálogo territorial (UXH-03). Público na leitura (sessão do aplicativo, sem papel ADMIN) e
 * administrativo na aprovação, no mesmo padrão de {@code /risk-areas}. Não tem nenhuma relação com
 * aquele módulo: aqui não há Área de Risco, indicativo de grupo nem aprovação compartilhada.
 */
@RestController
@RequestMapping("/api/v1")
@Profile("local")
@ConditionalOnProperty(name = "vetor.accounts.enabled", havingValue = "true")
public class TerritorialCatalogController {
    private final TerritorialCatalogService service;

    public TerritorialCatalogController(TerritorialCatalogService service) {
        this.service = service;
    }

    @GetMapping("/territories")
    public Object list(@RequestParam(required = false) String level,
                       @RequestParam(required = false) String q,
                       @RequestParam(required = false, defaultValue = "false") boolean includeGeometry) {
        return service.list(level, q, includeGeometry, false);
    }

    @GetMapping("/territories/{id}")
    public Object find(@PathVariable UUID id) {
        return service.find(id, false);
    }

    @GetMapping("/admin/territories")
    public Object adminList(@RequestParam(required = false) String level,
                            @RequestParam(required = false) String q,
                            @RequestParam(required = false, defaultValue = "true") boolean includeGeometry) {
        return service.list(level, q, includeGeometry, true);
    }

    @GetMapping("/admin/territories/datasets")
    public Object datasets() {
        return Map.of("items", service.datasets());
    }

    @GetMapping("/admin/territories/{id}")
    public Object adminFind(@PathVariable UUID id) {
        return service.find(id, true);
    }

    @PostMapping("/admin/territories/{id}/approvals")
    public Object approve(@PathVariable UUID id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        CorrectionController.csrf(request);
        return service.approve(id, body, CorrectionController.actor(request));
    }

    /** Falha de banco nunca vira 200 vazio: o cliente precisa distinguir «sem dado» de «indisponível». */
    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<?> unavailable(DataAccessException failure) {
        return ResponseEntity.status(503).body(Map.of("code", "TERRITORY_CATALOG_UNAVAILABLE",
                "message", "Catálogo territorial indisponível. Tente novamente."));
    }
}
