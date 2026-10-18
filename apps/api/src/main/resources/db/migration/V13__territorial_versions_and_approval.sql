-- Synthetic/local territorial history; no external territorial data imported.
CREATE TABLE territorial_identities (
    id UUID PRIMARY KEY,
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
    approved_version INTEGER CHECK (approved_version > 0 AND approved_version <= revision)
);
CREATE TABLE territorial_versions (
    territory_id UUID NOT NULL REFERENCES territorial_identities(id),
    version INTEGER NOT NULL CHECK (version > 0),
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    indicated_group TEXT,
    source_id TEXT REFERENCES sources(id),
    source_version INTEGER,
    evidence_reference TEXT,
    reference_date DATE,
    limitations TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    boundary geometry NOT NULL,
    author_id UUID REFERENCES local_accounts(id),
    historical_actor_id UUID REFERENCES historical_actors(id),
    actor_role TEXT NOT NULL CHECK (actor_role IN ('ADMIN','USER')),
    justification TEXT NOT NULL CHECK (btrim(justification) <> ''),
    PRIMARY KEY (territory_id, version),
    FOREIGN KEY(source_id,source_version) REFERENCES source_versions(source_id,version),
    CHECK ((source_id IS NULL)=(source_version IS NULL)),
    CHECK (num_nonnulls(author_id,historical_actor_id)=1),
    CHECK (indicated_group IS DISTINCT FROM 'Disputado' OR nullif(btrim(evidence_reference),'') IS NOT NULL),
    -- Deliberately no typmod: SRID 0 must never be silently promoted to 4326.
    CHECK (ST_SRID(boundary) = 4326),
    CHECK (GeometryType(boundary) IN ('POLYGON','MULTIPOLYGON')),
    CHECK (ST_NDims(boundary) = 2),
    CHECK (NOT ST_IsEmpty(boundary)),
    CHECK (ST_IsValid(boundary)),
    CHECK (ST_XMin(Box3D(boundary)) >= -180 AND ST_XMax(Box3D(boundary)) <= 180
       AND ST_YMin(Box3D(boundary)) >= -90 AND ST_YMax(Box3D(boundary)) <= 90)
);
ALTER TABLE territorial_identities ADD FOREIGN KEY (id,approved_version)
    REFERENCES territorial_versions(territory_id,version) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE territorial_approvals (
    territory_id UUID NOT NULL,
    version INTEGER NOT NULL,
    previous_version INTEGER,
    author_id UUID REFERENCES local_accounts(id),
    historical_actor_id UUID REFERENCES historical_actors(id),
    actor_role TEXT NOT NULL CHECK(actor_role='ADMIN'),
    justification TEXT NOT NULL CHECK(btrim(justification)<>''),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(territory_id,version),
    FOREIGN KEY(territory_id,version) REFERENCES territorial_versions(territory_id,version),
    CHECK(num_nonnulls(author_id,historical_actor_id)=1)
);
CREATE TABLE territorial_audit_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    territory_id UUID NOT NULL REFERENCES territorial_identities(id),
    action TEXT NOT NULL CHECK(action IN ('TERRITORY_REVISED','TERRITORY_APPROVED')),
    before_snapshot JSONB,
    after_snapshot JSONB NOT NULL,
    author_id UUID REFERENCES local_accounts(id),
    historical_actor_id UUID REFERENCES historical_actors(id),
    actor_role TEXT NOT NULL CHECK(actor_role='ADMIN'),
    justification TEXT NOT NULL CHECK(btrim(justification)<>''),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CHECK(num_nonnulls(author_id,historical_actor_id)=1)
);
-- Territorial administration is ADMIN, never SECURITY or individual query use.
ALTER TABLE auth_audit_events DROP CONSTRAINT auth_audit_events_module_check;
ALTER TABLE auth_audit_events ADD CONSTRAINT auth_audit_events_module_check
    CHECK(module IN ('access','query','audit','territories'));
ALTER TABLE auth_audit_events ALTER COLUMN event_class SET EXPRESSION AS
    (CASE WHEN module='query' THEN 'USE' WHEN module IN ('audit','territories') THEN 'ADMIN' ELSE 'SECURITY' END);

-- Missing evidence stays unknown, not an invented reference. Projection populated only on approval.
ALTER TABLE correction_area_targets ALTER COLUMN evidence_reference DROP NOT NULL;

-- Domain content is immutable. Only the irreversible account-closure detachment may update authorship.
CREATE FUNCTION territorial_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP='UPDATE' AND OLD.author_id IS NOT NULL AND NEW.author_id IS NULL
       AND OLD.historical_actor_id IS NULL AND NEW.historical_actor_id IS NOT NULL
       AND (to_jsonb(NEW)-'author_id'-'historical_actor_id')=(to_jsonb(OLD)-'author_id'-'historical_actor_id') THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Territorial history is immutable' USING ERRCODE='23514';
END $$;
CREATE TRIGGER territorial_versions_immutable BEFORE UPDATE OR DELETE ON territorial_versions
    FOR EACH ROW EXECUTE FUNCTION territorial_history_immutable();
CREATE TRIGGER territorial_approvals_immutable BEFORE UPDATE OR DELETE ON territorial_approvals
    FOR EACH ROW EXECUTE FUNCTION territorial_history_immutable();
CREATE TRIGGER territorial_audit_immutable BEFORE UPDATE OR DELETE ON territorial_audit_events
    FOR EACH ROW EXECUTE FUNCTION territorial_history_immutable();
