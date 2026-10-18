package br.com.vetorurbano.api.occurrences;

import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class OccurrenceQueryController {
    private final OccurrenceQueryParser parser;
    private final OccurrenceQueryService service;
    private final org.springframework.beans.factory.ObjectProvider<br.com.vetorurbano.api.auth.AuthService> auth;

    public OccurrenceQueryController(OccurrenceQueryParser parser, OccurrenceQueryService service, org.springframework.beans.factory.ObjectProvider<br.com.vetorurbano.api.auth.AuthService> auth) {
        this.auth=auth;
        this.parser = parser;
        this.service = service;
    }

    @GetMapping("/occurrences")
    public OccurrenceQueryResponse find(@RequestParam MultiValueMap<String, String> parameters, jakarta.servlet.http.HttpServletRequest request) {
        var query = parser.parse(parameters);
        return auditAndReturn(query, service.find(query), request);
    }

    @GetMapping("/occurrences/{id}")
    public Object findOne(@org.springframework.web.bind.annotation.PathVariable String id, jakarta.servlet.http.HttpServletRequest request) {
        auth.getObject().auditRecordLookup(
                java.util.UUID.fromString((String) request.getAttribute("vu.account")), id);
        return service.findOne(id);
    }

    @GetMapping("/history/occurrences")
    public OccurrenceQueryResponse findHistory(@RequestParam MultiValueMap<String, String> parameters, jakarta.servlet.http.HttpServletRequest request) {
        var query = parser.parseHistory(parameters);
        return auditAndReturn(query, service.findHistory(query), request);
    }

    private OccurrenceQueryResponse auditAndReturn(
            OccurrenceQuery query,
            OccurrenceQueryResponse result,
            jakarta.servlet.http.HttpServletRequest request) {
        auth.getObject().auditQuery(
                java.util.UUID.fromString((String) request.getAttribute("vu.account")),
                query,
                result.counts());
        return result;
    }
}
