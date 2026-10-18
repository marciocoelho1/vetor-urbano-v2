-- Ticket 26: test-only prototype. NOT a production migration or publication workflow.
CREATE TABLE territorial_identities (
    id UUID PRIMARY KEY,
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0)
);
CREATE TABLE territorial_versions (
    territory_id UUID NOT NULL REFERENCES territorial_identities(id),
    version INTEGER NOT NULL CHECK (version > 0),
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    indicated_group TEXT,
    source_id TEXT REFERENCES sources(id),
    evidence_reference TEXT,
    reference_date DATE,
    limitations TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    boundary geometry NOT NULL,
    PRIMARY KEY (territory_id, version),
    -- Untyped geometry avoids PostGIS silently assigning 4326 to SRID 0 input.
    CHECK (ST_SRID(boundary) = 4326),
    CHECK (GeometryType(boundary) IN ('POLYGON','MULTIPOLYGON')),
    CHECK (ST_NDims(boundary) = 2),
    CHECK (NOT ST_IsEmpty(boundary)),
    CHECK (ST_IsValid(boundary)),
    CHECK (ST_XMin(Box3D(boundary)) >= -180 AND ST_XMax(Box3D(boundary)) <= 180
       AND ST_YMin(Box3D(boundary)) >= -90 AND ST_YMax(Box3D(boundary)) <= 90)
);
