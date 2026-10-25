# UXH-01 — verificação técnica local — 24/10/2026

## Parecer

**Não recomendar merge por aceite funcional completo.** Planning, web, controlador e API/PostGIS descartável passaram nesta execução. A matriz obrigatória do `integrated-review` passou 46/46 em Chromium/Firefox, mas usa demonstração/mocks e não substitui a prova persistida. A seleção adicional navegador → API Java → PostGIS sintético foi interrompida após três falhas: 13 aprovados, 3 falhas, 36 não executados. Firefox persistido não foi executado; não há aceite por skips. Nenhuma fonte ou configuração do controlador foi alterada para obter verde.

## Árvore e limites

- Repositório: `/home/marciocoelho/Documentos/Projetos/VetorUrbano v2/vetor-urbano-v2`.
- Branch: `integration/functional-spec-v1`; HEAD: `fc35eba12d3c65a714854df6073e245bd72183cb`.
- Alterações documentais preexistentes preservadas; documentação reconciliada em paralelo pelo responsável da sessão, não por este executor. Sem staging, commit, merge, push, troca de branch, deploy ou acesso à fonte real.
- Lidos ticket UXH-01, plano/especificação UXH, PLAN, AGENTS, operações web, harness, scripts de verificação/arranque, configuração Playwright, POM, datasource e helpers/callsites de fixtures.
- Node `v22.23.1`, npm `10.9.8`, JRE `25.0.4.1`; Maven/JDK 21 pelo contêiner documentado. Sem Maven/JDK compilador no host no caminho descoberto.
- Logs duráveis, XML e artefatos fora de `target`: `/home/marciocoelho/.hermes/workspace/uxh-01-verification-2026-10-24/`. São evidências locais, não publicadas nem presentes em clone novo.

## Isolamento e proveniência antes de HTTP/SQL integrados

Listeners inspecionados antes dos arranques: 8080, 8025, 4201 e 55440 livres. Nenhuma API preexistente foi reutilizada. O inventário Podman consultou somente metadados gerais; não houve exec/SQL/arranque no contêiner protegido `vu-fogo-cruzado-db` nem acesso a 55438.

API dedicada PID **26411** → `VETOR_DATABASE_URL` efetiva, lida seletivamente de `/proc/26411/environ`, **`jdbc:postgresql://127.0.0.1:55440/vetor_urbano`** → contêiner permitido **`vu-ticket29-e2e-db`**, ID `a522cec57821c0b1158754f33e9b0c8e8cd075f5ff0375a79cf01bcff35cef81`, imagem `docker.io/postgis/postgis:17-3.5`, binding `127.0.0.1:55440 → 5432` → helpers `http://127.0.0.1:8080/api/v1`, caixa 8025 → Angular `http://127.0.0.1:4201`, URL de API fixa 8080 → fixtures com `VETOR_E2E_DATABASE_CONTAINER=vu-ticket29-e2e-db`, único destino da allowlist, base `vetor_urbano`.

`provenance.json` registra essa cadeia sanitizada antes das jornadas. Primeira tentativa de extração do PID não reconheceu o formato IPv4-mapped IPv6 de `ss`; a extração foi corrigida, sem HTTP/SQL para inferir destino. Usuário/senha foram capturados apenas do contêiner sintético autorizado para ambiente do novo processo, sem impressão. Chave MFA nova sintética de 32 bytes/0600 fora do repositório; nenhuma chave privada preexistente lida. Coleta real explicitamente desligada; `poll-seconds=86400`. Jar reconstruído pelo `clean verify` desta rodada.

A API integrou com o banco permitido já existente; isso comprova isolamento sintético, **não baseline vazio**. Não houve recriação, truncamento geral nem exclusão de dados de rodadas alheias. Fixtures próprias das specs escreveram/removeram apenas seus dados conforme código. As pausas de banco dos cenários aprovados foram revertidas pelos respectivos `finally`.

A suíte Java é prova separada: classes IT instanciam `PostgreSQLContainer` PostGIS com bancos sintéticos dedicados e datasource dinâmico; o runner não recebe datasource do banco persistente. Socket Podman dedicado respondeu `_ping` via runner. XMLs reais copiados imediatamente para diretórios duráveis `surefire-reports`/`failsafe-reports`.

## Comandos e resultados desta execução

Todos os comandos abaixo partiram da raiz, com saída redirecionada ao diretório de evidência. Nenhum resultado histórico foi contado.

| Verificação | Comando | Resultado real |
|---|---|---|
| Planning | `bash scripts/verify.sh planning` | exit 0; 685 links locais; âncoras/URLs externas não verificadas |
| Controlador | `python3 -m unittest discover -s tools/tests -v` | exit 0; 43 testes, OK |
| Web | `bash scripts/verify.sh web` | exit 0; Prettier OK; 205 testes/28 arquivos; build inicial 852,03 kB, estimativa transferência 190,34 kB |
| API/PostGIS | `VU_PODMAN_SOCKET=/home/marciocoelho/.hermes/cache/scratch/uxh01-podman.sock bash scripts/verify-api-container.sh` | exit 0; Maven clean verify, 59 unitários + 145 integrações |
| Obrigatórias 06/07/10/36 | seleção Playwright abaixo, `mandatory.log`/`mandatory.xml` | exit 0; 46 aprovados, zero falhas/erros/skips; 23 por navegador |
| Persistidas + guards | seleção Playwright abaixo, `persisted.log`/`persisted.xml` | exit 1; 13 aprovados, 3 falhas, 36 não executados; parada no limite solicitado |
| Whitespace final | `git diff --check` | exit 0 antes deste registro |

