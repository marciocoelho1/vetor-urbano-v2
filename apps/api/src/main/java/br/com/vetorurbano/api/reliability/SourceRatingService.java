package br.com.vetorurbano.api.reliability;

import br.com.vetorurbano.api.corrections.CorrectionService;
import br.com.vetorurbano.api.sources.SourceService;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Ticket 24: recomendação mensal sobre a nota da fonte a partir dos resultados verificados.
 *
 * <p>Parâmetros aprovados em 22/10/2026: janela acumulada de 90 dias, amostra mínima de 10 afirmações
 * aplicáveis, descer só com ≥30% de demonstradas incorretas e ≥3 casos, subir só com ≥20 verificações
 * e nenhuma incorreta. Erro de extração/cadastro do sistema fica fora da amostra e nunca rebaixa a
 * fonte; inconclusivo não pune; amostra insuficiente não produz recomendação. A decisão é humana,
 * versionada e justificada, e a nota antiga das ocorrências não é trocada em silêncio.
 */
@Service
@Profile("local")
@ConditionalOnProperty(name = "vetor.accounts.enabled", havingValue = "true")
public class SourceRatingService {
    /** Parâmetros aprovados; mudar qualquer um deles exige nova rodada de decisão do responsável. */
    static final int WINDOW_DAYS = 90;
    static final int MIN_SAMPLE = 10;
    static final int DOWNGRADE_MIN_DISPROVEN = 3;
    static final double DOWNGRADE_RATIO = 0.30;
    static final int UPGRADE_MIN_SAMPLE = 20;

    private static final Set<String> RESULTS = Set.of("CONFIRMED", "DISPROVEN", "CORRECTED_BY_SOURCE",
            "INCONCLUSIVE", "SYSTEM_ERROR");

    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final SourceService sources;

