-- Ticket 23: regra calibrada e versionada de confiabilidade da ocorrência.
-- Parâmetros v1 aprovados pelo responsável em 22/10/2026 (proposta registrada em
-- docs/history/ticket-23-24-calibration-proposal-2026-10-22.md). Mudar parâmetro exige nova versão:
-- avaliações históricas permanecem íntegras e nunca são recalculadas em silêncio.
ALTER TABLE auth_audit_events DROP CONSTRAINT auth_audit_events_module_check;
ALTER TABLE auth_audit_events ADD CONSTRAINT auth_audit_events_module_check
    CHECK(module IN ('access','query','audit','territories','operations','reliability'));
ALTER TABLE auth_audit_events ALTER COLUMN event_class SET EXPRESSION AS
    (CASE WHEN module='query' THEN 'USE'
          WHEN module IN ('audit','territories','operations','reliability') THEN 'ADMIN'
          ELSE 'SECURITY' END);

CREATE TABLE reliability_rules (
    version INTEGER PRIMARY KEY CHECK (version > 0),
    parameters JSONB NOT NULL CHECK (jsonb_typeof(parameters) = 'object'),
    summary TEXT NOT NULL CHECK (length(btrim(summary)) BETWEEN 20 AND 2000),
    provenance TEXT NOT NULL CHECK (provenance IN ('SEEDED_APPROVED','ACCOUNT')),
    -- Sem FK para local_accounts: a regra aprovada precisa sobreviver ao expurgo de contas de teste
    -- e ao encerramento de conta. A autoria é validada na escrita (ator vem da sessão autenticada).
    author_id UUID,
    created_at TIMESTAMPTZ NOT NULL,
    CHECK ((provenance = 'SEEDED_APPROVED' AND author_id IS NULL)
        OR (provenance = 'ACCOUNT' AND author_id IS NOT NULL))
);

CREATE FUNCTION reliability_rules_immutable() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Reliability rule history is immutable' USING ERRCODE='23514';
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER reliability_rules_immutable BEFORE UPDATE OR DELETE ON reliability_rules
    FOR EACH ROW EXECUTE FUNCTION reliability_rules_immutable();

CREATE TABLE occurrence_reliability_evaluations (
    occurrence_id TEXT NOT NULL REFERENCES occurrences (id) ON DELETE RESTRICT,
    evaluation_version INTEGER NOT NULL CHECK (evaluation_version > 0),
    evaluation_key UUID NOT NULL,
    rule_version INTEGER NOT NULL REFERENCES reliability_rules (version) ON DELETE RESTRICT,
    note SMALLINT NOT NULL CHECK (note BETWEEN 1 AND 5),
    factors JSONB NOT NULL CHECK (jsonb_typeof(factors) = 'object'),
    blocking JSONB NOT NULL CHECK (jsonb_typeof(blocking) = 'array'),
    context JSONB NOT NULL CHECK (jsonb_typeof(context) = 'object'),
    state TEXT NOT NULL DEFAULT 'RECORDED' CHECK (state IN ('RECORDED','PUBLISHED')),
    published_at TIMESTAMPTZ,
    author_id UUID NOT NULL REFERENCES local_accounts (id) ON DELETE RESTRICT,
    evaluated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (occurrence_id, evaluation_version),
    UNIQUE (occurrence_id, evaluation_key),
    CHECK ((state = 'PUBLISHED') = (published_at IS NOT NULL))
);
CREATE INDEX occurrence_reliability_published_idx
    ON occurrence_reliability_evaluations (occurrence_id, evaluation_version DESC)
    WHERE state = 'PUBLISHED';

-- Uma avaliação registrada nunca é reescrita: só a primeira publicação da própria nota avança
-- RECORDED -> PUBLISHED, uma vez. Notas antigas continuam visíveis na história.
CREATE FUNCTION reliability_evaluations_immutable() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Reliability evaluation history is immutable' USING ERRCODE='23514';
    END IF;
    IF OLD.state <> 'RECORDED' OR NEW.state <> 'PUBLISHED'
        OR (to_jsonb(NEW) - 'state' - 'published_at')
            IS DISTINCT FROM (to_jsonb(OLD) - 'state' - 'published_at') THEN
        RAISE EXCEPTION 'Reliability evaluation history is immutable' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER occurrence_reliability_evaluations_immutable
    BEFORE UPDATE OR DELETE ON occurrence_reliability_evaluations
    FOR EACH ROW EXECUTE FUNCTION reliability_evaluations_immutable();

INSERT INTO reliability_rules (version, parameters, summary, provenance, created_at) VALUES (
    1,
    '{
        "schemaVersion": 1,
        "approvedOn": "2026-10-22",
        "noteRange": [1, 5],
        "qualityFactor": "HIGHEST_TRACEABLE_INDEPENDENT_SOURCE_RATING",
        "neutralBase": 3,
        "neutralBaseReason": "Sem fonte de suporte com referência rastreável parte-se do centro da escala; desconhecido nunca vira zero.",
        "reproductionWindowMinutes": 120,
        "corroborationBonus": { "1": 0.0, "2": 0.5, "3": 1.0 },
        "corroborationCap": 3,
        "divergenceAsBlocking": true,
        "rounding": "HALF_UP",
        "referenceRequiresTraceableReference": true,
        "notInformedValues": ["NAO_INFORMADO", "Não informado", "Não Informado", "DESCONHECIDO", "DESCONHECIDA", "UNKNOWN"],
        "notApplicableValues": ["NAO_SE_APLICA", "NÃO SE APLICA", "Não se aplica"],
        "essentialFields": [
            { "field": "title", "allowsNotInformed": false, "allowsNotApplicable": false },
            { "field": "description", "allowsNotInformed": false, "allowsNotApplicable": false },
            { "field": "category", "allowsNotInformed": false, "allowsNotApplicable": false },
            { "field": "type", "allowsNotInformed": false, "allowsNotApplicable": false },
            { "field": "situation", "allowsNotInformed": true, "allowsNotApplicable": true },
            { "field": "municipality", "allowsNotInformed": false, "allowsNotApplicable": false },
            { "field": "locationPrecision", "allowsNotInformed": false, "allowsNotApplicable": false },
            { "field": "temporal", "allowsNotInformed": false, "allowsNotApplicable": false }
        ]
    }'::jsonb,
    'Regra v1 aprovada em 22/10/2026: referência é a maior nota entre fontes independentes com referência rastreável, reprodução conta uma vez pela origem, bônus de corroboração 0/0,5/1,0, ausência de essencial e conflito essencial bloqueiam, desconhecido nunca vira zero.',
    'SEEDED_APPROVED',
    TIMESTAMPTZ '2026-10-22 00:00:00Z'
);
