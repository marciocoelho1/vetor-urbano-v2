package br.com.vetorurbano.api.audit;

import java.sql.Timestamp;
import java.time.Clock;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Service
@Profile("local")
@ConditionalOnProperty(name = "vetor.accounts.enabled", havingValue = "true")
public class AuditService {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String EVENTS = """
        SELECT 'access-' || id AS id, 'access'::text AS event_kind, id AS event_number, account_id::text AS actor, occurred_at,
               module, action, outcome, parameters::text AS parameters,
               event_class
        FROM auth_audit_events
        UNION ALL
        SELECT 'account-' || id, 'account', id, account_id::text, occurred_at, module, action, outcome,
               '{}', event_class FROM account_audit_events
        UNION ALL
        SELECT 'source-' || id, 'source', id, actor_id::text, occurred_at, 'sources', action, 'SUCCEEDED',
               jsonb_build_object('sourceId', source_id, 'before', before_snapshot,
                                  'after', after_snapshot)::text, event_class
        FROM source_audit_events
        """;
    private volatile boolean maintenanceFailed;
    public void cleanupFailed() { maintenanceFailed = true; }
    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final AuditRetention.Policy policy;
    public AuditService(JdbcTemplate jdbc, Clock clock, AuditRetention.Policy policy) {
        this.jdbc = jdbc; this.clock = clock; this.policy = policy;
    }
    private Timestamp cutoff(java.time.Duration retention) { return Timestamp.from(clock.instant().minus(retention)); }
    private void operation(UUID actor, String action, Map<String, Object> parameters) {
        jdbc.update("INSERT INTO auth_audit_events(account_id,occurred_at,module,action,outcome,parameters) VALUES(?,?,'audit',?,'SUCCEEDED',?::jsonb)",
            actor, Timestamp.from(clock.instant()), action, JSON.writeValueAsString(parameters));
    }
    @Transactional
    public Map<String, Object> cleanup(UUID actor) {
        int auth = jdbc.update("DELETE FROM auth_audit_events WHERE occurred_at <= CASE event_class WHEN 'USE' THEN ?::timestamptz WHEN 'SECURITY' THEN ?::timestamptz ELSE ?::timestamptz END", cutoff(policy.use()), cutoff(policy.security()), cutoff(policy.admin()));
        int accounts = jdbc.update("DELETE FROM account_audit_events WHERE occurred_at <= ?", cutoff(policy.security()));
        int sources = jdbc.update("DELETE FROM source_audit_events WHERE occurred_at <= ?", cutoff(policy.admin()));
        var result = Map.<String, Object>of("executedAt", clock.instant(), "deleted", auth + accounts + sources);
        operation(actor, "LOG_CLEANUP", result);
        maintenanceFailed = false;
        return result;
    }

    @Transactional
    public Map<String, Object> list(String eventClass, String cursor, UUID actor) {
        if (eventClass != null && !Set.of("USE", "SECURITY", "ADMIN").contains(eventClass))
            throw new IllegalArgumentException("Classe de evento inválida.");
        Timestamp beforeTime = null;
        String beforeKind = null;
        Long beforeNumber = null;
        if (cursor != null && !cursor.isBlank()) {
            var parts = cursor.split("\\|", -1);
            if (parts.length != 3 || !Set.of("access", "account", "source").contains(parts[1]))
                throw new IllegalArgumentException("Página inválida.");
            try {
                beforeTime = Timestamp.from(java.time.Instant.parse(parts[0]));
                beforeKind = parts[1]; beforeNumber = Long.parseLong(parts[2]);
                if (beforeNumber < 1) throw new IllegalArgumentException("Página inválida.");
            } catch (java.time.DateTimeException failure) { throw new IllegalArgumentException("Página inválida."); }
        }
        operation(actor, "LOG_READ", Map.of());
        var items = jdbc.query("SELECT * FROM (" + EVENTS + ") events WHERE (?::text IS NULL OR event_class = ?) AND occurred_at > CASE event_class WHEN 'USE' THEN ?::timestamptz WHEN 'SECURITY' THEN ?::timestamptz ELSE ?::timestamptz END AND (?::timestamptz IS NULL OR (occurred_at, event_kind, event_number) < (?::timestamptz, ?::text, ?::bigint)) ORDER BY occurred_at DESC, event_kind DESC, event_number DESC LIMIT 51",
            (row, index) -> {
                var event = new LinkedHashMap<String, Object>();
                event.put("id", row.getString("id")); event.put("actor", row.getString("actor"));
                event.put("occurredAt", row.getTimestamp("occurred_at").toInstant());
                event.put("module", row.getString("module")); event.put("action", row.getString("action"));
                event.put("outcome", row.getString("outcome")); event.put("eventClass", row.getString("event_class"));
                event.put("parameters", safeParameters(row.getString("module"), row.getString("parameters")));
                return event;
            }, eventClass, eventClass, cutoff(policy.use()), cutoff(policy.security()), cutoff(policy.admin()), beforeTime, beforeTime, beforeKind, beforeNumber);
        String next = "";
        if (items.size() > 50) {
            var last = items.get(49);
            var id = last.get("id").toString().split("-", 2);
            next = last.get("occurredAt") + "|" + id[0] + "|" + id[1];
        }
        return Map.of("items", items.stream().limit(50).toList(), "hasMore", items.size() > 50, "nextCursor", next, "maintenanceFailed", maintenanceFailed);
    }

    private static Object safeParameters(String module, String raw) {
        var input = JSON.readTree(raw);
        var output = new LinkedHashMap<String, Object>();
        var keys = switch (module) {
            case "query" -> Set.of("periodStart", "periodEnd", "categories", "types", "subtypes", "categorySelection", "municipalities", "neighborhoods", "sourceIds", "situations", "hasText", "minReliability", "maxReliability", "timeStart", "timeEnd", "hasSpatialFilter", "occurrences", "happenings");
            case "sources" -> Set.of("sourceId", "before", "after");
            case "audit" -> Set.of("executedAt", "deleted");
            default -> Set.<String>of();
        };
        for (var key : keys) {
            if (!input.has(key)) continue;
            if (module.equals("sources") && (key.equals("before") || key.equals("after")) && !input.path(key).isNull()) {
                var snapshot = new LinkedHashMap<String, Object>();
                for (var field : Set.of("name", "channel", "url", "territories", "pillars", "accessMethod", "accessConfigurationRef", "rating", "ratingJustification", "version", "createdAt"))
                    if (input.path(key).has(field)) snapshot.put(field, input.path(key).get(field));
                output.put(key, snapshot);
            } else output.put(key, input.get(key));
        }
        return output;
    }
}
