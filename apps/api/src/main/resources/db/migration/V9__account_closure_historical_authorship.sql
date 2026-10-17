-- ADR 0001 / E09–E11 / CA24 (ticket 15C): o encerramento separa a autoria histórica da identidade
-- de login. A referência residual é nova, distinta do identificador da conta — nunca reutilizada —
-- e não existe tabela de correspondência entre autores históricos e cadastros.
CREATE TABLE historical_actors (
    id UUID PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('USER', 'ADMIN')),
    closed_at TIMESTAMPTZ NOT NULL
);

-- Auditoria guarda o ator residual sem cadastro recuperável: USE é eliminada na transação do
-- encerramento (E10); SECURITY e ADMIN mantêm o fato com o ator histórico (E09/E16).
ALTER TABLE auth_audit_events ADD COLUMN historical_actor_id UUID REFERENCES historical_actors (id);
ALTER TABLE account_audit_events ADD COLUMN historical_actor_id UUID REFERENCES historical_actors (id);
ALTER TABLE source_audit_events ADD COLUMN historical_actor_id UUID REFERENCES historical_actors (id);
ALTER TABLE source_access_configurations ADD COLUMN historical_actor_id UUID REFERENCES historical_actors (id);
ALTER TABLE source_versions ADD COLUMN historical_actor_id UUID REFERENCES historical_actors (id);

-- A referência da configuração/versão de fonte passa ao histórico; a configuração segue válida.
ALTER TABLE source_audit_events ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE source_access_configurations ALTER COLUMN created_by DROP NOT NULL;

-- Auditoria de contas: ações e resultados do encerramento e do controle de sessões.
ALTER TABLE account_audit_events DROP CONSTRAINT account_audit_events_action_check;
ALTER TABLE account_audit_events ADD CONSTRAINT account_audit_events_action_check
    CHECK (action IN ('REGISTRATION', 'CONFIRMATION', 'RESEND', 'RECOVERY_REQUEST', 'RECOVERY',
                      'DISPLAY_NAME', 'PASSWORD_CHANGE', 'EMAIL_CHANGE_REQUEST', 'EMAIL_CHANGE',
                      'ACCOUNT_CLOSURE', 'SESSIONS_REVOKED'));
ALTER TABLE account_audit_events DROP CONSTRAINT account_audit_events_outcome_check;
ALTER TABLE account_audit_events ADD CONSTRAINT account_audit_events_outcome_check
    CHECK (outcome IN ('CREATED','ACCEPTED','REJECTED','CONFIRMED','INVALID','EXPIRED','USED','REPLACED','SENT','SUPPRESSED','LIMITED','RECOVERED','CHANGED','CONFLICT','CLOSED','REVOKED'));
