# Ticket 35 — rodada de 19/10/2026

## Baseline e correção de estado

`git fetch origin` e `git rev-list --left-right --count origin/integration/functional-spec-v1...HEAD` retornaram `0 0`, HEAD `6c46132e8eb8faa62775e8d6ee258a53035fd553`, branch esperada. Estado inicial: apenas `docs/product/tickets-status.md` modificado e dois arquivos não rastreados preexistentes, excluídos da rodada.

Fase 1: commit `9bd9f549e0b99a6f0cba66c1efa24eecab7f1192`, `docs: reconcile ticket 25 closure status after push`, somente três hunks de tickets-status. Diff e índice sem erros de whitespace. Push `6c46132..9bd9f54`; `ls-remote` igual ao HEAD e status sem divergência. Nenhuma decisão nova misturada nesse commit.

## Decisões do responsável — recebidas antes da implementação

- D1, ticket 25: **«Aceito»**. Aceite do responsável; resultados 21+20/21+101, web127 e Playwright42/42 são do checkpoint de fechamento, não reexecução desta rodada.
- D2, ticket 26: **«Aceito»**, em resposta à suficiência da demonstração local sintética para o ciclo atual. Não representa prontidão operacional, material autorizado ou validação cartográfica real.
- D3, ticket 36: **«Deixe pendente para ser tratado após o fim das implementações»**. Publicação jurídica e revisão final de conteúdo seguem pendentes; responsáveis pelas peças ainda não designados. Nenhuma publicação ou alteração de conteúdo autorizada.
- D4: **«Eleve para 850kB, a sua primeira sugestão»**. Alterar somente o alerta inicial de 500 para 850 kB; baseline declarado 836,58 kB, margem aprovada de 13,42 kB antes do incremento. Sem otimização de dependência/carregamento ou alegação de melhoria de desempenho.
- D5: **«Autorizado»**. Reconciliação B5 pelo mecanismo do controlador; verificação local demonstrada não substitui decisão de produto nem aceite operacional.
- D6: **«Autorizado»**. Recriação vazia individual dos três sintéticos, condicionada à confirmação histórica de nomes/portas/imagem. Conteúdo perdido não será recuperado; nenhuma limpeza em massa ou repair.
- Mecanismo do ticket 35: **«confirmo»**, para sondagem leve de versão/carimbo do recorte no servidor e atualização explícita pelo usuário; sem SLA, instantaneidade, serviço externo ou custo novo.

## Contrato compartilhado anterior ao código

Escopo exclusivo: **35 — Avisar atualizações publicadas na consulta aberta**. A autorização explícita desta rodada prevalece sobre o recorte antigo do issue que adiava a seleção. D06, D08, D13, CA25, CA14 e RF02; sem RF03/push/geofencing.

- Estender `GET /api/v1/occurrences` e `/api/v1/history/occurrences`: resposta completa acrescenta `revision`, token opaco determinístico do estado público do recorte, incluindo relacionados e projeção efetiva, na mesma leitura repetível. Não depende do instante da tentativa.
- Mesmos filtros com `checkUpdates=true` retornam somente `{checkedAt, revision}`, sem conteúdo; `Cache-Control: no-store`. Comparação é feita pelo cliente. Token estável significa ausência de mudança; vazio válido também tem token. HTTP 503 `QUERY_UNAVAILABLE` continua indisponibilidade, nunca vazio/ausência.
- Reutilizar autorização de consulta no servidor. Auditoria de sondagem classe USE e indicadores allowlisted; nunca token, texto, centro, raio ou bounds.
- Cliente guarda os filtros efetivamente aplicados, `generatedAt` e `revision`. Sonda somente com sessão/consulta apropriadas; deduplica aviso pelo token, oferece atualização explícita mantendo filtros/centro/câmera. Falha da sondagem preserva último resultado válido e seu horário em `America/Sao_Paulo`.
- Relatórios não são atualizados silenciosamente. PDF de snapshot envia `snapshotOccurrenceIds` (itens e relacionados) no registro `SUCCEEDED`; servidor valida publicação e recusa retirada com 409 `SNAPSHOT_UNAVAILABLE`. Falha impede download e exige atualização explícita, sem reescrever snapshot nem prometer alteração de arquivos baixados. XLSX já reconsulta estado publicado.
- Revisar concorrência retirada/exportação e estabilidade do token com HTTP/PostGIS reais. Reduzir payload não equivale a provar redução de custo SQL; medir/registrar limitações.

