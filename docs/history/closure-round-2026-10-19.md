# Rodada de fechamento — 19/10/2026

O primeiro bloco preserva o histórico da Trilha B e do bloqueio anterior. A decisão foi destravada pelo responsável na retomada da Trilha A, registrada abaixo **antes do código**. O fechamento consolidado da retomada prevalece sobre os estados históricos “sem V14/A parcial”. Nenhum staging/commit/push nesta árvore.

## Gate anterior ao código

- Baseline verificada nesta execução: `84013adbad16e08cf8aafd0a7411527a1818c0ad`, branch `integration/functional-spec-v1`, fetch origin e divergência `0 0`. Somente os dois untracked preexistentes; preservá-los fora do trabalho.
- Instrução mais recente: **não commitar nem push**. Entregar árvore revisável; revisão própria não substitui Standards + Spec independente pelo coordenador.
- Trilha A aprovada quanto à evidência humana rastreável por efeito, não futura, autoria tipada, versão factual e conflito otimista sem sobrescrita; períodos: congestionamento/disparos 30 min; acidente/operação/bloqueio/semáforo/alagamento/incêndio 2 h; deslizamento/árvore/energia/água 6 h; obras 24 h; roubo/furto/confronto sem extensão automática. Expiração significa insuficiência, nunca encerramento.
- Divergência de autorização descoberta: V3, V9 e V13 só aceitam USER/ADMIN; GLOSSARY proíbe equivalência automática com Gestor/Operador. Aprovação recebida usa autor/moderador/gestor. **Não inventar mapeamento.** Aguardando confirmação explícita de ADMIN no fluxo; não ativar configuração nem criar escrita sem resolver a autorização. Aviso administrativo persistente e tratamento com nova evidência integram a A, não podem ser declarados entregues isoladamente.
- Baseline histórica verde não é aceite novo. Seams já aprovados: HTTP/PostGIS real e navegador Chromium/Firefox, teclado/foco, 390 px; CA08 integral para conclusão do 25.
- B1: preservar actor e historicalActor separados; fallback sistema apenas na ausência de ambos. Teste vermelho antes da mudança do template, depois prova de encerramento real e regressão administrativa.
- B2: localizar importação/triagem atuais; não recriar tela retirada ou aceitar decisão documental por inferência.
- B3: documentar runner containerizado reproduzível com REST Podman independente, ping, SELinux e JDK 21.
- B4: medir bundle e propor alternativas; não alterar orçamento ou otimizar código sem autorização.
- B5 não autorizado; não executar ticketctl. Sem deploy, dados reais ou refatorações fora do escopo. V1–V13 devem permanecer intactas.

## Entregas e evidências executadas

**B1 — implementado, revisão independente pendente.** `audit-log.ts` consome `historicalActor`; template mantém prioridade da conta viva, rotula a referência residual `Autor histórico:` e só mostra sistema quando ambas faltam. Não busca identidade nem acrescenta atributos pessoais. `audit-authorship.spec.ts` cria USER real separado do ADMIN/MFA observador, prova o mesmo LOGIN por ID antes/depois do encerramento HTTP, actor nulo, residual diferente, ausência do UUID eliminado na resposta e na tela, foco por teclado e 390 px. RED real falhou exatamente na falta da referência histórica na tela; GREEN 2/2. O spec legado de auditoria estava preso a `postgres/vetor_urbano`; passou a usar o helper allowlisted existente e aceita a flag `VETOR_ACCOUNTS_E2E` da receita aprovada, preservando a flag anterior. Regressão efetivamente executada, não pulada.

**B2 — lacuna coberta, sem retirar contrato.** Os títulos existem em `apps/web/src/app/app.html`, dentro de `activeView() === 'sources'`, ocultos no modo API. São fluxos locais administrativos **na demonstração sem `?consulta=api`**; a fila persistida usa `app-source-management`/`app-review-queue` e não é essa importação. `admin-local-sources.spec.ts` usa sessão ADMIN/MFA real: teste próprio recebe CSV agregado com proveniência, confirma estatística/licença/limitações e remove dados; outro adiciona referência e a arquiva, sem buscar URL externa ou publicar. Ambos usam teclado, foco de entrada e 390 px; 4/4 Chromium/Firefox. Nenhuma tela recriada. Isso não certifica ingestão operacional nem coleta.

