CREATE TABLE local_accounts (
    id UUID PRIMARY KEY,
    display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 80),
    email TEXT NOT NULL UNIQUE CHECK (email = lower(btrim(email)) AND char_length(email) <= 254),
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'USER' CHECK (role = 'USER'),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED')),
    created_at TIMESTAMPTZ NOT NULL,
    confirmed_at TIMESTAMPTZ,
    last_sent_at TIMESTAMPTZ NOT NULL,
    resend_window_start TIMESTAMPTZ NOT NULL,
    resend_count INTEGER NOT NULL DEFAULT 0 CHECK (resend_count >= 0),
    CHECK ((status = 'PENDING' AND confirmed_at IS NULL) OR (status = 'CONFIRMED' AND confirmed_at IS NOT NULL))
);
CREATE TABLE account_confirmation_tokens (
    token_hash CHAR(64) PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES local_accounts(id),
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > created_at),
    consumed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);
CREATE INDEX account_confirmation_account_idx ON account_confirmation_tokens(account_id);
CREATE TABLE account_request_limits (
    action TEXT PRIMARY KEY,
    window_start TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL CHECK (attempts > 0)
);
CREATE TABLE account_audit_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id UUID REFERENCES local_accounts(id),
    occurred_at TIMESTAMPTZ NOT NULL,
    module TEXT NOT NULL DEFAULT 'accounts' CHECK (module = 'accounts'),
    action TEXT NOT NULL CHECK (action IN ('REGISTRATION', 'CONFIRMATION', 'RESEND')),
    outcome TEXT NOT NULL CHECK (outcome IN ('CREATED','ACCEPTED','REJECTED','CONFIRMED','INVALID','EXPIRED','USED','REPLACED','SENT','SUPPRESSED','LIMITED'))
);