## D6 — recriação parcial verificada pelo coordenador

Após confirmar nomes/portas/imagem nas evidências históricas, foram recriados individualmente:

- `vu-selected-db`, `127.0.0.1:55432`, imagem `docker.io/postgis/postgis:17-3.5`, usuário/banco `postgres/postgres`.
- `vu-ticket30-db`, `127.0.0.1:55437`, mesma imagem, usuário/banco `postgres/vetor_urbano`.

Readback independente por `podman inspect`, `pg_isready` e contagem SQL confirmou ambos em execução, portas corretas, conexões aceitas e zero tabelas de aplicação (excluídos metadados PostGIS). Credenciais novas aleatórias ficaram em arquivos privados 0600 fora do repositório, sem exposição. Nenhuma restauração de conteúdo, fixture ou migração nessa recriação. O banco anterior e a divergência histórica de checksum não foram recuperados nem reparados.

`vu-ticket29-e2e-db` **não foi criado**: nome/imagem comprovados, porta histórica não localizada. D6 permanece parcial. `vetor-spec-postgis` existente em 55436 foi apenas iniciado e verificado, não recriado.

## B5 — inventário reconciliado; controlador ainda bloqueado

`implementation-state.json` passou a registrar 30 entregas históricas (01–19, 25–34 e 36) com `state=done`, `acceptance=verified_local_demonstration`, checkpoints e commits confirmados como ancestrais do HEAD. Estados anteriores foram preservados; nenhum teste histórico foi declarado reexecutado. Backup privado dos JSONs em `/home/marciocoelho/.hermes/cache/scratch/b5-safe-20261019-130758/`; backup automático preexistente de migração preservado.

`python3 tools/ticketctl.py migrate` retornou 0 e importou 19 registros ausentes. Readback independente confirmou inventário com 30 entregas, controlador com 28 registros `accepted` (incluindo fase documental), `active=null` e somente `reconciliation` em `phase_completed`. O mecanismo não sobrescreve registros existentes: 06/07 continuam `blocked`, 36 continua `accepted_partial`; fases 06, 36, 07, 10 e `integrated-review` permanecem sem as provas próprias do controlador.

Inspeção read-only de `Controller.select()` retornou `None`. `python3 tools/ticketctl.py run 20` retornou 3: `20: dependências ou fases obrigatórias pendentes`, sem iniciar trabalho ou chamar provedor. Dependências 21/22 → 20 confirmadas na configuração. 20/23/24 continuam sem autorização/parâmetros operacionais e não foram implementados. 35 não foi aceito nem executado pelo controlador, mas sua entrada ainda existe na configuração histórica; esta rodada o implementa separadamente.

**B5 parcial, não concluído:** completar fases exige execuções/revisões/fingerprints que o mecanismo só registra ao passar por seu fluxo, não pelo migrate. Não foram inventados `verification_v2`, `approved_result` ou fases concluídas, nem reescritas decisões de produto. A fila histórica não equivale ainda à fila operacional reconciliada solicitada.

## Fronteiras TDD e verificação

Fronteiras previamente exigidas pelo responsável: HTTP com PostgreSQL/PostGIS real, cliente/transporte e jornadas de duas sessões Chromium/Firefox, teclado/foco e 390 px. RED observável antes de GREEN por fatia. API runner exclusivo de um executor, sem clean concorrente. Web e API implementados em caminhos separados; documentação compartilhada e autoridade de commit/push pertencem ao coordenador.

## Verificações executadas e bloqueio atual

