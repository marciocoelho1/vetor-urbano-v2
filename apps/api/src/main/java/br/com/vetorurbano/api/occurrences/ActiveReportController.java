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
    private final OccurrenceVerificationService verifications;
    public ActiveReportController(ActiveReportQueryService service, ObjectProvider<AuthService> auth, OccurrenceVerificationService verifications) {
        this.service = service; this.auth = auth;this.verifications=verifications;
    }
    public record Item(OccurrenceView occurrence, OccurrenceSituation effectiveSituation, ActiveReportQueryService.Validity validity, OccurrenceVerificationService.VerificationSummary verification) {}
    public record Response(Instant evaluatedAt, String limitation, List<Item> items) {}

    @GetMapping
    @org.springframework.transaction.annotation.Transactional(isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
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
        var items = snapshot.items().stream().map(entry -> {
            var effective=entry.occurrence().situation()==OccurrenceSituation.ONGOING && entry.validity()!=ActiveReportQueryService.Validity.CONFIRMED?OccurrenceSituation.UNKNOWN:entry.occurrence().situation();
            var verification=verifications.summary(entry.occurrence().id());
            return new Item(OccurrenceView.from(entry.occurrence(),effective,verification),effective,entry.validity(),verification);
        }).toList();
        auth.getObject().auditActiveReports(UUID.fromString((String) request.getAttribute("vu.account")), items.size());
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore())
                .body(new Response(snapshot.evaluatedAt(), "Vigência depende da última verificação humana da versão atual. Expiração indica insuficiência, nunca encerramento; esta leitura preserva a situação armazenada.", items));
    }
}
