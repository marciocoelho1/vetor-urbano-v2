-- Ticket 15B / E02, E14, E15: troca de e-mail confirmada no novo endereço.
-- O endereço pendente vive só na linha do token; `local_accounts.email` só muda na confirmação.
CREATE TABLE account_email_change_tokens (
    token_hash CHAR(64) PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES local_accounts(id),
    pending_email TEXT NOT NULL CHECK (pending_email = lower(btrim(pending_email)) AND char_length(pending_email) <= 254),
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > created_at),
    consumed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);
CREATE INDEX account_email_change_account_idx ON account_email_change_tokens(account_id);
-- Limite de reexpedição por conta: mesmos valores locais do cadastro, contador e janela próprios.
-- Nulas de propósito: "nunca pediu troca de e-mail" é estado legítimo e distinto.
ALTER TABLE local_accounts ADD COLUMN email_change_sent_at TIMESTAMPTZ;
ALTER TABLE local_accounts ADD COLUMN email_change_window_start TIMESTAMPTZ;
ALTER TABLE local_accounts ADD COLUMN email_change_count INTEGER NOT NULL DEFAULT 0 CHECK (email_change_count >= 0);
-- Auditoria de contas: ações e resultados desta fatia (alterações autenticadas).
ALTER TABLE account_audit_events DROP CONSTRAINT account_audit_events_action_check;
ALTER TABLE account_audit_events ADD CONSTRAINT account_audit_events_action_check
    CHECK (action IN ('REGISTRATION', 'CONFIRMATION', 'RESEND', 'RECOVERY_REQUEST', 'RECOVERY',
                      'DISPLAY_NAME', 'PASSWORD_CHANGE', 'EMAIL_CHANGE_REQUEST', 'EMAIL_CHANGE'));
ALTER TABLE account_audit_events DROP CONSTRAINT account_audit_events_outcome_check;
ALTER TABLE account_audit_events ADD CONSTRAINT account_audit_events_outcome_check
    CHECK (outcome IN ('CREATED','ACCEPTED','REJECTED','CONFIRMED','INVALID','EXPIRED','USED','REPLACED','SENT','SUPPRESSED','LIMITED','RECOVERED','CHANGED','CONFLICT'));
