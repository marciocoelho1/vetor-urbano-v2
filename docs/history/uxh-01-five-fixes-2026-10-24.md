# UXH-01 — cinco correções e recuperação técnica — 24/10/2026

## Conferência final da sessão principal

- XMLs finais de publicação2/2, correção4/4, XLSX8080 8/8 e XLSX8081 8/8 recalculados diretamente, sem falhas/erros/skips. Na consolidação, a parcela antiga de exportação foi removida de `final_persisted` e substituída pelo XML padrão final, sem somar duplicatas: 208 entradas, 184 aprovadas, 24 skips de modos complementares, zero falhas/erros. A porta alternativa é evidência adicional separada.
- Revisão independente final **Standards/segurança: zero achados novos**; autoria exata, contexto de solicitante e predicado503 fechados. **Spec: zero gaps concretos/scope creep no diff corrigido**. Não representa aceite de UXH-02, candidato hospedado ou produto operacional.
- Planning final: 716 links locais, exit0; `git diff --check` aprovado; checklist externo com23 caixas desmarcadas. Branch/HEAD preservados, índice vazio, listeners próprios livres e `podman ps` sem contêiner ativo. Sem staging/commit/push/merge, dados reais ou controlador.

## Resultado e fronteira

Branch `integration/functional-spec-v1`, HEAD `fc35eba12d3c65a714854df6073e245bd72183cb`, sem escrita Git. A recuperação corrigiu **somente duas specs**: `session-access.spec.ts` e `source-management.spec.ts`. A terceira seleção de cada família passou em Chromium/Firefox serial: **6/6 e 4/4**, zero falhas/erros/skips. Nenhum helper compartilhado nem produto/API foi alterado nesta recuperação.

Consolidação sem somar execuções sobrepostas: **208 entradas XML, 184 aprovadas, 0 falhas, 0 erros, 24 skips de configuração**. É uma composição de evidências históricas conferidas e duas reexecuções, **não uma nova execução integral da matriz**. Os dois modos de coleta são complementares: 2 aprovadas/22 skips desligada e 22 aprovadas/2 skips configurada com stub local. Skips não são aceites. O `matrix.py` histórico continua exit 1; não foi reescrito para parecer verde.

**Lacuna XLSX8081 fechada na árvore final:** a spec completa `report-export.spec.ts` passou **8/8**, Chromium 4/4 e Firefox 4/4, zero falhas/erros/skips, com API dedicada 8081 e fixtures `vetor_export`. Os XMLs estreitos históricos continuam anteriores às mudanças e não são usados para provar a árvore final. A regra literal interrompe alterações repetitivas quando a mesma seleção **continua falhando após três tentativas focadas**; não limita execuções totais incluindo GREEN ou portas distintas. XLSX tinha um RED e dois GREEN históricos, não três falhas consecutivas; a revalidação obrigatória após mudanças compartilhadas não exigia nova autorização. Esta seleção completa passou na primeira execução, sem editar specs/helpers/produto.

Não há aceite do Lote A, cartografia, dados reais, hospedagem ou prontidão operacional. Revisão independente da árvore fica com a sessão principal.

## Evidências e comandos executados na recuperação

Diretório novo: `/home/marciocoelho/.hermes/workspace/uxh01-recovery-validation`. Originais preservados em `/home/marciocoelho/.hermes/workspace/uxh01-five`.

A partir de `apps/web`:

```bash
npx prettier --check e2e/session-access.spec.ts e2e/source-management.spec.ts
python /home/marciocoelho/.hermes/workspace/uxh01-recovery-validation/recover.py
```

Ambos terminaram exit 0. O segundo comando executou, uma vez por família, sem grep ou fail-fast:

```bash
npx playwright test session-access.spec.ts --workers=1 --max-failures=0 --project=chromium --project=firefox --reporter=list,junit --output=/home/marciocoelho/.hermes/workspace/uxh01-recovery-validation/final_session_access-attempt3
npx playwright test source-management.spec.ts --workers=1 --max-failures=0 --project=chromium --project=firefox --reporter=list,junit --output=/home/marciocoelho/.hermes/workspace/uxh01-recovery-validation/final_source_management-attempt3
```