**B3 — executado.** `scripts/verify-api-container.sh`, documentado em `docs/operations/web.md`, verifica ping do socket REST e roda o executor real no Maven/JDK 21. Host direto retornou `BLOQUEADO: comando não disponível: javac`. Runner dirigido final: `VETOR_API_INTEGRATION_TESTS=ActiveReportHttpIT,ActiveReportQueryIT,AuditHttpIT,ClosureHttpIT bash scripts/verify-api-container.sh`: **21 unitários + 15 integrações**, sem falhas/erros/pulados. Primeira tentativa informou incorretamente nomes AuditLogHttpIT/AccountClosureHttpIT e Maven ignorou esses padrões enquanto executava os outros: foi corrigida e reexecutada, não usada como prova de auditoria/encerramento. Runner completo: **21 unitários + 96 integrações**, sem falhas/erros/pulados, PostgreSQL 17.5/PostGIS 3.5 real. Não houve recriação do contêiner E2E nem repair/reset. Logs de falha sintética da política no caso 503 são esperados pelo teste, não falhas da suíte.

Web: `bash scripts/verify.sh web`: lint, **127 testes**, build passaram. Playwright final com `VETOR_ACCOUNTS_E2E=1 VETOR_E2E_DATABASE_CONTAINER=vetor-spec-postgis npm run test:e2e --prefix apps/web -- --project=chromium --project=firefox --workers=1 audit-authorship.spec.ts admin-local-sources.spec.ts audit-log.spec.ts active-reports-api.spec.ts active-reports.spec.ts public-information.spec.ts`: **30/30**, nenhuma falha ou skip. Cobre a nova tela, regressão administrativa de carga/vazio/erro/recuperação, documentos públicos e Informes 08/25. Demais specs de navegador não foram reexecutados; não se declara suíte E2E completa. Sem QA físico/leitor de tela nem operação real.

### B4 — medição e proposta sem alteração do orçamento

`npm run build --prefix apps/web -- --stats-json` produziu `apps/web/dist/web/browser-stats.json`. Tamanhos finais brutos: main **750.591 bytes**, estilos **73.201 bytes**, chunk compartilhado **1.139 bytes**; inicial **824.931 bytes / 824,93 kB**, transferência estimada **186,26 kB**, orçamento 500 kB, excesso **324,93 kB** (aproximadamente 64,99%). O baseline informado era 824,67 kB; este incremento de autoria acrescentou aproximadamente 0,26 kB, não a origem do excesso. **Medição da árvore final com a Trilha A: inicial 836,39 kB (main 762,05 kB), excesso 336,39 kB — ver «Conferência final da árvore».**

Chunks lazy já separados: PDF **1.156.593 bytes** (transferência estimada 420,90 kB), MapLibre **1.067.080 bytes** (236,57 kB), Leaflet **149.416 bytes** (37,47 kB), GSAP **71.291 bytes** (25,02 kB), importação **4.375 bytes** (1,87 kB). `pako` só aparece no chunk PDF lazy; o warning CommonJS não explica o excesso inicial. A atribuição `bytesInOutput` do stats aponta app.ts 353.902, Angular total 332.978 e pako 41.520 bytes no PDF; **são atribuições intermediárias antes da minificação final, não custos finais somáveis**. Não há estimativa garantida de economia a partir dessas atribuições.

Opções para decisão, nenhuma aplicada:

1. **Elevar orçamento**: reconhecer baseline atual e adotar margem explícita (por exemplo 850 kB), mantendo alerta separado para crescimento; elimina o aviso sem melhorar download/parse. Exige decisão de produto/desempenho, não é correção técnica automática.
2. **Reduzir inicial com mais lazy loading** (não remover o lazy loading existente): carregar módulos administrativos, contas e relatórios apenas ao navegar, preservando estados/foco. Ataca o main, mas exige aprovação e medição comparativa com testes completos; não refatorar App ou transportes nesta rodada. PDF/mapas já são lazy, portanto diferi-los de novo não resolve o inicial.
3. **Tratar pako**: investigar versão/alternativa ESM compatível com fontkit ou composição de fonte; comparar PDFs, Unicode e tamanho do chunk antes/depois. Atua no lazy PDF e no warning, não promete retirar 324,93 kB iniciais. Allowlist CommonJS só silencia aviso; não otimiza e não foi adicionada.

