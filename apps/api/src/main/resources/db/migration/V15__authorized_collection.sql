-- Ticket 20: coleta autorizada da fonte Fogo Cruzado v2 (fatia local, nada publica).
-- Fronteira do contrato: docs/architecture/collection-local-v1.md.

-- Ficha de procedência da fonte (origem/licença/data/limitações) sobre o cadastro existente da V5.
-- Coluna nova apenas porque a V5 não possui campo livre para a ficha: territories/pillars são
-- semanticamente fechados e `rating` exige uma nota aprovada (tickets 23/24 seguem bloqueados).
ALTER TABLE sources ADD COLUMN provenance JSONB;

CREATE TABLE collection_sources (
    source_id TEXT PRIMARY KEY REFERENCES sources (id) ON DELETE RESTRICT,
    window_start DATE NOT NULL,
    window_end DATE,
    poll_seconds INTEGER NOT NULL CHECK (poll_seconds BETWEEN 60 AND 86400),
    page_size INTEGER NOT NULL CHECK (page_size BETWEEN 1 AND 1000),
    max_pages INTEGER NOT NULL CHECK (max_pages BETWEEN 1 AND 10000),
    paused BOOLEAN NOT NULL DEFAULT false,
    last_attempt_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_error_class TEXT CHECK (
        last_error_class IN ('AUTH_FAILED', 'RATE_LIMITED', 'UPSTREAM_UNAVAILABLE', 'UPSTREAM_BLOCKED', 'INVALID_RESPONSE')
    ),
    upstream_last_update TIMESTAMPTZ,
    upstream_last_update_state TIMESTAMPTZ,
    -- Cabeçalhos adicionais observados na fonte em 19/10/2026; metadado, nunca conteúdo pessoal.
    upstream_last_update_timestamp BIGINT,
    upstream_last_update_state_id TEXT,
    upstream_last_update_state_timestamp BIGINT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT collection_source_window_order CHECK (window_end IS NULL OR window_end >= window_start)
);

CREATE TABLE collection_runs (
    id UUID PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources (id) ON DELETE RESTRICT,
    kind TEXT NOT NULL CHECK (kind IN ('RECENT', 'BACKFILL')),
    window_start DATE NOT NULL,
    window_end DATE NOT NULL,
    next_page INTEGER NOT NULL DEFAULT 1 CHECK (next_page >= 1),
    take INTEGER NOT NULL CHECK (take BETWEEN 1 AND 1000),
    max_pages INTEGER NOT NULL CHECK (max_pages BETWEEN 1 AND 10000),
    pages_done INTEGER NOT NULL DEFAULT 0 CHECK (pages_done >= 0),
    items_seen INTEGER NOT NULL DEFAULT 0 CHECK (items_seen >= 0),
    items_created INTEGER NOT NULL DEFAULT 0 CHECK (items_created >= 0),
    items_duplicated INTEGER NOT NULL DEFAULT 0 CHECK (items_duplicated >= 0),
    municipalities_missing JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(municipalities_missing) = 'array'),
    state TEXT NOT NULL CHECK (
        state IN ('RUNNING', 'PAUSED', 'SUCCEEDED_NO_CHANGES', 'SUCCEEDED_NEW_ITEMS', 'PARTIAL', 'FAILED')
    ),
    error_class TEXT CHECK (
        error_class IN ('AUTH_FAILED', 'RATE_LIMITED', 'UPSTREAM_UNAVAILABLE', 'UPSTREAM_BLOCKED', 'INVALID_RESPONSE')
    ),
    error_detail TEXT,
    pause_requested BOOLEAN NOT NULL DEFAULT false,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL,
    requested_by UUID REFERENCES local_accounts (id) ON DELETE RESTRICT,
    CONSTRAINT collection_run_window_order CHECK (window_end >= window_start),
    CONSTRAINT collection_run_failed_has_class CHECK (state <> 'FAILED' OR error_class IS NOT NULL),
    CONSTRAINT collection_run_partial_has_class CHECK (state <> 'PARTIAL' OR error_class IS NOT NULL)
);

CREATE INDEX collection_runs_recent_idx ON collection_runs (source_id, started_at DESC);
CREATE INDEX collection_runs_open_idx ON collection_runs (state) WHERE state IN ('RUNNING', 'PAUSED', 'PARTIAL');

-- Trilha append-only. Nunca guarda credencial, token, endereço completo ou atributo pessoal.
CREATE TABLE collection_run_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES collection_runs (id) ON DELETE RESTRICT,
    source_id TEXT NOT NULL REFERENCES sources (id) ON DELETE RESTRICT,
    occurred_at TIMESTAMPTZ NOT NULL,
    event TEXT NOT NULL CHECK (length(btrim(event)) BETWEEN 1 AND 80),
    detail JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(detail) = 'object')
);
CREATE INDEX collection_run_events_run_idx ON collection_run_events (run_id, id);

-- Chave de idempotência da coleta: identidade da fonte. Reprocessar não duplica clipping nem fila.
CREATE TABLE collection_items (
    source_id TEXT NOT NULL REFERENCES sources (id) ON DELETE RESTRICT,
    source_reference TEXT NOT NULL CHECK (length(btrim(source_reference)) BETWEEN 1 AND 200),
    clipping_id TEXT NOT NULL REFERENCES clippings (id) ON DELETE RESTRICT,
    clipping_review_id TEXT NOT NULL REFERENCES clipping_reviews (clipping_id) ON DELETE RESTRICT,
    run_id UUID NOT NULL REFERENCES collection_runs (id) ON DELETE RESTRICT,
    collected_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (source_id, source_reference)
);
CREATE INDEX collection_items_clipping_idx ON collection_items (clipping_id);
CREATE INDEX collection_items_review_idx ON collection_items (clipping_review_id);
