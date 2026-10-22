-- Ticket 24: decisão mensal sobre a nota da fonte a partir de resultados verificados.
-- Rubrica e parâmetros aprovados em 22/10/2026 (docs/history/ticket-23-24-calibration-proposal-2026-10-22.md):
-- amostra mínima de 10 afirmações aplicáveis na janela de 90 dias, descer só com ≥30% de incorretas e
-- ≥3 casos confirmados, subir só com ≥20 verificações e nenhuma incorreta, erro do sistema fora da amostra.
CREATE TABLE source_statement_verifications (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources (id) ON DELETE RESTRICT,
    statement_key TEXT NOT NULL CHECK (length(btrim(statement_key)) BETWEEN 1 AND 200),
    statement_excerpt TEXT NOT NULL CHECK (length(btrim(statement_excerpt)) BETWEEN 1 AND 2000),
    result TEXT NOT NULL CHECK (result IN (
        'CONFIRMED', 'DISPROVEN', 'CORRECTED_BY_SOURCE', 'INCONCLUSIVE', 'SYSTEM_ERROR')),
    note TEXT NOT NULL CHECK (length(btrim(note)) BETWEEN 1 AND 2000),
    occurrence_id TEXT REFERENCES occurrences (id) ON DELETE RESTRICT,
    -- Autoria sem FK: o resultado sobrevive ao encerramento/expurgo de contas; a escrita é auditada
    -- e o ator vem da sessão autenticada.
    recorded_by UUID NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX source_statement_verifications_window_idx
    ON source_statement_verifications (source_id, statement_key, recorded_at DESC);

CREATE FUNCTION source_statement_verifications_immutable() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Source statement verification history is immutable' USING ERRCODE='23514';
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER source_statement_verifications_immutable
    BEFORE UPDATE OR DELETE ON source_statement_verifications
    FOR EACH ROW EXECUTE FUNCTION source_statement_verifications_immutable();

CREATE TABLE source_rating_decisions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources (id) ON DELETE RESTRICT,
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    window_days INTEGER NOT NULL CHECK (window_days > 0),
    sample_applicable INTEGER NOT NULL CHECK (sample_applicable >= 0),
    sample_confirmed INTEGER NOT NULL CHECK (sample_confirmed >= 0),
    sample_disproven INTEGER NOT NULL CHECK (sample_disproven >= 0),
    sample_inconclusive INTEGER NOT NULL CHECK (sample_inconclusive >= 0),
    sample_corrected INTEGER NOT NULL CHECK (sample_corrected >= 0),
    sample_system_errors INTEGER NOT NULL CHECK (sample_system_errors >= 0),
    recommendation TEXT NOT NULL CHECK (recommendation IN (
        'UPGRADE', 'KEEP', 'DOWNGRADE', 'INSUFFICIENT_SAMPLE')),
    justification TEXT NOT NULL CHECK (length(btrim(justification)) BETWEEN 20 AND 2000),
    decision TEXT NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
    previous_rating SMALLINT NOT NULL CHECK (previous_rating BETWEEN 1 AND 5),
    applied_rating SMALLINT CHECK (applied_rating BETWEEN 1 AND 5),
    applied_source_version INTEGER,
    author_id UUID NOT NULL,
    decided_at TIMESTAMPTZ NOT NULL,
    CHECK (window_start < window_end),
    CHECK ((decision = 'APPROVED') = (applied_rating IS NOT NULL)),
    CHECK (applied_rating IS NULL OR applied_rating <> previous_rating)
);
CREATE INDEX source_rating_decisions_source_idx ON source_rating_decisions (source_id, decided_at DESC);

CREATE FUNCTION source_rating_decisions_immutable() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Source rating decision history is immutable' USING ERRCODE='23514';
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER source_rating_decisions_immutable
    BEFORE UPDATE OR DELETE ON source_rating_decisions
    FOR EACH ROW EXECUTE FUNCTION source_rating_decisions_immutable();

-- Sinaliza ocorrências sem trocar a nota delas: a reavaliação é uma nova avaliação explícita (ticket 23).
CREATE TABLE source_reevaluation_flags (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources (id) ON DELETE RESTRICT,
    occurrence_id TEXT NOT NULL REFERENCES occurrences (id) ON DELETE RESTRICT,
    decision_id BIGINT NOT NULL REFERENCES source_rating_decisions (id) ON DELETE RESTRICT,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    UNIQUE (decision_id, occurrence_id)
);

CREATE FUNCTION source_reevaluation_flags_update_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Source reevaluation flags are append-only' USING ERRCODE='23514';
    END IF;
    -- Só a resolução é aceita, uma única vez, sem reescrever a origem do sinal.
    IF OLD.resolved_at IS NOT NULL OR NEW.resolved_at IS NULL
        OR (to_jsonb(NEW) - 'resolved_at') IS DISTINCT FROM (to_jsonb(OLD) - 'resolved_at') THEN
        RAISE EXCEPTION 'Source reevaluation flags are append-only' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER source_reevaluation_flags_guard
    BEFORE UPDATE OR DELETE ON source_reevaluation_flags
    FOR EACH ROW EXECUTE FUNCTION source_reevaluation_flags_update_guard();
