-- Read-only validated targets for intake. Does not activate territorial editor/prototype.
CREATE TABLE correction_area_targets (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL CHECK(version > 0),
    name TEXT NOT NULL,
    evidence_reference TEXT NOT NULL CHECK(length(trim(evidence_reference)) > 0),
    validated_by UUID REFERENCES local_accounts(id),
    historical_actor_id UUID REFERENCES historical_actors(id),
    validated_at TIMESTAMPTZ NOT NULL,
    CHECK(validated_by IS NOT NULL OR historical_actor_id IS NOT NULL)
);
CREATE TABLE correction_requests (
    id UUID PRIMARY KEY,
    requester_id UUID REFERENCES local_accounts(id),
    target_kind TEXT NOT NULL CHECK(target_kind IN ('OCCURRENCE','AREA')),
    target_id TEXT NOT NULL,
    problem_type TEXT NOT NULL,
    explanation TEXT NOT NULL,
    private_references TEXT NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('RECEIVED','IN_REVIEW','COMPLETED','NOT_APPLICABLE')),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    applied_version INTEGER,
    privacy_review_required BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE correction_decisions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES correction_requests(id),
    version INTEGER NOT NULL,
    previous_state TEXT NOT NULL,
    state TEXT NOT NULL,
    reason TEXT NOT NULL,
    applied_version INTEGER,
    author_id UUID REFERENCES local_accounts(id),
    historical_actor_id UUID REFERENCES historical_actors(id),
    occurred_at TIMESTAMPTZ NOT NULL,
    UNIQUE(request_id,version)
);
CREATE INDEX correction_requester_idx ON correction_requests(requester_id,created_at);
CREATE INDEX correction_queue_idx ON correction_requests(state,created_at);
