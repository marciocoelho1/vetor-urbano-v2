package br.com.vetorurbano.api.moderation;

import java.util.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import br.com.vetorurbano.api.corrections.CorrectionController;

@RestController
@RequestMapping("/api/v1/admin/review-clippings")
@Profile("local")
@ConditionalOnProperty(name="vetor.accounts.enabled",havingValue="true")
public class ReviewController {
    private final ReviewService service;
    public ReviewController(ReviewService service){this.service=service;}
    @GetMapping public Object queue(@RequestParam(required=false) String priority,@RequestParam(required=false) String order,HttpServletRequest request){return service.queue(priority,order,CorrectionController.actor(request));}
    @GetMapping("/options") public Object options(HttpServletRequest request){return service.options(CorrectionController.actor(request));}
    @GetMapping("/{id}/history") public Object history(@PathVariable String id,HttpServletRequest request){return service.history(id,CorrectionController.actor(request));}
    @PostMapping("/{id}/decisions") public Object decide(@PathVariable String id,@RequestBody Map<String,Object> body,HttpServletRequest request){CorrectionController.csrf(request);return service.decide(id,body,CorrectionController.actor(request));}
}
