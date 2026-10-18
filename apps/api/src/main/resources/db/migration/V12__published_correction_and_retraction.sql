-- Ticket 18: prepared correction/retraction of already published synthetic occurrences.
-- Nothing here rewrites occurrence history: every applied change is an appended version.
-- The withdrawal moment is what lets a withdrawn address explain itself without resending content.
ALTER TABLE occurrences ADD COLUMN withdrawn_at TIMESTAMPTZ;
CREATE TABLE correction_essential_reasons (
    code TEXT PRIMARY KEY,
    label TEXT NOT NULL CHECK(length(trim(label)) > 0)
);
-- Essential errors that justify withdrawing a published record use a closed list, never free text alone.
INSERT INTO correction_essential_reasons(code,label) VALUES
    ('FATO_INCORRETO','Fato demonstrado incorreto'),
    ('LOCAL_INCORRETO','Local demonstrado incorreto'),
    ('DATA_INCORRETA','Data demonstrada incorreta'),
    ('IDENTIDADE_INDEVIDA','Exposição indevida de identidade ou dado pessoal'),
    ('RISCO_EVIDENTE','Risco evidente à integridade de pessoas'),
    ('FORA_DE_ESCOPO','Conteúdo fora do escopo aprovado do produto');
CREATE TABLE occurrence_editor_preparations (
    request_id UUID PRIMARY KEY REFERENCES correction_requests(id),
    action TEXT NOT NULL CHECK(action IN ('CORRECTION','RETRACTION')),
    target_id TEXT NOT NULL,
    target_revision INTEGER NOT NULL CHECK(target_revision > 0),
    changes JSONB NOT NULL,
    essential_reason TEXT REFERENCES correction_essential_reasons(code),
    reason TEXT NOT NULL CHECK(length(trim(reason)) > 0),
    evidence TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT 'PREPARED' CHECK(state IN ('PREPARED','APPLIED','DISCARDED')),
    applied_revision INTEGER,
    applied_version INTEGER,
    author_id UUID REFERENCES local_accounts(id),
    historical_actor_id UUID REFERENCES historical_actors(id),
    prepared_at TIMESTAMPTZ NOT NULL,
    applied_at TIMESTAMPTZ,
    CHECK(state <> 'PREPARED' OR applied_revision IS NULL),
    CHECK(author_id IS NOT NULL OR historical_actor_id IS NOT NULL)
);
CREATE TABLE correction_editor_audit (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES correction_requests(id),
    action TEXT NOT NULL,
    target_id TEXT NOT NULL,
    before_snapshot JSONB NOT NULL,
    after_snapshot JSONB NOT NULL,
    author_id UUID REFERENCES local_accounts(id),
    historical_actor_id UUID REFERENCES historical_actors(id),
    occurred_at TIMESTAMPTZ NOT NULL,
    CHECK(author_id IS NOT NULL OR historical_actor_id IS NOT NULL)
);
CREATE INDEX correction_editor_queue_idx ON occurrence_editor_preparations(state,prepared_at);
CREATE INDEX correction_editor_audit_idx ON correction_editor_audit(request_id,occurred_at);
