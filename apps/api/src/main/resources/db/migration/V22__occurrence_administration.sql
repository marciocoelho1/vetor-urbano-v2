-- Decisão do responsável em 22/10/2026: administração de ocorrências em lista ordenada por última
-- atualização, com filtros e ações em lote (ativo, inativo, concluído, excluir).
-- «Excluir» é exclusão lógica: o histórico de publicação é imutável e precisa continuar auditável;
-- a ocorrência sai da lista e das consultas, mas o fato não é apagado do banco.
ALTER TABLE occurrences ADD COLUMN administrative_status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (administrative_status IN ('ACTIVE', 'INACTIVE', 'CONCLUDED', 'DELETED'));
ALTER TABLE occurrences ADD COLUMN updated_at TIMESTAMPTZ;
ALTER TABLE occurrences ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE occurrences ADD CONSTRAINT occurrences_deleted_at_matches_status
    CHECK ((administrative_status = 'DELETED') = (deleted_at IS NOT NULL));

-- Situação encerrada no domínio já significa concluída: espelha uma vez, sem inventar atualização
-- (updated_at continua nulo e a lista mostra «não registrada»).
UPDATE occurrences SET administrative_status = 'CONCLUDED' WHERE situation = 'CLOSED';

CREATE INDEX occurrences_admin_order_idx
    ON occurrences ((COALESCE(updated_at, occurred_at)) DESC, title);
CREATE INDEX occurrences_admin_status_idx ON occurrences (administrative_status, title);

ALTER TABLE auth_audit_events DROP CONSTRAINT auth_audit_events_module_check;
ALTER TABLE auth_audit_events ADD CONSTRAINT auth_audit_events_module_check
    CHECK(module IN ('access','query','audit','territories','operations','reliability','occurrences'));
ALTER TABLE auth_audit_events ALTER COLUMN event_class SET EXPRESSION AS
    (CASE WHEN module='query' THEN 'USE'
          WHEN module IN ('audit','territories','operations','reliability','occurrences') THEN 'ADMIN'
          ELSE 'SECURITY' END);
