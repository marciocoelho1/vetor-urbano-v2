-- Ticket 15 / E01, E15: recuperação de acesso por link de posse, uso único e prazo curto.
-- Recuperação é jornada distinta da confirmação de cadastro: não reutiliza account_confirmation_tokens.
CREATE TABLE account_recovery_tokens (
    token_hash CHAR(64) PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES local_accounts(id),
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > created_at),
    consumed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);
CREATE INDEX account_recovery_account_idx ON account_recovery_tokens(account_id);
-- Limite de reexpedição por conta (cooldown e janela de uma hora), persistente como no cadastro.
-- Nulas de propósito, diferente de `last_sent_at`/`resend_window_start` em V2: aqui "nunca pediu
-- recuperação" é um estado legítimo e distinto, e o registro de cadastro (V2) não é alterado.
ALTER TABLE local_accounts ADD COLUMN recovery_sent_at TIMESTAMPTZ;
ALTER TABLE local_accounts ADD COLUMN recovery_window_start TIMESTAMPTZ;
ALTER TABLE local_accounts ADD COLUMN recovery_count INTEGER NOT NULL DEFAULT 0 CHECK (recovery_count >= 0);
ALTER TABLE account_audit_events DROP CONSTRAINT account_audit_events_action_check;
ALTER TABLE account_audit_events ADD CONSTRAINT account_audit_events_action_check
    CHECK (action IN ('REGISTRATION', 'CONFIRMATION', 'RESEND', 'RECOVERY_REQUEST', 'RECOVERY'));
ALTER TABLE account_audit_events DROP CONSTRAINT account_audit_events_outcome_check;
ALTER TABLE account_audit_events ADD CONSTRAINT account_audit_events_outcome_check
    CHECK (outcome IN ('CREATED','ACCEPTED','REJECTED','CONFIRMED','INVALID','EXPIRED','USED','REPLACED','SENT','SUPPRESSED','LIMITED','RECOVERED'));