Recomendação pendente: manter o limite de 500 kB como sinal conhecido até decidir se a meta será mantida com redução inicial ou recalibrada. Não aumentar limite nem alterar dependências/carregamento sem aprovação.

## Logs e relatórios duráveis

Diretório desta execução fora do Git: `/home/marciocoelho/.hermes/cache/scratch/closure-round-2026-10-19/`.

- `b1-red.log`, `b1-green.log`, `b2.log`, `e2e-final.log`.
- `api-host.log`, `api-directed.log` (tentativa com padrões parcialmente ausentes), `api-directed-final.log`, `api-full.log`.
- `directed-surefire/`, `directed-failsafe/`, `full-surefire/`, `full-failsafe/` contêm os XMLs/textos copiados antes de clean posterior.
- `web.log`, `bundle.log`, `browser-stats.json`, `bundle-analysis.json`.
- Processos não são artefatos garantidos: o REST Podman foi iniciado por esta execução e deve ser verificado/recriado pelo operador; a API/caixa preexistentes não foram substituídas. Cache scratch pode ser podado após 24 h de inatividade; preservar evidências necessárias antes disso.

## Proposta de divisão, sem staging/commit/push

**(Superada pela «Proposta final de commits» ao fim deste documento, que inclui a Trilha A. Mantida como registro do estado B desta rodada.)**

- `feat(web): show historical authorship in administrative logs`: `apps/web/src/app/audit/audit-log.ts`, `apps/web/src/app/audit/audit-log.html`.
- `test(e2e): cover historical authorship and local administrative sources`: `apps/web/e2e/audit-authorship.spec.ts`, `apps/web/e2e/admin-local-sources.spec.ts`, `apps/web/e2e/audit-log.spec.ts`.
- `docs: document closure evidence and containerized verification`: `scripts/verify-api-container.sh`, `docs/operations/web.md`, `docs/history/closure-round-2026-10-19.md`, `PLAN.md`, `CHANGELOG.md`, `docs/product/tickets-status.md`.
- Não há slice `feat(api)` nesta árvore: A1–A4 não implementados. Dois arquivos não rastreados preexistentes permanecem excluídos. B5 não executado; controlador continua divergente dos checkpoints.

## Revisão própria — não independente

### Standards

Fontes: AGENTS.md, CONTRIBUTING.md, GLOSSARY.md, repository-layout e contratos audit/account-closure; baseline de smells do skill code-review. Mudança localizada sem dependência nova, dados sintéticos, residual sem ligação recuperável; comandos por caminho exato. Substituição do SQL legado pelo helper existente evita nova duplicação de transporte/fixture. Nenhum refactor de App, orçamento ou migração. Revisão final deve conferir diff e arquivos novos explicitamente, pois não entram em `git diff` por padrão. Nenhum achado bloqueante conhecido na Trilha B; lint/testes não substituem revisão independente.

### Spec

B1–B4 têm implementação/evidência acima; B2 não foi declarado removido do contrato. B5 permanece não autorizado. **A1–A4, o aviso administrativo e o tratamento de expiração foram implementados depois da autorização explícita de papéis e têm evidência própria na seção «Trilha A» abaixo**; o parágrafo antigo que registrava A1–A4 como não entregues está superado. Testes históricos de Informes verdes não substituem as provas novas de vigência persistida. Revisão independente do coordenador continua obrigatória antes de staging/commits/push.

## Conferência final da árvore

