# Ticket 25 — proximidade integrada (retomada)

## Baseline e decisões anteriores ao código

Baseline confirmado: `integration/functional-spec-v1`, HEAD `d60fd7359c6fada91e38b4bcb261644e852a529e`; comparação com origin `0 7` (fetch já realizado pelo coordenador). Apenas os dois untracked preexistentes `docs/product/tickets-checklist.html` e `scripts/generate-tickets-checklist.py`; serão preservados. Sem commits/push nesta execução: revisão independente do parent antecederá ambos.

Seleção real anterior à edição: `VETOR_API_INTEGRATION_TESTS=ActiveReportQueryIT bash "$TMPDIR/vu25-verify-api.sh"`, status 0, **18 unitários + 1 integração PostGIS**, zero falhas/erros/pulados. Log `$TMPDIR/vu25-baseline.log`. Runner executa `scripts/verify.sh api` em Maven/JDK21/Podman, socket scratch, shim docker, SELinux label=disable. Prova núcleo temporal/espacial existente, não prova endpoint, política concreta, auditoria ou tela integrados ainda ausentes.

1. **Vigência:** configuração declarada por tipo e evidência explícita por ocorrência, contendo instante de confirmação e referência. Produção inicia com mapas vazios e nega na ausência de qualquer componente. Nenhum instante de fato/coleta/publicação/revisão substitui confirmação. Recomendação ao responsável (NÃO aprovada): revisão humana de evidência rastreável por efeito e confirmação não futura; limites propostos: congestionamento/disparos 30 min, acidente/operação/bloqueio/semáforo/alagamento/incêndio 2 h, deslizamento/árvore/energia/água 6 h, obras 24 h; roubo/furto/confronto sem extensão automática até definição própria. São propostas conservadoras para discussão, não promessa de atualização nem parâmetros produtivos. Testes usarão somente prazos e evidências rotulados sintéticos.
2. **D06 persistido:** não neste incremento. Sem aprovação de semântica/autoria/origem da confirmação e concorrência de transições não inventar verificação. Sem V14, sem código morto ou atualização de situação pela leitura. Persistência de transição/última verificação e CA08 completo permanecem pendentes. A tela não será apresentada como confirmação atual de andamento.
3. **Insuficiência pública:** explícita. Preservar situação armazenada, acrescentar situação efetiva consultiva e motivo de insuficiência; ONGOING sem confirmação válida será UNKNOWN na projeção, não CLOSED. Antigas sem evidência ficam excluídas; recentes elegíveis pela janela continuam com insuficiência declarada. Erros de política/banco são falhas 503, nunca vazio.

## Contrato e fronteiras TDD

GET `/api/v1/active-reports?longitude=...&latitude=...&radiusMeters=...`: sessão comum completa verificada no servidor; 401 sem sessão, 400 centro/raio inválidos, 503 indisponibilidade. Raio inteiro 1–5000 m, centro WGS84 explícito. Resposta no-store com items, evaluatedAt, validity limitation e projeção da ocorrência mais effectiveSituation/validity; instante único para seleção/projeção. Sem expansão de relacionados nem filtros de Histórico/Relatórios. Auditoria módulo query/classe USE, apenas sinal de recorte espacial e contagens; nunca centro, raio ou bounds. Não há escrita factual, CSRF não se aplica à leitura.

Fronteiras já aceitas no prompt: núcleo/política pública, HTTP com sessão USER e PostGIS real, logs ADMIN minimizados, navegador Chromium/Firefox (consentimento/negativa/erro/manual, teclado/foco/lista/390px), regressão do 08 e verificadores web/api/planning. Ciclos verticais RED/GREEN; revisão própria Standards e Spec separada não substitui a independente do coordenador.

## Implementação e TDD executados

