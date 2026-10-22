package br.com.vetorurbano.api.reliability;

import br.com.vetorurbano.api.corrections.CorrectionController;
import java.util.Map;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Ticket 23: rotas administrativas da avaliação de confiabilidade. O caminho sob
 * {@code /api/v1/admin/} garante 401 sem sessão e 403 para USER no servidor; toda escrita exige CSRF.
 */
@RestController
@RequestMapping("/api/v1/admin/reliability")
@Profile("local")
@ConditionalOnProperty(name = "vetor.accounts.enabled", havingValue = "true")
public class ReliabilityController {

    private final ReliabilityService service;

    public ReliabilityController(ReliabilityService service) {
        this.service = service;
    }

    @GetMapping("/rules")
    public Object rules(HttpServletRequest request) {
        return service.rules(CorrectionController.actor(request));
    }

    @PostMapping("/rules")
    public Object publishRule(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        CorrectionController.csrf(request);
        return service.publishRule(body, CorrectionController.actor(request));
    }

    @PostMapping("/occurrences/{id}/evaluations")
    public Object evaluate(@PathVariable String id, @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        CorrectionController.csrf(request);
        return service.evaluate(id, body, CorrectionController.actor(request));
    }

    @GetMapping("/occurrences/{id}/evaluations/latest")
    public Object latest(@PathVariable String id, HttpServletRequest request) {
        return service.latest(id, CorrectionController.actor(request));
    }

    @GetMapping("/occurrences/{id}/evaluations/{version}/reproduction")
    public Object reproduction(@PathVariable String id, @PathVariable int version, HttpServletRequest request) {
        return service.reproduction(id, version, CorrectionController.actor(request));
    }

    @PostMapping("/occurrences/{id}/evaluations/{version}/publication")
    public Object publishNote(@PathVariable String id, @PathVariable int version, HttpServletRequest request) {
        CorrectionController.csrf(request);
        return service.publishNote(id, version, CorrectionController.actor(request));
    }
}