- `bash scripts/verify.sh planning`: **460 links locais**, passou (âncoras/URLs externas não verificadas).
- `git diff --check` e `git diff --cached --check`: passaram; índice vazio. Nenhum staging/commit/push. HEAD permanece `84013adbad16e08cf8aafd0a7411527a1818c0ad`.
- Comparação binária de cada uma das **13 migrações V1–V13** com `git show 84013ad:<path>`, repetida depois da Trilha A: todas idênticas, com SHA-256 iguais. `V14__occurrence_verification_history.sql` é a única migração nova e permanece não rastreada (`a-preservation.json`).
- XMLs agregados programaticamente (`final-api-summary.json`): dirigida **21 unitários + 50 integrações**, completa **21 + 100**, zero falhas/erros/pulados nas quatro coleções; `BUILD SUCCESS` nas duas execuções (`final-directed.log`, `final-full.log`). A dirigida anterior 21/15 e a completa 21/96 são evidência de 19/10 antes da Trilha A, não do estado final.
- `bash scripts/verify.sh web` reexecutado **depois** da última alteração de fonte (`verification-panel.html`, 01:16) e do spec novo: lint, **127 testes** e build verdes (`final-web.log`); inicial **836,39 kB** (main 762,05 kB, estilos 73,20 kB, chunk 1,14 kB), excesso **336,39 kB** sobre 500 kB, `pako` apenas no chunk PDF lazy. Sem alteração de orçamento ou carregamento.
- Playwright da seleção autorizada (Chromium/Firefox, `--workers=1`, API/PostGIS reais): **42/42** com a matriz final (`final-e2e-group1.log`).
- Checklist conferível fora do repositório: `/home/marciocoelho/Documentos/vetor-urbano-checklist-fechamento-2026-10-19.md`, itens deliberadamente desmarcados para conferência independente.
- Arquivos compartilhados: PLAN, CHANGELOG e tickets-status receberam um hunk cada; operations recebeu dois hunks. Todos pertencem à rodada, nenhum descartado; **nenhum staged**. A revisão independente deve inspecionar também os quatro arquivos novos desta rodada.


## Retomada Trilha A — decisão aprovada antes do código (19/10/2026)

Autorização explícita do responsável nesta sessão: o autor da ocorrência e ADMIN com MFA podem registrar confirmação humana; não criar perfis. Evidência rastreável específica por efeito, instante não futuro e referência à versão factual são obrigatórios. Concorrência otimista deve recusar confirmação/transição após outra confirmação ou edição, sem sobrescrever. Confirmação anterior não valida versão nova. Expiração projeta UNKNOWN, nunca CLOSED, sem alterar a situação armazenada.

Prazos aprovados: congestionamento/disparos 30 minutos; acidente/operação/bloqueio/semáforo/alagamento/incêndio 2 horas; deslizamento/árvore/energia/água 6 horas; obras 24 horas. Roubo/furto/confronto sem extensão automática. Estes prazos não são garantia de atualidade factual.

Fluxo aprovado: ADMIN recebe toast persistente para uma ou mais expiradas; clique abre ocorrências ativas, com container no início e botão tratar por ocorrência. Tratar abre edição; renovar pelo mesmo prazo padrão exige nova evidência humana/confirmacão. Repetir em cada expiração; autor também pode confirmar. Seams HTTP/PostGIS real e navegador previamente aprovadas; RED antes de GREEN por fatia. Sem staging/commit/push, alteração de budget ou recriação do banco sintético. B1–B4 e os dois untracked preexistentes serão preservados.

### Estado final da Trilha A

Implementada e verificada nesta árvore. Estes resultados são da execução final, depois de todas as
alterações de código: **API dirigida 21 unitários + 50 integrações** (`ActiveReportHttpIT` 7,
`ActiveReportQueryIT` 1, `OccurrenceQueryHttpIT` 10, `SessionHttpIT` 7, `ClosureHttpIT` 6,
`PublicationHttpIT` 5, `AuditHttpIT` 5, `AccountRegistrationHttpIT` 9) e **API completa 21 + 100**,
zero falhas/erros/pulados em quatro coleções (`final-directed.log`, `final-full.log`,
`final-directed-*`, `final-full-*`, agregado em `final-api-summary.json`). `DatabaseMigrationIT`
aplicou a V14 real no PostgreSQL 17.5/PostGIS 3.5 descartável do Testcontainers.