- `ActiveReportQueryService` tornou-se bean e expõe snapshot com um instante único, preservando a interface `find`. Política concreta usa mapas declarados de duração por tipo e evidência por efeito; não usa os timestamps factuais como confirmação. Defaults vazios. Resposta HTTP projeta ocorrência armazenada, situação efetiva e insuficiência separadas. Política/banco propagam indisponibilidade, sem fallback vazio.
- `ActiveReportHttpIT` usa PostGIS descartável/Flyway V1–V13 e sessão **USER** criada/confirmada/login real. Prova 401, 200/no-store, 400, vazio, indisponibilidade de banco e política, expiração sintética e independência/read-only. Só a leitura de logs troca para ADMIN com MFA real; parâmetros persistidos têm exatamente as duas chaves permitidas. Nenhuma situação/transição factual foi escrita pela consulta.
- Web opt-in não reexecuta pertinência espacial/temporal no cliente. Consentimento pontual é solicitado na entrada; negativa/erro e escolha manual por coordenadas/mapa continuam disponíveis. Resposta anterior é invalidada ao editar o recorte; resultado da API, carga, falha, vazio e consulta ainda não executada são distintos. Lista mostra situação armazenada/consultiva e insuficiência, detalhes por teclado com retorno de foco e horário America/Sao_Paulo. Posicionar câmera conserva o recorte independente do mapa.
- RED HTTP: `vu25-http-red.log`, esperado 200/recebido **404** (rota ausente). GREEN inicial: `vu25-http-green.log`, 18 unitários + 2 integrações. RED política: `vu25-policy-red.log`, esperado 3/recebido **2** (antiga sintética não incluída); GREEN `vu25-policy-green.log`, 18 + 3. RED falha da política: `vu25-policy-failure-red.log`, esperado 503/recebido **500**; corrigida a tradução para o contrato de erro existente.
- RED web: primeiro ensaio encontrou corrida do helper de login; acrescentada espera observável pela sessão. Repetição `vu25-web-red-corrected.log` falhou no status de localização ausente, antes da implementação. Depois, a matriz inicial passou nos dois casos novos e falhou nos oito legados do 08 porque tentavam módulo anonimamente contra API ativa. Corrigida somente a fixture demonstrativa: sessão USER e autorização de módulo simuladas na fronteira HTTP. Não foi removida nenhuma asserção do 08 nem utilizada essa simulação na prova real do 25.
- Uma tentativa de comando de teste teve workdir repetido/inexistente e não iniciou; repetida no caminho correto. Após reiniciar a API final, o probe de prontidão com urllib recebeu **401 esperado sem cookie** e levantou HTTPError (não falha do startup); as jornadas seguintes autenticaram e passaram. Sem ocultar esses ensaios como sucesso de teste.

## Verificação final real

Todos os logs abaixo ficam em `/home/marciocoelho/.hermes/cache/scratch/`.

