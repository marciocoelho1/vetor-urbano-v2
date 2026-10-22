package br.com.vetorurbano.api.reliability;

import br.com.vetorurbano.api.corrections.CorrectionService;
import java.sql.Timestamp;
import java.text.Normalizer;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Ticket 23: avaliação de confiabilidade com regra calibrada e versionada.
 *
 * <p>O resultado público é apenas a nota 1–5; os fatores que a produziram ficam internos. A regra é
 * imutável por versão, então repetir a avaliação com os mesmos dados e a mesma versão devolve a
 * mesma nota, e trocar de versão nunca reescreve uma nota histórica em silêncio.
 */
@Service
@Profile("local")
@ConditionalOnProperty(name = "vetor.accounts.enabled", havingValue = "true")
public class ReliabilityService {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final Set<String> BODY_FIELDS = Set.of("evaluationKey", "ruleVersion");
    /** jsonb só é legível como texto: o driver devolve PGobject, não String. */
    private static final String EVALUATION_COLUMNS = """
            SELECT occurrence_id, evaluation_version, rule_version, note, factors::text AS factors,
                   blocking::text AS blocking, context::text AS context, state, evaluated_at
            FROM occurrence_reliability_evaluations
            """;

    private final JdbcTemplate jdbc;
    private final Clock clock;

    public ReliabilityService(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    /** Versões de regra guardadas; a última versão é a vigente para novas avaliações. */
    public Map<String, Object> rules(UUID actor) {
        audit(actor, "RELIABILITY_RULES_READ", null);
        var items = jdbc.queryForList("""
                SELECT version, parameters::text AS parameters, summary, provenance, author_id, created_at
                FROM reliability_rules ORDER BY version
                """);
        items.forEach(row -> row.put("parameters", JSON.readTree((String) row.remove("parameters"))));
        return Map.of("items", items, "currentVersion",
                items.isEmpty() ? 0 : ((Number) items.getLast().get("version")).intValue());
    }

    /** Nova versão de regra: exige a versão imediatamente seguinte e parâmetros completos. */
    @Transactional
    public Map<String, Object> publishRule(Map<String, Object> body, UUID actor) {
        if (!Set.of("version", "parameters", "summary").containsAll(body.keySet())) {
            throw CorrectionService.invalid("Campos da regra inválidos.");
        }
        int version = number(body, "version");
        if (version != currentRule().version() + 1) {
            throw CorrectionService.invalid("Regra exige a versão imediatamente seguinte à vigente.");
        }
        if (!(body.get("parameters") instanceof Map<?, ?> raw)) {
            throw CorrectionService.invalid("Parâmetros da regra são obrigatórios.");
        }
        @SuppressWarnings("unchecked") var parameters = (Map<String, Object>) raw;
        validateParameters(parameters);
        jdbc.update("""
                INSERT INTO reliability_rules (version, parameters, summary, provenance, author_id, created_at)
                VALUES (?, ?::jsonb, ?, 'ACCOUNT', ?, ?)
                """, version, JSON.writeValueAsString(parameters), text(body, "summary", 2000), actor,
                Timestamp.from(clock.instant()));
        audit(actor, "RELIABILITY_RULE_PUBLISHED", "rule:" + version);
        return Map.of("version", version,
                "message", "Nova versão vigente; avaliações anteriores mantêm a nota da versão com que foram feitas.");
    }

    /** Avaliação reprodutível de ocorrência publicada; repetir a mesma chave devolve o registro. */
    @Transactional
    public Map<String, Object> evaluate(String occurrenceId, Map<String, Object> body, UUID actor) {
        if (!BODY_FIELDS.containsAll(body.keySet())) {
            throw CorrectionService.invalid("Campos da avaliação inválidos.");
        }
        UUID key = key(body, "evaluationKey");
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtextextended(?::text,0))", key.toString());
        var occurrence = occurrence(occurrenceId, true);
        var replay = jdbc.queryForList(
                EVALUATION_COLUMNS + " WHERE occurrence_id=? AND evaluation_key=?", occurrenceId, key);
        if (!replay.isEmpty()) {
            return evaluation(replay.getFirst());
        }
        if (!"PUBLISHED".equals(occurrence.get("publication_status"))) {
            throw CorrectionService.invalid("Avaliação exige ocorrência publicada.");
        }
        Rule rule = body.get("ruleVersion") == null ? currentRule() : rule(number(body, "ruleVersion"));
        boolean conflict = essentialConflict(occurrenceId);
        Computed computed = compute(valuesFromOccurrence(occurrence), rule, supports(occurrenceId), conflict);
        int version = Optional.ofNullable(jdbc.queryForObject("""
                SELECT max(evaluation_version) FROM occurrence_reliability_evaluations WHERE occurrence_id=?
                """, Integer.class, occurrenceId)).orElse(0) + 1;
        var factors = JSON.writeValueAsString(factors(computed, rule));
        var blocking = JSON.writeValueAsString(computed.blocking());
        var context = JSON.writeValueAsString(context(computed, rule, occurrence));
        Timestamp now = Timestamp.from(clock.instant());
        jdbc.update("""
                INSERT INTO occurrence_reliability_evaluations (occurrence_id, evaluation_version, evaluation_key,
                    rule_version, note, factors, blocking, context, state, author_id, evaluated_at)
                VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, 'RECORDED', ?, ?)
                """, occurrenceId, version, key, rule.version(), computed.note(), factors, blocking, context, actor, now);
        audit(actor, "RELIABILITY_EVALUATED", occurrenceId);
        return evaluation(stored(occurrenceId, version));
    }

