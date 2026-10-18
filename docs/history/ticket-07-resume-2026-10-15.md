# Ticket 07 — retomada de implementação em 15/10/2026

Execução `cc8ef1577e5b`, solicitação `d509f24b92f7487e895d0ff9c6af8930`, fase `implement`. HEAD observado: `505a0b1`. Sem commit, publicação, dados reais, troca de modelo ou subagentes.

## Estado preservado

Lidos `PLAN.md`, `AGENTS.md`, ticket original 07, logs anteriores informados, spec D06/CA09 e documentos de escopo, arquitetura, estrutura e operação web. Dependências 02 e 05 têm implementação histórica integrada registrada; o checklist local de 05 ainda está desmarcado. Esta retomada não concede novo aceite às dependências.

O checkpoint já continha alterações em `apps/web/src/app/app.ts`, `apps/web/src/app/app.spec.ts`, `apps/web/src/styles.scss` e `apps/web/e2e/clustering-and-overlap.spec.ts`: badges MapLibre de coincidentes, handlers das camadas, remoção de popups, estilos e cobertura unitária/E2E. Esses quatro arquivos foram inspecionados e preservados sem nova edição. Demais alterações preexistentes de produto, controlador e documentos também foram preservadas.

O log anterior registra falha do clique físico no segundo item do popup MapLibre no Firefox; Enter e Leaflet passavam historicamente. Isso permanece pendente, sem causa confirmada nem correção declarada. A skill `diagnosing-bugs` orientou a tentativa de reprodução; o bloqueio de execução impediu avançar para hipóteses e correção. Não há instrumentação `DEBUG` nem `console.log` nos dois arquivos inspecionados (`app.ts` e E2E direcionado).

## Comandos e resultados novos

- `bash scripts/verify.sh web`: **exit 0**; Prettier passou, 7 arquivos/85 testes unitários passaram, build passou. Bundle inicial 600,60 kB; aviso de 100,60 kB acima do orçamento de 500 kB. Isso não comprova mouse, foco ou renderização em navegador.
- Em `apps/web/`, `npx playwright test e2e/clustering-and-overlap.spec.ts --project=chromium --project=firefox --workers=1`: **exit 1**, antes de executar cenários, `Process from config.webServer was not able to start. Exit code: 127`.
- `npm run start -- --host 127.0.0.1 --port 4201`: compilou e anunciou servidor em `127.0.0.1:4201`. Nova tentativa da mesma suíte com esse servidor já iniciado também encerrou antes dos cenários, com erro 127. Servidor iniciado nesta retomada foi encerrado ao terminar o diagnóstico (SIGINT, exit 130).
- `DEBUG=pw:webserver npx playwright test e2e/clustering-and-overlap.spec.ts --project=firefox --workers=1`: **exit 1**, diagnóstico explícito `connect EPERM 127.0.0.1:4201 - Local (undefined:undefined)` na checagem HTTP; depois erro 127 do subprocesso webServer. Nenhum cenário Firefox executado.
- `curl -I --max-time 3 http://127.0.0.1:4201`: **exit 7**, `failed to open socket: Operation not permitted`. Confirma restrição local de socket, independentemente da aplicação.
- `git diff --check`: **exit 0** antes e depois do registro documental. `bash scripts/verify.sh planning`: **exit 0**, 192 links locais validados; não verifica âncoras nem URLs externas.

Logs integrais desta retomada preservados em `.scratch/consulta-coerente/evidence/07-cc8ef1577e5b/`: `ticket07-web.log`, `ticket07-e2e.log`, `ticket07-e2e-running.log` e `ticket07-e2e-debug.log`. Os logs do checkpoint anterior continuam nos caminhos originais; não foram substituídos.

## Bloqueio e próxima ação

O ambiente impede conexão HTTP local necessária ao Playwright. A política desta execução não permite escalonamento de permissões. Nenhuma credencial ou decisão de produto é necessária para este recorte; é necessário um executor com sockets locais e navegadores disponíveis.

