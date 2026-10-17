package br.com.vetorurbano.api.occurrences;

import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/occurrences")
public class OccurrenceQueryController {
    private final OccurrenceQueryParser parser;
    private final OccurrenceQueryService service;
    private final org.springframework.beans.factory.ObjectProvider<br.com.vetorurbano.api.auth.AuthService> auth;

    public OccurrenceQueryController(OccurrenceQueryParser parser, OccurrenceQueryService service, org.springframework.beans.factory.ObjectProvider<br.com.vetorurbano.api.auth.AuthService> auth) {
        this.auth=auth;
        this.parser = parser;
        this.service = service;
    }

    @GetMapping
    public OccurrenceQueryResponse find(@RequestParam MultiValueMap<String, String> parameters, jakarta.servlet.http.HttpServletRequest request) {
        var query=parser.parse(parameters);
        var result=service.find(query);
        auth.getObject().auditQuery(
                java.util.UUID.fromString((String) request.getAttribute("vu.account")),
                query,
                result.counts());
        return result;
    }
}
