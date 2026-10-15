CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE happenings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sources (
    id TEXT PRIMARY KEY,
    public_name TEXT NOT NULL
);

CREATE TABLE occurrences (
    id TEXT PRIMARY KEY,
    happening_id TEXT NOT NULL REFERENCES happenings (id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('TRANSITO', 'SEGURANCA', 'CONTINGENCIA')),
    occurrence_type TEXT NOT NULL,
    subtype TEXT NOT NULL,
    situation TEXT NOT NULL CHECK (situation IN ('ONGOING', 'CLOSED', 'UNKNOWN')),
    reliability_score SMALLINT NOT NULL CHECK (reliability_score BETWEEN 1 AND 5),
    municipality TEXT NOT NULL,
    neighborhood TEXT NOT NULL,
    location_precision TEXT NOT NULL CHECK (location_precision IN ('POINT', 'TERRITORY')),
    location GEOGRAPHY(POINT, 4326),
    occurred_at TIMESTAMPTZ,
    occurred_from TIMESTAMPTZ,
    occurred_until TIMESTAMPTZ,
    publication_status TEXT NOT NULL CHECK (
        publication_status IN ('PUBLISHED', 'PENDING', 'DISMISSED', 'WITHDRAWN')
    ),
    CONSTRAINT occurrence_location_precision_matches_geometry CHECK (
        (location_precision = 'POINT' AND location IS NOT NULL)
        OR (location_precision = 'TERRITORY' AND location IS NULL)
    ),
    CONSTRAINT occurrence_temporal_precision_is_exclusive CHECK (
        (occurred_at IS NOT NULL AND occurred_from IS NULL AND occurred_until IS NULL)
        OR (
            occurred_at IS NULL
            AND occurred_from IS NOT NULL
            AND occurred_until IS NOT NULL
            AND occurred_from < occurred_until
        )
    )
);

