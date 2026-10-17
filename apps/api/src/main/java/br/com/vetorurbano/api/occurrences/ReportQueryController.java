package br.com.vetorurbano.api.occurrences;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
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
}
