ALTER TABLE occurrences ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0);
ALTER TABLE clippings ADD COLUMN reference TEXT;
CREATE UNIQUE INDEX clipping_source_reference_unique ON clippings(source_id,reference) WHERE reference IS NOT NULL;
CREATE TABLE clipping_reviews (
    clipping_id TEXT PRIMARY KEY REFERENCES clippings(id),
    original_text TEXT NOT NULL,
    extracted JSONB NOT NULL,
    priority TEXT NOT NULL CHECK(priority IN ('HIGH','NORMAL','PLANNED')),
    state TEXT NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','DISMISSED','APPROVED')),
    revision INTEGER NOT NULL DEFAULT 1,
    essential_conflict BOOLEAN NOT NULL DEFAULT false,
    reason TEXT NOT NULL DEFAULT '',
    occurrence_id TEXT REFERENCES occurrences(id),
    occurrence_ids TEXT[] NOT NULL DEFAULT '{}',
    queued_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE publication_versions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occurrence_id TEXT NOT NULL REFERENCES occurrences(id),
    version INTEGER NOT NULL,
    action TEXT NOT NULL,
    reason TEXT NOT NULL,
    before_snapshot JSONB,
    after_snapshot JSONB NOT NULL,
    author_id UUID REFERENCES local_accounts(id),
    historical_actor_id UUID REFERENCES historical_actors(id),
    occurred_at TIMESTAMPTZ NOT NULL,
    UNIQUE(occurrence_id,version)
);
-- Existing synthetic records have explicit migration provenance, never an invented human author.
INSERT INTO publication_versions(occurrence_id,version,action,reason,after_snapshot,occurred_at)
SELECT id,revision,'INITIAL','Carga sintética anterior à revisão humana',to_jsonb(o)-'location' || jsonb_build_object('longitude',ST_X(location::geometry),'latitude',ST_Y(location::geometry)),now()
FROM occurrences o;
CREATE TABLE clipping_review_decisions (
    decision_key UUID PRIMARY KEY,
    clipping_id TEXT NOT NULL REFERENCES clipping_reviews(clipping_id),
    revision INTEGER NOT NULL,
    action TEXT NOT NULL,
    reason TEXT NOT NULL,
    command JSONB NOT NULL,
    before_snapshot JSONB NOT NULL,
    after_snapshot JSONB NOT NULL,
    author_id UUID REFERENCES local_accounts(id),
    historical_actor_id UUID REFERENCES historical_actors(id),
    occurred_at TIMESTAMPTZ NOT NULL,
    UNIQUE(clipping_id,revision)
);
CREATE INDEX review_queue_idx ON clipping_reviews(state,priority,queued_at);
