-- V1__Initial_Schema.sql
-- Inception Arquitetural & Engenharia de Requisitos - Vetor Urbano
-- DBA: Antigravity AI Pareado
-- RDBMS: PostgreSQL 16 + PostGIS

-- 1. Extensões
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Domínios e Tipos Enumerados
CREATE TYPE user_status AS ENUM ('ACTIVE', 'LOCKED', 'EXPIRED', 'DELETED');

CREATE TYPE incident_category AS ENUM (
    'CRIME_VIOLENT', 'CRIME_PATRIMONIAL', 'TRAFFIC_COLLISION', 
    'FLOODING_CLIMATE', 'INFRASTRUCTURE_FAILURE', 'POLICE_OPERATION'
);

CREATE TYPE incident_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE incident_status AS ENUM ('REPORTED', 'ACTIVE', 'COOLING_DOWN', 'RESOLVED', 'DISMISSED');

CREATE TYPE incident_source AS ENUM ('CITIZEN_APP', 'OPERATOR_CONSOLE', 'API_PARTNER');

CREATE TYPE vote_type AS ENUM ('STILL_HAPPENING', 'CLEARED', 'FAKE');

CREATE TYPE faction_type AS ENUM (
    'COMANDO_VERMELHO', 'TERCEIRO_COMANDO_PURO', 
    'AMIGOS_DOS_AMIGOS', 'MILICIA', 'DISPUTA'
);

-- 3. Tabela de Usuários (RF06, RF07, RNF06)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Criptografia via Argon2id (RNF06)
    status user_status NOT NULL DEFAULT 'ACTIVE',
    failed_login_attempts INT NOT NULL DEFAULT 0,
    mfa_enabled BOOLEAN NOT NULL DEFAULT false, -- RNF08
    totp_secret VARCHAR(255), -- Segredo criptografado para TOTP
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para login insensível a maiúsculas/minúsculas
CREATE UNIQUE INDEX unq_users_email_lower ON users (LOWER(email));

-- 4. Controle de Acesso (RBAC - RF06)
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL -- ROLE_CITIZEN, ROLE_OPERATOR, ROLE_MANAGER
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- Inserindo perfis padrão
INSERT INTO roles (name) VALUES ('ROLE_CITIZEN'), ('ROLE_OPERATOR'), ('ROLE_MANAGER');

-- 5. Tabela de Incidentes (RF01, RF02)
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES users(id), -- Soft delete obrigatório p/ manter rastreabilidade
    reporter_fingerprint VARCHAR(255), -- Hash HMAC p/ controle anti-fraude anônimo (RNF02)
    category incident_category NOT NULL,
    severity incident_severity NOT NULL,
    status incident_status NOT NULL DEFAULT 'REPORTED',
    -- Uso do tipo geography para cálculos precisos (raio métrico via ST_DWithin)
    location GEOGRAPHY(Point, 4326) NOT NULL,
    risk_radius_meters INT DEFAULT 50,
    description TEXT,
    source_type incident_source NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES users(id), -- Operador que validou/modificou
    resolved_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT chk_incidents_bounds CHECK (
        ST_Intersects(location::geometry, ST_MakeEnvelope(-43.9000, -23.1000, -42.9500, -22.4500, 4326))
    )
);

-- Índices Funcionais e Espaciais para Incidentes (RNF01)
CREATE INDEX idx_incidents_location ON incidents USING GIST (location);
CREATE INDEX idx_incidents_status_created ON incidents (status, created_at);
CREATE INDEX idx_incidents_category ON incidents (category);

-- 6. Tabela de Votos (RF04 - Validação Comunitária)
CREATE TABLE incident_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    voter_fingerprint VARCHAR(255),
    vote vote_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
-- Restrição Sybil Attack: 1 voto por usuário ou fingerprint
CREATE UNIQUE INDEX unq_incident_vote_user ON incident_votes (incident_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX unq_incident_vote_fingerprint ON incident_votes (incident_id, voter_fingerprint) WHERE voter_fingerprint IS NOT NULL;

-- 7. Tabela de Zonas Territoriais Conflagradas (RF10, RN-AD01)
CREATE TABLE territory_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    faction faction_type NOT NULL,
    risk_level incident_severity NOT NULL,
    -- GEOMETRY é mais eficiente para ST_Simplify e ST_Intersects com roteamento complexo
    area_polygon GEOMETRY(MultiPolygon, 4326) NOT NULL,
    simplified_polygon GEOMETRY(MultiPolygon, 4326), -- Pré-calculado (RNF10) via Trigger
    last_intelligence_update TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES users(id), -- Operador que cadastrou
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES users(id)  -- Operador que atualizou
);

-- Índices Espaciais para Polígonos (RNF10)
CREATE INDEX idx_territory_zones_area ON territory_zones USING GIST (area_polygon);
CREATE INDEX idx_territory_zones_simplified ON territory_zones USING GIST (simplified_polygon);

-- 8. Automação de Auditoria e Geometria (Triggers)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_incidents_updated_at BEFORE UPDATE ON incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_territory_zones_updated_at BEFORE UPDATE ON territory_zones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para simplificação topológica automática (RNF10)
CREATE OR REPLACE FUNCTION trigger_simplify_territory_polygon()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.simplified_polygon IS NULL THEN
            NEW.simplified_polygon = ST_SimplifyPreserveTopology(NEW.area_polygon, 0.0001);
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.area_polygon IS DISTINCT FROM OLD.area_polygon THEN
            NEW.simplified_polygon = ST_SimplifyPreserveTopology(NEW.area_polygon, 0.0001);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_simplify_territory 
BEFORE INSERT OR UPDATE ON territory_zones 
FOR EACH ROW EXECUTE FUNCTION trigger_simplify_territory_polygon();