- API dirigida inicial pelo runner: **21 unitários + 27 integrações**; XMLs agregados pelo coordenador confirmaram zero falhas/erros/pulados em `ticket35-api/final-directed/`.
- Regressão adicional de startup sem contas foi confirmada por RED `NoSuchBeanDefinitionException: AuthService` e corrigida com resolução tardia `ObjectProvider`, seguindo o padrão existente. Novo teste de contexto; runner dirigido adicional **1 + 14**, completo em cópia isolada **22 + 104**.
- Coordenador reexecutou `bash scripts/verify-api-container.sh` na árvore principal após essa correção: **22 unitários + 104 integrações**, zero falhas/erros/pulados nos XMLs (9 arquivos unitários/18 de integração). Log `ticket35-parent/api-final-full.log`; 14/14 migrações idênticas ao baseline.
- Web inicial **133 testes**, 840,99 kB. Revisão independente Spec encontrou dois P2 reais: revisão A→B→A mantinha aviso obsoleto; XLSX atrasado podia substituir relatório posterior. Ambos corrigidos com RED/GREEN e regressões específicas. Coordenador reexecutou `bash scripts/verify.sh web` após formatação E2E: exit 0 (`ticket35-parent/web-final.log`). Contagens/tamanho finais devem ser lidos desse log antes de fechamento; execução anterior após correções informou **135 testes**, **841,20 kB**.
- Revisão independente Standards: zero violações documentadas, três sugestões de manutenção (união repetida de IDs, cast de transporte, cálculo de revisão no DTO), mantidas como julgamento fora da refatoração desta fatia. Spec: dois P2 acima corrigidos; **revisão final dos dois eixos ainda pendente**.
- Playwright inicial do coordenador: **6/10 passaram**, quatro falhas (`ticket35-parent/e2e-first.log`). Correção do relógio tornou a ocorrência real consultável; ajuste do oráculo de título, carregamento com gate HTTP e navegação móvel foi aplicado no spec. Três tentativas posteriores não produziram seleção integral verde. Última execução ampla foi interrompida por timeout, sem XML final válido; não somar resultados parciais como aceite.

### Bloqueios observáveis de navegador

1. Oráculo da câmera compara `overlay-pane.innerHTML` durante animação Leaflet (`scale(2)` intermediário versus projeção estabilizada); precisa de desenho determinístico da observação, sem mascarar mudança real de câmera.
2. Carregamento em Chromium ainda não observado mesmo com gate; Firefox passou. Falta provar ativação/foco e qual request foi interceptado.
3. Regressão do 10 é `query-updates-and-states.spec.ts`; abre `/` sem sessão e encontra o gate de acesso, não o mapa. É necessário preparar a sessão completa na fronteira apropriada, não remover a prova de autenticação do produto.
4. `publication-editor` falhou retorno de foco em Chromium e passou em Firefox; causa ainda não confirmada.

Após três tentativas de correção E2E, a fatia de navegador foi interrompida para alinhar a estratégia de harness/relógio/câmera. O responsável escolheu **«Continuar com diagnóstico mínimo e revisão do harness, sem reduzir critérios»**; diagnóstico mínimo retomado, sem novo aceite. **Ticket 35 não fechado, sem commits produtivos/push final.**

O coordenador reiniciou a API de navegador com o jar final contra `vetor-spec-postgis` (session 401 e mailbox 200 provados). Para preparar regressões sem interromper essa seleção, iniciou instância isolada em 8081/8026 contra o `vu-ticket30-db` vazio recriado: startup Flyway normal aplicou 14 migrações, 14 sucessos e quatro ocorrências sintéticas publicadas, conferidos por SQL. Nenhum repair/restauração. Regressões `VETOR_PERSISTED_E2E` ainda não executadas; exigem agendamento da API em 8080 usada pelos helpers históricos. Terceiro contêiner permanece sem porta comprovada.

## Resultado integrado antes da revisão final

