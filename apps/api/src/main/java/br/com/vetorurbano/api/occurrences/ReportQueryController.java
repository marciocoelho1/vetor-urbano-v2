package br.com.vetorurbano.api.occurrences;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.util.MultiValueMap;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import br.com.vetorurbano.api.auth.AuthService;
import br.com.vetorurbano.api.auth.AuthController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/reports")
public class ReportQueryController {
    private final OccurrenceQueryParser parser;
    private final OccurrenceQueryService service;
    private final ObjectProvider<br.com.vetorurbano.api.auth.AuthService> auth;

    public ReportQueryController(
            OccurrenceQueryParser parser,
            OccurrenceQueryService service,
            ObjectProvider<br.com.vetorurbano.api.auth.AuthService> auth) {
        this.parser = parser;
        this.service = service;
        this.auth = auth;
    }

    @GetMapping("/occurrences")
    public OccurrenceQueryResponse generate(
            @RequestParam MultiValueMap<String, String> parameters,
            HttpServletRequest request) {
        var query = parser.parse(parameters);
        var result = service.find(query);
        var account = UUID.fromString((String) request.getAttribute("vu.account"));
        auth.getObject().auditReportGeneration(account, query, result.counts());
        return result;
    }

    @GetMapping("/occurrences/export")
    public OccurrenceQueryResponse export(
            @RequestParam MultiValueMap<String, String> parameters,
            HttpServletRequest request) {
        var query = parser.parse(parameters);
        var result = service.find(query);
        var account = UUID.fromString((String) request.getAttribute("vu.account"));
        auth.getObject().auditReportExport(account, query, result.counts());
        return result;
    }
    public record PdfExportRequest(Instant generatedAt, OccurrenceQueryCounts counts, String outcome) {}

    @PostMapping("/exports/pdf")
    public ResponseEntity<?> recordPdfExport(@RequestParam MultiValueMap<String, String> parameters,
            @RequestBody PdfExportRequest body, HttpServletRequest request,
            @RequestHeader(value = "X-CSRF-Token", required = false) String csrf) {
        if (!AuthService.validCsrf(AuthController.token(request), csrf))
            return ResponseEntity.status(403).body(Map.of("code", "CSRF_REQUIRED", "message", "Recarregue a sessão e tente novamente."));
        var query = parser.parse(parameters);
        var counts = body.counts();
        if (body.generatedAt() == null || body.outcome() == null || !Set.of("SUCCEEDED", "FAILED").contains(body.outcome()) || counts == null
                || counts.occurrences() < 0 || counts.occurrences() > 9_007_199_254_740_991L
                || counts.happenings() < 0 || counts.happenings() > counts.occurrences()
                || counts.mappedOccurrences() < 0 || counts.mappedOccurrences() > counts.occurrences()
                || counts.listOnlyOccurrences() < 0 || counts.listOnlyOccurrences() > counts.occurrences()
                || counts.mappedOccurrences() + counts.listOnlyOccurrences() != counts.occurrences()
                || counts.temporallyCertain() < 0 || counts.temporallyCertain() > counts.occurrences()
                || counts.temporallyPossible() < 0 || counts.temporallyPossible() > counts.occurrences()
                || counts.temporallyCertain() + counts.temporallyPossible() > counts.occurrences())
            throw new InvalidQueryException("Metadados do snapshot PDF inválidos.");
        auth.getObject().auditPdfExport(UUID.fromString((String) request.getAttribute("vu.account")), query, counts, body.generatedAt(), body.outcome());
        return ResponseEntity.ok(Map.of("code", "PDF_EXPORT_RECORDED"));
    }

}