1. Seleção inicial exigida `VETOR_API_INTEGRATION_TESTS=ActiveReportQueryIT bash "$TMPDIR/vu25-verify-api.sh"`: **18 unitários + 1 integração**, status 0 (`vu25-baseline.log`). Seleção ampliada posterior `ActiveReportHttpIT,ActiveReportQueryIT`: **21 + 4**, status 0 (`vu25-api-directed.log`).
2. `bash "$TMPDIR/vu25-verify-api.sh"` executa o próprio `bash scripts/verify.sh api` no Maven 3.9.11/JDK21 por Podman: **21 unitários + 96 integrações**, zero falhas/erros/pulados, BUILD SUCCESS. Primeira completa `vu25-api-full.log`; repetição após revisão/fortalecimento das asserções `vu25-api-reviewed.log`, status 0, 3min08s. Totais confirmados pelos XMLs Surefire/Failsafe via Python.
3. `bash scripts/verify.sh web`: lint, **127 testes em 17 arquivos** e build passaram. Repetida depois dos ajustes de revisão: `vu25-web-reviewed.log`, status 0. Bundle inicial **824,67 kB**, excede aviso de 500 kB em **324,67 kB**; `pako` CommonJS permanece. Os testes novos do fluxo foram feitos na fronteira navegador, não como unidades redundantes do App.
4. `VETOR_ACCOUNTS_E2E=1 VETOR_E2E_DATABASE_CONTAINER=vetor-spec-postgis npm run test:e2e --prefix apps/web -- --project=chromium --project=firefox --workers=1 e2e/active-reports.spec.ts e2e/active-reports-api.spec.ts`: **14/14**, status 0, **27,1 s**, `vu25-e2e-reviewed.log`. Seis execuções do 25 + oito regressões do 08. API reiniciada com o JAR final antes desta repetição, reaproveitando configuração privada, somente banco sintético `vetor-spec-postgis/vetor_spec_test` em 55436. Reinício pelo helper scratch `vu26-restart-api.py`; startup final no log scratch `vu26-api-server.log` (nome herdado do helper). USER é criado/confirmado por HTTP; API/login/autorização/consulta não são interceptados no spec integrado. Geolocalização e tiles são fronteiras simuladas; apenas carga/falha visual usa resposta HTTP controlada, e retry retorna à API real. Sem prova de prompt nativo do navegador nem cartografia operacional.
5. `bash scripts/verify.sh planning`: **455 links**, status 0, repetido após a reconciliação final. `git diff --check` e `git diff --cached --check`: status 0; índice vazio, nada staged.
6. Preservação: 15 hashes do manifesto anterior `vu26-preservation.json` conferidos, zero divergências (inclui GeoJSON, V1–V12 e dois preexistentes). Todas as **13 migrações** comparadas byte a byte com HEAD, zero divergências; nenhuma V14. Sem repair/reset ou acesso ao banco original divergente.

## Revisão própria — Standards

Referências: AGENTS.md, CONTRIBUTING.md, .editorconfig, layout, contratos de API/auditoria e guias carregados. Diff WIP contra `d60fd7359c6fada91e38b4bcb261644e852a529e`, incluindo leitura explícita dos arquivos novos (não aparecem em git diff sem staging). Sem commits novos. Não houve delegação, conforme limite imposto.

Nenhuma violação normativa pendente encontrada na revisão própria. Código novo fica em occurrences/data, sem dependência nova, migração reescrita, segredos ou dados reais. O App continua grande (smell preexistente de responsabilidade concentrada); integração usa os controles existentes e extrai transporte/projeção no módulo de dados, sem refatoração transversal especulativa. SQL de auditoria minimizado reutiliza classe USE e allowlist existentes. Removida variável de teste sem uso e fortalecidos IDs exatos/contagem das chaves persistidas; ferramentas de lint/build executadas separadamente. Esta seção não é revisão independente.

## Revisão própria — Spec

- Falha de política respondia 500 no primeiro ensaio: **corrigida**, com RED 500 → GREEN 503 real. Banco indisponível e vazio continuam distintos.
- Detalhe usava o recorte do mapa para contar relacionados em Informes: **corrigido** para o conjunto de Informes, com asserção de duas ocorrências/um acontecimento no recorte. Rótulo do botão integrado explicita posicionamento de câmera sem transferir filtros; não promete pin que o recorte independente possa excluir.
- D06/CA08 persistido **não implementado deliberadamente** pela decisão pré-código permitida no prompt. Semântica/autoria/origem da confirmação, vinculação à versão factual e concorrência das transições precisam de aprovação; durações propostas não estão em configuração produtiva. Mapas vazios negam vigência. A tela declara que não confirma andamento atual por si só. Ticket 25 completo continua **parcial**, não aprovado por ter baseline verde.
- Nenhum outro desvio do incremento de leitura encontrado na revisão própria final; sem escopo de RF03, histórico de ator na UI, coleta, deploy ou tickets adicionais. Revisão independente Standards + Spec do parent ainda é gate antes de commits/push.