- Reexecução web do coordenador na árvore final: `bash scripts/verify.sh web` exit 0, **136 testes/19 arquivos**, lint e build verdes; **841,23 kB** iniciais, transferência estimada **189,36 kB**. Comparado ao checkpoint de 836,58 kB, acréscimo de **4,65 kB**; margem de **8,77 kB** até o alerta aprovado de 850 kB. Permanece warning CommonJS de `pako` no lazy PDF. Log `ticket35-parent/web-final2.log`.
- Jornadas do 35: **6/6**; grupo de contas/regressões diretas (`query-update-notices`, `query-updates-and-states`, `correction-channel`, `publication-editor`): **26/26**; grupo persistido: **46/46** na árvore final. Somadas sem duplicar as regressões diretas repetidas, a seleção final é de **78 casos** em Chromium/Firefox, logs na árvore final: `harness-final-six-verified.log`, `harness-regressions-final.log`, `persisted-final-tree.log`, `accounts-final-green2.log`.
- Causas do harness confirmadas: esperar fim público da animação Leaflet antes de comparar câmera/projeção; abrir `<details>` móvel antes de focar refresh; observar corpo 409 por `route.fetch()` e encaminhar resposta HTTP real inalterada, pois Chromium deixava leitura do corpo pelo observador pendente. Nenhuma resposta de conteúdo/persistência foi substituída por fixture.
- Grupo `VETOR_PERSISTED_E2E`: **46/46** Chromium/Firefox, `--workers=1`, API final contra `vu-ticket30-db`/55437, banco sintético `vetor_urbano` migrado normalmente. Reexecutado na árvore final depois das últimas correções de fonte, log `persisted-final-tree.log` (46 marcadores contados pelo coordenador); a primeira execução, `persisted-regressions.log`, teve 42/46 por expectativas históricas obsoletas: FURTO armazenado ONGOING projeta UNKNOWN sem extensão aprovada (agora prova ONGOING zero e UNKNOWN com ID exato); limitações PDF iniciavam na penúltima página e continuavam na última (agora prova título com primeiro parágrafo, textos integrais em ordem e continuação). Preservadas asserções de renderização, auditoria e snapshot.
- **78 casos de navegador selecionados passaram** (6 do 35 + 26 de contas/regressões diretas + 46 persistidos, sem duplicar as regressões diretas já contidas no grupo de contas); não é suíte Playwright integral nem reexecução da seleção histórica completa do 25. Nesta árvore final, as causas do harness foram confirmadas por diagnóstico mínimo: o observador de câmera passou a estabilizar o `transform` público antes e depois da atualização; a ordem de foco da fila administrativa passou a observar o destino real do foco; e a spec do 10 completou a sessão sintética na fronteira HTTP já usada pelo 08. Seleção persistida: `persisted-query`, `history-pagination`, `occurrence-heatmap-http`, `report-summary`, `report-comparison`, `report-export`, `report-pdf`.
- Nenhum dado real, deploy, coleta, contratação, QA físico ou leitor de tela. D3 segue adiado, B5 parcial e D6 parcial pela terceira porta desconhecida. Revisão final em dois eixos e commits/push permanecem gates anteriores ao fechamento.

## Prontidão para os gates finais

- **Implementação:** API e web do 35 implementadas localmente com RED antes de GREEN por fatia; contrato registrado antes do código; nenhum outro ticket tocado.
- **Verificação (árvore final):** API completa **22 unitários + 104 integrações** pelo runner containerizado com PostgreSQL/PostGIS reais (`ticket35-parent/api-final-full.log`); web lint/**136 testes**/build **841,23 kB** iniciais (`ticket35-parent/web-final2.log`); Playwright **78 casos** Chromium/Firefox (`--workers=1`); `planning` **470 links**; `git diff --check`/`--cached --check` limpos; 14/14 migrações idênticas ao baseline.
- **Revisão independente Standards + Spec:** executada sobre o diff final; P2 corrigidos com regressão (revisão voltando ao estado aplicado, exportação atrasada, dispensa vinculada ao snapshot) e nenhum achado pendente na reconferência do delta final.
- **Fora do escopo desta reexecução:** resultados históricos do 25 (21+20/21+101, 127, 42/42) não foram reexecutados; QA físico, leitor de tela, deploy, coleta e dados reais continuam ausentes. Regressões de navegador não listadas não foram rodadas.
- **Pendências do responsável:** aceite do 35; publicação/revisão do 36 (D3); porta histórica do terceiro contêiner sintético (D6); fases antigas do controlador (B5) que o mecanismo não substitui.

Fase 1 continua sendo o único commit enviado até este checkpoint; os commits de escopo desta rodada vêm depois desta revisão.