Flags explícitas em ambos: `VETOR_ACCOUNTS_E2E=1`, `VETOR_PERSISTED_E2E=1`, `VETOR_SESSION_E2E=1`, `VETOR_LOCAL_ACCESS_E2E=1`, `VETOR_SOURCE_E2E=1`, `VETOR_COLLECTION_E2E=unconfigured`, `VETOR_E2E_DATABASE_CONTAINER=vu-uxh01-five-db`, `VETOR_E2E_API_BASE=http://127.0.0.1:8080/api/v1`, `VETOR_E2E_DATABASE_NAME=vetor_<família>`. JUnit e caminho de credenciais sintéticas são definidos explicitamente pelo runner; valores privados não são publicados. Os manifestos `*-command.json` guardam comandos e configuração não secreta.

Auditoria calculada, sem iniciar serviços/testes adicionais:

```bash
python /home/marciocoelho/.hermes/workspace/uxh01-recovery-validation/audit.py > /home/marciocoelho/.hermes/workspace/uxh01-recovery-validation/audit.log
git diff --check
ss -ltnp
podman ps --format '{{.Names}} {{.Ports}}'
```

`git diff --check` passou. `xml-audit.json`, `final-matrix-audit.json`, `supplementary-input-audit.json`, `input-inventory.json`, `launcher-inventory.json` e `recovery-results.json` são evidências calculadas; não substituem os XMLs.

## Diagnóstico dos cinco pontos históricos

| Ponto | RED efetivamente encontrado | Causa/correção na árvore | Evidência posterior |
|---|---|---|---|
| Renovação/foco | `renewal-red.xml`: 1 falha; seletor resolve h1 e h2 chamados Ocorrências | Especificar nível 1; manter teclado e `toBeFocused()` | `renewal-green` 4/4; `final_active_report_renewal` 4/4 |
| Clique Informes/mapa | `active-red.xml`: 1 erro de timeout de clique | Posição antiga acerta legenda irmã; centralizar canvas e provar bounds + `elementFromPoint` antes do clique real | `active-green` 6/6; `final_active_reports_api` 6/6 |
| Fila global operações | `operations-red.xml`: 1 falha, esperado 1/recebido 2 | Contaminação sintética demonstrada; bases por família e limpeza da própria fixture em `afterEach`, sem alterar expectativa global | `operations-green` 4/4; `final_operations_panel` 4/4 |
| Associação referência/Firefox | **`publication-red` 1/1 e `publication-coupled-red` 3/3 passaram; nomes não são REDs** | SQL diagnóstico `publication-version-red.log` reproduz colisão `(occurrence_id,version)=(vu-demo-occurrence-traffic-001,2)`; reset revision=1 mantinha histórico. Reset agora preserva revisão monotônica. Asserção SQL acrescentada exige decisão ASSOCIATE, referência e autor não nulo | `publication-green` 6/6; editor final 4/4 e revisão final 2/2. Não alegar reprodução do sintoma Firefox original |
| XLSX/porta alternativa | `export-alt-red.xml`: 1 erro de timeout | Reescrever com `continue` não reencadeia interceptadores; handler casa URL original e busca resposta genuína no destino autorizado, retém resposta até observar loading e libera em `finally`; sem atraso fixo | alt-green 2/2 em 8081 e standard-green 2/2 em 8080 são históricos; persistida final cobre padrão; `xlsx8081-final.xml` completo 8/8 cobre 8081 na árvore final |

A causa da colisão foi reproduzida em SQL, não numa reprodução navegador Firefox falha. A relação com o sintoma antigo não deve ser promovida a certeza. Nenhuma correção de produção foi necessária ou autorizada por causa comprovada nesta recuperação.

## Por que sessão e fontes continuavam falhando

