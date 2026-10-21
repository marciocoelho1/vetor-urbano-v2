package br.com.vetorurbano.api.collection;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

/**
 * Persistência da coleta (V15). Nada é apagado: falhar conserva o cursor e o trabalho já encaminhado.
 * A trilha de eventos é append-only e nunca recebe credencial, token, endereço completo ou atributo
 * pessoal de vítima.
 */
public class CollectionStore {
    private static final JsonMapper JSON = JsonMapper.builder().build();

    public record BackfillPageReservation(boolean exhausted, long waitMillis, int pagesRequested) {}
    public record BackfillRunStart(UUID runId, String conflictCode) {}
    private record BackfillPacing(Timestamp reservedAt, Timestamp completedAt) {}
    private record ExhaustedBackfillWindow(LocalDate start, LocalDate end) {}

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;

    public CollectionStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        this.transaction = new TransactionTemplate(new DataSourceTransactionManager(
                java.util.Objects.requireNonNull(jdbc.getDataSource())));
    }

    /** Ficha de procedência no cadastro de fontes existente; idempotente. */
    public void ensureSourceFicha(CollectionSourceFicha ficha, Instant recordedAt) {
        jdbc.update("""
                INSERT INTO sources (id, public_name, current_version, provenance)
                VALUES (?, ?, 1, ?::jsonb)
                ON CONFLICT (id) DO UPDATE SET public_name = EXCLUDED.public_name, provenance = EXCLUDED.provenance
                """, ficha.sourceId(), ficha.publicName(), json(ficha.provenance(recordedAt)));
    }

    public Map<String, Object> ensureCollectionSource(CollectionSettings settings, Instant now) {
        jdbc.update("""
                INSERT INTO collection_sources (source_id, window_start, window_end, poll_seconds, page_size,
                    max_pages, paused, created_at, updated_at)
                VALUES (?, ?, NULL, ?, ?, ?, false, ?, ?)
                ON CONFLICT (source_id) DO UPDATE SET window_start = EXCLUDED.window_start,
                    poll_seconds = EXCLUDED.poll_seconds, page_size = EXCLUDED.page_size,
                    max_pages = EXCLUDED.max_pages, updated_at = EXCLUDED.updated_at
                """, settings.sourceId(), java.sql.Date.valueOf(settings.windowStart()), settings.pollSeconds(),
                settings.pageSize(), settings.maxPages(), ts(now), ts(now));
        return source(settings.sourceId());
    }

    public Map<String, Object> source(String sourceId) {
        var rows = jdbc.queryForList("""
                SELECT s.source_id, s.window_start, s.window_end, s.poll_seconds, s.page_size, s.max_pages, s.paused,
                       s.last_attempt_at, s.last_success_at, s.last_error_class, s.upstream_last_update,
                       s.upstream_last_update_state, s.upstream_last_update_timestamp, s.upstream_last_update_state_id,
                       s.upstream_last_update_state_timestamp, src.public_name, src.provenance::text AS provenance
                FROM collection_sources s JOIN sources src ON src.id = s.source_id WHERE s.source_id = ?
                """, sourceId);
        return rows.isEmpty() ? null : sourceView(rows.getFirst());
    }

    public void markAttempt(String sourceId, Instant now, boolean success, CollectionErrorClass errorClass,
            FogoCruzadoClient.UpstreamHeaders headers) {
        FogoCruzadoClient.UpstreamHeaders source = headers == null
                ? new FogoCruzadoClient.UpstreamHeaders(null, null, null, null, null) : headers;
        jdbc.update("""
                UPDATE collection_sources SET last_attempt_at = ?, updated_at = ?,
                    last_success_at = CASE WHEN ? THEN ? ELSE last_success_at END,
                    last_error_class = ?,
                    upstream_last_update = COALESCE(?, upstream_last_update),
                    upstream_last_update_state = COALESCE(?, upstream_last_update_state),
                    upstream_last_update_timestamp = COALESCE(?, upstream_last_update_timestamp),
                    upstream_last_update_state_id = COALESCE(?, upstream_last_update_state_id),
                    upstream_last_update_state_timestamp = COALESCE(?, upstream_last_update_state_timestamp)
                WHERE source_id = ?
                """, ts(now), ts(now), success, ts(now), errorClass == null ? null : errorClass.name(),
                ts(source.lastUpdate()), ts(source.lastUpdateState()), source.lastUpdateTimestamp(),
                source.lastUpdateStateId(), source.lastUpdateStateTimestamp(), sourceId);
    }

    /**
     * Cria execução apenas se a fonte não tiver outra aberta. O lock da linha da fonte serializa
     * início manual e agendado antes da checagem e do INSERT.
     */
    public UUID createRunIfAvailable(String sourceId, CollectionRunKind kind, LocalDate windowStart, LocalDate windowEnd,
            int take, int maxPages, UUID requestedBy, Instant now) {
        UUID id = UUID.randomUUID();
        return transaction.execute(status -> {
            lockSource(sourceId);
            if (hasOpenRun(sourceId)) return null;
            insertRun(id, sourceId, kind, windowStart, windowEnd, take, maxPages, requestedBy, now);
            return id;
        });
    }

    /**
     * Valida a política de janela e reserva o início do BACKFILL sob o mesmo lock da fonte que
     * serializa as páginas. Isso impede que um início concorrente observe um orçamento obsoleto.
     */
    public BackfillRunStart createBackfillRunIfAvailable(String sourceId, LocalDate windowStart, LocalDate windowEnd,
            int take, int requestedMaxPages, int maxPagesPerWindow, UUID requestedBy, Instant now) {
        UUID id = UUID.randomUUID();
        BackfillRunStart result = transaction.execute(status -> {
            lockSource(sourceId);
            if (hasOpenRun(sourceId)) return new BackfillRunStart(null, "COLLECTION_RUN_ACTIVE");
            if (violatesExhaustedWindowPolicy(sourceId, windowStart, windowEnd, maxPagesPerWindow))
                return new BackfillRunStart(null, "BACKFILL_WINDOW_LIMIT_REACHED");

            int requested = backfillPagesRequested(sourceId, windowStart, windowEnd);
            int remaining = maxPagesPerWindow - requested;
            if (remaining <= 0) return new BackfillRunStart(null, "BACKFILL_WINDOW_LIMIT_REACHED");
            int maxPages = Math.min(requestedMaxPages, remaining);
            insertRun(id, sourceId, CollectionRunKind.BACKFILL, windowStart, windowEnd, take, maxPages, requestedBy, now);
            return new BackfillRunStart(id, null);
        });
        return java.util.Objects.requireNonNull(result, "A criação do BACKFILL precisa de resultado.");
    }

    private void lockSource(String sourceId) {
        jdbc.queryForObject("SELECT source_id FROM collection_sources WHERE source_id = ? FOR UPDATE",
                String.class, sourceId);
    }

    private void insertRun(UUID id, String sourceId, CollectionRunKind kind, LocalDate windowStart, LocalDate windowEnd,
            int take, int maxPages, UUID requestedBy, Instant now) {
        jdbc.update("""
                INSERT INTO collection_runs (id, source_id, kind, window_start, window_end, next_page, take, max_pages,
                    state, started_at, updated_at, requested_by)
                VALUES (?, ?, ?, ?, ?, 1, ?, ?, 'RUNNING', ?, ?, ?)
                """, id, sourceId, kind.name(), java.sql.Date.valueOf(windowStart), java.sql.Date.valueOf(windowEnd),
                take, maxPages, ts(now), ts(now), requestedBy);
        appendEvent(id, sourceId, now, "RUN_STARTED", Map.of("kind", kind.name(), "take", take, "maxPages", maxPages));
    }

    private boolean violatesExhaustedWindowPolicy(String sourceId, LocalDate windowStart, LocalDate windowEnd,
            int maxPagesPerWindow) {
        List<ExhaustedBackfillWindow> exhausted = jdbc.query("""
                SELECT window_start, window_end FROM collection_backfill_windows
                WHERE source_id = ? AND pages_requested >= ?
                ORDER BY updated_at DESC, window_start DESC, window_end DESC
                """, (result, row) -> new ExhaustedBackfillWindow(
                        result.getDate("window_start").toLocalDate(), result.getDate("window_end").toLocalDate()),
                sourceId, maxPagesPerWindow);
        if (exhausted.isEmpty()) return false;

        long requestedSpan = ChronoUnit.DAYS.between(windowStart, windowEnd);
        for (ExhaustedBackfillWindow previous : exhausted) {
            long previousSpan = ChronoUnit.DAYS.between(previous.start(), previous.end());
            if (requestedSpan >= previousSpan) return true;
            boolean overlaps = !windowEnd.isBefore(previous.start()) && !windowStart.isAfter(previous.end());
            if (overlaps) return true;
        }
        return false;
    }

    public void appendEvent(UUID runId, String sourceId, Instant now, String event, Map<String, Object> detail) {
        jdbc.update("INSERT INTO collection_run_events (run_id, source_id, occurred_at, event, detail) VALUES (?, ?, ?, ?, ?::jsonb)",
                runId, sourceId, ts(now), event, json(detail));
    }

    public Map<String, Object> run(UUID id) {
        var rows = jdbc.queryForList("""
                SELECT id, source_id, kind, window_start, window_end, next_page, take, max_pages, pages_done,
                       items_seen, items_created, items_duplicated, municipalities_missing::text AS missing,
                       state, error_class, error_detail, pause_requested, started_at, finished_at, updated_at
                FROM collection_runs WHERE id = ?
                """, id);
        return rows.isEmpty() ? null : runView(rows.getFirst());
    }

    public List<Map<String, Object>> runs(int limit) {
        var rows = jdbc.queryForList("""
                SELECT id, source_id, kind, window_start, window_end, next_page, take, max_pages, pages_done,
                       items_seen, items_created, items_duplicated, municipalities_missing::text AS missing,
                       state, error_class, error_detail, pause_requested, started_at, finished_at, updated_at
                FROM collection_runs ORDER BY started_at DESC, id DESC LIMIT ?
                """, limit);
        List<Map<String, Object>> items = new ArrayList<>();
        for (var row : rows) items.add(runView(row));
        return List.copyOf(items);
    }

    public List<Map<String, Object>> events(UUID runId) {
        return jdbc.queryForList("SELECT occurred_at, event, detail::text AS detail FROM collection_run_events WHERE run_id = ? ORDER BY id", runId);
    }

    public int backfillPagesRequested(String sourceId, LocalDate windowStart, LocalDate windowEnd) {
        Integer requested = jdbc.queryForObject("""
                SELECT COALESCE((SELECT pages_requested FROM collection_backfill_windows
                    WHERE source_id = ? AND window_start = ? AND window_end = ?), 0)
                """, Integer.class, sourceId, java.sql.Date.valueOf(windowStart), java.sql.Date.valueOf(windowEnd));
        return requested == null ? 0 : requested;
    }

    /** Reserva el siguiente slot de página con presupuesto acumulado y cadencia persistente por fuente. */
    public BackfillPageReservation reserveBackfillPageRequest(UUID runId, String sourceId, LocalDate windowStart,
            LocalDate windowEnd, int page, int maxPagesPerWindow, Duration minInterval, Instant now) {
        BackfillPageReservation reservation = transaction.execute(status -> {
            BackfillPacing pacing = jdbc.queryForObject("""
                    SELECT last_backfill_request_at, last_backfill_page_completed_at
                    FROM collection_sources WHERE source_id = ? FOR UPDATE
                    """, (result, row) -> new BackfillPacing(result.getTimestamp(1), result.getTimestamp(2)), sourceId);
            jdbc.update("""
                    INSERT INTO collection_backfill_windows (source_id, window_start, window_end)
                    VALUES (?, ?, ?) ON CONFLICT (source_id, window_start, window_end) DO NOTHING
                    """, sourceId, java.sql.Date.valueOf(windowStart), java.sql.Date.valueOf(windowEnd));
            Integer current = jdbc.queryForObject("""
                    SELECT pages_requested FROM collection_backfill_windows
                    WHERE source_id = ? AND window_start = ? AND window_end = ? FOR UPDATE
                    """, Integer.class, sourceId, java.sql.Date.valueOf(windowStart), java.sql.Date.valueOf(windowEnd));
            int requested = current == null ? 0 : current;
            if (requested >= maxPagesPerWindow) return new BackfillPageReservation(true, 0, requested);

            Instant lastRequest = pacing.reservedAt() == null ? null : pacing.reservedAt().toInstant();
            if (pacing.completedAt() != null && (lastRequest == null || pacing.completedAt().toInstant().isAfter(lastRequest)))
                lastRequest = pacing.completedAt().toInstant();
            if (lastRequest != null) {
                Instant availableAt = lastRequest.plus(minInterval);
                if (availableAt.isAfter(now)) {
                    long waitNanos = Duration.between(now, availableAt).toNanos();
                    long waitMillis = (waitNanos + 999_999L) / 1_000_000L;
                    return new BackfillPageReservation(false, Math.max(1L, waitMillis), requested);
                }
            }

            int updated = jdbc.update("""
                    UPDATE collection_backfill_windows SET pages_requested = pages_requested + 1, updated_at = ?
                    WHERE source_id = ? AND window_start = ? AND window_end = ? AND pages_requested < ?
                    """, ts(now), sourceId, java.sql.Date.valueOf(windowStart), java.sql.Date.valueOf(windowEnd),
                    maxPagesPerWindow);
            if (updated == 0) return new BackfillPageReservation(true, 0, requested);
            jdbc.update("UPDATE collection_sources SET last_backfill_request_at = ?, updated_at = ? WHERE source_id = ?",
                    ts(now), ts(now), sourceId);
            appendEvent(runId, sourceId, now, "BACKFILL_PAGE_RESERVED", Map.of("page", page,
                    "windowStart", windowStart.toString(), "windowEnd", windowEnd.toString(),
                    "pagesRequested", requested + 1, "maxPagesPerWindow", maxPagesPerWindow));
            return new BackfillPageReservation(false, 0, requested + 1);
        });
        return java.util.Objects.requireNonNull(reservation, "A reserva de BACKFILL precisa de resultado.");
    }

    public void recordBackfillPageCompletion(String sourceId, Instant now) {
        jdbc.update("""
                UPDATE collection_sources SET last_backfill_page_completed_at = ?, updated_at = ?
                WHERE source_id = ?
                """, ts(now), ts(now), sourceId);
    }

    public boolean hasOpenRun(String sourceId) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                """
                SELECT EXISTS (SELECT 1 FROM collection_runs WHERE source_id = ? AND (
                    state IN ('RUNNING','PAUSED') OR
                    (state = 'PARTIAL' AND error_class IS DISTINCT FROM 'BACKFILL_LIMIT_REACHED')
                ))
                """, Boolean.class, sourceId));
    }

    public boolean itemExists(String sourceId, String reference) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM collection_items WHERE source_id = ? AND source_reference = ?)",
                Boolean.class, sourceId, reference));
    }

    public void requestPause(UUID runId, String sourceId, Instant now) {
        jdbc.update("UPDATE collection_runs SET pause_requested = true, updated_at = ? WHERE id = ?", ts(now), runId);
        jdbc.update("UPDATE collection_sources SET paused = true, updated_at = ? WHERE source_id = ?", ts(now), sourceId);
        appendEvent(runId, sourceId, now, "PAUSE_REQUESTED", Map.of());
    }

    /** Transição compare-and-set para impedir retomadas simultâneas do mesmo cursor. */
    public boolean resumeRun(UUID runId, String sourceId, Instant now) {
        Boolean resumed = transaction.execute(status -> {
            jdbc.queryForObject("SELECT source_id FROM collection_sources WHERE source_id = ? FOR UPDATE",
                    String.class, sourceId);
            int updated = jdbc.update("""
                    UPDATE collection_runs SET state = 'RUNNING', pause_requested = false,
                        updated_at = ?, finished_at = NULL
                    WHERE id = ? AND source_id = ? AND state IN ('PAUSED', 'PARTIAL')
                        AND error_class IS DISTINCT FROM 'BACKFILL_LIMIT_REACHED'
                    """, ts(now), runId, sourceId);
            if (updated == 0) return false;
            jdbc.update("UPDATE collection_sources SET paused = false, updated_at = ? WHERE source_id = ?",
                    ts(now), sourceId);
            appendEvent(runId, sourceId, now, "RESUME_REQUESTED", Map.of());
            return true;
        });
        return Boolean.TRUE.equals(resumed);
    }

    public void municipalityReport(UUID runId, String sourceId, List<String> missing, Instant now) {
        jdbc.update("UPDATE collection_runs SET municipalities_missing = ?::jsonb, updated_at = ? WHERE id = ?",
                json(missing), ts(now), runId);
        appendEvent(runId, sourceId, now, missing.isEmpty() ? "MUNICIPALITIES_MATCHED" : "MUNICIPALITIES_MISSING",
                Map.of("missing", missing));
    }

    public void stateResolved(UUID runId, String sourceId, String stateId, int cities, Instant now) {
        appendEvent(runId, sourceId, now, "STATE_RESOLVED", Map.of("stateId", stateId, "cityIds", cities));
    }

    /**
     * Uma página por transação: clippings, fila de revisão e chave de idempotência juntos, e o cursor
     * avançado no mesmo commit. Reprocessar a mesma referência não duplica clipping nem review.
     */
    public int[] persistPage(UUID runId, String sourceId, int page, boolean hasNextPage, int nextPage,
            List<CollectionMapper.CollectionItemDraft> drafts, Instant collectedAt, Instant now) {
        int[] counters = new int[2];
        transaction.executeWithoutResult(status -> {
            for (var draft : drafts) {
                if (itemExists(sourceId, draft.reference())) {
                    counters[1]++;
                    continue;
                }
                String clippingId = UUID.randomUUID().toString();
                jdbc.update("INSERT INTO clippings (id, source_id, title, source_published_at, collected_at, reference) VALUES (?, ?, ?, ?, ?, ?)",
                        clippingId, sourceId, draft.title(), ts(draft.sourcePublishedAt()), ts(collectedAt),
                        sourceId + ":" + draft.reference());
                jdbc.update("INSERT INTO clipping_reviews (clipping_id, original_text, extracted, priority, state, queued_at) VALUES (?, ?, ?::jsonb, ?, 'PENDING', ?)",
                        clippingId, draft.summary(), json(draft.extracted()), draft.priority(), ts(collectedAt));
                jdbc.update("INSERT INTO collection_items (source_id, source_reference, clipping_id, clipping_review_id, run_id, collected_at) VALUES (?, ?, ?, ?, ?, ?)",
                        sourceId, draft.reference(), clippingId, clippingId, runId, ts(collectedAt));
                counters[0]++;
            }
            jdbc.update("""
                    UPDATE collection_runs SET pages_done = pages_done + 1, items_seen = items_seen + ?,
                        items_created = items_created + ?, items_duplicated = items_duplicated + ?,
                        next_page = ?, updated_at = ? WHERE id = ?
                    """, drafts.size(), counters[0], counters[1], nextPage, ts(now), runId);
        });
        appendEvent(runId, sourceId, now, "PAGE_DONE", eventDetail("page", page, "seen", drafts.size(),
                "created", counters[0], "duplicated", counters[1], "hasNextPage", hasNextPage));
        return counters;
    }

    public void finishRun(UUID runId, String sourceId, CollectionRunState state, CollectionErrorClass errorClass,
            String errorDetail, Instant now) {
        jdbc.update("""
                UPDATE collection_runs SET state = ?, error_class = ?, error_detail = ?, finished_at = ?, updated_at = ?
                WHERE id = ?
                """, state.name(), errorClass == null ? null : errorClass.name(), errorDetail,
                state == CollectionRunState.PAUSED ? null : ts(now), ts(now), runId);
        appendEvent(runId, sourceId, now, "RUN_" + state.name(),
                errorClass == null ? Map.of() : Map.of("errorClass", errorClass.name()));
    }

    private static Map<String, Object> eventDetail(Object... pairs) {
        Map<String, Object> detail = new LinkedHashMap<>();
        for (int index = 0; index + 1 < pairs.length; index += 2) detail.put((String) pairs[index], pairs[index + 1]);
        return detail;
    }

    private Map<String, Object> runView(Map<String, Object> row) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", row.get("id").toString());
        view.put("sourceId", row.get("source_id"));
        view.put("kind", row.get("kind"));
        view.put("windowStart", java.sql.Date.class.cast(row.get("window_start")).toLocalDate().toString());
        view.put("windowEnd", java.sql.Date.class.cast(row.get("window_end")).toLocalDate().toString());
        view.put("nextPage", row.get("next_page"));
        view.put("take", row.get("take"));
        view.put("maxPages", row.get("max_pages"));
        view.put("pagesDone", row.get("pages_done"));
        view.put("itemsSeen", row.get("items_seen"));
        view.put("itemsCreated", row.get("items_created"));
        view.put("itemsDuplicated", row.get("items_duplicated"));
        view.put("municipalitiesMissing", JSON.readTree((String) row.get("missing")));
        view.put("state", row.get("state"));
        view.put("errorClass", row.get("error_class"));
        view.put("errorDetail", row.get("error_detail"));
        view.put("pauseRequested", row.get("pause_requested"));
        view.put("startedAt", instant(row.get("started_at")));
        view.put("finishedAt", instant(row.get("finished_at")));
        view.put("updatedAt", instant(row.get("updated_at")));
        return view;
    }

    private Map<String, Object> sourceView(Map<String, Object> row) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("sourceId", row.get("source_id"));
        view.put("publicName", row.get("public_name"));
        view.put("provenance", row.get("provenance") == null ? null : JSON.readTree((String) row.get("provenance")));
        view.put("windowStart", java.sql.Date.class.cast(row.get("window_start")).toLocalDate().toString());
        view.put("windowEnd", row.get("window_end") == null ? null : java.sql.Date.class.cast(row.get("window_end")).toLocalDate().toString());
        view.put("pollSeconds", row.get("poll_seconds"));
        view.put("pageSize", row.get("page_size"));
        view.put("maxPages", row.get("max_pages"));
        view.put("paused", row.get("paused"));
        view.put("lastAttemptAt", instant(row.get("last_attempt_at")));
        view.put("lastSuccessAt", instant(row.get("last_success_at")));
        view.put("lastErrorClass", row.get("last_error_class"));
        view.put("upstreamLastUpdate", instant(row.get("upstream_last_update")));
        view.put("upstreamLastUpdateState", instant(row.get("upstream_last_update_state")));
        view.put("upstreamLastUpdateTimestamp", row.get("upstream_last_update_timestamp"));
        view.put("upstreamLastUpdateStateId", row.get("upstream_last_update_state_id"));
        view.put("upstreamLastUpdateStateTimestamp", row.get("upstream_last_update_state_timestamp"));
        return view;
    }

    private static Object instant(Object value) {
        return value == null ? null : ((Timestamp) value).toInstant().toString();
    }

    private static Timestamp ts(Instant instant) { return instant == null ? null : Timestamp.from(instant); }

    private static String json(Object value) {
        try {
            return JSON.writeValueAsString(value);
        } catch (RuntimeException failure) {
            throw new DataAccessException("Não foi possível registrar a coleta.", failure) {};
        }
    }
}
