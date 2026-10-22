package br.com.vetorurbano.api.occurrences;

import br.com.vetorurbano.api.accounts.AccountPassword;
import br.com.vetorurbano.api.corrections.CorrectionService;
import br.com.vetorurbano.api.moderation.PublicationDraft;
import br.com.vetorurbano.api.moderation.PublicationStore;
import java.sql.Timestamp;
import java.time.Clock;
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
 * Administração de ocorrências (pedido do responsável em 22/10/2026).
 *
 * <p>Lista ordenada por última atualização (ou alfabética), com filtro por estado administrativo;
 * edição de todos os campos; ações em lote para ativo, inativo, concluído e exclusão. A exclusão é
 * lógica — o histórico de publicação é imutável e continua auditável — e exige a senha do
 * administrador, conferida <strong>uma única vez</strong> por lote, nunca por item.
 */
@Service
@Profile("local")
@ConditionalOnProperty(name = "vetor.accounts.enabled", havingValue = "true")
public class OccurrenceAdminService {
    private static final Set<String> STATES = Set.of("ACTIVE", "INACTIVE", "CONCLUDED", "DELETED");
    private static final Set<String> ACTIONS = Set.of("ACTIVE", "INACTIVE", "CONCLUDED", "DELETE");
    private static final Set<String> SORTS = Set.of("last_update", "alphabetical");

    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final PublicationStore publications;
    private final AccountPassword passwords;