Contagens Java obtidas por soma programática dos atributos XML `tests/failures/errors/skipped`: Surefire **16 arquivos, 59/0/0/0**; Failsafe **24 arquivos, 145/0/0/0**. Web apresentou avisos CommonJS de `leaflet` e `pako`, sem falha ou ajuste de orçamento.

Os testes do controlador usam repositórios Git temporários e executável Codex falso (`tools/tests/test_ticketctl.py`); mensagens de commits/estágios no log pertencem a esses fixtures, não ao repositório da aplicação. Não se executou o controlador real nem se alterou seu estado.

Preparação do socket: `podman system service --time=7200 unix:///home/marciocoelho/.hermes/cache/scratch/uxh01-podman.sock` (PID 9282). API por `java -jar apps/api/target/vetor-urbano-api-0.1.0-SNAPSHOT.jar --spring.profiles.active=local --vetor.accounts.enabled=true --vetor.accounts.mailbox-port=8025 --vetor.auth.key-file=<arquivo-sintético-0600> --vetor.collection.enabled=false --vetor.collection.poll-seconds=86400`, com datasource sanitizado acima e credenciais sintéticas em ambiente, não em argumentos/logs.

Comum às duas seleções Playwright: `VETOR_ACCOUNTS_E2E=1 VETOR_E2E_DATABASE_CONTAINER=vu-ticket29-e2e-db`, `PLAYWRIGHT_JUNIT_OUTPUT_FILE=<diretório-evidência>/<seleção>.xml`, `npm run test:e2e --prefix apps/web -- --project=chromium --project=firefox --workers=1 --max-failures=3 --reporter=list,junit --output=<diretório-evidência>/<seleção>-artifacts`.

- Obrigatórias: `e2e/clustering-and-overlap.spec.ts e2e/query-updates-and-states.spec.ts e2e/two-modes.spec.ts e2e/public-information.spec.ts`.
- Persistidas, também com `VETOR_PERSISTED_E2E=1`: `e2e/helpers/synthetic-admin.spec.ts e2e/persisted-query.spec.ts e2e/history-pagination.spec.ts e2e/report-comparison.spec.ts e2e/report-export.spec.ts e2e/report-pdf.spec.ts e2e/report-summary.spec.ts e2e/occurrence-heatmap-http.spec.ts`.

## Três falhas e diagnóstico, sem alteração de fontes

1. **Histórico Chromium**, `history-pagination.spec.ts:233`: após limpar filtros esperava 33 registros, recebeu 38. A fixture adiciona 29 e presume quatro publicadas de baseline. Inventário somente leitura posterior mostra cinco publicadas sintéticas extras em 10/10: `vu23-e2e-blocked`, `vu23-e2e-ok`, `vu26-e2e-concluded`, `vu26-e2e-newer`, `vu26-e2e-older`. Isso explica a diferença global; não foram apagadas para fazer passar.
2. **Comparação Chromium**, `report-comparison.spec.ts:31`: recorte semanal esperava quatro, recebeu oito. Mesmo baseline com fixtures residuais; uma classificação/visibilidade adicional pode excluir uma das cinco do recorte. A diferença foi observada, mas a composição exata da consulta não foi reconstruída; não afirmar que toda falha é exclusivamente ambiente sem isolamento novo.
3. **XLSX Chromium**, `report-export.spec.ts:161`: esperava estado transitório «Preparando a planilha», recebeu «Planilha XLSX completa gerada e exportação registrada no servidor». Diagnóstico provável: corrida de asserção de estado transitório, não prova de falha da exportação. Validação do conteúdo/download posterior não foi atingida; não contabilizar exportação como validada.

Parada efetiva com `--max-failures=3`, sem retries ou seleção posterior. JUnit marca 36 como `skipped`, mas são **não executados por interrupção**, não skips esperados de configuração. Log ainda relata um erro global de encerramento por limite; raiz JUnit tem `errors=0`. Firefox persistido integral, PDF, resumo e demais cenários restantes ficaram pendentes. Coleta em dois modos, contas/admin/revisão e toda a matriz E2E não foram executadas nesta rodada; não declaradas cobertas por unidades ou testes mockados.

Dos 13 aprovados persistidos, três são guards sem SQL; dez são jornadas Chromium reais: duas de calor HTTP, sete de consulta/relatório (inclusive 503, recuperação e banco pausado), uma comparação de médias. Isso não substitui as famílias interrompidas nem Firefox.

Inventário pós-teste (`synthetic-inventory.log`) contém somente IDs/status/datas de ocorrências e versões Flyway; V1–V22 com sucesso. Não se consultaram identidades, tokens, senhas ou dados privados para diagnóstico. Resíduos sintéticos alheios foram preservados.

## Encerramento e próxima decisão

API PID 26411 e serviço REST PID 9282 encerrados com SIGTERM; `podman stop --time 20 vu-ticket29-e2e-db` retornou o banco ao estado parado inicial, sem remover contêiner/volume. `podman ps` final vazio; listeners finais sem 8080/8025/4201/55440. Playwright encerrou seus próprios servidores web. **Nenhum processo de verificação permanece ativo.** Se uma sessão futura reiniciar esses recursos, encerrar sua própria API/socket por SIGTERM e `podman stop vu-ticket29-e2e-db`, nunca parar serviços por nome/porta sem reconferir propriedade.

Próxima decisão do responsável: autorizar preparação de baseline sintético controlado sem destruir banco alheio e/ou correção das fixtures/asserções; então reexecutar seleções completas nos dois navegadores. Não trocar a allowlist, reduzir contagens, aceitar skips ou corrigir fontes sem diagnóstico/autorização. Reconciliação documental e destino dos documentos ignorados pertencem ao responsável da sessão. O registro comprova execução técnica local parcial, não hospedagem, prontidão operacional ou UXH-CA29 integral.
