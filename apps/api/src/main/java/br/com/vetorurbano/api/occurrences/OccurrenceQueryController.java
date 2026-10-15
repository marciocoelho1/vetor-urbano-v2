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

    public OccurrenceQueryController(OccurrenceQueryParser parser, OccurrenceQueryService service) {
        this.parser = parser;
        this.service = service;
    }

    @GetMapping
    public OccurrenceQueryResponse find(@RequestParam MultiValueMap<String, String> parameters) {
        return service.find(parser.parse(parameters));
    }
}