- **Sessão:** XML inicial: 0 aprovadas/1 falha/5 skips; XML complete: 4 aprovadas/2 falhas. O modo persistido mostra `app-public-source-list` e esconde a seção demonstrativa cujo h1 é «Conheça nossas fontes» (`app.html`, bloco public-sources). O snapshot já mostrava «Fontes cadastradas». Corrigido o alvo para `#managed-public-sources-heading`, mantendo navegação pública, acesso negado, login inválido, foco, dois modos, reload, logout e móvel. RED histórico da mesma árvore precede a edição; terceira seleção: 6/6.
- **Fontes:** XML inicial: 1 aprovada/1 falha/2 skips; complete: 2 aprovadas/2 falhas. O mock consumia o vazio só no GET nº 2, mas componentes administrativos também pedem `/admin/sources`. Metadados da trace Firefox mostram três GETs, 200/503/200: o retry da gestão já recebia a lista real. O snapshot mostrava as duas fontes iniciais, não vazio. Corrigida a simulação para uma fase vazia mantida até a asserção do vazio; depois liberada a lista real. Preservados erro, loading, vazio, criação/edição real, versões 1/2, identidade da fonte, teclado/foco, logout e projeção pública mínima. Terceira seleção: 4/4.

Contagem histórica dessas famílias: inicial + complete + attempt3 = **três seleções**, não três falhas consecutivas. `session-prerequisite-red.log` é inspeção estática fail-closed de caminhos antigos, não execução de navegador. Sessão/fontes não foram repetidas nesta complementação; evidência verde válida preservada.

## Matriz selecionada sem duplicação

Cada linha usa o XML `final_<família>.xml` histórico, exceto as linhas marcadas como reexecutadas (sessão, fontes e complementação de revisão). Não somar initial/complete/attempt3 ou provas estreitas a essas linhas.

| Família | Aprovadas | Skips | Origem |
|---|---:|---:|---|
| account_registration | 8 | 0 | histórica |
| account_recovery | 10 | 0 | histórica |
| account_self_service | 8 | 0 | histórica |
| account_closure | 8 | 0 | histórica |
| session_access | 6 | 0 | reexecutada attempt3 |
| local_origin_session | 6 | 0 | histórica |
| source_management | 4 | 0 | reexecutada attempt3 |
| admin_local_sources | 4 | 0 | histórica |
| audit_authorship | 2 | 0 | histórica |
| audit_log | 2 | 0 | histórica |
| active_report_renewal | 4 | 0 | histórica |
| active_reports_api | 6 | 0 | histórica |
| operations_panel | 4 | 0 | histórica |
| publication_editor | 4 | 0 | histórica |
| publication_review | 2 | 0 | reexecutada review-final_publication_review-8080-final |
| reliability_panel | 4 | 0 | histórica |
| risk_area_drawing | 4 | 0 | histórica |
| risk_area_versions | 4 | 0 | histórica |
| occurrences_admin | 4 | 0 | histórica |
| query_update_notices | 6 | 0 | histórica |
| correction_channel | 4 | 0 | reexecutada review-final_correction_channel-8080-final |
| collection_recent desligada | 2 | 22 | histórica |
| collection_configured stub local | 22 | 2 | histórica |
| persisted | 56 | 0 | histórica |
| **Total das entradas** | **184** | **24** | **208; zero falhas/erros** |

Antes desta recuperação, selecionar os complete mais recentes produzia **180 aprovadas/4 falhas/24 skips**, nas mesmas 208 entradas. `guards-final` 10/10 se sobrepõe aos guards de `final_persisted`; não adicioná-lo. `demo-final` 46/46 é seleção separada histórica, sem nova execução. `web-final.log` é histórico. Após as alterações das duas specs e a seleção XLSX8081, `bash scripts/verify.sh web` foi executado novamente na árvore atual: exit 0, lint aprovado, 205 testes/28 arquivos aprovados, build inicial 852,03 kB; log durável `web-current.log`. Avisos CommonJS de leaflet/pako permanecem, sem falha. API unitária/integrada e controlador não foram reexecutados; números anteriores não são evidência nova.

## Validade dos inputs e limites da auditoria