## Commits propostos — nenhum executado ou staged

A lista abaixo é o escopo exato sugerido ao parent; adicionar somente por caminho exato depois da revisão independente.

### `feat(api): integrate authenticated active reports with explicit validity`

- `apps/api/src/main/java/br/com/vetorurbano/api/auth/AuthService.java`
- `apps/api/src/main/java/br/com/vetorurbano/api/occurrences/ActiveReportQueryService.java`
- `apps/api/src/main/java/br/com/vetorurbano/api/occurrences/OccurrenceQueryExceptionHandler.java`
- `apps/api/src/main/java/br/com/vetorurbano/api/occurrences/ActiveReportConfiguration.java`
- `apps/api/src/main/java/br/com/vetorurbano/api/occurrences/ActiveReportController.java`
- `apps/api/src/main/java/br/com/vetorurbano/api/occurrences/ConfiguredValidityPolicy.java`
- `apps/api/src/test/java/br/com/vetorurbano/api/auth/ActiveReportHttpIT.java`
- `apps/api/src/test/java/br/com/vetorurbano/api/occurrences/ConfiguredValidityPolicyTest.java`

### `feat(web): query active reports by consented or manual location`

- `apps/web/src/app/app.ts`
- `apps/web/src/app/app.html`
- `apps/web/src/app/data/active-report-query.ts`

### `test(e2e): verify integrated active reports and preserve demo journeys`

- `apps/web/e2e/active-reports-api.spec.ts`
- `apps/web/e2e/active-reports.spec.ts`

### `docs: record ticket 25 evidence and pending validity decisions`

- `PLAN.md`
- `CHANGELOG.md`
- `docs/product/tickets-status.md`
- `docs/history/ticket-25-progress-2026-10-18.md`
- `docs/history/ticket-25-progress-2026-10-17.md`
- `docs/architecture/active-reports-local-v1.md`
- `docs/architecture/audit-local-v1.md`
- `docs/architecture/corrections-local-v1.md`
- `docs/operations/web.md`

Não incluir `docs/product/tickets-checklist.html` nem `scripts/generate-tickets-checklist.py`. HEAD permanece `d60fd7359c6fada91e38b4bcb261644e852a529e`; nenhum hash novo/local/enviado ou confirmação de push é alegado. Não houve `ticketctl.py`, fetch adicional, push, deploy ou seleção de outro ticket.

## Retorno da revisão independente — reforço de cobertura

Baseline recebido: HEAD `d60fd73`, índice vazio e implementação WIP preservada; API anterior 21 + 96, web 127 e E2E 14 verdes são evidências anteriores, não execução desta correção. Spec identificou somente duas lacunas de cobertura em `ActiveReportHttpIT`, sem bug de produção apontado. Fronteiras já autorizadas: HTTP USER/PostGIS, persistência de auditoria e projeção ADMIN/MFA. Antes de editar, rastreados `LocalAuthHttpSupport` (cadastro confirmado/login real e reset por teste), `ActiveReportController` (audita somente consulta bem-sucedida), `AuthService.auditActiveReports` (account_id, SUCCEEDED, duas chaves) e `AuditService` (actor separado de historicalActor, ID access e allowlist).

Decisão: reforçar IDs/situações antes e após expiração e associar os dois sucessos de consulta (2 e 0 ocorrências) à conta USER real, tanto na persistência quanto na projeção administrativa, sem ampliar parâmetros. É reforço de teste sobre implementação existente; não há RED de defeito produtivo presumido. Standards independente: **0 violações e 2 smells não bloqueantes**, duplicação de transporte e concentração no App; decisão explícita de não refatorar fora desta fatia. Somente teste e este checkpoint podem ser editados; sem staging, commits ou push. Parent fará nova revisão.

### Evidência nova após as duas correções