**A1.** `V14__occurrence_verification_history.sql` cria `occurrence_verifications` com chave
`(occurrence_id, verification_version)`, `effect_version`, situações anterior/nova, evidência não
vazia, `confirmed_at <= recorded_at`, `expires_at` nulo ou posterior, autoria tipada
`author_id XOR historical_actor_id`, `actor_role` e trigger de imutabilidade reutilizando
`territorial_history_immutable()`. V1–V13 conferidas byte a byte contra `git show 84013ad:<path>`
(SHA-256 iguais; `a-preservation.json`); nenhum repair/reset. `ActiveReportHttpIT`
`persistedConfirmationRequiresEvidenceAndRejectsStaleVersion` prova recusa sem evidência (400),
conflito de versão de verificação e de versão factual (409 sem escrita), expiração em `expires_at`
inclusivo e `appliesToCurrentVersion=false` depois de uma edição factual;
`concurrentHumanDecisionsKeepOneWinnerAndRelatedEffectIndependent` dispara duas confirmações
simultâneas por HTTP e obtém exatamente `{200, 409}` com uma única linha persistida;
`authorConfirmationDetachesIrreversiblyOnClosure` confirma como o próprio autor (papel `USER`),
encerra a conta e verifica que `author_id` é nulo, o residual é diferente e o UUID eliminado não
aparece em **nenhuma** tabela pública. `everyApprovedDurationExpiresInclusivelyWithoutExtendingUnsupportedTypes`
cobre os dezesseis tipos aprovados.

**A2.** `PersistedValidityPolicy` substitui a política por mapas produtiva e lê somente o histórico
V14 da revisão atual; `ActiveReportController`, `OccurrenceQueryService` (consulta, histórico e
detalhe) e o filtro estrito `situation=ONGOING` usam a situação efetiva, preservando `situation`
armazenada. A confirmação expirada volta a `EXPIRED`/`UNKNOWN` e a antiga sem evidência segue
`MISSING_EVIDENCE`, nunca `CLOSED`. `ConfiguredValidityPolicy` e `ActiveReportConfiguration.Settings`
permanecem **apenas como núcleo legado com teste unitário próprio**; a fábrica do bean deixou de
receber `Settings`, de modo que nenhum mapa de configuração pode estender vigência. É uma decisão de
julgamento registrada para a revisão independente: a alternativa era apagar a classe e os três
testes unitários que documentam as semânticas negativas da porta.

**A3.** `AccountService` desliga `occurrence_verifications` no mesmo caminho da V9/V13, junto das
demais tabelas; a prova HTTP/PostGIS acima percorre todas as tabelas públicas.

**A4.** CA08 passa a ter filtro estrito por vigência efetiva nas consultas e persistência por
versão; `OccurrenceQueryHttpIT` e `ActiveReportHttpIT` ajustados para o novo significado (uma
`ONGOING` sem evidência não entra em `situation=ONGOING` e entra em `situation=UNKNOWN`).

**Fluxo administrativo (requisito detalhado do responsável).** Toast persistente de ADMIN enquanto
há expiradas (polling de 5 s só com sessão aberta), clique abrindo Informes ativos, container
`expired-occurrences` no início da página, botão `Tratar <título>`, editor que carrega a revisão
antes de exibir campos e nunca pré-preenche a evidência anterior, renovação pelo mesmo prazo do tipo
e repetição a cada nova expiração. `active-report-renewal.spec.ts` (Chromium/Firefox, 390 px,
teclado/foco) percorre o ciclo inteiro com API e banco reais: aviso por teclado, redirecionamento
com foco no cabeçalho, fila, tratamento, primeira renovação ainda vencida mantendo a fila, terceira
confirmação vigente retirando o efeito da fila, histórico com três novas decisões, presença na lista
pública como «Em andamento», **reconfirmação já vencida reexibindo o aviso persistente e a fila** e
cancelamento devolvendo o estado. O outro teste cobre carga, 503 e vazio com recuperação por teclado.