Retomar a mesma suíte em ambiente habilitado, reproduzir e diagnosticar o clique físico MapLibre/Firefox sem substituir por Enter nem reduzir cobertura. Depois corrigir com regressão e demonstrar ambos os itens pelo popup, identidade/total/coordenadas preservados, contagem única sem POIs/polígonos, teclado/foco, alternativa em lista, estados aplicáveis e 390 px em Chromium/Firefox. A inspeção do E2E atual mostra lacunas adicionais a fechar nessa demonstração: testa o primeiro item pela lista após escolher o segundo no popup, usa apenas contagem maior que um para cluster, condiciona a checagem de vazio à visibilidade da busca e não verifica carga/erro cartográfico neste arquivo.

Ticket continua **bloqueado nesta execução e sem aceite**; checklist original e estado do controlador não foram alterados manualmente. Alterações novas desta retomada limitam-se a este histórico, `PLAN.md` e `CHANGELOG.md`, além dos logs locais ignorados. Material disponível para revisão independente; correção funcional não concluída.

## Reexecução e diagnóstico local em 15/10/2026

Esta retomada conseguiu iniciar HTTP em `127.0.0.1:4201` e executar Chromium/Firefox. JavaScript/Node e os binários Playwright estão disponíveis. O PostgreSQL local responde a `pg_isready`; autenticação por role do usuário falhou (`role "marciocoelho" não existe`) e não foi necessária para o Ticket 07.

`npx playwright test e2e/clustering-and-overlap.spec.ts --project=chromium --project=firefox --workers=1`: 7/8 cenários passaram. Passaram os dois cenários de agrupamento, coincidências no Chromium (MapLibre e Leaflet) e seleção no Firefox/Leaflet. Falhou a seleção individual por clique no popup MapLibre/Firefox ao esperar detalhes de `demo-contingencia-004`; screenshot/trace no diretório Playwright `apps/web/test-results/clustering-and-overlap-Mot-dc144-em-no-modelo-real-MapLibre--firefox/`.

Diagnóstico reproduzido em seguida, sem correção confirmada:

- Clique normal do locator ficou tentando até 90 s; Firefox reportou o popup ou o primeiro botão como interceptador do ponto. Isso confirma que o teste não consegue entregar o clique no segundo botão com a rolagem/layout atuais.
- A leitura DOM mediu o botão em `x=315, y≈518`, no popup dentro do mapa. `elementFromPoint` identificou o botão naquele quadro.
- Clique Playwright por coordenadas medidas na chamada seguinte gerou evento de mouse em `x=425, y=709`, no link “Mais informações abaixo”, sem selecionar o registro. A coordenada estava defasada da leitura DOM; a rolagem/relayout é suspeita, ainda sem confirmação causal.
- Uma quarta sondagem esperou quadros estáveis e validou `elementFromPoint` antes de enviar o mouse, mas não encontrou ponto estável dentro de 5 s. Não houve alteração de produto; instrumentação temporária foi removida. O teste preexistente e as outras alterações locais foram preservados.

Após tentativas direcionadas sem avanço suficiente para correção segura, encerrar esta rodada conforme a regra de continuidade. Não apresentar o diagnóstico como defeito de produto confirmado nem o E2E como aceite. O critério de contagem única exata também permanece incompleto: testes atuais verificam contagem maior que um e exclusão de POI, sem comparar o total esperado completo. O detalhe selecionado, teclado/foco, lista, vazio e viewport móvel não são concluídos no cenário Firefox/MapLibre porque ele falha antes dessas verificações.

Verificações atuais: `bash scripts/verify.sh web` passou (lint, 85 unitários, build 600,60 kB; aviso de 100,60 kB acima do orçamento); `bash scripts/verify.sh planning` passou (193 links); `git diff --check` passou. Nenhum aceite do ticket, commit ou alteração do checklist original. A revisão desta sessão foi própria.

## Correção do clique Firefox — 17/10/2026

