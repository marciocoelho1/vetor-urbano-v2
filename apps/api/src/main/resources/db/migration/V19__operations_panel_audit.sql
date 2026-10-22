-- Ticket 22: leitura do painel de operação é ato administrativo, não uso de consulta.
-- Mantém as classes de evento já existentes: 'operations' entra como ADMIN, como 'audit' e
-- 'territories', para não se confundir com o evento USE produzido pela consulta pública.
ALTER TABLE auth_audit_events DROP CONSTRAINT auth_audit_events_module_check;
ALTER TABLE auth_audit_events ADD CONSTRAINT auth_audit_events_module_check
    CHECK(module IN ('access','query','audit','territories','operations'));
ALTER TABLE auth_audit_events ALTER COLUMN event_class SET EXPRESSION AS
    (CASE WHEN module='query' THEN 'USE'
          WHEN module IN ('audit','territories','operations') THEN 'ADMIN'
          ELSE 'SECURITY' END);