**Playwright final da seleção autorizada:** 42/42, zero falhas/pulados, `--workers=1`,
`VETOR_ACCOUNTS_E2E=1 VETOR_E2E_DATABASE_CONTAINER=vetor-spec-postgis`, API em `127.0.0.1:8080`
reiniciada a partir do jar construído na verificação completa e banco `vetor-spec-postgis` /
`vetor_spec_test` (55436) não recriado (`final-e2e-group1.log`, `final-e2e.xml`).

**Revisão própria — Standards (não independente).** Sem dependência nova, sem refactor de App,
orçamento, migrações antigas ou transporte; dados sintéticos; caminhos exatos em todos os comandos;
evidência humana restrita não vaza para a consulta pública (que recebe só resumo temporal/versionado).
Achados de julgamento que ficam registrados: (a) `@Transactional(REPEATABLE_READ)` declarado no
`ActiveReportController.find` para que seleção e resumo compartilhem um instante — funciona, mas
coloca fronteira transacional na camada de apresentação; (b) `verification-panel.ts` monta a URL
absoluta do host da API como os transportes existentes já faziam, sem extrair um cliente comum;
(c) `ConfiguredValidityPolicy` mantido como núcleo legado descrito em (A2); (d) o botão «Verificar situação de …» aparece na lista de Informes para qualquer sessão autenticada, porque a resposta da consulta não expõe autoria (contrato de minimização) e a autorização efetiva é do servidor — quem não for autor/ADMIN recebe 403 com mensagem explícita. Nenhum deles bloqueia.

**Revisão própria — Spec (não independente).** Todos os itens aprovados item a item têm prova real
acima. Lacunas declaradas: a repetição do aviso é provada com uma reconfirmação humana já vencida
(não há controle de relógio no navegador), a lista `expired` é recalculada por consulta periódica e
não por push, e não há QA físico, leitor de tela, coleta, deploy ou ativação sobre dados reais.

**Não executado.** O grupo de specs de navegador `persisted-query`, `history-pagination`,
`occurrence-heatmap-http`, `report-summary`, `report-comparison`, `report-export` e `report-pdf`
(flags `VETOR_PERSISTED_E2E`/`DOCKER_HOST` e contêineres `vu-ticket30-db`/`vu-ticket29-e2e-db`) está
**fora da seleção autorizada e com ambiente ausente**: falharam por `no container with name or ID
"vu-ticket30-db" found`, não por regressão desta rodada. A cobertura do servidor para a mudança de
consulta nesses fluxos vem dos ITs reais (`OccurrenceQueryHttpIT` 10, `ActiveReportQueryIT`,
`DatabaseMigrationIT`), que passaram. A suíte de navegador completa também não foi executada; não se
declara suíte E2E integral verde.

## Proposta final de commits por caminho exato — NÃO EXECUTADA

Esta lista substitui a proposta anterior desta rodada. Nenhum staging, commit ou push autorizado/executado. B1–B4 estão incluídos sem descarte. O checklist externo é artefato de conferência fora do Git.

### `feat(api): persist versioned human occurrence verification`

- `apps/api/src/main/java/br/com/vetorurbano/api/accounts/AccountService.java`
- `apps/api/src/main/java/br/com/vetorurbano/api/occurrences/ActiveReportConfiguration.java`
- `apps/api/src/main/java/br/com/vetorurbano/api/occurrences/ActiveReportController.java`
- `apps/api/src/main/java/br/com/vetorurbano/api/occurrences/ActiveReportQueryService.java`
- `apps/api/src/main/java/br/com/vetorurbano/api/occurrences/OccurrenceQuery.java`
- `apps/api/src/main/java/br/com/vetorurbano/api/occurrences/OccurrenceQueryService.java`
- `apps/api/src/main/java/br/com/vetorurbano/api/occurrences/OccurrenceVerificationController.java`
- `apps/api/src/main/java/br/com/vetorurbano/api/occurrences/OccurrenceVerificationService.java`
- `apps/api/src/main/java/br/com/vetorurbano/api/occurrences/OccurrenceView.java`
- `apps/api/src/main/java/br/com/vetorurbano/api/occurrences/PersistedValidityPolicy.java`
- `apps/api/src/main/resources/db/migration/V14__occurrence_verification_history.sql`
- `apps/api/src/test/java/br/com/vetorurbano/api/accounts/AccountRegistrationHttpIT.java`
- `apps/api/src/test/java/br/com/vetorurbano/api/auth/ActiveReportHttpIT.java`
- `apps/api/src/test/java/br/com/vetorurbano/api/auth/LocalAuthHttpSupport.java`
- `apps/api/src/test/java/br/com/vetorurbano/api/occurrences/OccurrenceQueryHttpIT.java`