`audit.py` confere SHA-256 e mtime de **338 inputs comuns**: fontes/recursos web e API, arquivos de configuração/build de primeiro nível, todos os helpers E2E e jar efetivamente usado. Acrescenta **todos os arquivos de spec de cada seleção**, não apenas `.ts` do produto. Compara com o timestamp de início dos testes no XML, não o fim do relatório. Na auditoria anterior às edições dirigidas de revisão, as 24 seleções escolhidas não tinham inputs posteriores: 339 inputs por família simples e 345 na persistida. Guards e demo também não têm inputs posteriores (338 e 342 inputs).

As duas seleções XLSX estreitas têm três inputs posteriores: `helpers/synthetic-admin.spec.ts`, `helpers/synthetic-admin.ts` e a própria `report-export.spec.ts`. Logo, não validar a porta alternativa apenas com ausência de mudança no produto. A evidência final padrão vem de `final_persisted`. Nenhum helper foi modificado agora, evitando disparar desnecessariamente nova matriz ampla.

Os launchers históricos foram lidos e inventariados, mas `run.py` atual é posterior a algumas execuções iniciais: manifestos históricos comprovam `--max-failures=1`, enquanto o arquivo atual usa 0. Não reconstruir o comando antigo a partir de um launcher novo. A instalação de dependências e os binários do sistema não foram reconstruídos nem têm hash histórico para comparação; mtime/hash atuais não provam imutabilidade passada. Fixtures são estado de banco, não arquivos; usaram bases existentes preservadas, não um baseline recriado.

## Isolamento e encerramento

Antes de HTTP/fixtures da recuperação, o runner verificou ausência de listeners de teste, iniciou somente `vu-uxh01-five-db` existente e comprovou seletivamente `/proc/<pid>/environ` **somente para JDBC**, associação PID/listener e metadados não secretos do contêiner. Nenhum ambiente completo ou arquivo privado foi exibido.

- Sessão: PID **14194**, JDBC `jdbc:postgresql://127.0.0.1:55442/vetor_final_session_access`.
- Fontes: PID **15609**, JDBC `jdbc:postgresql://127.0.0.1:55442/vetor_final_source_management`.
- Contêiner em ambos: `vu-uxh01-five-db`, ID `4beb18531f8d21e0c94f155103405f9f60b18e7d06f27464a45ddd94be3edd3b`, bind `127.0.0.1:55442 -> 5432`.
- Startup de ambos, anterior aos testes, registra schema **public**, versão **22**, sem migração pendente. JDBC não inclui troca de schema.
- Helpers e Angular: API `127.0.0.1:8080/api/v1`, frontend `127.0.0.1:4201`; fixtures `vetor_final_session_access` e `vetor_final_source_management` no mesmo contêiner. Guard rejeita contêiner real/antigo e base ausente/default/não enumerada antes de Podman/SQL; `psql -d` usa explicitamente a base selecionada. É allowlist de bases, não descoberta automática da família; a correspondência com JDBC é responsabilidade do launcher e foi asserida.
- Arquivos privados sintéticos permanecem fora do repo, modo 0600 conferido por metadados; não foram copiados ao relatório. Bases anteriores `vu-uxh01-resume-db` e `vu-ticket29-e2e-db` preservadas; nenhum uso de `vu-fogo-cruzado-db:55438` ou dados reais.

Ao final, ambos os PIDs terminaram, Playwright encerrou seus servidores Angular e o contêiner próprio foi parado, não removido. `shutdown-listeners.log` e nova conferência `ss` sem listeners 8080/8081/4201/8025/8788/55442; `shutdown-containers.log` e `podman ps` sem contêiner ativo. Serviços alheios não foram encerrados.

### Complementação XLSX8081 e web anterior à revisão dirigida

Comando durável: `python /home/marciocoelho/.hermes/workspace/uxh01-recovery-validation/xlsx8081.py` (exit 0). Executa `npx playwright test report-export.spec.ts --workers=1 --max-failures=0 --project=chromium --project=firefox --reporter=list,junit`, sem grep, seguido de `bash scripts/verify.sh web`. Resultados: `xlsx8081-final.xml`, `xlsx8081-final.log`, `xlsx8081-result.json`, `xlsx8081-command.json`, `xlsx8081-inputs.json`, `web-current.log` e `web-current-result.json`, todos no mesmo workspace durável. Não adicionar 8 à matriz de 208: prova complementar de porta, sobreposta à família persistida.

