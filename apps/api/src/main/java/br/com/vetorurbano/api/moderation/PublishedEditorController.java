package br.com.vetorurbano.api.moderation;

import java.util.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;
import br.com.vetorurbano.api.corrections.CorrectionController;

/** Ticket 18: ADMIN with complete MFA prepares, approves or discards a correction/withdrawal of a publication. */
@RestController
@RequestMapping("/api/v1/admin/corrections/{id}/publication")
@Profile("local")
@ConditionalOnProperty(name="vetor.accounts.enabled",havingValue="true")
public class PublishedEditorController {
    private final PublishedEditorService service;
    public PublishedEditorController(PublishedEditorService service){this.service=service;}
    @GetMapping public Object find(@PathVariable UUID id,HttpServletRequest request){return service.find(id,CorrectionController.actor(request));}
    @PostMapping("/preparations") public Object prepare(@PathVariable UUID id,@RequestBody Map<String,Object> body,HttpServletRequest request){CorrectionController.csrf(request);return service.prepare(id,CorrectionController.actor(request),body);}
    @PostMapping("/decisions") public Object decide(@PathVariable UUID id,@RequestBody Map<String,Object> body,HttpServletRequest request){CorrectionController.csrf(request);return service.decide(id,CorrectionController.actor(request),body);}
}
