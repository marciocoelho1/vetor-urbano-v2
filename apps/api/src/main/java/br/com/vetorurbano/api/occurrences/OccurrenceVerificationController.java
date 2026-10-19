package br.com.vetorurbano.api.occurrences;

import java.util.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import br.com.vetorurbano.api.corrections.CorrectionController;

@RestController
@RequestMapping("/api/v1/active-reports")
public class OccurrenceVerificationController {
    private final OccurrenceVerificationService service;
    public OccurrenceVerificationController(OccurrenceVerificationService service){this.service=service;}
    @GetMapping("/expired") public Object expired(HttpServletRequest request){return service.expired(CorrectionController.actor(request));}
    @GetMapping("/{id}/verification") public Object read(@PathVariable String id,HttpServletRequest request){return service.read(id,CorrectionController.actor(request));}
    @PostMapping("/{id}/verification") public Object confirm(@PathVariable String id,@RequestBody Map<String,Object> body,HttpServletRequest request){CorrectionController.csrf(request);return service.confirm(id,CorrectionController.actor(request),body);}
}
