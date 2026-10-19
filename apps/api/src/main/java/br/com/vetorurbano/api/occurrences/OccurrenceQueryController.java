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
    public Object find(@RequestParam MultiValueMap<String, String> parameters, jakarta.servlet.http.HttpServletRequest request) {
        var check = checkUpdates(parameters);
        var query = parser.parse(parameters);
        var result = auditAndReturn(query, service.find(query), request);
        return response(result, check);
    }

    @GetMapping("/occurrences/{id}")
    public Object findOne(@org.springframework.web.bind.annotation.PathVariable String id, jakarta.servlet.http.HttpServletRequest request) {
        auth.getObject().auditRecordLookup(
                java.util.UUID.fromString((String) request.getAttribute("vu.account")), id);
        return service.findOne(id);
    }

    @GetMapping("/history/occurrences")
    public Object findHistory(@RequestParam MultiValueMap<String, String> parameters, jakarta.servlet.http.HttpServletRequest request) {
        var check = checkUpdates(parameters);
        var query = parser.parseHistory(parameters);
        var result = auditAndReturn(query, service.findHistory(query), request);
        return response(result, check);
    }

    private static boolean checkUpdates(MultiValueMap<String, String> parameters) {
        var values = parameters.remove("checkUpdates");
        if (values == null) return false;
        if (values.size() != 1 || !java.util.Set.of("true", "false").contains(values.getFirst()))
            throw new InvalidQueryException("checkUpdates aceita true ou false uma única vez.");
        return "true".equals(values.getFirst());
    }

    private static Object response(OccurrenceQueryResponse result, boolean check) {
        Object body = check ? java.util.Map.of("checkedAt", result.generatedAt(), "revision", result.revision()) : result;
        return org.springframework.http.ResponseEntity.ok().header("Cache-Control", "no-store").body(body);
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