    public OccurrenceAdminService(JdbcTemplate jdbc, Clock clock, PublicationStore publications,
            AccountPassword passwords) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.publications = publications;
        this.passwords = passwords;
    }

    /** Lista administrativa: excluídas ficam fora; o resto ordena por atualização ou alfabeto. */
    public Map<String, Object> list(String sort, String status, UUID actor) {
        String order = sort == null || sort.isBlank() ? "last_update" : sort;
        if (!SORTS.contains(order)) {
            throw CorrectionService.invalid("Ordenação inválida: use last_update ou alphabetical.");
        }
        String state = status == null || status.isBlank() || "ALL".equals(status) ? null : status;
        if (state != null && !STATES.contains(state)) {
            throw CorrectionService.invalid("Filtro de estado inválido.");
        }
        var sql = new StringBuilder("""
                SELECT o.id, o.title, o.category, o.occurrence_type, o.situation, o.administrative_status,
                       o.municipality, o.neighborhood, o.revision, o.occurred_at, o.updated_at,
                       COALESCE((
                           SELECT e.note FROM occurrence_reliability_evaluations e
                           WHERE e.occurrence_id = o.id AND e.state = 'PUBLISHED'
                           ORDER BY e.evaluation_version DESC LIMIT 1
                       ), o.reliability_score) AS reliability
                FROM occurrences o
                WHERE o.administrative_status <> 'DELETED'
                """);
        var arguments = new ArrayList<Object>();
        if (state != null) {
            sql.append(" AND o.administrative_status = ?");
            arguments.add(state);
        }
        sql.append("alphabetical".equals(order)
                ? " ORDER BY o.title ASC, o.id ASC"
                // DESC colocaria nulos primeiro no PostgreSQL; registro sem atualização vai ao fim.
                : " ORDER BY COALESCE(o.updated_at, o.occurred_at) DESC NULLS LAST, o.id ASC");
        var items = jdbc.queryForList(sql.toString(), arguments.toArray());
        audit(actor, "OCCURRENCE_LIST_READ", "list");
        return Map.of("items", items, "sort", order, "status", state == null ? "ALL" : state,
                "counts", counts(),
                "rule", "Ordem padrão por última atualização; sem atualização registrada vale a data da ocorrência.");
    }

    /** Edição de todos os campos do núcleo factual, com a mesma validação da publicação. */
    @Transactional
    public Map<String, Object> edit(String id, Map<String, Object> body, UUID actor) {
        var current = jdbc.queryForList("""
                SELECT revision, publication_status, administrative_status FROM occurrences WHERE id=? FOR UPDATE
                """, id);
        if (current.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ocorrência inexistente.");
        }
        if ("DELETED".equals(current.getFirst().get("administrative_status"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ocorrência excluída não é editável.");
        }
        if (!body.containsKey("expectedVersion")) {
            throw CorrectionService.invalid("Informe expectedVersion para editar sem sobrescrever outra decisão.");
        }
        int expected = PublicationDraft.integer(body, "expectedVersion");
        if (expected != ((Number) current.getFirst().get("revision")).intValue()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ocorrência mudou; recarregue antes de editar.");
        }
        var draftBody = new LinkedHashMap<String, Object>(body);
        draftBody.remove("expectedVersion");
        var draft = PublicationDraft.parse(draftBody);
        String before = publications.snapshot(id);
        publications.replace(id, draft);
        jdbc.update("UPDATE occurrences SET updated_at=? WHERE id=?", Timestamp.from(clock.instant()), id);
        publications.record(id, before, "ADMIN_EDIT", "Edição administrativa de todos os campos", actor);
        audit(actor, "OCCURRENCE_EDITED", id);
        return detail(id);
    }

    /**
     * Ações em lote. A senha é exigida apenas na exclusão e conferida uma única vez para o lote
     * inteiro; a operação é atômica — ou aplica em todas as ocorrências, ou em nenhuma.
     */
    @Transactional
    public Map<String, Object> bulk(Map<String, Object> body, UUID actor) {
        if (!Set.of("ids", "action").containsAll(body.keySet())
                && !Set.of("ids", "action", "password").containsAll(body.keySet())) {
            throw CorrectionService.invalid("Campos da ação em lote inválidos.");
        }
        if (!(body.get("ids") instanceof List<?> raw) || raw.isEmpty() || raw.size() > 500) {
            throw CorrectionService.invalid("Selecione de 1 a 500 ocorrências.");
        }
        var ids = new ArrayList<String>();
        for (var item : raw) {
            if (!(item instanceof String id) || id.isBlank() || id.length() > 200) {
                throw CorrectionService.invalid("Identificador de ocorrência inválido.");
            }
            ids.add(id);
        }
        String action = body.get("action") instanceof String value ? value : "";
        if (!ACTIONS.contains(action)) {
            throw CorrectionService.invalid("Ação inválida: use ACTIVE, INACTIVE, CONCLUDED ou DELETE.");
        }
        if ("DELETE".equals(action)) {
            requirePassword(body, actor);
        }
        var target = "DELETE".equals(action) ? "DELETED" : action;
        var placeholders = String.join(",", java.util.Collections.nCopies(ids.size(), "?"));
        Timestamp now = Timestamp.from(clock.instant());
        var arguments = new ArrayList<Object>();
        arguments.add(target);
        arguments.add(now);
        arguments.addAll(ids);
        int changed = "DELETE".equals(action)
                ? jdbc.update("""
                        UPDATE occurrences SET administrative_status=?, deleted_at=?
                        WHERE id IN (%s) AND administrative_status <> 'DELETED'
                        """.formatted(placeholders), arguments.toArray())
                : jdbc.update("""
                        UPDATE occurrences SET administrative_status=?, updated_at=?
                        WHERE id IN (%s) AND administrative_status <> 'DELETED'
                        """.formatted(placeholders), arguments.toArray());
        if (changed != ids.size()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Alguma ocorrência mudou ou foi excluída; recarregue a lista e repita a ação.");
        }
        audit(actor, "OCCURRENCE_BULK_" + action, "bulk:" + ids.size());
        return Map.of("action", action, "affected", changed, "ids", ids,
                "message", "DELETE".equals(action)
                        ? "Exclusão lógica registrada; histórico de publicação preservado."
                        : "Estado administrativo atualizado em lote.");
    }

    private void requirePassword(Map<String, Object> body, UUID actor) {
        if (!(body.get("password") instanceof String password) || password.isBlank() || password.length() > 512) {
            throw CorrectionService.invalid("Exclusão exige a senha do administrador.");
        }
        String hash = jdbc.queryForObject("SELECT password_hash FROM local_accounts WHERE id=?", String.class, actor);
        if (!passwords.matches(password, hash)) {
            audit(actor, "OCCURRENCE_BULK_DELETE_DENIED", "password");
            // 400 e não 403: o administrador está autorizado; o que falhou foi a reconferência de senha.
            // 403 é reservado ao filtro de acesso (sessão/perfil) e confundiria a interface.
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Senha do administrador incorreta; nada foi excluído.");
        }
    }

    private Map<String, Object> detail(String id) {
        return jdbc.queryForMap("""
                SELECT o.id, o.title, o.description, o.category, o.occurrence_type, o.subtype, o.situation,
                       o.reliability_score, o.municipality, o.neighborhood, o.location_precision,
                       ST_X(o.location::geometry) AS longitude, ST_Y(o.location::geometry) AS latitude,
                       o.occurred_at, o.occurred_from, o.occurred_until, o.revision,
                       o.administrative_status, o.updated_at
                FROM occurrences o WHERE o.id=?
                """, id);
    }

    private Map<String, Object> counts() {
        var counts = new LinkedHashMap<String, Object>();
        jdbc.queryForList("""
                SELECT administrative_status, count(*)::int AS total FROM occurrences
                WHERE administrative_status <> 'DELETED' GROUP BY administrative_status
                """).forEach(row -> counts.put((String) row.get("administrative_status"), row.get("total")));
        counts.putIfAbsent("ACTIVE", 0);
        counts.putIfAbsent("INACTIVE", 0);
        counts.putIfAbsent("CONCLUDED", 0);
        return counts;
    }

    private void audit(UUID actor, String action, String target) {
        jdbc.update("""
                INSERT INTO auth_audit_events (account_id, occurred_at, module, action, outcome, parameters)
                VALUES (?, ?, 'occurrences', ?, 'SUCCEEDED', jsonb_build_object('recordId', ?::text))
                """, actor, Timestamp.from(clock.instant()), action, target);
    }
}