Antes de HTTP/SQL das fixtures: launcher sanitizado inspecionado; portas livres; PID API **19990** comprovado por listener 8081 e leitura seletiva somente de JDBC; `jdbc:postgresql://127.0.0.1:55442/vetor_export`; contêiner `vu-uxh01-five-db`, mesmo ID e bind documentados acima; fixtures selecionam explicitamente `psql -d vetor_export`, base allowlisted. Helpers usam `http://127.0.0.1:8081/api/v1`; Angular em 4201 instala `route.fallback` da origem fixa 8080 para 8081 antes de navegar. 8080 permaneceu sem listener, portanto o verde não depende de API alheia. `provenance-export-8081.json` e `xlsx8081-listeners-before.log` registram a cadeia. Arquivos privados sintéticos externos ao repo mantidos 0600, sem exibir valores.

Spec integral preservada: loading com resposta genuína suspensa e liberação em finally, botão desabilitado, status 200, 33 ocorrências/29 acontecimentos, conteúdo/abas/linhas/referências e neutralização de fórmula, recorte vazio, limite de conteúdo e indisponibilidade PostGIS sem download parcial. Nenhuma edição de helper/spec necessária. Hashes/mtime dos inputs registrados em `xlsx8081-inputs.json`.

Encerramento comprovado em `xlsx8081-shutdown-listeners.log` e `xlsx8081-shutdown-containers.log`: API própria encerrada, Angular encerrado pelo Playwright, contêiner próprio parado (não removido), sem listeners 8080/8081/4201/8025/55442 e sem contêiner ativo; recursos alheios preservados. Nenhum runner API repetido, pois produto/API não mudaram. Na primeira complementação, somente este relatório foi alterado no repo; a rodada de revisão abaixo passou a alterar também três specs; sem Git, PLAN, CHANGELOG, tickets, checklist, controlador, deploy ou dados reais. Permanecem a reprodução Firefox original não comprovada e a revisão independente do pai; nenhum aceite é inferido.

## Revisão dirigida — atores exatos e XLSX completo nas duas portas

Esta seção prevalece sobre os resultados da primeira complementação quando houve edição posterior. Arquivos alterados nesta rodada: somente `apps/web/e2e/publication-review.spec.ts`, `apps/web/e2e/correction-channel.spec.ts`, `apps/web/e2e/report-export.spec.ts` e este relatório. Nenhum helper compartilhado/produto/API alterado; consumidores não afetados reutilizam sua evidência válida.

- **Associação:** lê `/auth/session` do contexto do navegador, exige ADMIN autenticado e ID válido; decisão SQL exige esse ID exato, `ASSOCIATE`, clipping exato e ocorrência `vu-demo-occurrence-traffic-001`, em vez de autor apenas não nulo.
- **Correção:** cria ADMIN via `context.request` isolado, com fechamento em `finally`; prova sessão ADMIN distinta. Captura sessão USER do navegador titular, comprova email no banco e localiza ID exato do pedido pela referência única no GET privado. Antes da atualização final, prova que o navegador titular continua USER com o mesmo ID. SQL exige pedido/solicitante/alvo/referência exatos, versão 3, transição IN_REVIEW→COMPLETED, motivo exato e autor igual ao ADMIN autenticado. O review original é tratado como lacuna de cobertura, não como reprodução comprovada de troca de cookies: `request` da fixture é independente do contexto `page`.
- **503 XLSX:** aceita resposta do destino configurado ou da origem fixa do navegador, como o sucesso já fazia, sempre exigindo status 503. A spec completa, inclusive indisponibilidade PostGIS sem download parcial, passou nas duas portas. A rodada 8081 anterior já havia passado também o 503; não alegar RED de produto desse predicado.

