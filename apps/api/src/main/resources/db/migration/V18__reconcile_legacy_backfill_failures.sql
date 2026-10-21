-- Reconcile repeated legacy failures not represented by V17's final-state fallback.
-- Preserve V17 as applied history; add only failures observed before V17 ran.
WITH v17_applied AS (
    SELECT installed_on
    FROM flyway_schema_history
    WHERE version = '17' AND success
),
legacy_failed_attempts AS (
    SELECT event.run_id, COUNT(*) AS failed_attempts
    FROM collection_run_events AS event
    CROSS JOIN v17_applied AS migration
    WHERE event.event IN ('RUN_PARTIAL', 'RUN_FAILED')
      AND event.occurred_at <= (migration.installed_on AT TIME ZONE current_setting('TimeZone'))
    GROUP BY event.run_id
),
additional_usage AS (
    SELECT run.source_id,
           run.window_start,
           run.window_end,
           SUM(GREATEST(
               COALESCE(failures.failed_attempts, 0)
                   - CASE WHEN run.state IN ('PARTIAL', 'FAILED') THEN 1 ELSE 0 END,
               0
           ))::INTEGER AS pages_to_add
    FROM collection_runs AS run
    LEFT JOIN legacy_failed_attempts AS failures ON failures.run_id = run.id
    WHERE run.kind = 'BACKFILL'
    GROUP BY run.source_id, run.window_start, run.window_end
)
UPDATE collection_backfill_windows AS backfill_window
SET pages_requested = LEAST(100, backfill_window.pages_requested + additional.pages_to_add),
    updated_at = GREATEST(backfill_window.updated_at, now())
FROM additional_usage AS additional
WHERE backfill_window.source_id = additional.source_id
  AND backfill_window.window_start = additional.window_start
  AND backfill_window.window_end = additional.window_end
  AND additional.pages_to_add > 0;
