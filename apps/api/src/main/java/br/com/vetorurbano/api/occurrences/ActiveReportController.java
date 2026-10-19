package br.com.vetorurbano.api.occurrences;

import br.com.vetorurbano.api.auth.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/active-reports")
public class ActiveReportController {
    private final ActiveReportQueryService service;
    private final ObjectProvider<AuthService> auth;
    public ActiveReportController(ActiveReportQueryService service, ObjectProvider<AuthService> auth) {
        this.service = service; this.auth = auth;
    }
    public record Item(OccurrenceView occurrence, OccurrenceSituation effectiveSituation, ActiveReportQueryService.Validity validity) {}
    public record Response(Instant evaluatedAt, String limitation, List<Item> items) {}

    @GetMapping
    public ResponseEntity<Response> find(@RequestParam MultiValueMap<String, String> parameters, HttpServletRequest request) {
        Coordinates center;
        int radius;
        try {
            if (!parameters.keySet().equals(Set.of("longitude", "latitude", "radiusMeters"))
                    || parameters.values().stream().anyMatch(values -> values.size() != 1))
                throw new IllegalArgumentException();
            center = new Coordinates(Double.parseDouble(parameters.getFirst("longitude")), Double.parseDouble(parameters.getFirst("latitude")));
            radius = Integer.parseInt(parameters.getFirst("radiusMeters"));
        } catch (IllegalArgumentException failure) {
            throw new InvalidQueryException("Informe centro WGS84 e raio inteiro entre 1 e 5000 metros.");
        }
        // AccessBoundary requires a complete session before this method runs (also for USER).
        var snapshot = service.snapshot(center, radius);
        var items = snapshot.items().stream().map(entry -> new Item(OccurrenceView.from(entry.occurrence()),
                entry.occurrence().situation() == OccurrenceSituation.ONGOING && entry.validity() != ActiveReportQueryService.Validity.CONFIRMED
                        ? OccurrenceSituation.UNKNOWN : entry.occurrence().situation(), entry.validity())).toList();
        auth.getObject().auditActiveReports(UUID.fromString((String) request.getAttribute("vu.account")), items.size());
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore())
                .body(new Response(snapshot.evaluatedAt(), "Vigência depende de configuração e evidência explícitas; esta leitura não persiste transições nem confirma andamento por si só.", items));
    }
}