### `feat(web): add persistent expiration treatment and historical authorship`

- `apps/web/src/app/active-reports/verification-panel.html`
- `apps/web/src/app/active-reports/verification-panel.ts`
- `apps/web/src/app/active-reports/verification-selection.ts`
- `apps/web/src/app/app.html`
- `apps/web/src/app/app.ts`
- `apps/web/src/app/audit/audit-log.html`
- `apps/web/src/app/audit/audit-log.ts`
- `apps/web/src/app/data/active-report-query.ts`
- `apps/web/src/app/data/persisted-query.ts`

### `test(e2e): verify renewal cycles and closure regressions`

- `apps/web/e2e/account-closure.spec.ts`
- `apps/web/e2e/active-report-renewal.spec.ts`
- `apps/web/e2e/active-reports-api.spec.ts`
- `apps/web/e2e/admin-local-sources.spec.ts`
- `apps/web/e2e/audit-authorship.spec.ts`
- `apps/web/e2e/audit-log.spec.ts`

### `docs: close trail A with verification evidence and operations`

- `CHANGELOG.md`
- `PLAN.md`
- `docs/architecture/account-closure-local-v1.md`
- `docs/architecture/active-reports-local-v1.md`
- `docs/architecture/api-query-v1.md`
- `docs/architecture/audit-local-v1.md`
- `docs/history/closure-round-2026-10-19.md`
- `docs/operations/web.md`
- `docs/product/tickets-status.md`
- `scripts/verify-api-container.sh`

Excluídos: `docs/product/tickets-checklist.html`, `scripts/generate-tickets-checklist.py`; intactos. Orçamento, dependências, carregamento, ticketctl e deploy não alterados.

## Revisão independente do coordenador (Standards + Spec) e correções — 19/10/2026

Dois eixos rodados em paralelo sobre o diff consolidado `review-diff.txt` (2.104 linhas, incluindo os
11 arquivos novos como pseudo-diff). Standards: CONTRIBUTING, AGENTS, GLOSSARY, repository-layout,
`docs/agents/domain.md`, os quatro contratos tocados, vizinhos de cada área e o baseline de smells.
Spec: o pedido do responsável, as três decisões aprovadas nesta sessão, `GLOSSARY` e os contratos.
Os relatórios dos dois eixos são anteriores a estas correções; o diff final foi reexecutado nos dois
eixos depois delas.

**Corrigido**

1. `verification-panel.html` imprimia `confirmed_at`/`expires_at` como ISO cru. Passou a usar
   `date: 'dd/MM/yyyy HH:mm:ss' : '-0300'`, como `audit-log.html`, conforme AGENTS.md (apresentação
   `America/Sao_Paulo`). Prettier reaplicado.
2. Os três tipos aprovados **sem extensão automática** (roubo, furto, confronto) devolviam
   `MISSING_CONFIGURATION`, confundindo decisão aprovada com configuração ausente. Nova
   `Validity.NO_APPROVED_EXTENSION`, rótulo público «Sem extensão automática aprovada para este tipo»
   e teste `approvedNonExtendedTypeIsLabelledAsDecisionNotAsMissingConfiguration`, que distingue no
   mesmo relatório o tipo aprovado sem janela (`NO_APPROVED_EXTENSION` + situação efetiva `UNKNOWN`)
   do tipo não catalogado (`MISSING_CONFIGURATION`) e confirma `expires_at` nulo.
