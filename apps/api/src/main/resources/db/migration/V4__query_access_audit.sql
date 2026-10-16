ALTER TABLE auth_audit_events DROP CONSTRAINT auth_audit_events_module_check;
ALTER TABLE auth_audit_events ADD CONSTRAINT auth_audit_events_module_check CHECK (module IN ('access','query'));
ALTER TABLE auth_audit_events ADD COLUMN parameters JSONB NOT NULL DEFAULT '{}';
