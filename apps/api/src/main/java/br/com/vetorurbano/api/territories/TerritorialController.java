package br.com.vetorurbano.api.territories;

import java.util.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import br.com.vetorurbano.api.corrections.CorrectionController;

@RestController
@RequestMapping("/api/v1")
@Profile("local")
@ConditionalOnProperty(name="vetor.accounts.enabled",havingValue="true")
public class TerritorialController {
    private final TerritorialService service;
    public TerritorialController(TerritorialService service){this.service=service;}
    @GetMapping("/risk-areas") public Object approved(HttpServletRequest request){return Map.of("items",service.list(false,CorrectionController.actor(request)));}
    @GetMapping("/admin/risk-areas") public Object latest(HttpServletRequest request){return Map.of("items",service.list(true,CorrectionController.actor(request)));}
    @GetMapping("/admin/risk-areas/{id}") public Object history(@PathVariable UUID id,HttpServletRequest request){return Map.of("items",service.history(id,CorrectionController.actor(request)));}
    @PostMapping("/admin/risk-areas/{id}/versions") public Object revise(@PathVariable UUID id,@RequestBody Map<String,Object> body,HttpServletRequest request){CorrectionController.csrf(request);return service.revise(id,body,CorrectionController.actor(request));}
    @PostMapping("/admin/risk-areas/{id}/approvals") public Object approve(@PathVariable UUID id,@RequestBody Map<String,Object> body,HttpServletRequest request){CorrectionController.csrf(request);return service.approve(id,body,CorrectionController.actor(request));}
    @ExceptionHandler(OptimisticLockingFailureException.class) public ResponseEntity<?> conflict(){return ResponseEntity.status(409).body(Map.of("code","TERRITORY_CONFLICT","message","Versão territorial mudou. Recarregue antes de decidir."));}
    @ExceptionHandler(org.springframework.jdbc.UncategorizedSQLException.class)
    public ResponseEntity<?> spatialFailure(org.springframework.jdbc.UncategorizedSQLException failure) {
        // PostGIS reports malformed rings/coordinates as XX000, not an integrity violation.
        // Keep genuine outages distinct; never turn them into an empty successful query.
        if("XX000".equals(failure.getSQLException().getSQLState()) && failure.getSql()!=null
                && (failure.getSql().contains("ST_GeomFromEWKT")||failure.getSql().contains("ST_GeomFromGeoJSON"))) return invalid();
        return ResponseEntity.status(503).body(Map.of("code","TERRITORY_UNAVAILABLE","message","Serviço territorial indisponível. Tente novamente."));
    }
    @ExceptionHandler({DataIntegrityViolationException.class,InvalidDataAccessApiUsageException.class}) public ResponseEntity<?> invalid(){return ResponseEntity.badRequest().body(Map.of("code","INVALID_TERRITORY","message","Revise geometria, fonte e detalhes territoriais."));}
}
