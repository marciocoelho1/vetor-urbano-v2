package br.com.vetorurbano.api.reliability;

import br.com.vetorurbano.api.corrections.CorrectionController;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Ticket 24: rotas administrativas de verificação de afirmações e decisão mensal da nota da fonte. */
@RestController
@RequestMapping("/api/v1/admin/source-ratings")
@Profile("local")
@ConditionalOnProperty(name = "vetor.accounts.enabled", havingValue = "true")
public class SourceRatingController {

    private final SourceRatingService service;

    public SourceRatingController(SourceRatingService service) {
        this.service = service;
    }

    @PostMapping("/{sourceId}/verifications")
    public Object record(@PathVariable String sourceId, @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        CorrectionController.csrf(request);
        return service.record(sourceId, body, CorrectionController.actor(request));
    }

    @GetMapping("/{sourceId}/verifications")
    public Object verifications(@PathVariable String sourceId, HttpServletRequest request) {
        return service.verifications(sourceId, CorrectionController.actor(request));
    }

    @GetMapping("/{sourceId}/recommendation")
    public Object recommendation(@PathVariable String sourceId, HttpServletRequest request) {
        return service.recommendation(sourceId, CorrectionController.actor(request));
    }

    @PostMapping("/{sourceId}/decisions")
    public Object decide(@PathVariable String sourceId, @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        CorrectionController.csrf(request);
        return service.decide(sourceId, body, CorrectionController.actor(request));
    }

    @GetMapping("/{sourceId}/flags")
    public Object flags(@PathVariable String sourceId, HttpServletRequest request) {
        return service.flags(sourceId, CorrectionController.actor(request));
    }

    @PostMapping("/flags/{flagId}/resolution")
    public Object resolve(@PathVariable long flagId, HttpServletRequest request) {
        CorrectionController.csrf(request);
        return service.resolve(flagId, CorrectionController.actor(request));
    }
}
