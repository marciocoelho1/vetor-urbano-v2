-- Reconcile legacy BACKFILL activity and prevent a capped budget from being renewed by overlap.
-- V16 may already be applied; evolve its persistent state only through this new migration.
WITH legacy_usage AS (
    SELECT source_id,
           window_start,
           window_end,
           LEAST(100, SUM(pages_done) + COUNT(*) FILTER (WHERE state IN ('PARTIAL', 'FAILED', 'RUNNING')))::INTEGER
               AS pages_requested,
           MIN(started_at) AS created_at,
           MAX(updated_at) AS updated_at
    FROM collection_runs
    WHERE kind = 'BACKFILL'
    GROUP BY source_id, window_start, window_end
)
INSERT INTO collection_backfill_windows (source_id, window_start, window_end, pages_requested, created_at, updated_at)
SELECT source_id, window_start, window_end, pages_requested, created_at, updated_at
FROM legacy_usage
ON CONFLICT (source_id, window_start, window_end) DO UPDATE
SET pages_requested = GREATEST(collection_backfill_windows.pages_requested, EXCLUDED.pages_requested),
    updated_at = GREATEST(collection_backfill_windows.updated_at, EXCLUDED.updated_at);

-- Historical run timestamps are a conservative fallback when V16's explicit request timestamp is absent.
WITH last_legacy_activity AS (
    SELECT source_id, MAX(updated_at) AS last_request_at
    FROM collection_runs
    WHERE kind = 'BACKFILL'
      AND (pages_done > 0 OR state IN ('PARTIAL', 'FAILED', 'RUNNING'))
    GROUP BY source_id
)
UPDATE collection_sources AS source
SET last_backfill_request_at = CASE
        WHEN source.last_backfill_request_at IS NULL
          OR activity.last_request_at > source.last_backfill_request_at
        THEN activity.last_request_at
        ELSE source.last_backfill_request_at
    END
FROM last_legacy_activity AS activity
WHERE source.source_id = activity.source_id;