    public SourceRatingService(JdbcTemplate jdbc, Clock clock, SourceService sources) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.sources = sources;
    }

    /** Registra o resultado de uma afirmação da fonte. Erro do sistema é registrado e isolado. */
    @Transactional
    public Map<String, Object> record(String sourceId, Map<String, Object> body, UUID actor) {
        if (!Set.of("statementKey", "statementExcerpt", "result", "note", "occurrenceId").containsAll(body.keySet())
                || !body.keySet().containsAll(Set.of("statementKey", "statementExcerpt", "result", "note"))) {
            throw CorrectionService.invalid("Campos da verificação inválidos.");
        }
        String result = text(body, "result", 30);
        if (!RESULTS.contains(result)) {
            throw CorrectionService.invalid("Resultado de verificação inválido.");
        }
        sources.find(sourceId);
        String occurrenceId = body.get("occurrenceId") == null ? null : text(body, "occurrenceId", 200);
        jdbc.update("""
                INSERT INTO source_statement_verifications (source_id, statement_key, statement_excerpt, result,
                    note, occurrence_id, recorded_by, recorded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, sourceId, text(body, "statementKey", 200), text(body, "statementExcerpt", 2000), result,
                text(body, "note", 2000), occurrenceId, actor, Timestamp.from(clock.instant()));
        audit(actor, "SOURCE_STATEMENT_VERIFIED", sourceId);
        return Map.of("sourceId", sourceId, "result", result,
                "message", "Resultado registrado sem alterar a nota da fonte; a recomendação é mensal.");
    }

    /** Resultados da janela acumulada, sempre com amostra e justificativa explícitas. */
    public Map<String, Object> verifications(String sourceId, UUID actor) {
        sources.find(sourceId);
        audit(actor, "SOURCE_STATEMENT_VERIFICATIONS_READ", sourceId);
        var items = jdbc.queryForList("""
                SELECT id, statement_key, statement_excerpt, result, note, occurrence_id, recorded_at
                FROM source_statement_verifications WHERE source_id=? ORDER BY recorded_at DESC, id DESC
                """, sourceId);
        return Map.of("sourceId", sourceId, "items", items);
    }

    /** Recomendação calculada no servidor a partir dos resultados guardados, nunca da tela. */
    public Map<String, Object> recommendation(String sourceId, UUID actor) {
        var source = sources.find(sourceId);
        var computed = compute(sourceId);
        audit(actor, "SOURCE_RATING_RECOMMENDATION_READ", sourceId);
        return view(sourceId, source == null ? 0 : currentRating(sourceId), computed);
    }

    /** Decisão humana: aprova a mudança (nova versão da fonte) ou recusa, sempre justificada. */
    @Transactional
    public Map<String, Object> decide(String sourceId, Map<String, Object> body, UUID actor) {
        if (!Set.of("decision", "justification").containsAll(body.keySet())) {
            throw CorrectionService.invalid("Campos da decisão inválidos.");
        }
        String decision = text(body, "decision", 20);
        if (!Set.of("APPROVED", "REJECTED").contains(decision)) {
            throw CorrectionService.invalid("Decisão inválida.");
        }
        String justification = text(body, "justification", 2000);
        if (justification.length() < 20) {
            throw CorrectionService.invalid("Justificativa da decisão precisa de pelo menos 20 caracteres.");
        }
        sources.find(sourceId);
        var computed = compute(sourceId);
        int previous = currentRating(sourceId);
        if ("APPROVED".equals(decision)) {
            if ("INSUFFICIENT_SAMPLE".equals(computed.recommendation())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Amostra insuficiente (" + computed.applicable() + " de " + MIN_SAMPLE
                                + ") não rebaixa nem sobe fonte: registre mais verificações.");
            }
            if (!Set.of("UPGRADE", "DOWNGRADE").contains(computed.recommendation())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Recomendação atual é manter: não há mudança de nota a aprovar.");
            }
        }
        Integer applied = null;
        Integer appliedVersion = null;
        if ("APPROVED".equals(decision)) {
            applied = "UPGRADE".equals(computed.recommendation())
                    ? Math.min(5, previous + 1) : Math.max(1, previous - 1);
            appliedVersion = sources.reRate(sourceId, applied, justification, actor).version();
        }
        Timestamp now = Timestamp.from(clock.instant());
        Long decisionId = jdbc.queryForObject("""
                INSERT INTO source_rating_decisions (source_id, window_start, window_end, window_days,
                    sample_applicable, sample_confirmed, sample_disproven, sample_inconclusive, sample_corrected,
                    sample_system_errors, recommendation, justification, decision, previous_rating, applied_rating,
                    applied_source_version, author_id, decided_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """, Long.class, sourceId, Timestamp.from(computed.windowStart()), Timestamp.from(computed.windowEnd()),
                WINDOW_DAYS, computed.applicable(), computed.confirmed(), computed.disproven(),
                computed.inconclusive(), computed.corrected(), computed.systemErrors(), computed.recommendation(),
                justification, decision, previous, applied, appliedVersion, actor, now);
        int flagged = 0;
        if ("APPROVED".equals(decision)) {
            flagged = jdbc.update("""
                    INSERT INTO source_reevaluation_flags (source_id, occurrence_id, decision_id, reason, created_at)
                    SELECT DISTINCT ?::text, oc.occurrence_id, ?::bigint, ?::text, ?::timestamptz
                    FROM occurrence_clippings oc
                    JOIN clippings c ON c.id = oc.clipping_id
                    JOIN occurrences o ON o.id = oc.occurrence_id
                    WHERE c.source_id = ? AND o.publication_status = 'PUBLISHED'
                    """, sourceId, decisionId,
                    "Nota da fonte mudou de " + previous + " para " + applied + "; ocorrência exige reavaliação explícita.",
                    now, sourceId);
        }
        audit(actor, "SOURCE_RATING_DECIDED", sourceId);
        return Map.of(
                "sourceId", sourceId,
                "decisionId", decisionId,
                "decision", decision,
                "recommendation", computed.recommendation(),
                "previousRating", previous,
                "appliedRating", applied == null ? previous : applied,
                "appliedSourceVersion", appliedVersion == null ? 0 : appliedVersion,
                "flaggedOccurrences", flagged,
                "message", "APPROVED".equals(decision)
                        ? "Nova versão da fonte registrada; notas antigas das ocorrências foram preservadas e sinalizadas."
                        : "Decisão registrada sem alterar a nota da fonte.");
    }

    public Map<String, Object> flags(String sourceId, UUID actor) {
        sources.find(sourceId);
        audit(actor, "SOURCE_REEVALUATION_FLAGS_READ", sourceId);
        var items = jdbc.queryForList("""
                SELECT f.id, f.occurrence_id, f.reason, f.created_at, f.resolved_at, o.reliability_score::int AS current_note
                FROM source_reevaluation_flags f JOIN occurrences o ON o.id = f.occurrence_id
                WHERE f.source_id=? ORDER BY f.created_at DESC, f.id DESC
                """, sourceId);
        return Map.of("sourceId", sourceId, "items", items);
    }

    /** Resolve o sinal depois de nova avaliação explícita da ocorrência; a nota não é tocada aqui. */
    @Transactional
    public Map<String, Object> resolve(long flagId, UUID actor) {
        int changed = jdbc.update("""
                UPDATE source_reevaluation_flags SET resolved_at=? WHERE id=? AND resolved_at IS NULL
                """, Timestamp.from(clock.instant()), flagId);
        if (changed == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Sinal inexistente ou já resolvido.");
        }
        audit(actor, "SOURCE_REEVALUATION_FLAG_RESOLVED", "flag:" + flagId);
        return Map.of("id", flagId, "resolved", true,
                "message", "Sinal resolvido; a nota da ocorrência só muda por nova avaliação.");
    }

    // --- cálculo ---

    private Computed compute(String sourceId) {
        Instant end = clock.instant();
        Instant start = end.minus(Duration.ofDays(WINDOW_DAYS));
        var sample = jdbc.queryForMap("""
                WITH latest AS (
                    SELECT DISTINCT ON (statement_key) statement_key, result
                    FROM source_statement_verifications
                    WHERE source_id=? AND recorded_at >= ? AND recorded_at < ?
                    ORDER BY statement_key, recorded_at DESC, id DESC
                )
                SELECT
                    count(*) FILTER (WHERE result IN ('CONFIRMED','DISPROVEN','CORRECTED_BY_SOURCE','INCONCLUSIVE'))::int AS applicable,
                    count(*) FILTER (WHERE result='CONFIRMED')::int AS confirmed,
                    count(*) FILTER (WHERE result='DISPROVEN')::int AS disproven,
                    count(*) FILTER (WHERE result='INCONCLUSIVE')::int AS inconclusive,
                    count(*) FILTER (WHERE result='CORRECTED_BY_SOURCE')::int AS corrected,
                    count(*) FILTER (WHERE result='SYSTEM_ERROR')::int AS system_errors
                FROM latest
                """, sourceId, Timestamp.from(start), Timestamp.from(end));
        int applicable = number(sample, "applicable");
        int confirmed = number(sample, "confirmed");
        int disproven = number(sample, "disproven");
        int inconclusive = number(sample, "inconclusive");
        int corrected = number(sample, "corrected");
        int systemErrors = number(sample, "system_errors");
        String recommendation;
        String justification;
        if (applicable < MIN_SAMPLE) {
            recommendation = "INSUFFICIENT_SAMPLE";
            justification = "Amostra de " + applicable + " afirmações aplicáveis na janela de " + WINDOW_DAYS
                    + " dias, abaixo do mínimo de " + MIN_SAMPLE + "; sem recomendação de mudança.";
        } else if (disproven >= DOWNGRADE_MIN_DISPROVEN && disproven / (double) applicable >= DOWNGRADE_RATIO) {
            recommendation = "DOWNGRADE";
            justification = disproven + " de " + applicable + " afirmações demonstradas incorretas ("
                    + Math.round(100 * disproven / (double) applicable) + "%), acima do limite de "
                    + Math.round(DOWNGRADE_RATIO * 100) + "% com pelo menos " + DOWNGRADE_MIN_DISPROVEN + " casos.";
        } else if (applicable >= UPGRADE_MIN_SAMPLE && disproven == 0) {
            recommendation = "UPGRADE";
            justification = applicable + " afirmações verificadas na janela sem nenhuma demonstrada incorreta.";
        } else {
            recommendation = "KEEP";
            justification = "Manter: " + applicable + " aplicáveis, " + confirmed + " confirmadas, " + disproven
                    + " incorretas, " + inconclusive + " inconclusivas e " + corrected
                    + " corrigidas pela fonte, sem atingir os limites de mudança.";
        }
        return new Computed(start, end, applicable, confirmed, disproven, inconclusive, corrected, systemErrors,
                recommendation, justification);
    }

    private Map<String, Object> view(String sourceId, int currentRating, Computed computed) {
        var view = new LinkedHashMap<String, Object>();
        view.put("sourceId", sourceId);
        view.put("currentRating", currentRating);
        view.put("windowDays", WINDOW_DAYS);
        view.put("windowStart", computed.windowStart());
        view.put("windowEnd", computed.windowEnd());
        view.put("sample", Map.of(
                "applicable", computed.applicable(),
                "confirmed", computed.confirmed(),
                "disproven", computed.disproven(),
                "inconclusive", computed.inconclusive(),
                "correctedBySource", computed.corrected(),
                "systemErrors", computed.systemErrors(),
                "minimum", MIN_SAMPLE));
        view.put("recommendation", computed.recommendation());
        view.put("justification", computed.justification());
        view.put("canChange", Set.of("UPGRADE", "DOWNGRADE").contains(computed.recommendation()));
        view.put("rules", Map.of(
                "minimumSample", MIN_SAMPLE,
                "upgradeMinimumSample", UPGRADE_MIN_SAMPLE,
                "downgradeMinimumDisproven", DOWNGRADE_MIN_DISPROVEN,
                "downgradeRatio", DOWNGRADE_RATIO));
        view.put("limitations",
                "Erro de extração/cadastro do sistema fica fora da amostra e não rebaixa a fonte; inconclusivo "
                        + "não pune; amostra insuficiente não produz mudança automática.");
        return view;
    }

    private int currentRating(String sourceId) {
        return jdbc.queryForObject("""
                SELECT v.rating FROM sources s JOIN source_versions v
                    ON v.source_id = s.id AND v.version = s.current_version
                WHERE s.id = ?
                """, Integer.class, sourceId);
    }

    private static int number(Map<String, Object> row, String key) {
        return row.get(key) == null ? 0 : ((Number) row.get(key)).intValue();
    }

    private static String text(Map<String, Object> body, String key, int max) {
        if (!(body.get(key) instanceof String value) || value.isBlank() || value.length() > max) {
            throw CorrectionService.invalid("Revise " + key + ".");
        }
        return value.strip();
    }

    private void audit(UUID actor, String action, String target) {
        jdbc.update("""
                INSERT INTO auth_audit_events (account_id, occurred_at, module, action, outcome, parameters)
                VALUES (?, ?, 'reliability', ?, 'SUCCEEDED', jsonb_build_object('recordId', ?::text))
                """, actor, Timestamp.from(clock.instant()), action, target);
    }

    private record Computed(Instant windowStart, Instant windowEnd, int applicable, int confirmed, int disproven,
            int inconclusive, int corrected, int systemErrors, String recommendation, String justification) {}
}
