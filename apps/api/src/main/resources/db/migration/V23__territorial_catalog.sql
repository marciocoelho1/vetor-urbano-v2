-- Catálogo territorial administrativo versionado: município, bairro, RA e AP.
-- Módulo distinto de `territorial_versions` (Áreas de Risco, V13): o ticket UXH-03 proíbe tratá-los
-- como equivalentes, então nada aqui referencia nem reutiliza aquele histórico.
--
-- Regras de proveniência: todo polígono pertence a um `catalog_datasets` com origem, licença,
-- atribuição, data-base, instante de obtenção, checksum do arquivo original e limitações. Sem isso
-- não há como provar a trilha de transformação exigida no primeiro critério de aceite.
--
-- `internal_point` NÃO é escolhido por quem insere: um gatilho o deriva de ST_PointOnSurface, e o
-- CHECK ST_Contains garante ponto interno real. Centroide de bounding box e média de ocorrências
-- ficam impossíveis por construção (o chamador não controla a coluna).

CREATE TABLE catalog_datasets (
    id UUID PRIMARY KEY,
    source TEXT NOT NULL CHECK (btrim(source) <> ''),
    source_url TEXT NOT NULL CHECK (source_url ~ '^https://'),
    license TEXT NOT NULL CHECK (btrim(license) <> ''),
    attribution TEXT NOT NULL CHECK (btrim(attribution) <> ''),
    reference_date DATE NOT NULL,
    obtained_at TIMESTAMPTZ NOT NULL,
    -- sha256 do arquivo original preservado fora do banco: 64 dígitos hexadecimais minúsculos.
    checksum TEXT NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
    limitations TEXT NOT NULL CHECK (btrim(limitations) <> ''),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE catalog_territories (
    id UUID PRIMARY KEY,
    level TEXT NOT NULL CHECK (level IN ('MUNICIPALITY','BAIRRO','RA','AP')),
    -- Município usa o código IBGE de 7 dígitos; os demais níveis, o código da própria fonte.
    official_code TEXT NOT NULL CHECK (btrim(official_code) <> ''),
    parent_id UUID REFERENCES catalog_territories(id),
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    -- Derivado por gatilho (caixa alta, sem acentos): busca do catálogo não depende do cliente.
    normalized_name TEXT NOT NULL CHECK (btrim(normalized_name) <> ''),
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
    approved_version INTEGER,
    UNIQUE (level, official_code),
    CHECK (level <> 'MUNICIPALITY' OR official_code ~ '^[0-9]{7}$'),
    -- Hierarquia: bairro, RA e AP pertencem a um município; município não tem pai.
    CHECK ((level = 'MUNICIPALITY') = (parent_id IS NULL)),
    CHECK ((approved_version IS NULL) OR (approved_version > 0 AND approved_version <= revision))
);

CREATE TABLE catalog_territory_versions (
    territory_id UUID NOT NULL REFERENCES catalog_territories(id),
    version INTEGER NOT NULL CHECK (version > 0),
    dataset_id UUID NOT NULL REFERENCES catalog_datasets(id),
    -- Deliberadamente sem typmod: SRID 0 nunca é promovido silenciosamente para 4326.
    boundary geometry NOT NULL,
    internal_point geometry NOT NULL,
    reference_date DATE NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (territory_id, version),
    CHECK (ST_SRID(boundary) = 4326),
    CHECK (GeometryType(boundary) IN ('POLYGON','MULTIPOLYGON')),
    CHECK (ST_NDims(boundary) = 2),
    CHECK (NOT ST_IsEmpty(boundary)),
    CHECK (ST_IsValid(boundary)),
    CHECK (ST_XMin(Box3D(boundary)) >= -180 AND ST_XMax(Box3D(boundary)) <= 180
       AND ST_YMin(Box3D(boundary)) >= -90 AND ST_YMax(Box3D(boundary)) <= 90),
    CHECK (ST_SRID(internal_point) = 4326),
    CHECK (GeometryType(internal_point) = 'POINT'),
    CHECK (ST_NDims(internal_point) = 2),
    CHECK (ST_Contains(boundary, internal_point))
);

ALTER TABLE catalog_territories ADD FOREIGN KEY (id, approved_version)
    REFERENCES catalog_territory_versions(territory_id, version) DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX catalog_territory_versions_boundary_gist
    ON catalog_territory_versions USING GIST (boundary);
CREATE INDEX catalog_territories_level_name_idx
    ON catalog_territories (level, normalized_name);

-- Nome normalizado é derivado, nunca digitado: evita divergência entre busca e exibição.
CREATE FUNCTION catalog_normalize_name() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.normalized_name := upper(unaccent(btrim(NEW.name)));
    RETURN NEW;
END $$;
CREATE TRIGGER catalog_territories_normalize BEFORE INSERT OR UPDATE OF name ON catalog_territories
    FOR EACH ROW EXECUTE FUNCTION catalog_normalize_name();

-- Ponto representativo é sempre derivado do polígono persistido. Quem inserir um ponto diferente
-- tem o valor sobrescrito: não existe caminho para centro inventado.
CREATE FUNCTION catalog_derive_internal_point() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.internal_point := ST_PointOnSurface(NEW.boundary);
    RETURN NEW;
END $$;
CREATE TRIGGER catalog_territory_versions_internal_point BEFORE INSERT ON catalog_territory_versions
    FOR EACH ROW EXECUTE FUNCTION catalog_derive_internal_point();

-- Trilha de proveniência e geometria publicada são imutáveis; correção entra como nova versão.
CREATE FUNCTION catalog_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Catalog territorial history is immutable' USING ERRCODE='23514';
END $$;
CREATE TRIGGER catalog_territory_versions_immutable BEFORE UPDATE OR DELETE ON catalog_territory_versions
    FOR EACH ROW EXECUTE FUNCTION catalog_history_immutable();
CREATE TRIGGER catalog_datasets_immutable BEFORE UPDATE OR DELETE ON catalog_datasets
    FOR EACH ROW EXECUTE FUNCTION catalog_history_immutable();

COMMENT ON TABLE catalog_datasets IS
    'Proveniência imutável de cada conjunto territorial ingerido (UXH-03, critério 1).';
COMMENT ON COLUMN catalog_territory_versions.internal_point IS
    'ST_PointOnSurface(boundary) derivado por gatilho; centro do raio do mapa e da câmera.';
COMMENT ON COLUMN catalog_territories.approved_version IS
    'Versão publicada no endpoint público; revisão sem aprovação não vaza para /api/v1/territories.';
