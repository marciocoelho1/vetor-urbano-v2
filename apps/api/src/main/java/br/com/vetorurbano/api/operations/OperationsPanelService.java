package br.com.vetorurbano.api.operations;

import br.com.vetorurbano.api.occurrences.OccurrenceVerificationService;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ticket 22: leitura do estado real de operação — conectores de coleta e espera da fila de revisão.
 *
 * <p>Três regras de honestidade guiam este painel:
 * <ul>
 *   <li>fonte não configurada, conector pausado, execução sem novidades e falha de alimentação são
 *       estados distintos — nenhum deles vira «zero ocorrências»;</li>
 *   <li>a janela de antecedência das confirmações vem de configuração explícita; ausente, o painel
 *       responde {@code NOT_CONFIGURED} em vez de inventar prazo;</li>
 *   <li>a leitura é agregada (três consultas e um agregado de confirmações) e não copia conteúdo de
 *       ocorrência, credencial ou atributo pessoal.</li>
 * </ul>
 */
@Service
public class OperationsPanelService {

    /** Propriedade que define a antecedência considerada «próxima de expirar». */
    public static final String EXPIRY_WINDOW_PROPERTY = "vetor.operations.expiry-window";

    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final Duration expiryWindow;

    public OperationsPanelService(JdbcTemplate jdbc, Clock clock, Environment environment) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.expiryWindow = parseWindow(environment.getProperty(EXPIRY_WINDOW_PROPERTY, String.class));
    }

    private static Duration parseWindow(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        var parsed = org.springframework.boot.convert.DurationStyle.detectAndParse(value.strip());
        return parsed.isNegative() || parsed.isZero() ? null : parsed;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Map<String, Object> panel() {
        var at = clock.instant();
        var body = new LinkedHashMap<String, Object>();
        body.put("generatedAt", at);
        body.put("sources", sources());
        body.put("queue", queue(at));
        body.put("confirmations", confirmations(at));
        body.put("limitations",
                "Estado do ambiente local sintético: não comprova coleta real, cobertura, SLA ou "
                        + "prontidão operacional. Falha de conector nunca é lida como ausência de ocorrências.");
        return body;
    }

    private Map<String, Object> sources() {
        var rows = jdbc.queryForList("""
                SELECT cs.source_id,
                       s.public_name,
                       s.provenance ->> 'credit' AS credit,
                       s.provenance ->> 'attribution' AS attribution,
                       cs.paused,
                       cs.window_start,
                       cs.window_end,
                       cs.poll_seconds,
                       cs.last_attempt_at,
                       cs.last_success_at,
                       cs.last_error_class,
                       r.id AS run_id,
                       r.kind AS run_kind,
                       r.state AS run_state,
                       r.error_class AS run_error_class,
                       r.pages_done,
                       r.items_seen,
                       r.items_created,
                       r.items_duplicated,
                       r.finished_at
                FROM collection_sources cs
                JOIN sources s ON s.id = cs.source_id
                LEFT JOIN LATERAL (
                    SELECT * FROM collection_runs cr
                    WHERE cr.source_id = cs.source_id
                    ORDER BY cr.started_at DESC, cr.id
                    LIMIT 1
                ) r ON true
                ORDER BY cs.source_id
                """);
        var items = new ArrayList<Map<String, Object>>();
        for (var row : rows) {
            var item = new LinkedHashMap<String, Object>();
            item.put("id", row.get("source_id"));
            item.put("name", row.get("public_name"));
            item.put("credit", row.get("credit"));
            item.put("attribution", row.get("attribution"));
            boolean paused = Boolean.TRUE.equals(row.get("paused"));
            item.put("paused", paused);
            item.put("windowStart", localDate(row.get("window_start")));
            item.put("windowEnd", localDate(row.get("window_end")));
            item.put("pollSeconds", row.get("poll_seconds"));
            item.put("lastAttemptAt", instant(row.get("last_attempt_at")));
            item.put("lastSuccessAt", instant(row.get("last_success_at")));
            item.put("lastErrorClass", row.get("last_error_class"));
            item.put("lastRun", lastRun(row));
            var assessment = assessment(paused, row);
            item.put("assessment", assessment.get("state"));
            item.put("assessmentLabel", assessment.get("label"));
            item.put("detail", assessment.get("detail"));
            items.add(item);
        }
        var result = new LinkedHashMap<String, Object>();
        result.put("state", items.isEmpty() ? "NOT_CONFIGURED" : "CONFIGURED");
        result.put("items", items);
        if (items.isEmpty()) {
            result.put("label", "Nenhuma fonte de coleta configurada");
            result.put("detail", "Coleta não configurada não é falha nem ausência de ocorrências: "
                    + "não há conector para observar.");
        }
        return result;
    }

    private static Map<String, Object> lastRun(Map<String, Object> row) {
        if (row.get("run_id") == null) {
            return null;
        }
        var run = new LinkedHashMap<String, Object>();
        run.put("id", row.get("run_id").toString());
        run.put("kind", row.get("run_kind"));
        run.put("state", row.get("run_state"));
        run.put("errorClass", row.get("run_error_class"));
        run.put("pagesDone", row.get("pages_done"));
        run.put("itemsSeen", row.get("items_seen"));
        run.put("itemsCreated", row.get("items_created"));
        run.put("itemsDuplicated", row.get("items_duplicated"));
        run.put("finishedAt", instant(row.get("finished_at")));
        return run;
    }

    /** Falha de alimentação e sucesso sem novidades precisam de estados e textos distintos. */
    private static Map<String, Object> assessment(boolean paused, Map<String, Object> row) {
        var result = new LinkedHashMap<String, Object>();
        var attempt = (Timestamp) row.get("last_attempt_at");
        var success = (Timestamp) row.get("last_success_at");
        var errorClass = (String) row.get("last_error_class");
        var runState = (String) row.get("run_state");
        if (paused) {
            return state(result, "PAUSED", "Fonte pausada",
                    "O conector está pausado por decisão administrativa; o histórico abaixo é o último observado.");
        }
        if (attempt == null) {
            return state(result, "NEVER_ATTEMPTED", "Nenhuma tentativa registrada",
                    "A fonte está configurada, mas ainda não houve execução. Não indica ausência de ocorrências.");
        }
        if (errorClass != null && (success == null || attempt.toInstant().isAfter(success.toInstant()))) {
            return state(result, "FAILING", "Falha de alimentação: " + errorLabel(errorClass),
                    "A última tentativa falhou e não houve sucesso posterior. O painel não converte "
                            + "essa falha em nenhuma ocorrência.");
        }
        if ("RUNNING".equals(runState)) {
            return state(result, "RUNNING", "Execução em andamento",
                    "Há uma execução em andamento; os totais são os já persistidos.");
        }
        if ("PARTIAL".equals(runState)) {
            return state(result, "PARTIAL", "Execução parcial",
                    "A execução parou no limite ou em falha no meio da janela; há cursor para retomada.");
        }
        if ("SUCCEEDED_NO_CHANGES".equals(runState)) {
            return state(result, "UP_TO_DATE_NO_NEW_ITEMS", "Sem novidades na última execução",
                    "A última execução foi bem-sucedida e nenhuma publicação nova apareceu. "
                            + "Isso é sucesso, não falha de alimentação.");
        }
        if ("SUCCEEDED_NEW_ITEMS".equals(runState)) {
            return state(result, "NEW_ITEMS", "Novas publicações coletadas",
                    "A última execução foi bem-sucedida e criou itens que aguardam revisão humana.");
        }
        return state(result, "IDLE", "Sem execução recente",
                "Não há execução correspondente aos parâmetros atuais; nenhuma conclusão sobre a fonte.");
    }

    private static Map<String, Object> state(Map<String, Object> target, String state, String label, String detail) {
        target.put("state", state);
        target.put("label", label);
        target.put("detail", detail);
        return target;
    }

    private static String errorLabel(String errorClass) {
        return switch (errorClass) {
            case "AUTH_FAILED" -> "credencial recusada";
            case "RATE_LIMITED" -> "limite de taxa da fonte";
            case "UPSTREAM_UNAVAILABLE" -> "fonte indisponível";
            case "UPSTREAM_BLOCKED" -> "acesso bloqueado pela borda da fonte";
            case "INVALID_RESPONSE" -> "resposta inválida da fonte";
            default -> errorClass;
        };
    }

    private Map<String, Object> queue(Instant at) {
        var row = jdbc.queryForMap("""
                SELECT count(*) AS pending,
                       count(*) FILTER (WHERE priority = 'HIGH') AS high_priority,
                       min(queued_at) AS oldest,
                       coalesce(max(extract(epoch FROM (?::timestamptz - queued_at))), 0)::bigint AS longest_wait
                FROM clipping_reviews
                WHERE state = 'PENDING'
                """, Timestamp.from(at));
        long pending = number(row.get("pending"));
        var result = new LinkedHashMap<String, Object>();
        result.put("pending", pending);
        result.put("highPriority", number(row.get("high_priority")));
        result.put("oldestQueuedAt", instant(row.get("oldest")));
        result.put("longestWaitSeconds", number(row.get("longest_wait")));
        result.put("state", pending == 0 ? "EMPTY" : "HAS_PENDING");
        result.put("label", pending == 0
                ? "Fila de revisão vazia"
                : pending + " item(ns) aguardando revisão humana");
        return result;
    }

    private Map<String, Object> confirmations(Instant at) {
        var types = new ArrayList<String>();
        for (var row : jdbc.queryForList("""
                SELECT DISTINCT occurrence_type
                FROM occurrences
                WHERE publication_status = 'PUBLISHED' AND situation = 'ONGOING'
                ORDER BY occurrence_type
                """, String.class)) {
            types.add(row);
        }
        var withoutDeadline = new TreeSet<String>();
        var withoutAutomaticExtension = new TreeSet<String>();
        for (var type : types) {
            if (OccurrenceVerificationService.duration(type) == null) {
                if (OccurrenceVerificationService.NO_APPROVED_EXTENSION.contains(type)) {
                    withoutAutomaticExtension.add(type);
                } else {
                    withoutDeadline.add(type);
                }
            }
        }

        var result = new LinkedHashMap<String, Object>();
        result.put("ongoingTypes", List.copyOf(types));
        result.put("typesWithoutDeadline", List.copyOf(withoutDeadline));
        result.put("typesWithoutAutomaticExtension", List.copyOf(withoutAutomaticExtension));
        if (expiryWindow == null) {
            result.put("state", "NOT_CONFIGURED");
            result.put("windowSeconds", null);
            result.put("expiring", List.of());
            result.put("expired", expired(at));
            result.put("label", "Antecedência não configurada");
            result.put("detail", "Defina " + EXPIRY_WINDOW_PROPERTY
                    + " para listar confirmações próximas de expirar. Sem essa configuração o painel "
                    + "não sugere nenhum prazo.");
            return result;
        }
        var until = at.plus(expiryWindow);
        var expiring = jdbc.queryForList("""
                SELECT o.id, o.occurrence_type, o.municipality, v.confirmed_at, v.expires_at
                FROM occurrences o
                JOIN LATERAL (
                    SELECT confirmed_at, expires_at, effect_version
                    FROM occurrence_verifications
                    WHERE occurrence_id = o.id
                    ORDER BY verification_version DESC
                    LIMIT 1
                ) v ON true
                WHERE o.publication_status = 'PUBLISHED'
                  AND o.situation = 'ONGOING'
                  AND v.effect_version = o.revision
                  AND v.expires_at IS NOT NULL
                  AND v.expires_at > ?::timestamptz
                  AND v.expires_at <= ?::timestamptz
                ORDER BY v.expires_at, o.id
                LIMIT 50
                """, Timestamp.from(at), Timestamp.from(until)).stream().map(row -> {
                    var item = new LinkedHashMap<String, Object>();
                    item.put("occurrenceId", row.get("id"));
                    item.put("type", row.get("occurrence_type"));
                    item.put("municipality", row.get("municipality"));
                    item.put("confirmedAt", instant(row.get("confirmed_at")));
                    item.put("expiresAt", instant(row.get("expires_at")));
                    return (Object) item;
                }).toList();
        result.put("state", "CONFIGURED");
        result.put("windowSeconds", expiryWindow.toSeconds());
        result.put("expiring", expiring);
        result.put("expired", expired(at));
        result.put("label", expiryWindow.toHours() + " h de antecedência (" + expiring.size()
                + " confirmação(ões) próxima(s) de expirar)");
        result.put("detail", withoutDeadline.isEmpty()
                ? "Somente prazos aprovados por tipo são usados nesta lista."
                : "Tipos sem prazo aprovado não aparecem como expirando: "
                        + String.join(", ", withoutDeadline) + ".");
        return result;
    }

    private long expired(Instant at) {
        var value = jdbc.queryForObject("""
                SELECT count(*)
                FROM occurrences o
                JOIN LATERAL (
                    SELECT expires_at, effect_version
                    FROM occurrence_verifications
                    WHERE occurrence_id = o.id
                    ORDER BY verification_version DESC
                    LIMIT 1
                ) v ON true
                WHERE o.publication_status = 'PUBLISHED'
                  AND o.situation = 'ONGOING'
                  AND v.effect_version = o.revision
                  AND v.expires_at IS NOT NULL
                  AND v.expires_at <= ?::timestamptz
                """, Long.class, Timestamp.from(at));
        return value == null ? 0 : value;
    }

    private static long number(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
    }

    private static String instant(Object value) {
        return value instanceof Timestamp timestamp ? timestamp.toInstant().toString() : null;
    }

    private static String localDate(Object value) {
        return value instanceof java.sql.Date date ? date.toLocalDate().toString() : null;
    }
}
