package br.com.vetorurbano.api.corrections;

import java.util.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import br.com.vetorurbano.api.auth.*;

@RestController
@RequestMapping("/api/v1")
@Profile("local")
@ConditionalOnProperty(name="vetor.accounts.enabled",havingValue="true")
public class CorrectionController {
    private final CorrectionService service;
    public CorrectionController(CorrectionService service){this.service=service;}
    public static UUID actor(HttpServletRequest request){return UUID.fromString((String)request.getAttribute("vu.account"));}
    public static void csrf(HttpServletRequest request){if(!AuthService.validCsrf(AuthController.token(request),request.getHeader("X-CSRF-Token")))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Recarregue a sessão.");}
    @GetMapping("/corrections") public Object mine(HttpServletRequest request){return Map.of("items",service.list(actor(request),false));}
    @GetMapping("/corrections/{id}") public Object find(@PathVariable UUID id,HttpServletRequest request){return service.find(id,actor(request),false);}
    @PostMapping("/corrections") public ResponseEntity<?> create(@RequestBody Map<String,Object> body,HttpServletRequest request){csrf(request);return ResponseEntity.status(201).body(service.create(body,actor(request)));}
    @GetMapping("/admin/corrections") public Object queue(HttpServletRequest request){return Map.of("items",service.list(actor(request),true));}
    @GetMapping("/admin/corrections/{id}") public Object adminFind(@PathVariable UUID id,HttpServletRequest request){return service.find(id,actor(request),true);}
    @PostMapping("/admin/corrections/{id}/minimization") public Object minimize(@PathVariable UUID id,@RequestBody Map<String,Object> body,HttpServletRequest request){csrf(request);return service.minimize(id,body,actor(request));}
    @PostMapping("/admin/corrections/{id}/decisions") public Object decide(@PathVariable UUID id,@RequestBody Map<String,Object> body,HttpServletRequest request){csrf(request);return service.decide(id,body,actor(request));}
}
