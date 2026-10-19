package br.com.vetorurbano.api.occurrences;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class OccurrenceQueryExceptionHandler {
    private static final Logger LOGGER = LoggerFactory.getLogger(OccurrenceQueryExceptionHandler.class);

    @ExceptionHandler(PdfExportService.SnapshotUnavailableException.class)
    public ResponseEntity<?> snapshotUnavailable() {
        return ResponseEntity.status(HttpStatus.CONFLICT).header("Cache-Control", "no-store")
                .body(java.util.Map.of("code", "SNAPSHOT_UNAVAILABLE", "message", "Uma ocorrência do snapshot não está mais publicada. Atualize o relatório."));
    }

    @ExceptionHandler(InvalidQueryException.class)
    public ResponseEntity<ApiErrorResponse> invalidQuery(InvalidQueryException exception) {
        return ResponseEntity.badRequest()
                .body(new ApiErrorResponse(new ApiErrorDetail("INVALID_QUERY", exception.getMessage())));
    }

    @ExceptionHandler({DataAccessException.class, org.springframework.transaction.TransactionException.class, ActiveReportQueryService.PolicyUnavailableException.class})
    public ResponseEntity<ApiErrorResponse> queryUnavailable(RuntimeException exception) {
        LOGGER.error("Occurrence query failed; returning unavailable instead of an empty result", exception);
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).header("Cache-Control", "no-store")
                .body(new ApiErrorResponse(new ApiErrorDetail(
                        "QUERY_UNAVAILABLE",
                        "A consulta está indisponível no momento; a falha não significa ausência de ocorrências.")));
    }
}