    /** Última avaliação registrada, com fatores internos, para conferência administrativa. */
    public Map<String, Object> latest(String occurrenceId, UUID actor) {
        var rows = jdbc.queryForList(
                EVALUATION_COLUMNS + " WHERE occurrence_id=? ORDER BY evaluation_version DESC LIMIT 1", occurrenceId);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ocorrência ainda não avaliada.");
        }
        audit(actor, "RELIABILITY_EVALUATION_READ", occurrenceId);
        return evaluation(rows.getFirst());
    }

    /** Reexecuta a mesma versão de regra sobre os dados atuais e compara com o registro guardado. */
    public Map<String, Object> reproduction(String occurrenceId, int version, UUID actor) {
        var row = stored(occurrenceId, version);
        Rule rule = rule(((Number) row.get("rule_version")).intValue());
        var occurrence = occurrence(occurrenceId, false);
        Computed computed = compute(valuesFromOccurrence(occurrence), rule, supports(occurrenceId),
                essentialConflict(occurrenceId));
        JsonNode factors = JSON.readTree((String) row.get("factors"));
        var differences = new ArrayList<String>();
        int storedNote = ((Number) row.get("note")).intValue();
        if (storedNote != computed.note()) {
            differences.add("nota: registrada " + storedNote + ", recalculada " + computed.note());
        }
        var storedBlocking = strings(JSON.readTree((String) row.get("blocking")));
        if (!storedBlocking.equals(computed.blocking())) {
            differences.add("bloqueios: registrados " + storedBlocking + ", recalculados " + computed.blocking());
        }
        if (!Objects.equals(factors.path("quality").path("status").asString(""),
                computed.quality() == null ? "NOT_INFORMED" : "INFORMED")) {
            differences.add("qualidade: registrada " + factors.path("quality").path("status").asString("")
                    + ", recalculada " + (computed.quality() == null ? "NOT_INFORMED" : "INFORMED"));
        }
        if (factors.path("corroboration").path("count").asInt() != computed.corroborationCount()) {
            differences.add("corroboração: registrada " + factors.path("corroboration").path("count").asInt()
                    + ", recalculada " + computed.corroborationCount());
        }
        audit(actor, "RELIABILITY_EVALUATION_REPRODUCED", occurrenceId);
        return Map.of(
                "occurrenceId", occurrenceId,
                "evaluationVersion", version,
                "ruleVersion", rule.version(),
                "reproduced", differences.isEmpty(),
                "storedNote", storedNote,
                "recomputedNote", computed.note(),
                "differences", differences,
                "message", differences.isEmpty()
                        ? "Mesma versão de regra e mesmos dados: a nota se reproduz."
                        : "Os dados mudaram desde o registro; a nota histórica permanece e uma nova avaliação é necessária.");
    }

    /** Publica a nota resumida. Avaliação bloqueada não publica, mesmo com nota alta. */
    @Transactional
    public Map<String, Object> publishNote(String occurrenceId, int version, UUID actor) {
        var row = stored(occurrenceId, version);
        var blocking = strings(JSON.readTree((String) row.get("blocking")));
        if (!blocking.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Avaliação bloqueada não publica nota: " + String.join(", ", blocking) + ".");
        }
        jdbc.update("""
                UPDATE occurrence_reliability_evaluations SET state='PUBLISHED', published_at=?
                WHERE occurrence_id=? AND evaluation_version=? AND state='RECORDED'
                """, Timestamp.from(clock.instant()), occurrenceId, version);
        audit(actor, "RELIABILITY_NOTE_PUBLISHED", occurrenceId);
        return Map.of(
                "occurrenceId", occurrenceId,
                "evaluationVersion", version,
                "note", ((Number) row.get("note")).intValue(),
                "message", "Nota 1–5 publicada; fórmula, rubrica e nota interna da fonte permanecem restritas.");
    }

    /** Guarda de publicação: essencial ausente e conflito essencial bloqueiam mesmo com nota alta. */
    public List<String> blockingForDraft(Map<String, Object> draft, boolean essentialConflict) {
        Rule rule = currentRule();
        return blockingOf(valuesFromDraft(draft), essentialConflict, rule);
    }

    /** Mesma guarda para associação a ocorrência já publicada. */
    public List<String> blockingForOccurrence(String occurrenceId) {
        Rule rule = currentRule();
        return blockingOf(valuesFromOccurrence(occurrence(occurrenceId, false)), essentialConflict(occurrenceId), rule);
    }

    // --- avaliação ---

    private Map<String, Object> evaluation(Map<String, Object> row) {
        return Map.of(
                "occurrenceId", row.get("occurrence_id"),
                "evaluationVersion", row.get("evaluation_version"),
                "ruleVersion", row.get("rule_version"),
                "note", row.get("note"),
                "factors", JSON.readTree((String) row.get("factors")),
                "blocking", JSON.readTree((String) row.get("blocking")),
                "context", JSON.readTree((String) row.get("context")),
                "state", row.get("state"),
                "evaluatedAt", row.get("evaluated_at"));
    }

    private Computed compute(Map<String, Object> values, Rule rule, List<Support> supports, boolean essentialConflict) {
        long windowMinutes = rule.parameters().path("reproductionWindowMinutes").asLong(120);
        Duration window = Duration.ofMinutes(windowMinutes);
        var byTitle = new LinkedHashMap<String, List<Support>>();
        for (var support : supports) {
            byTitle.computeIfAbsent(normalize(support.title()), key -> new ArrayList<>()).add(support);
        }
        var independents = new ArrayList<Support>();
        var reproductions = new ArrayList<Map<String, Object>>();
        for (var group : byTitle.values()) {
            group.sort(Comparator.comparing(Support::publishedAt).thenComparing(Support::clippingId));
            Support original = group.getFirst();
            independents.add(original);
            for (var candidate : group.subList(1, group.size())) {
                if (Duration.between(original.publishedAt(), candidate.publishedAt()).abs().compareTo(window) <= 0) {
                    reproductions.add(Map.of("clippingId", candidate.clippingId(), "sourceId", candidate.sourceId(),
                            "reproductionOf", original.clippingId(), "windowMinutes", windowMinutes));
                    continue;
                }
                independents.add(candidate);
            }
        }
        var traceable = independents.stream()
                .filter(support -> support.reference() != null && !support.reference().isBlank())
                .toList();
        Support reference = null;
        for (var support : traceable) {
            if (support.rating() == null) {
                continue;
            }
            if (reference == null || support.rating() > reference.rating()
                    || support.rating().equals(reference.rating())
                            && support.clippingId().compareTo(reference.clippingId()) < 0) {
                reference = support;
            }
        }
        var corroboratingSources = new TreeSet<String>();
        if (reference != null) {
            for (var support : traceable) {
                if (!support.sourceId().equals(reference.sourceId())) {
                    corroboratingSources.add(support.sourceId());
                }
            }
        }
        int cap = rule.parameters().path("corroborationCap").asInt(3);
        int capped = Math.min(corroboratingSources.size(), cap);
        double bonus = bonus(rule, capped);
        int neutralBase = rule.parameters().path("neutralBase").asInt(3);
        Integer quality = reference == null ? null : reference.rating();
        int base = quality == null ? neutralBase : quality;
        int note = round(base + bonus, rule);
        return new Computed(note, quality, neutralBase, base, bonus, corroboratingSources.size(), capped,
                blockingOf(values, essentialConflict, rule), reproductions, traceable, independents,
                reference == null ? null : reference.sourceId(), statuses(values, rule));
    }

    private List<String> blockingOf(Map<String, Object> values, boolean essentialConflict, Rule rule) {
        var blocking = new ArrayList<String>();
        var statuses = statuses(values, rule);
        for (var fieldRule : fieldRules(rule)) {
            String status = statuses.get(fieldRule.field());
            boolean allowed = switch (status) {
                case "INFORMED" -> true;
                case "NOT_INFORMED" -> fieldRule.allowsNotInformed();
                default -> fieldRule.allowsNotApplicable();
            };
            if (!allowed) {
                blocking.add("ESSENTIAL_" + status + ":" + fieldRule.field());
            }
        }
        if (essentialConflict) {
            blocking.add("ESSENTIAL_CONFLICT_UNRESOLVED");
        }
        return List.copyOf(blocking);
    }

    /** «Não informado» e «não se aplica» ficam visíveis e distintos; desconhecido nunca vale zero. */
    private static Map<String, String> statuses(Map<String, Object> values, Rule rule) {
        var known = markers(rule, "notInformedValues");
        var notApplicable = markers(rule, "notApplicableValues");
        var result = new LinkedHashMap<String, String>();
        for (var fieldRule : fieldRules(rule)) {
            result.put(fieldRule.field(), status(values.get(fieldRule.field()), known, notApplicable));
        }
        for (String auxiliary : List.of("subtype", "neighborhood")) {
            result.put(auxiliary, status(values.get(auxiliary), known, notApplicable));
        }
        return result;
    }

    private static List<FieldRule> fieldRules(Rule rule) {
        var rules = new ArrayList<FieldRule>();
        for (var node : rule.parameters().path("essentialFields")) {
            rules.add(new FieldRule(node.path("field").asString(), node.path("allowsNotInformed").asBoolean(false),
                    node.path("allowsNotApplicable").asBoolean(false)));
        }
        return rules;
    }

    private static List<String> markers(Rule rule, String name) {
        var values = new ArrayList<String>();
        for (var node : rule.parameters().path(name)) {
            values.add(node.asString());
        }
        return values;
    }

    private Map<String, Object> factors(Computed computed, Rule rule) {
        var factors = new LinkedHashMap<String, Object>();
        factors.put("quality", Map.of(
                "status", computed.quality() == null ? "NOT_INFORMED" : "INFORMED",
                "value", computed.quality() == null ? computed.base() : computed.quality(),
                "neutralBaseUsed", computed.quality() == null,
                "reason", computed.quality() == null
                        ? "Sem nota de fonte com referência rastreável vale o centro da escala, nunca zero."
                        : "Maior nota entre fontes independentes com referência rastreável."));
        factors.put("corroboration", Map.of(
                "status", computed.corroborationCount() == 0 ? "NOT_INFORMED" : "INFORMED",
                "count", computed.corroborationCount(),
                "capped", computed.capped(),
                "bonus", computed.bonus()));
        factors.put("divergence", Map.of(
                "status", "NOT_INFORMED",
                "penalty", 0.0,
                "effect", "BLOCKING",
                "reason", "Divergência não essencial não é sinal persistido neste incremento; conflito essencial bloqueia em vez de descontar."));
        factors.put("completeness", Map.of(
                "status", computed.blocking().isEmpty() ? "INFORMED" : "BLOCKED",
                "blocking", computed.blocking(),
                "fieldStatus", computed.fieldStatus()));
        factors.put("rounding", rule.parameters().path("rounding").asString("HALF_UP"));
        factors.put("formula", "clamp(noteRange, HALF_UP(base + bonus))");
        factors.put("notApplicableEffect",
                "Campo «não se aplica» tem efeito próprio, distinto de «não informado», e nunca vale zero.");
        return factors;
    }

    private Map<String, Object> context(Computed computed, Rule rule, Map<String, Object> occurrence) {
        var context = new LinkedHashMap<String, Object>();
        context.put("ruleVersion", rule.version());
        context.put("occurrenceRevision", occurrence.get("revision"));
        var sources = new ArrayList<Map<String, Object>>();
        for (var support : computed.independents()) {
            var item = new LinkedHashMap<String, Object>();
            item.put("clippingId", support.clippingId());
            item.put("sourceId", support.sourceId());
            item.put("sourceName", support.sourceName());
            item.put("rating", support.rating());
            item.put("traceableReference", support.reference() != null && !support.reference().isBlank());
            item.put("referenceSource", support.sourceId().equals(computed.referenceSourceId()));
            sources.add(item);
        }
        context.put("sources", sources);
        context.put("reproductions", computed.reproductions());
        context.put("publicExposure",
                "Somente a nota 1–5 é pública; fatores, fórmula e nota interna da fonte não são expostos.");
        return context;
    }

    // --- persistência ---

    private Map<String, Object> stored(String occurrenceId, int version) {
        var rows = jdbc.queryForList(
                EVALUATION_COLUMNS + " WHERE occurrence_id=? AND evaluation_version=?", occurrenceId, version);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Versão de avaliação inexistente.");
        }
        return rows.getFirst();
    }

    private Rule currentRule() {
        int version = Optional.ofNullable(jdbc.queryForObject("SELECT max(version) FROM reliability_rules", Integer.class))
                .orElse(0);
        if (version == 0) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Nenhuma regra de confiabilidade vigente; avaliação não é inventada.");
        }
        return rule(version);
    }

    private Rule rule(int version) {
        var row = jdbc.queryForMap("SELECT parameters::text AS parameters FROM reliability_rules WHERE version=?", version);
        return new Rule(version, JSON.readTree((String) row.get("parameters")));
    }

    private Map<String, Object> occurrence(String occurrenceId, boolean lock) {
        var rows = jdbc.queryForList("""
                SELECT id, revision, publication_status, title, description, category, occurrence_type, subtype,
                       situation, municipality, neighborhood, location_precision, occurred_at, occurred_from, occurred_until
                FROM occurrences WHERE id=?%s
                """.formatted(lock ? " FOR UPDATE" : ""), occurrenceId);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ocorrência inexistente.");
        }
        return rows.getFirst();
    }

    private List<Support> supports(String occurrenceId) {
        return jdbc.query("""
                SELECT c.id AS clipping_id, c.source_id, c.title, c.reference, c.source_published_at,
                       s.public_name, v.rating
                FROM occurrence_clippings oc
                JOIN clippings c ON c.id = oc.clipping_id
                JOIN sources s ON s.id = c.source_id
                LEFT JOIN source_versions v ON v.source_id = s.id AND v.version = s.current_version
                WHERE oc.occurrence_id=?
                ORDER BY c.source_published_at, c.id
                """, (result, rowNumber) -> new Support(
                        result.getString("clipping_id"),
                        result.getString("source_id"),
                        result.getString("public_name"),
                        result.getString("title"),
                        result.getString("reference"),
                        result.getTimestamp("source_published_at").toInstant(),
                        result.getObject("rating") == null ? null : result.getInt("rating")), occurrenceId);
    }

    private boolean essentialConflict(String occurrenceId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS(
                    SELECT 1 FROM clipping_reviews r
                    JOIN occurrence_clippings oc ON oc.clipping_id = r.clipping_id
                    WHERE oc.occurrence_id=? AND r.essential_conflict)
                """, Boolean.class, occurrenceId));
    }

    /** Nomes de campo da regra a partir do núcleo factual enviado pela revisão. */
    private static Map<String, Object> valuesFromDraft(Map<String, Object> draft) {
        var values = new LinkedHashMap<String, Object>();
        values.put("title", draft.get("title"));
        values.put("description", draft.get("description"));
        values.put("category", draft.get("category"));
        values.put("type", draft.get("type"));
        values.put("subtype", draft.get("subtype"));
        values.put("situation", draft.get("situation"));
        values.put("municipality", draft.get("municipality"));
        values.put("neighborhood", draft.get("neighborhood"));
        values.put("locationPrecision", draft.get("locationPrecision"));
        values.put("temporal", temporal(draft.get("occurredAt"), draft.get("occurredFrom"), draft.get("occurredUntil")));
        return values;
    }

    /** Mesmos nomes a partir da ocorrência persistida. */
    private static Map<String, Object> valuesFromOccurrence(Map<String, Object> occurrence) {
        var values = new LinkedHashMap<String, Object>();
        values.put("title", occurrence.get("title"));
        values.put("description", occurrence.get("description"));
        values.put("category", occurrence.get("category"));
        values.put("type", occurrence.get("occurrence_type"));
        values.put("subtype", occurrence.get("subtype"));
        values.put("situation", occurrence.get("situation"));
        values.put("municipality", occurrence.get("municipality"));
        values.put("neighborhood", occurrence.get("neighborhood"));
        values.put("locationPrecision", occurrence.get("location_precision"));
        values.put("temporal", temporal(occurrence.get("occurred_at"), occurrence.get("occurred_from"),
                occurrence.get("occurred_until")));
        return values;
    }

    private static Object temporal(Object at, Object from, Object until) {
        if (at != null && from == null && until == null) {
            return at;
        }
        if (at == null && from != null && until != null) {
            return from;
        }
        return null;
    }

    private static String status(Object value, List<?> known, List<?> notApplicable) {
        if (value == null) {
            return "NOT_INFORMED";
        }
        String text = value instanceof String string ? string.strip() : String.valueOf(value);
        if (text.isEmpty() || known.contains(text)) {
            return "NOT_INFORMED";
        }
        if (notApplicable.contains(text)) {
            return "NOT_APPLICABLE";
        }
        return "INFORMED";
    }

    private static double bonus(Rule rule, int capped) {
        if (capped <= 0) {
            return 0.0;
        }
        return rule.parameters().path("corroborationBonus").path(String.valueOf(capped)).asDouble(0.0);
    }

    private static int round(double raw, Rule rule) {
        var range = rule.parameters().path("noteRange");
        int low = range.path(0).asInt(1);
        int high = range.path(1).asInt(5);
        return (int) Math.min(high, Math.max(low, Math.floor(raw + 0.5)));
    }

    private static String normalize(String title) {
        String decomposed = Normalizer.normalize(title == null ? "" : title, Normalizer.Form.NFD);
        return decomposed.replaceAll("\\p{M}+", "").replaceAll("\\s+", " ").strip().toLowerCase(Locale.ROOT);
    }

    private static List<String> strings(JsonNode array) {
        var values = new ArrayList<String>();
        array.forEach(node -> values.add(node.asString()));
        return values;
    }

    private static void validateParameters(Map<String, Object> parameters) {
        for (String required : List.of("noteRange", "neutralBase", "corroborationBonus", "corroborationCap",
                "rounding", "reproductionWindowMinutes", "notInformedValues", "notApplicableValues",
                "essentialFields", "divergenceAsBlocking")) {
            if (!parameters.containsKey(required)) {
                throw CorrectionService.invalid("Parâmetro obrigatório ausente: " + required);
            }
        }
        if (!(parameters.get("essentialFields") instanceof List<?> fields) || fields.isEmpty()
                || !(parameters.get("noteRange") instanceof List<?> range) || range.size() != 2
                || !(parameters.get("neutralBase") instanceof Number base) || base.intValue() < 1) {
            throw CorrectionService.invalid("Campos essenciais, faixa de nota e base neutra são obrigatórios.");
        }
    }

    private static UUID key(Map<String, Object> body, String field) {
        try {
            return UUID.fromString(text(body, field, 36));
        } catch (IllegalArgumentException ex) {
            throw CorrectionService.invalid("Chave de avaliação inválida.");
        }
    }

    private static int number(Map<String, Object> body, String field) {
        if (!(body.get(field) instanceof Number value) || value.intValue() < 1) {
            throw CorrectionService.invalid("Número inválido: " + field);
        }
        return value.intValue();
    }

    private static String text(Map<String, Object> body, String field, int max) {
        if (!(body.get(field) instanceof String value) || value.isBlank() || value.length() > max) {
            throw CorrectionService.invalid("Revise " + field + ".");
        }
        return value.strip();
    }

    private void audit(UUID actor, String action, String target) {
        jdbc.update("""
                INSERT INTO auth_audit_events (account_id, occurred_at, module, action, outcome, parameters)
                VALUES (?, ?, 'reliability', ?, 'SUCCEEDED', jsonb_build_object('recordId', ?::text))
                """, actor, Timestamp.from(clock.instant()), action, target);
    }

    private record Rule(int version, JsonNode parameters) {}

    private record FieldRule(String field, boolean allowsNotInformed, boolean allowsNotApplicable) {}

    private record Support(String clippingId, String sourceId, String sourceName, String title, String reference,
            Instant publishedAt, Integer rating) {}

    private record Computed(int note, Integer quality, int neutralBase, int base, double bonus, int corroborationCount,
            int capped, List<String> blocking, List<Map<String, Object>> reproductions, List<Support> traceable,
            List<Support> independents, String referenceSourceId, Map<String, String> fieldStatus) {}
}
