-- E04/E16: classify by purpose; domain versions are intentionally outside these tables.
ALTER TABLE auth_audit_events DROP CONSTRAINT auth_audit_events_module_check;
ALTER TABLE auth_audit_events ADD CONSTRAINT auth_audit_events_module_check
    CHECK (module IN ('access', 'query', 'audit'));
ALTER TABLE auth_audit_events ADD COLUMN event_class TEXT GENERATED ALWAYS AS
    (CASE WHEN module = 'query' THEN 'USE' WHEN module = 'audit' THEN 'ADMIN' ELSE 'SECURITY' END) STORED;
ALTER TABLE account_audit_events ADD COLUMN event_class TEXT GENERATED ALWAYS AS ('SECURITY'::text) STORED;
ALTER TABLE source_audit_events ADD COLUMN event_class TEXT GENERATED ALWAYS AS ('ADMIN'::text) STORED;
CREATE INDEX auth_audit_expiry_idx ON auth_audit_events(event_class, occurred_at);
CREATE INDEX account_audit_expiry_idx ON account_audit_events(occurred_at);
CREATE INDEX source_audit_expiry_idx ON source_audit_events(occurred_at);