### REDs controlados de sensibilidade e GREENs finais

Runner durável `review-fixes.py` restaura a spec após cada mutação negativa, mesmo em exceção; nenhuma mutação de dados foi usada para simular autoria. REDs são controles deliberados da asserção, **não reprodução do defeito original** nem falhas de produto:

| Seleção/XML no workspace recovery-validation | Resultado real |
|---|---|
| `review-final_publication_review-8080-actor-negative.xml` | Chromium: 1 falha; ID esperado substituído por UUID zero, SQL retorna 0 em vez de 1 |
| `review-final_publication_review-8080-final.xml` | Chromium/Firefox completos: 2/2, zero falhas/erros/skips |
| `review-final_correction_channel-8080-actor-negative.xml` | Chromium completo: 1 aprovada/1 falha; leitura da sessão do titular deliberadamente trocada para contexto ADMIN; asserção detecta ID diferente e ADMIN em vez de USER |
| `review-final_correction_channel-8080-final.xml` | Chromium/Firefox completos: 4/4, zero falhas/erros/skips |
| `review-export-8081-final.xml` | Chromium/Firefox completos: 8/8, zero falhas/erros/skips |
| `review-export-8080-final.xml` | Chromium/Firefox completos: 8/8, zero falhas/erros/skips |

Todos os GREENs usaram `--workers=1 --max-failures=0 --project=chromium --project=firefox --reporter=list,junit`, sem grep, com flags explícitas accounts/persisted/session/local-access/source=1, collection=unconfigured, contêiner/base/API coerentes. Manifestos `*-command.json`, logs, XMLs e downloads permanecem em `/home/marciocoelho/.hermes/workspace/uxh01-recovery-validation`; `review-results.json` e `review-xml-audit.json` registram saídas/contagens calculadas. Nenhuma seleção ficou falhando três vezes consecutivas.

Cadeia novamente comprovada antes de cada família fazer HTTP/SQL, por launcher sanitizado, JDBC seletivo do PID, listener e mapeamento do contêiner:

| Família | PID/API | JDBC/base em 55442 |
|---|---|---|
| publication_review | 25437 / 8080 | `vetor_final_publication_review` |
| correction_channel | 27828 / 8080 | `vetor_final_correction_channel` |
| export alternativa | 29886 / 8081 | `vetor_export` |
| export padrão | 31698 / 8080 | `vetor_export` |

Mesmo contêiner sintético autorizado e bind `127.0.0.1:55442 -> 5432`; bases existentes separadas por família preservadas, sem reset amplo. Helpers apontam à porta da API dedicada, frontend 4201; export instala fallback antes de navegar quando em 8081. `review-*-inputs.json` registra SHA-256/mtime das specs/helpers/config, e todos os hashes foram reconferidos ao fim. Proveniências JSON e listeners duráveis permitem auditoria da cadeia.

**Validade da consolidação:** substituir as duas linhas de revisão/correção pelos novos XMLs sem somar execuções sobrepostas. A seleção histórica persistida 56/56 contém a spec export agora editada: não apresentá-la integralmente como executada na árvore final. Sua parcela export padrão é substituída pela seleção completa `review-export-8080-final.xml`; a alternativa é prova suplementar. A auditoria histórica de 338 inputs permanece histórica; pai fará revisão/contagens finais da composição, sem repetir a matriz inteira.

Após todas as edições finais das specs, `bash scripts/verify.sh web` terminou **exit 0**: lint aprovado, **205 testes/28 arquivos**, build inicial **852,03 kB**. Evidências finais `web-review-current.log` e `web-review-result.json`; avisos CommonJS leaflet/pako sem falha. Nenhum runner API repetido.

Encerramento final registrado em `review-shutdown-listeners.log` e `review-shutdown-containers.log`, depois reconferido por sockets: portas 8080/8081/4201/8025/55442 fechadas, contêiner próprio parado (não removido), sem contêiner ativo e processos próprios encerrados. Sem Git/staging/commit/push/merge/branch, controlador, issues, deploy ou dados reais. Revisão final independente permanece com o pai.