CREATE TABLE clippings (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources (id),
    title TEXT NOT NULL,
    source_published_at TIMESTAMPTZ NOT NULL,
    collected_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE occurrence_clippings (
    occurrence_id TEXT NOT NULL REFERENCES occurrences (id) ON DELETE CASCADE,
    clipping_id TEXT NOT NULL REFERENCES clippings (id) ON DELETE CASCADE,
    PRIMARY KEY (occurrence_id, clipping_id)
);

CREATE INDEX occurrences_happening_idx ON occurrences (happening_id);
CREATE INDEX occurrences_published_time_idx
    ON occurrences (occurred_at, occurred_from, occurred_until)
    WHERE publication_status = 'PUBLISHED';
CREATE INDEX occurrences_category_idx ON occurrences (category, occurrence_type, subtype);
CREATE INDEX occurrences_territory_idx ON occurrences (municipality, neighborhood);
CREATE INDEX occurrences_location_gist_idx ON occurrences USING GIST (location);
CREATE INDEX occurrence_clippings_clipping_idx ON occurrence_clippings (clipping_id);
CREATE INDEX clippings_source_idx ON clippings (source_id);

INSERT INTO happenings (id, title, description) VALUES
    (
        'vu-demo-happening-001',
        'Acontecimento de teste de trânsito e contingência',
        'Contexto inteiramente sintético que relaciona três efeitos independentes.'
    ),
    (
        'vu-demo-happening-002',
        'Acontecimento territorial de demonstração',
        'Contexto sintético localizado somente por bairro.'
    );

INSERT INTO sources (id, public_name) VALUES
    ('vu-demo-source-001', 'Fonte demonstrativa A'),
    ('vu-demo-source-002', 'Fonte demonstrativa B');

INSERT INTO occurrences (
    id, happening_id, title, description, category, occurrence_type, subtype,
    situation, reliability_score, municipality, neighborhood, location_precision,
    location, occurred_at, occurred_from, occurred_until, publication_status
) VALUES
    (
        'vu-demo-occurrence-traffic-001', 'vu-demo-happening-001',
        'Colisão demonstrativa',
        'Fato inteiramente sintético para desenvolvimento local.',
        'TRANSITO', 'ACIDENTE', 'COLISAO', 'UNKNOWN', 3,
        'Rio de Janeiro', 'Centro', 'POINT',
        ST_SetSRID(ST_MakePoint(-43.1915, -22.9033), 4326)::GEOGRAPHY,
        '2026-10-14T15:00:00Z', NULL, NULL, 'PUBLISHED'
    ),
    (
        'vu-demo-occurrence-contingency-001', 'vu-demo-happening-001',
        'Interrupção demonstrativa com intervalo incerto',
        'Fato inteiramente sintético com início e fim aproximados.',
        'CONTINGENCIA', 'ENERGIA', 'NAO_INFORMADO', 'UNKNOWN', 3,
        'Rio de Janeiro', 'Centro', 'POINT',
        ST_Project(
            ST_SetSRID(ST_MakePoint(-43.1915, -22.9033), 4326)::GEOGRAPHY,
            400.0, pi() / 2
        ),
        NULL, '2026-10-14T14:00:00Z', '2026-10-15T16:00:00Z', 'PUBLISHED'
    ),
    (
        'vu-demo-occurrence-contingency-002', 'vu-demo-happening-001',
        'Bloqueio demonstrativo na borda do raio',
        'Ponto sintético construído a exatamente mil metros da referência de teste.',
        'CONTINGENCIA', 'INTERDICAO', 'NAO_INFORMADO', 'ONGOING', 4,
        'Rio de Janeiro', 'Centro', 'POINT',
        ST_Project(
            ST_SetSRID(ST_MakePoint(-43.1915, -22.9033), 4326)::GEOGRAPHY,
            1000.0, pi() / 2
        ),
        '2026-10-15T09:00:00Z', NULL, NULL, 'PUBLISHED'
    ),
    (
        'vu-demo-occurrence-territory-001', 'vu-demo-happening-002',
        'Registro territorial demonstrativo',
        'Localização sintética conhecida somente pelo bairro; nenhuma coordenada foi atribuída.',
        'SEGURANCA', 'FURTO', 'NAO_INFORMADO', 'UNKNOWN', 2,
        'Rio de Janeiro', 'Setor demonstrativo', 'TERRITORY',
        NULL, '2026-10-15T11:00:00Z', NULL, NULL, 'PUBLISHED'
    ),
    (
        'vu-demo-occurrence-pending-control', 'vu-demo-happening-001',
        'Controle não publicado',
        'Registro sintético interno para confirmar a exclusão da resposta pública.',
        'TRANSITO', 'ACIDENTE', 'COLISAO', 'UNKNOWN', 5,
        'Rio de Janeiro', 'Centro', 'POINT',
        ST_SetSRID(ST_MakePoint(-43.1915, -22.9033), 4326)::GEOGRAPHY,
        '2026-10-15T12:00:00Z', NULL, NULL, 'PENDING'
    );

INSERT INTO clippings (id, source_id, title, source_published_at, collected_at) VALUES
    (
        'vu-demo-clipping-001', 'vu-demo-source-001', 'Publicação sintética A',
        '2026-10-14T15:10:00Z', '2026-10-14T15:12:00Z'
    ),
    (
        'vu-demo-clipping-002', 'vu-demo-source-001', 'Publicação sintética B',
        '2026-10-14T15:20:00Z', '2026-10-14T15:22:00Z'
    ),
    (
        'vu-demo-clipping-003', 'vu-demo-source-002', 'Referência sintética C',
        '2026-10-14T15:30:00Z', '2026-10-14T15:32:00Z'
    );

INSERT INTO occurrence_clippings (occurrence_id, clipping_id) VALUES
    ('vu-demo-occurrence-traffic-001', 'vu-demo-clipping-001'),
    ('vu-demo-occurrence-traffic-001', 'vu-demo-clipping-002'),
    ('vu-demo-occurrence-traffic-001', 'vu-demo-clipping-003');
