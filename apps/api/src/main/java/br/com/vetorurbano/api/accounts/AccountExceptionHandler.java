package br.com.vetorurbano.api.accounts;

import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.transaction.TransactionException;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import org.springframework.core.annotation.Order;
import org.springframework.core.Ordered;

@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = AccountController.class)
public class AccountExceptionHandler {
    @ExceptionHandler({DataAccessException.class, TransactionException.class})
    ResponseEntity<Map<String,String>> unavailable(RuntimeException exception) {
        // Never log SQL exception text or rejected request bodies from credential endpoints.
        return AccountController.respond(new AccountResult(503,"ACCOUNTS_UNAVAILABLE",
            "O serviço local de contas está indisponível. Tente novamente; a operação não foi confirmada."));
    }
    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<Map<String,String>> invalid(HttpMessageNotReadableException exception) {
        return AccountController.respond(AccountResult.invalid());
    }
}
