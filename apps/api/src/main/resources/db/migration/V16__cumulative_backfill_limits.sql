-- Guardrails persistentes para carga retroativa: orçamento por janela exata e cadência por fonte.
ALTER TABLE collection_sources ADD COLUMN last_backfill_request_at TIMESTAMPTZ;
ALTER TABLE collection_sources ADD COLUMN last_backfill_page_completed_at TIMESTAMPTZ;

ALTER TABLE collection_sources DROP CONSTRAINT IF EXISTS collection_sources_last_error_class_check;
ALTER TABLE collection_sources ADD CONSTRAINT collection_sources_last_error_class_check CHECK (
    last_error_class IN ('AUTH_FAILED', 'RATE_LIMITED', 'UPSTREAM_UNAVAILABLE', 'UPSTREAM_BLOCKED',
        'INVALID_RESPONSE', 'BACKFILL_LIMIT_REACHED')
);

ALTER TABLE collection_runs DROP CONSTRAINT IF EXISTS collection_runs_error_class_check;
ALTER TABLE collection_runs ADD CONSTRAINT collection_runs_error_class_check CHECK (
    error_class IN ('AUTH_FAILED', 'RATE_LIMITED', 'UPSTREAM_UNAVAILABLE', 'UPSTREAM_BLOCKED',
        'INVALID_RESPONSE', 'BACKFILL_LIMIT_REACHED')
);

CREATE TABLE collection_backfill_windows (
    source_id TEXT NOT NULL REFERENCES collection_sources (source_id) ON DELETE CASCADE,
    window_start DATE NOT NULL,
    window_end DATE NOT NULL,
    pages_requested INTEGER NOT NULL DEFAULT 0 CHECK (pages_requested BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (source_id, window_start, window_end),
    CONSTRAINT collection_backfill_window_order CHECK (window_end >= window_start)
);