- `ActiveReportHttpIT`: IDs exatos antes `{recent-closed,recent-ongoing,old-confirmed}` e depois `{recent-closed,recent-ongoing}`, sem duplicatas; HTTP 200 nas duas respostas. Em ambas, `recent-closed` permanece CLOSED armazenada/efetiva e `recent-ongoing` ONGOING armazenada/UNKNOWN efetiva. Preservadas confirmação CONFIRMED/ONGOING e temporalMatch OUTSIDE da antiga antes de expirar e asserção read-only das duas antigas no banco.
- Auditoria: exatamente dois eventos persistidos, `account_id` igual ao UUID da conta real com role USER, módulo query/classe USE/outcome SUCCEEDED; parâmetros exatos `{hasSpatialFilter:true,occurrences:2}` e `{hasSpatialFilter:true,occurrences:0}` em ordem de ID. Projeção ADMIN/MFA confere os mesmos IDs `access-*`, actor igual à conta USER e os mesmos parâmetros/resultados; nenhuma chave sensível nova. As recusas/indisponibilidade não passam por sucesso silencioso.
- Socket anterior indisponível: probe curl retornou 7; reaberto com `podman system service --time=0 unix:///home/marciocoelho/.hermes/cache/scratch/vu25-podman.sock`, novo `/_ping` retornou OK. Serviço deixado ativo para a revisão do parent.
- `bash /home/marciocoelho/.hermes/cache/scratch/vu25-verify-api.sh > /home/marciocoelho/.hermes/cache/scratch/vu25-api-spec-fixed.log 2>&1`: **status 0, BUILD SUCCESS, 03:12 min**, Maven/JDK21/Podman e PostGIS reais, execução única sem testes concorrentes. XMLs Surefire/Failsafe agregados por Python: **21 unitários + 96 integrações**, zero falhas/erros/pulados; `ActiveReportHttpIT` **3/3**, 7,52 s. Não se usa evidência anterior como substituto desta execução.
- `git diff --check` e `git diff --cached --check`: status 0; `git diff --cached --stat` vazio. Nenhum staging/commit/push, nenhuma mudança produtiva. Revisão final independente continua com o parent; web/E2E não reexecutados nesta fatia exclusivamente de cobertura API.

## Gate final independente e fechamento

Segunda revisão independente do diff final contra `d60fd73`: Standards com **zero violações bloqueantes**, mantendo os dois smells de manutenção não bloqueantes; Spec com **zero achados pendentes**, confirmando as duas correções de cobertura. Coordenador conferiu XMLs: 21 unitários + 96 integrações, zero falhas/erros/pulados; repetiu planning (455 links) e ambos os diff-checks. Web/E2E desta rodada permanecem válidos: após sua execução só houve reforço de testes API e documentação, sem alteração produtiva.

Autorizados quatro commits isolados pelos caminhos exatos acima, após esse gate. Hunks dos documentos compartilhados: PLAN 1, CHANGELOG 1 e tickets-status 2, todos pertencentes à fatia; nenhum descartado. O push autorizado inclui os sete commits anteriores e os quatro desta rodada; resultado e hashes serão conferidos por `git ls-remote` e informados no relatório final, sem presumir sucesso. Os dois arquivos preexistentes ficam não rastreados e fora do envio.

## Limites e próxima decisão

A leitura integrada e sua negação segura estão implementadas/verificadas no ambiente sintético. O bloqueio real restante é de produto/domínio: aprovar ou corrigir a recomendação de prazos por tipo, o contrato da evidência/última confirmação vinculada à versão/efeito e o histórico concorrente antes de qualquer persistência D06 ou uso operacional. Sem aprovação, permanecer com mapas vazios e insuficiência explícita. Não se propõe duração infinita nem transição presumida. A próxima ação técnica pertence ao parent: revisar os dois eixos no diff final e somente então decidir staging/commits/push. Toda a suíte Playwright do repositório, leitor de tela, aparelho físico, carga e operação não foram executados nem são alegados.
