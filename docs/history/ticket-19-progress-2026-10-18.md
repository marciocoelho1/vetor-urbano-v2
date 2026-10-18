# Ticket 19 — projeção de autoria histórica nos logs (18/10/2026)

## Baseline e preservação

- Início da rodada: branch `integration/functional-spec-v1`, HEAD `0da31f5dce4bd91eb0c1dba3e31e54f2d66fe691`.
- Não havia alterações rastreadas. Já existia o arquivo não rastreado `docs/product/tickets-checklist.html`; permaneceu intacto e fora dos commits. Isso diverge da afirmação de árvore limpa no pedido.
- Título do ticket local: **Consultar logs administrativos com retenção configurada** (`.scratch/consulta-coerente/issues/19-consultar-logs.md`). Escopo restrito à projeção histórica de `/api/v1/admin/logs`; sem mudança de UI, migração, retenção ou paginação.

## Implementação e contrato

`AuditService` agora projeta `historical_actor_id` das três origens já existentes: `auth_audit_events`, `account_audit_events` e `source_audit_events`. A resposta conserva `actor` e acrescenta `historicalActor`; a referência residual nunca é convertida em UUID de conta viva. O cursor `occurred_at|kind|number` e `safeParameters` não foram alterados.

Novo cenário em `AuditHttpIT`, pela fronteira HTTP com PostgreSQL/PostGIS real, prova antes e depois do encerramento: a conta viva aparece em `actor`; depois, `actor` fica nulo e `historicalActor` contém o residual, sem o UUID eliminado. A prova cobre `auth_audit_events` SECURITY, `account_audit_events`, `auth_audit_events` ADMIN e `source_audit_events`, e confirma que as referências de segurança/conta e autoria de domínio são distintas. A suíte existente de paginação (50 + 3 eventos) e minimização da allowlist também continua verde.

`docs/architecture/audit-local-v1.md` descreve os dois campos; a pendência de projeção em `docs/architecture/account-closure-local-v1.md` foi substituída por evidência e checkpoint.

## RED → GREEN e verificações

- RED da regressão nova: `VETOR_API_INTEGRATION_TESTS=AuditHttpIT bash scripts/verify.sh api` falhou no campo `historicalActor` ausente (5 integrações, 1 falha). A execução usou a imagem Maven/JDK 21 já disponível, pois o host não tem `javac`; Testcontainers acessou o Podman rootless pelo socket local e iniciou `postgis/postgis:17-3.5` real.
- GREEN direcionado após a implementação: `AuditHttpIT` passou **18 testes unitários + 5 integrações HTTP/PostGIS**, sem falhas/erros/pulados.
- A primeira `bash scripts/verify.sh api` completa expôs falha independente em `ActiveReportQueryIT`: após a V11 semear `publication_versions`, a fixture apagava `occurrences` sem limpar as versões. Reprodução isolada confirmou o FK `publication_versions_occurrence_id_fkey`. A fixture agora apaga as versões sintéticas antes das ocorrências; `VETOR_API_INTEGRATION_TESTS=ActiveReportQueryIT bash scripts/verify.sh api` passou (**18 unitários + 1 integração**).
- Verificação completa final: `bash scripts/verify.sh api` passou com **18 unitários + 86 integrações HTTP/PostGIS**, zero falhas, erros ou pulados. Foi executada na mesma imagem Maven/JDK 21, com o socket Podman montado. O `docker info` exigido pelo wrapper do script foi substituído somente por função de shell que valida `_ping` nesse socket; o Testcontainers conectou ao mesmo servidor e executou PostGIS real. Nenhuma dependência foi instalada.
- `bash scripts/verify.sh planning` passou: **421 links locais**. Âncoras e URLs externas não foram verificadas.
- `git diff --check` passou.
- `verify.sh web` e Playwright não foram executados: nenhuma tela nem contrato visual foi alterado neste ticket.

## Revisão e limites

Revisão Standards + Spec contra o baseline `0da31f5`:

- **Standards:** sem violações pendentes. A revisão apontou que o `.editorconfig` genérico pedia dois espaços, embora os arquivos Java existentes usem quatro; resolvido com a exceção `[*.java] indent_size = 4`. A possível duplicação de asserções no IT foi mantida como decisão heurística: cada origem/classe e cada referência residual é verificada separadamente na fronteira HTTP, tornando explícito o contrato de separação.
- **Spec:** nenhum requisito ausente ou implementação incorreta. A limpeza de `publication_versions` em `ActiveReportQueryIT` é a única alteração lateral; ficou restrita à fixture PostGIS e foi necessária para executar a verificação API completa sem violar a FK.

Aceite restrito ao ambiente sintético local e ao PostgreSQL/PostGIS Testcontainers. Não indica prontidão operacional. Sem dados reais, alteração de migração, `repair`/reset do banco original, push ou deploy. Próxima pendência da rodada: ticket 11.
