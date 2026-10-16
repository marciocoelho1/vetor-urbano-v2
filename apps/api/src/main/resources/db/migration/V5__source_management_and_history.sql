ALTER TABLE sources
    ADD COLUMN current_version INTEGER NOT NULL DEFAULT 1 CHECK (current_version > 0);

CREATE TABLE source_access_configurations (
    id UUID PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources (id) ON DELETE RESTRICT,
    version INTEGER NOT NULL CHECK (version > 0),
    method TEXT NOT NULL CHECK (method IN ('MANUAL', 'PUBLIC_PAGE', 'RSS', 'PUBLIC_API', 'OTHER')),
    created_by UUID REFERENCES local_accounts (id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT source_access_configuration_version_unique UNIQUE (source_id, version),
    CONSTRAINT source_access_configuration_id_unique UNIQUE (source_id, id),
    CONSTRAINT source_access_configuration_version_id_unique UNIQUE (source_id, version, id)
);

CREATE TABLE source_versions (
    id UUID PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources (id) ON DELETE RESTRICT,
    version INTEGER NOT NULL CHECK (version > 0),
    name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
    channel TEXT NOT NULL CHECK (length(btrim(channel)) BETWEEN 1 AND 160),
    public_url TEXT,
    territories JSONB NOT NULL CHECK (
        jsonb_typeof(territories) = 'array' AND jsonb_array_length(territories) > 0
    ),
    pillars JSONB NOT NULL CHECK (
        jsonb_typeof(pillars) = 'array' AND jsonb_array_length(pillars) > 0
    ),
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    rating_justification TEXT NOT NULL CHECK (length(btrim(rating_justification)) BETWEEN 1 AND 2000),
    access_configuration_id UUID NOT NULL,
    author_id UUID REFERENCES local_accounts (id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT source_version_number_unique UNIQUE (source_id, version),
    CONSTRAINT source_version_id_unique UNIQUE (source_id, id),
    CONSTRAINT source_version_access_configuration_fk FOREIGN KEY
        (source_id, version, access_configuration_id)
        REFERENCES source_access_configurations (source_id, version, id) ON DELETE RESTRICT
);

CREATE INDEX source_versions_history_idx ON source_versions (source_id, version DESC);

CREATE TABLE source_audit_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources (id) ON DELETE RESTRICT,
    actor_id UUID NOT NULL REFERENCES local_accounts (id) ON DELETE RESTRICT,
    occurred_at TIMESTAMPTZ NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE')),
    before_version_id UUID,
    after_version_id UUID NOT NULL,
    before_access_configuration_id UUID,
    after_access_configuration_id UUID NOT NULL,
    before_snapshot JSONB,
    after_snapshot JSONB NOT NULL,
    CONSTRAINT source_audit_before_version_fk FOREIGN KEY (source_id, before_version_id)
        REFERENCES source_versions (source_id, id) ON DELETE RESTRICT,
    CONSTRAINT source_audit_after_version_fk FOREIGN KEY (source_id, after_version_id)
        REFERENCES source_versions (source_id, id) ON DELETE RESTRICT,
    CONSTRAINT source_audit_before_access_fk FOREIGN KEY (source_id, before_access_configuration_id)
        REFERENCES source_access_configurations (source_id, id) ON DELETE RESTRICT,
    CONSTRAINT source_audit_after_access_fk FOREIGN KEY (source_id, after_access_configuration_id)
        REFERENCES source_access_configurations (source_id, id) ON DELETE RESTRICT,
    CONSTRAINT source_audit_create_has_no_before CHECK (
        (action = 'CREATE' AND before_version_id IS NULL AND before_access_configuration_id IS NULL AND before_snapshot IS NULL)
        OR (action = 'UPDATE' AND before_version_id IS NOT NULL AND before_access_configuration_id IS NOT NULL AND before_snapshot IS NOT NULL)
    )
);

DO $$
DECLARE
    source_row RECORD;
    access_id UUID;
BEGIN
    FOR source_row IN SELECT id, public_name FROM sources ORDER BY id LOOP
        access_id := gen_random_uuid();
        INSERT INTO source_access_configurations (
            id, source_id, version, method, created_at
        ) VALUES (
            access_id, source_row.id, 1, 'OTHER', now()
        );

        INSERT INTO source_versions (
            id, source_id, version, name, channel, public_url, territories, pillars,
            rating, rating_justification, access_configuration_id, author_id, created_at
        ) VALUES (
            gen_random_uuid(), source_row.id, 1, source_row.public_name,
            'Canal sintético ' || right(source_row.id, 3), NULL,
            '["Rio de Janeiro"]'::jsonb,
            '["TRANSITO","SEGURANCA","CONTINGENCIA"]'::jsonb,
            3, 'Nota fictícia para desenvolvimento; não é avaliação de uma fonte real.',
            access_id, NULL, now()
        );
    END LOOP;
END $$;
