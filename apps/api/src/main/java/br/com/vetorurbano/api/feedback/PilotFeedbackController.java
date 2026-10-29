package br.com.vetorurbano.api.feedback;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * UXH-20 — coleta de feedback do piloto.
 *
 * <p>Sem listagem nesta entrega: o ticket pede coleta, não painel. A sessão é a mesma das
 * demais rotas (cookie), mas o envio também aceita visitante — nesse caso {@code account_id}
 * fica nulo. Nada além do que o formulário envia é gravado: sem captura de sessão, sem
 * localização, sem imagem.
 */
@RestController
@RequestMapping("/api/v1/feedback")
public class PilotFeedbackController {

    private static final int MESSAGE_MAX = 2000;
    private static final int PER_WINDOW = 5;
    private static final Duration WINDOW = Duration.ofMinutes(1);

    private final NamedParameterJdbcTemplate jdbc;
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    public PilotFeedbackController(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record Request(Integer rating, String message, Boolean contactOptIn, String route) {}

    public record Created(UUID id) {}

    @PostMapping
    public ResponseEntity<?> submit(@RequestBody Request body, HttpServletRequest request) {
        String account = (String) request.getAttribute("vu.account");
        String bucket = account != null ? "account:" + account : "ip:" + request.getRemoteAddr();
        if (!withinLimit(bucket)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("code", "FEEDBACK_LIMITED", "message", "Limite de envios atingido. Tente mais tarde."));
        }

        int rating = body == null || body.rating() == null ? 0 : body.rating();
        if (rating < 1 || rating > 5) {
            return ResponseEntity.badRequest()
                    .body(Map.of("code", "FEEDBACK_RATING", "message", "Escolha uma nota de 1 a 5."));
        }
        String message = body.message() == null ? "" : body.message().trim();
        if (message.isEmpty() || message.length() > MESSAGE_MAX) {
            return ResponseEntity.badRequest()
                    .body(Map.of("code", "FEEDBACK_MESSAGE", "message", "Escreva um comentário de 1 a 2000 caracteres."));
        }
        String route = body.route() == null ? "" : body.route().trim();
        if (route.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("code", "FEEDBACK_ROUTE", "message", "Informe a tela de origem."));
        }

        UUID id = UUID.randomUUID();
        MapSqlParameterSource parameters = new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("accountId", account == null ? null : UUID.fromString(account))
                .addValue("route", route)
                .addValue("rating", rating)
                .addValue("message", message)
                .addValue("contactOptIn", Boolean.TRUE.equals(body.contactOptIn()));
        jdbc.update(
                """
                INSERT INTO pilot_feedback (id, account_id, route, rating, message, contact_opt_in)
                VALUES (:id, :accountId, :route, :rating, :message, :contactOptIn)
                """,
                parameters);
        return ResponseEntity.status(HttpStatus.CREATED).body(new Created(id));
    }

    private boolean withinLimit(String bucket) {
        Instant now = Instant.now();
        Bucket current = buckets.computeIfAbsent(bucket, key -> new Bucket(now));
        synchronized (current) {
            if (Duration.between(current.windowStart, now).compareTo(WINDOW) > 0) {
                current.windowStart = now;
                current.count = 0;
            }
            if (current.count >= PER_WINDOW) return false;
            current.count++;
            return true;
        }
    }

    private static final class Bucket {
        private Instant windowStart;
        private int count;

        private Bucket(Instant windowStart) {
            this.windowStart = windowStart;
        }
    }
}
