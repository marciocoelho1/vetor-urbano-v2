package br.com.vetorurbano.api.auth;

import java.util.Map;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;

@RestControllerAdvice(assignableTypes=AuthController.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
public class AuthExceptionHandler {
    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    ResponseEntity<?> malformed() { return ResponseEntity.badRequest().cacheControl(CacheControl.noStore()).body(Map.of("code","INVALID_REQUEST","message","Requisição inválida.")); }
    @ExceptionHandler({org.springframework.dao.DataAccessException.class,org.springframework.transaction.TransactionException.class,IllegalStateException.class})
    ResponseEntity<?> unavailable() { return ResponseEntity.status(503).cacheControl(CacheControl.noStore()).body(Map.of("code","ACCESS_UNAVAILABLE","message","Serviço de acesso indisponível. Tente novamente.")); }
}
