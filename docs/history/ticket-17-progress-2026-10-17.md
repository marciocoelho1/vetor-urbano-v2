# Ticket local 17 — 17/10/2026

Ordem preservada: commits 27 `5af44ed` → 36 `a7469e4` → revisão/publicação sintética 17. Baseline da fatia compartilhada: `/tmp/vetor-after36`; baseline original completo permanece em `/tmp/vetor-baseline-20261017-192820`.

Implementados fila ADMIN/MFA, original/extração, prioridade/espera, catálogo/núcleo obrigatório no servidor, conflito essencial com resolução humana explícita, publicação de vários efeitos no mesmo acontecimento, associação versionada sem duplicar ocorrência, pendência/descarte justificados, idempotência e concorrência com histórico/autoria. V11 nova; [contrato](../architecture/publication-review-local-v1.md).

## Testes e revisão

- RED HTTP/PostGIS: fila ausente respondeu 404 em vez de 200 após ADMIN/MFA; usuários comuns já eram recusados pelo limite de acesso.
- GREEN direcionado: `JAVA_HOME=/tmp/vu-selected-jdk21 PATH=/tmp/vu-selected-jdk21/bin:$PATH VETOR_API_INTEGRATION_TESTS=PublicationHttpIT bash scripts/verify.sh api`: **15 unitários + 5 integrações HTTP/PostGIS**, zero falhas/erros/pulados, `/tmp/vetor-17-effects-tests.log`. Comprova exclusividade administrativa/CSRF, campos essenciais, conflito e nota alta, associação/pending/descarte, replay após reinício, replay HTTP concorrente e autoria histórica após encerramento; também dois efeitos de uma referência e local somente municipal sem coordenadas.
- Build Angular passou (`/tmp/vetor-17-build2.log`), com avisos de bundle/pako; suíte completa será consolidada no lote.
- Playwright separado usa banco sintético próprio `vetor_batch_review` no contêiner do lote, preservando os bancos de rodadas anteriores. A primeira rodada teve 2 falhas por seletor exato de label com opções; corrigido. A rodada final ampliou efeitos relacionados e localização municipal; resultado abaixo.
- Standards independente sem finding acionável. Spec encontrou limitação a um efeito/clipping e bairro obrigatório; corrigidos com publicação transacional de múltiplos efeitos e bairro desconhecido explícito, com teste HTTP e navegador.

Não há scraping, calibração automática, dados reais, deploy, push ou declaração de prontidão operacional. Conteúdo sintético não comprova qualidade de fontes reais. Verificação web/api/planning completa do lote ainda pendente.

## Checkpoint de verificação do lote 27 → 36 → 17 — 17/10/2026

Commits do lote: `5af44ed` (27), `a7469e4` (36), `28911b7` (17, conferido por `git show --stat`). A verificação abaixo foi executada por um agente independente, em **worktree isolado na revisão commitada** (`git worktree add /tmp/vu17-verify 28911b7`), para não misturar o trabalho preexistente não rastreado do diretório principal.

- `verify.sh api` no worktree: **14 unitários + 62 integrações HTTP/PostGIS** (Testcontainers/PostGIS 17-3.5 real), zero falhas/erros/pulados, `BUILD SUCCESS` (`/tmp/vu17-verify-api-full.log`). Inclui `CorrectionHttpIT` (27, 2) e `PublicationHttpIT` (17, 5).
- `verify.sh web` no worktree: lint, **14 arquivos / 114 testes** unitários e build **783,52 kB** (aviso de orçamento inicial +283,52 kB; `pako`/`@pdf-lib/fontkit` em CommonJS) — `/tmp/vu17-verify-web.log`.
- `verify.sh planning` no diretório principal (o worktree não contém `.scratch/`): **395 links** locais, âncoras e URLs externas não verificadas.
- Playwright separado no worktree, Chromium e Firefox, contra API e PostgreSQL/PostGIS sintéticos próprios (`vu-verify17-db`, banco `vetor_verify17`, migrações V1–V11): `correction-channel.spec.ts` (27) **2/2**, `publication-review.spec.ts` (17) **2/2**, `public-information.spec.ts` "rodapé permite consultar termos, privacidade, metodologia e correções sem login" (36) **1/1**, com teclado/foco e 390 px. Total **8 passaram / 6 falharam** (`/tmp/vu17-verify-e2e.log`).
- As 6 falhas são os três testes herdados de demonstração em `public-information.spec.ts` (linhas 20, 62 e 104) em ambos os navegadores: esperam `[data-quick-category="SEGURANCA"]`, botão `Lista` e a seção de fontes demonstrativa em `page.goto('/')`, mas o `app.html` exige sessão para os módulos (`@if (!publicView() && !moduleAllowed()) { <app-session-panel /> }`). **Reproduzidas de forma idêntica na revisão anterior ao lote** (`git worktree add /tmp/vu-pre-batch 67f29ae`, primeiro teste do arquivo com o mesmo erro de timeout) — são divergências preexistentes de teste/código, não regressão de 27/36/17; nenhum desses três testes foi tocado pelos commits do lote (o 36 alterou apenas o teste da linha 140).

Revisão Standards + Spec própria desta verificação: o commit 17 foi corrigido antes de ser aceito (ver abaixo), e nenhuma afirmação acima depende de teste ausente. Limitações: RNF05/aparelho físico, cartografia operacional e prontidão operacional não aferidos; os testes usam fixtures sintéticas.

## Correção do commit 17 durante a revisão (histórico)

O primeiro commit do 17 continha, por corrida com um editor concorrente no mesmo diretório, duas versões obsoletas de `PublishedCore`/`PublishedEditorService` (código do ticket 18 ainda em rascunho, com `Map.of` de 16 pares e `private var changes(...)`, que não compilam) e foi substituído por `git commit --amend` que removeu os dois arquivos do commit e os devolveu ao diretório de trabalho para o ticket 18. O commit final `28911b7` não depende deles e compila na verificação isolada acima.
