-- Human decisions are versioned per effect; expiration never mutates factual situation.
CREATE TABLE occurrence_verifications (
    occurrence_id TEXT NOT NULL REFERENCES occurrences(id),
    verification_version INTEGER NOT NULL CHECK(verification_version > 0),
    effect_version INTEGER NOT NULL CHECK(effect_version > 0),
    previous_situation TEXT NOT NULL CHECK(previous_situation IN ('ONGOING','CLOSED','UNKNOWN')),
    situation TEXT NOT NULL CHECK(situation IN ('ONGOING','CLOSED','UNKNOWN')),
    evidence TEXT NOT NULL CHECK(btrim(evidence) <> ''),
    confirmed_at TIMESTAMPTZ NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    author_id UUID REFERENCES local_accounts(id),
    historical_actor_id UUID REFERENCES historical_actors(id),
    actor_role TEXT NOT NULL CHECK(actor_role IN ('USER','ADMIN')),
    PRIMARY KEY(occurrence_id,verification_version),
    CHECK(num_nonnulls(author_id,historical_actor_id)=1),
    CHECK(confirmed_at <= recorded_at),
    CHECK(expires_at IS NULL OR expires_at > confirmed_at)
);
CREATE TRIGGER occurrence_verifications_immutable BEFORE UPDATE OR DELETE ON occurrence_verifications
    FOR EACH ROW EXECUTE FUNCTION territorial_history_immutable();
