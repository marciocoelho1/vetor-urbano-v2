# Ticket local 28 — Histórico avançado paginado (17/10/2026)

## Escopo e decisões

- Issue local: `.scratch/consulta-coerente/issues/28-historico-avancado.md`; ID 28 é local e não é número de issue GitHub.
- Rastreabilidade preservada: D05, D08, CA13 e RF02. Dependências locais 06 (modos) e 14 (sessão/MFA) conferidas como atendidas.
- Critérios antigos foram reconciliados com E01–E19 aprovados sem mudar IDs nem ampliar a fatia. E20 segue pendente. Retenção/expurgo de E16, reprodução temporal nova, risco e exportador permanecem fora deste ticket.
- Decisão aprovada em 17/10: 25 registros por página; datas exatas ordenadas pelo instante; intervalos pelo limite final conhecido exclusivo; desempate por ID estável decrescente; o conjunto permanece como snapshot até atualização explícita.

## Entrega

- `GET /api/v1/history/occurrences` exige sessão/autorização no servidor, registra auditoria da consulta e retorna todas as ocorrências publicadas do recorte, não somente a página visível. Situações pendentes, descartadas e retiradas permanecem excluídas.
- HTTP/Java/PostgreSQL/PostGIS aplicam filtros textuais (título, descrição e identificação), território, período, classificação, fonte, confiabilidade e situação. O total global e as relações/referências são calculados no servidor; a consulta roda em `REPEATABLE_READ` para manter o snapshot.
- A interface pagina localmente o resultado completo, mostra precisão e relações, diferencia carregamento/erro/vazio e permite tentar novamente. Ao desabilitar o botão de navegação na borda, o foco vai ao estado da página. O E2E cobre teclado, Chromium/Firefox e viewport de 390 px.
- A reprodução já existente permanece ligada aos pontos legados. Não foi conectada à nova consulta; reprodução nova, cálculo de risco e exportador ficaram fora desta fatia.

## TDD e verificações

- O teste unitário de consolidação de fontes foi introduzido antes da implementação do helper (RED por export ausente) e passou após centralizar deduplicação/ordenação (GREEN). As regressões de consulta, API HTTP, foco e E2E foram verificadas nas suítes afetadas.
- `bash scripts/verify.sh web`: lint/prettier passou; 12 arquivos e 104 testes passaram; build passou. Bundle inicial 681,01 kB, 181,01 kB acima do orçamento de 500 kB (aviso do build).
- `JAVA_HOME=/tmp/vu-jdk-21 PATH=/tmp/vu-jdk-21/bin:$PATH DOCKER_HOST=unix:///tmp/vu-podman.sock bash scripts/verify.sh api`: Maven `clean verify` passou; 14 testes unitários e 28 integrações passaram, incluindo HTTP e PostgreSQL/PostGIS reais. A primeira chamada sem `JAVA_HOME` foi bloqueada porque `javac` não estava no PATH; a repetição usou o JDK local disponível.
- `VETOR_PERSISTED_E2E=1 VETOR_E2E_DATABASE_CONTAINER=vu-ticket29-e2e-db DOCKER_HOST=unix:///tmp/vu-podman.sock ./node_modules/.bin/playwright test --project=chromium --project=firefox --workers=1 e2e/history-pagination.spec.ts` (em `apps/web`): 2/2 passaram.
- `bash scripts/verify.sh planning`: passou com 337 links Markdown locais; `git diff --check`: passou.

## Revisão, commits e limites

- Baseline de revisão resolvido: `fdd9ba9a43300ab92f010aad933219533c08c55a` (base do checkpoint anterior ao ticket 28). A primeira revisão Standards + Spec apontou documentação ausente, duplicação de ordenação/deduplicação de fontes, argumento booleano de modo e ampliação indevida de playback; os pontos foram corrigidos. Resultado da revisão final será registrado no checkpoint após revisar o diff completo com os documentos.
- Commits de código do ticket: `b03f904` (implementação) e `d7849c5` (correções de revisão/foco acessível). Registro local contém massa sintética; nenhum dado real foi coletado.
- Testes locais não demonstram cobertura ou prontidão operacional. Bundle permanece acima do limite configurado. Sem publicação, push, contratação ou coleta real.

**Próxima ação:** iniciar o ticket local 33 após fechar a revisão deste checkpoint. Ele não depende do ticket 28; as abas, colunas/ordem e regra de divisão/erro para XLSX foram aprovadas em 17/10.