Escopo desta rodada: corrigir o bug remanescente do 07, sem atuar no 32, sem commit/push e sem editar PLAN/CHANGELOG compartilhados. Branch conferida: `integration/functional-spec-v1`. Alterações anteriores de `app.ts`, `app.spec.ts`, estilos e E2E preservadas; `app.spec.ts` não recebeu novas mudanças nesta rodada.

### Reprodução e causa

O primeiro E2E parou antes do mapa porque a suíte histórica não preparava sessão após a integração do ticket 14. Adicionada resposta HTTP sintética explícita para `auth/session`, mantendo mapa e dados demonstrativos reais do frontend, sem depender da API ou credenciais. Depois disso, o comando `npx playwright test e2e/clustering-and-overlap.spec.ts --project=chromium --project=firefox --workers=1` reproduziu **7/8**, falhando exatamente no detalhe `demo-contingencia-004` após clicar no segundo botão MapLibre/Firefox.

Instrumentação temporária mediu popup com 329 px em um mapa de 291 px; a superfície cartográfica tinha `scrollHeight=435`. O segundo botão estava abaixo do recorte. Depois de `scrollIntoViewIfNeeded`, o clique físico foi recebido pelo contêiner `.coincident-pins-expansion`, não pelo botão. A experiência de trocar apenas `overflow:hidden` por `clip` no mapa também falhou, atingindo o link “Mais informações abaixo”; portanto, só impedir scroll ancestral não resolve o conteúdo inacessível. Essa experiência foi revertida, sem mudança final nos estilos.

A correção limita o conteúdo do seletor ao espaço disponível acima/abaixo do pin MapLibre, escolhe a âncora correspondente e mantém rolagem dentro do seletor. O Leaflet também recebe limite de altura compatível com seu mapa para que seu autopan não tente acomodar um popup maior que o viewport. Coordenadas e dados de negócio não mudam. Instrumentação `[DEBUG-07]` removida.

### Regressão e evidências finais

- O E2E usa clique normal (sem `force`) nos dois itens do popup e no marcador Leaflet; reabre o seletor e verifica a identidade de ambos os detalhes. Confere popup dentro do mapa e `scrollTop=0` da superfície MapLibre.
- A câmera é recentralizada explicitamente antes de cada abertura na fixture: o autopan Leaflet pode levar o pin para junto da atribuição após a primeira seleção. Isso não altera os registros e não substitui o clique real.
- O mesmo popup é exercitado por foco + Enter, separadamente dos cliques, e o foco do título do detalhe é conferido. Permanecem as comparações estritas de IDs/coordenadas/precisão/totais, alternativa por teclado na lista e apresentação de 390 px.
- `npx playwright test e2e/clustering-and-overlap.spec.ts --project=chromium --project=firefox --workers=1`: **8/8 passaram**.
- Após acrescentar teclado/foco, `npx playwright test e2e/clustering-and-overlap.spec.ts --project=chromium --project=firefox --workers=1 --repeat-each=2`: **16/16 passaram**, 48,1 s.
- `bash scripts/verify.sh web`: **exit 0**, Prettier, **122 testes em 16 arquivos**, build **752,12 kB**. Avisos: orçamento inicial excedido em **252,12 kB**, e `pako` CommonJS via fonte de PDF. Não tratados neste bug.
- `git diff --check`: **exit 0**.

Arquivos alterados nesta rodada: `apps/web/src/app/app.ts`, `apps/web/e2e/clustering-and-overlap.spec.ts` e este histórico. Capturas de lista móvel continuam em `apps/web/test-results/clustering-{MapLibre,Leaflet}-mobile-{chromium,firefox}.png` (artefatos locais ignorados).

**Resultado:** bug de seleção física corrigido e regressão verificada. Não equivale a aceite global de todos os critérios do ticket: a suíte ainda compara cluster com `>1` em vez de total único exato, o vazio permanece condicional à busca visível e carga/erro cartográfico não ganham cenários específicos nesta rodada. Fundos/tiles e sessão são sintéticos; não comprovam provedores externos, sessão real ou QA físico móvel. Checklist/controlador não alterados; cabe ao responsável reconciliar essas lacunas antes de encerrar integralmente o 07.

