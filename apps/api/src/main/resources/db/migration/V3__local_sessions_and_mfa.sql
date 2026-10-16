ALTER TABLE local_accounts DROP CONSTRAINT local_accounts_role_check;
ALTER TABLE local_accounts ADD CONSTRAINT local_accounts_role_check CHECK (role IN ('USER','ADMIN'));
ALTER TABLE local_accounts ADD COLUMN security_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE local_accounts ADD COLUMN mfa_secret TEXT;
ALTER TABLE local_accounts ADD COLUMN mfa_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE local_accounts ADD COLUMN mfa_counter BIGINT NOT NULL DEFAULT -1;
CREATE TABLE local_sessions (
    token_hash CHAR(64) PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES local_accounts(id),
    security_version BIGINT NOT NULL,
    mfa_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);
CREATE INDEX local_sessions_account_idx ON local_sessions(account_id);
CREATE TABLE auth_request_limits (
    bucket TEXT PRIMARY KEY,
    window_start TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL CHECK(attempts > 0)
);
CREATE TABLE auth_audit_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id UUID REFERENCES local_accounts(id),
    occurred_at TIMESTAMPTZ NOT NULL,
    module TEXT NOT NULL DEFAULT 'access' CHECK(module = 'access'),
    action TEXT NOT NULL,
    outcome TEXT NOT NULL
);