3. `docs/product/tickets-status.md` contradizia o fechamento: a visão geral ainda dizia «1 parcial:
   25» e a linha do 25 dizia «sem V14». Atualizada para 30 implementados localmente, 25 concluído
   localmente com a pendência real explicitada (aceite operacional e specs não reexecutadas).
4. O contrato `active-reports-local-v1.md` descrevia `items` sem `verification`; corrigido, com o
   novo valor de `validity` documentado.
5. Números reconciliados: bundle inicial final **836,58 kB** (+336,58 kB) nas operações, no plano e no
   changelog; API final **dirigida 21 + 20** e **completa 21 + 101**.

**Avaliado e mantido, sem alteração**

- `@Transactional(REPEATABLE_READ)` no `GET /active-reports`: coloca fronteira transacional na
  camada de apresentação, mas garante que situação, vigência e resumo compartilhem um instante.
- URL absoluta no `verification-panel.ts`: é a convenção vigente de todos os transportes
  (`audit-log`, `session`, `self-account`, `review-queue`) e a duplicação de transporte é smell não
  bloqueante declarado fora do escopo desta rodada.
- Botão «Verificar situação de …» visível a qualquer sessão autenticada: a consulta não expõe
  autoria (minimização) e a autorização é do servidor, que responde 403 com mensagem explícita.
- Autoria exercida pela **primeira** versão de publicação e provada por IT com `publication_versions`
  real; «edição posterior não transfere permissão» continua **não provado** — limitação registrada.
- A recusa de outro ator (403 por autorização, sem CSRF) é provada pela leitura `GET
  active-reports/<id>/verification` como `USER` sem autoria; a asserção de 403 no POST sem CSRF
  sozinha não distinguiria ator de token.
- Grupo E2E `VETOR_PERSISTED_E2E` não executado: ambiente ausente (`vu-ticket30-db` inexistente),
  fora da seleção autorizada.

**Verificação depois das correções (árvore final)**

- API pelo runner containerizado: **dirigida 21 unitários + 20 integrações**
  (`ActiveReportHttpIT` 8, `ActiveReportQueryIT` 1, `AuditHttpIT` 5, `ClosureHttpIT` 6) e **completa
  21 + 101**, zero falhas/erros/pulados, `BUILD SUCCESS`, sem linha «BLOQUEADO» em nenhum dos dois
  logs (`review-api-directed.log`, `review-api-full.log`, XMLs em `review-*-surefire|failsafe`).
- Web: `bash scripts/verify.sh web` → lint, **127 testes** e build, com inicial **836,58 kB**.
- Playwright da seleção autorizada, com a API reiniciada a partir do jar construído nessa verificação
  completa: **42/42**, zero falhas/pulados, `--workers=1`, Chromium/Firefox, 390 px, teclado/foco
  (`review-e2e-group1.log`). Banco `vetor-spec-postgis`/`vetor_spec_test` (55436) não recriado.
- `bash scripts/verify.sh planning`: 465 links locais; `git diff --check` e `git diff --cached --check`
  limpos; V1–V13 conferidas byte a byte (13/13) antes e depois das correções.
- Nada disto é aceite operacional: sem QA físico, leitor de tela, deploy, coleta ou dados reais, e as
  demais specs de navegador não foram reexecutadas.

## Envio — 19/10/2026

Revisão independente concluída e correções aplicadas; o gate de não commitar foi substituído pela
autorização de envio do responsável nesta sessão. Quatro commits por escopo, em caminhos exatos:
`e37f659` (api), `0baefde` (web), `762a8ba` (e2e) e `4a2a7cb` (docs). `git push origin
integration/functional-spec-v1` respondeu `84013ad..4a2a7cb` e `git ls-remote` devolve o mesmo
`4a2a7cbe907ac05e713a724444e51842e4dec8f8` de `git rev-parse HEAD`; `git status -sb` não mostra
«à frente». Os dois arquivos não rastreados preexistentes (`docs/product/tickets-checklist.html` e
`scripts/generate-tickets-checklist.py`) permanecem fora dos commits e do push, por decisão do
responsável. Nenhum `--force`, tag ou envio para `main`. Sem deploy, coleta, dados reais ou
recreação do contêiner sintético.
