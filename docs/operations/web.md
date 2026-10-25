# Operação da aplicação web

Este guia descreve o artefato frontend atual. O Vetor Urbano ainda é uma demonstração; não há ambiente de produção ou deploy automatizado configurado.

## Abrir o Vetor Urbano nesta branch (USER e ADMIN) — 19/10/2026

O caminho que funciona nesta branch são **dois processos**: a API em `127.0.0.1:8080` e o frontend em `127.0.0.1:4201`. Sem a API de pé, o formulário de acesso responde apenas `NetworkError when attempting to fetch resource.` — é queda de conexão, não senha errada.

```bash
# terminal 1 — API (constrói o jar se faltar, valida migrações e sobe contra o banco das contas)
bash scripts/run-local-stack.sh

# terminal 2 — frontend
npm start --prefix apps/web -- --host 127.0.0.1
```

Depois abra **`http://127.0.0.1:4201/?consulta=api`** (não `localhost`, que é outro domínio de cookies):

| Perfil | Login | Senha | O que acontece |
|---|---|---|---|
| Usuário | `usuario@vetorurbano.test` | `123456` | entra direto; sessão autenticada |
| Administrador | `admin@vetorurbano.test` | `123456` | entra e pede **cadastrar o autenticador** no primeiro acesso (TOTP, SHA-1, 6 dígitos, 30 s) |

Conferir sem abrir o navegador — o próprio script prova os dois logins por HTTP:

```bash
bash scripts/run-local-stack.sh --check
# API de pé em http://127.0.0.1:8080.
#   ✓ USER (usuario@vetorurbano.test): sessão autenticada
#   ✓ ADMIN (admin@vetorurbano.test): entra e pede cadastro do autenticador (primeiro acesso)
```

### Por que `java -jar` sem o ajuste não sobe

O endereço padrão do código-fonte é `jdbc:postgresql://127.0.0.1:55432/vetor_urbano`. Esse banco **não existe mais**: o contêiner `vu-selected-db` (55432) foi recriado vazio na rodada de contenção sintética de 19/10/2026, então o padrão falha com `FATAL: database "vetor_urbano" does not exist`. As contas de teste vivem em **`vetor-spec-postgis`/`vetor_spec_test` (55436)**, e é isso que `scripts/run-local-stack.sh` exporta. Mudar o padrão do repositório continua pendente de decisão do responsável; o script não altera configuração versionada.

O host tem JRE (`java` 25) mas **não tem `javac`**: o jar é construído pelo runner Maven em contêiner (`scripts/run-local-stack.sh` faz isso quando o artefato não existe) e apenas executado no host.

### Segundo fator do Administrador

Administração exige MFA verificado no servidor. Se a conta `admin@vetorurbano.test` já vier com autenticador cadastrado que você não tem, o script avisa (`!` no `--check`) e a saída é limpar o fator para cadastrar o seu:

```bash
bash scripts/run-local-stack.sh --reset-admin-mfa   # limpa e revoga sessões do ADMIN sintético
# ou, com JSON explícito por stdin:
printf '{"action":"reset-mfa","email":"admin@vetorurbano.test"}\n' | scripts/local-account-admin.py --synthetic-local-only
```

Nenhuma chave de autenticador entra em documentação, log ou repositório: a chave do cofre fica em `~/.local/share/vetor-urbano/mfa.key` (32 bytes, `0600`).

### Proveniência do arranque local

Um `GET` respondido por Java em `127.0.0.1:8080` em 20/10/2026 não pôde ser atribuído a nenhum banco porque a configuração efetiva daquele processo não foi preservada — o registro ficou como **«datasource histórico não determinado»**, sem inferir ausência de acesso nem corrupção. Para que o mesmo evento não se repita, `scripts/run-local-stack.sh` grava um manifesto sanitizado em `$HOME/.local/state/vetor-urbano/api-startup.log` (`0600`, sobrescrevível por `VETOR_STARTUP_MANIFEST_DIR`), com instante, pid, porta HTTP, caixa, contêiner e a URL JDBC **efetiva** lida de `/proc/<pid>/environ`. Quando já existe API de pé em 8080, o script identifica o listener e registra o destino que ele realmente usa (`origem=reaproveitada`), em vez de assumir o pretendido. O manifesto não contém usuário, senha nem token; a URL JDBC não carrega credenciais — usuário e senha vivem em variáveis de ambiente separadas.

Para conferir a proveniência de um processo em execução:

```bash
grep . "$HOME/.local/state/vetor-urbano/api-startup.log" | tail -3
tr '\0' '\n' < /proc/<pid>/environ | grep -E '^VETOR_DATABASE_URL='   # destino efetivo, sem senha
```

## Acesso local com sessão

Após `npm start` em `apps/web/`, use `http://127.0.0.1:4201/?consulta=api` para a consulta integrada à API. A entrada em `http://localhost:4201` é encaminhada automaticamente para `127.0.0.1`, preservando caminho, parâmetros e fragmento antes de iniciar a aplicação. Isso mantém o frontend no mesmo host da API local e permite o cookie de sessão `SameSite=Strict`; sem essa normalização, o login pode responder com sucesso e a configuração do autenticador perder a sessão na requisição seguinte. O cadastro local (`?conta=local`) segue o mesmo encaminhamento.

### Banco e credenciais locais

A sessão só funciona se a API em `127.0.0.1:8080` estiver apontada para **o banco que contém a conta usada**. Conferir antes de investigar senha:

```bash
podman ps --format '{{.Names}} {{.Ports}}'
podman exec <contêiner> psql -U postgres -tAc "select email,role,status from local_accounts order by created_at desc limit 5"
```

Contas válidas que a API desconhece geram `LOGIN DENIED` **com `account_id` nulo** em `auth_audit_events` — é o sinal de e-mail ausente no banco em uso, não de senha errada. Em 17/10/2026 as fixtures documentadas em [tickets-status.md](../product/tickets-status.md) estavam em `vetor_spec_test` (contêiner `vetor-spec-postgis`, porta 55436) com o contêiner **parado**, enquanto a API em `127.0.0.1:8080` servia o banco descartável do lote (`vu-batch-27361718-db`:55439) — daí o `LOGIN DENIED`. A correção verificada foi `podman start vetor-spec-postgis`, aplicar as migrações pendentes subindo a API contra esse banco e manter a API em `127.0.0.1:8080`:

```bash
podman start vetor-spec-postgis
export JAVA_HOME=<jdk-21>
PW=$(podman exec vetor-spec-postgis printenv POSTGRES_PASSWORD)
$JAVA_HOME/bin/java -jar apps/api/target/vetor-urbano-api-0.1.0-SNAPSHOT.jar --spring.profiles.active=local \
  --spring.datasource.url=jdbc:postgresql://127.0.0.1:55436/vetor_spec_test \
  --spring.datasource.username=vetor_spec_test --spring.datasource.password="$PW" \
  --vetor.accounts.enabled=true --vetor.accounts.mailbox-port=8025 \
  --vetor.accounts.key-file=<chave fora do repositório>
```

Duas instâncias não podem compartilhar a caixa local: a segunda falha no startup com `Endereço já em uso`. O banco `vetor_urbano` (`vu-selected-db`:55432, 215 contas) continua recusando startup pela divergência de checksum do `V9` registrada no ticket 32 — exige decisão explícita antes de `repair`.

Para criar ou recuperar uma conta local no banco em uso, use o provisionador documentado (`scripts/local-account-admin.py`, entrada por stdin, sem senha em histórico de shell). Nada disso vale para dados reais: o ambiente é sintético.

## Informes no modo integrado

Em `?consulta=api`, autentique-se como USER e entre em Informes. A função solicita localização pontual; negativa/falha não bloqueia coordenadas WGS84 manuais nem escolha no mapa. A ação **Consultar proximidade** envia somente centro e raio (inteiro 1–5000 m) a `/api/v1/active-reports`; mudar os campos invalida o resultado anterior. Horário da consulta, insuficiência e falhas são explícitos; a distância no cliente é aproximada e não redefine a pertinência validada pelo PostGIS.

A Trilha A de 19/10/2026 substitui a política baseada em mapas por verificações humanas persistidas na V14. Autor da ocorrência e ADMIN com MFA podem confirmar a revisão atual, com evidência e concorrência explícitas. Prazos aprovados, transições e desligamento estão no [contrato](../architecture/active-reports-local-v1.md). A lista integrada não garante andamento atual por si só; expiração indica insuficiência. Fora do modo API, permanece a demonstração.

## Harness de recuperação UXH-01 — 24/10/2026

Os comandos de E2E anteriores abaixo são **históricos**: a allowlist atual de `apps/web/e2e/helpers/synthetic-admin.ts` aceita somente `vu-uxh01-five-db` (55442), com **`VETOR_E2E_DATABASE_NAME` obrigatório** e enumerado por família. Não usar os bancos anteriores como fixtures nem fazer alias silencioso entre nomes. API e SQL precisam usar a mesma base comprovada antes dos testes; o guard verifica a allowlist, não descobre a família automaticamente. Releia o helper e os manifestos antes de iniciar. [Comandos, flags, bases e evidências da recuperação](../history/uxh-01-five-fixes-2026-10-24.md).

Fixtures distintas por família não autorizam limpeza/reset dos bancos preservados. Launchers e credenciais sintéticas ficam fora do repositório; clone novo exige preparar ambiente próprio de forma explícita e comprovar PID/JDBC/base/contêiner/HTTP/browser antes de qualquer operação integrada. Não executar cegamente lançadores antigos ou copiar o diretório privado inteiro.

## Verificar a API neste host sem JDK

`bash scripts/verify.sh api` no host retorna **BLOQUEADO: comando não disponível: javac**. A alternativa verificada usa o mesmo runner em Maven/JDK 21, sem instalar JDK e sem recriar o banco sintético. Requisitos: Podman local funcional, curl, imagem Maven acessível e `$TMPDIR` gravável fora do repositório. O Testcontainers cria bancos descartáveis PostgreSQL **17.5/PostGIS 3.5** reais para as integrações; não usa mocks nem o banco E2E persistente.

O daemon REST do Podman é **separado do CLI**: `podman ps`/`exec` funcionarem não prova que o socket está servido. Em um terminal, mantenha o processo em primeiro plano:

```bash
podman system service --time=0 "unix://$TMPDIR/vu.sock"
```

Em outro terminal, na raiz do repositório:

```bash
curl --fail --silent --show-error --unix-socket "$TMPDIR/vu.sock" http://d/_ping
# Aguarde responder OK; não prossiga apenas porque o arquivo existe.
VETOR_API_INTEGRATION_TESTS=ActiveReportHttpIT,ActiveReportQueryIT,AuditHttpIT,ClosureHttpIT \
  bash scripts/verify-api-container.sh > "$TMPDIR/api-directed.log" 2>&1
# Confira o status de saída antes de continuar e leia o log inteiro.
bash scripts/verify-api-container.sh > "$TMPDIR/api-full.log" 2>&1
```

O [runner containerizado](../../scripts/verify-api-container.sh) verifica `_ping` e executa `scripts/verify.sh api` em `docker.io/library/maven:3.9.11-eclipse-temurin-21`, com `--security-opt label=disable`, `--network=host`, cache `$HOME/.m2:/root/.m2`, socket em `/tmp/podman.sock`, `DOCKER_HOST=unix:///tmp/podman.sock`, `TESTCONTAINERS_HOST_OVERRIDE=127.0.0.1` e `TESTCONTAINERS_RYUK_DISABLED=true`. Um shim efêmero de `docker` aceita **somente** `docker info`, respondendo pelo ping real; criação dos bancos é responsabilidade do Testcontainers via REST. O diretório do shim é removido ao sair. `VU_PODMAN_SOCKET` permite indicar outro socket já servido.

Não usar `--userns=keep-id`: neste host ele quebra `/root`/entrypoint e o acesso a `/w`. SELinux requer `label=disable` para os bind mounts desta receita. O caminho padrão `/run/user/1000/podman/podman.sock` falhou com `bind: no such file or directory`; use o caminho explícito acima. Não faça repair/reset por checksum divergente. Não rode builds `clean` concorrentes no mesmo checkout. O serviço REST e o runner são processos distintos; reinicie/verifique o serviço em uma nova sessão, sem confiar que sobreviveu ao agente. Ao terminar, encerre o processo REST com Ctrl+C.

Relatórios: `apps/api/target/surefire-reports/TEST-*.xml` (unidade) e `apps/api/target/failsafe-reports/TEST-*.xml` (integração). A próxima execução `clean` os apaga: copie-os antes se precisar preservar a seleção dirigida. Uma seleção inexistente pode ser ignorada se outra classe corresponder; confira os nomes efetivamente executados. Filtros estreitos escondem falhas: leia o log completo ou inclua **BLOQUEADO**, **BUILD FAILURE**, **ERROR** e resumos de testes no filtro; somente “BUILD SUCCESS” sem contagens não prova cobertura.

Verificação final em 19/10, depois de toda a implementação da Trilha A: seleção acima **21 unitários + 50 integrações**; suíte completa **21 + 100**, zero falhas/erros/pulados (`final-directed.log`, `final-full.log`, XMLs em `final-directed-*`/`final-full-*`). Evidências no [checkpoint da rodada](../history/closure-round-2026-10-19.md#estado-final-da-trilha-a). Playwright usa API Java local em 8080 e caixa 8025 contra `vetor-spec-postgis`/`vetor_spec_test` em 55436; use `VETOR_ACCOUNTS_E2E=1 VETOR_E2E_DATABASE_CONTAINER=vetor-spec-postgis` e `--workers=1` para serializar fixtures compartilhadas entre browsers. Seleção autorizada final: **42/42** em Chromium/Firefox com o ciclo de expiração/renovação. Na seleção de 19/10, a família `VETOR_PERSISTED_E2E` (`persisted-query`, `history-pagination`, `report-*`, `occurrence-heatmap-http`) ficou fora por depender do contêiner sintético histórico ausente `vu-ticket30-db`; essa dependência foi substituída pela atualização de 21/10 abaixo.

### E2E com banco sintético dedicado — atualização 21/10/2026

O `vu-ticket30-db` mencionado acima era a dependência histórica indisponível em 19/10; não o use. A família persistida agora roda contra **`vu-ticket29-e2e-db`**, PostGIS local em `127.0.0.1:55440` (porta escolhida nesta rodada, sem evidência histórica), com a API apontada exclusivamente a esse banco e `CONTAINER_HOST="unix://$TMPDIR/vu-ticket29-podman.sock"`. Para as sete specs persistidas, use `VETOR_ACCOUNTS_E2E=1 VETOR_PERSISTED_E2E=1 VETOR_E2E_DATABASE_CONTAINER=vu-ticket29-e2e-db`, os projetos Chromium/Firefox e `--workers=1`; a última execução passou **46/46**. A coleta recente configurada usa stub HTTP local, banco sintético e passou **22 testes (2 pulados)** em Chromium/Firefox.

Na árvore final de 22/10/2026 a suíte foi repetida com os mesmos resultados — persistentes **46/46**, coleta configurada **22 (2 pulados)**, coleta desligada **2 (22 pulados)** e jornadas 06/07/10/36 **46/46** — e cada pulado corresponde à configuração do arranque. **A API de E2E precisa subir com `--vetor.collection.poll-seconds=86400`**: com o padrão de 60 s o agendador cria execuções `RECENT` no banco sintético durante a jornada e o estado «nenhuma execução registrada» fica intermitente (uma falha em Firefox foi observada antes do ajuste do arranque, sem alteração de produção).

O frontend E2E padrão deve escutar em `127.0.0.1:4201`: `LocalWebConfiguration` só autoriza CORS para `127.0.0.1:4201` e `localhost:4201`. Uma porta web ad hoc `4211` recebe 403 em OPTIONS e invalida o fluxo de login; se a API for servida fora de 8080, `VETOR_E2E_API_BASE` sozinho altera apenas os helpers `APIRequestContext` — chame `routeApplicationApi(page)` antes de navegar para redirecionar o navegador. Não aponte essas fixtures aos bancos protegidos nem use a fonte real. A seleção desligada da coleta foi revalidada em 22/10/2026 contra a API sem `vetor.collection.enabled`: **2 aprovados e 22 pulados**, todos esperados.

### Painel de operação (ticket 22) — 22/10/2026

O painel administrativo de operação lê `GET /api/v1/admin/operations` (ADMIN + segundo fator,
`no-store`) e é auditado como `OPERATIONS_VIEW` com contagens agregadas. A janela de antecedência das
confirmações vem de **`vetor.operations.expiry-window`** (padrão de repositório `24h`); em branco, o
painel responde `NOT_CONFIGURED` e não sugere prazo. Contrato completo em
[`docs/architecture/operations-panel-local-v1.md`](../architecture/operations-panel-local-v1.md).

A área administrativa de fontes, coleta, operação e revisão é carregada por **`@defer`**
(`AdminSourcesPanels`): o pacote inicial caiu de **872,43 kB** para **841,05 kB** e o bloco
administrativo virou o chunk preguiçoso `admin-sources-panels` de **79,20 kB**. Telas de conta e de
logs permanecem no pacote inicial de propósito: o foco do título da tela é verificado por navegador e
o carregamento diferido o perdia.

Jornada de navegador desta entrega (`VETOR_ACCOUNTS_E2E=1 VETOR_E2E_DATABASE_CONTAINER=vu-ticket29-e2e-db`,
API com `--vetor.accounts.enabled=true` e caixa em 8025): `operations-panel.spec.ts` passou **4/4**
Chromium/Firefox, junto com as regressões `admin-local-sources.spec.ts` e `audit-log.spec.ts`
(**10/10** no total, `--workers=1`). A fixture usa `SET session_replication_role = replica` somente
para remover as próprias linhas, porque o histórico de verificação é imutável por gatilho.

## Gerar o artefato

Na raiz do repositório, com o Node.js de `.nvmrc`:

```bash
npm ci --prefix apps/web
bash scripts/verify.sh web
```

O build otimizado fica em **`apps/web/dist/web/browser/`**. Esse diretório é o artefato para um servidor de arquivos estáticos. `npm start` inicia o servidor de desenvolvimento; não é o comando de hospedagem.

O frontend usa caminhos absolutos para mapas e fontes. A configuração atual espera publicação na raiz do domínio; hospedagem em subdiretório exige ajustar esses caminhos e validar o build. O servidor deve resolver a entrada da aplicação e servir JS, CSS, WOFF2, TTF e GeoJSON com seus tipos de conteúdo corretos.

Além dos WOFF2 da interface, `apps/web/public/fonts/manrope-pdf-regular.ttf` é a derivação estática usada somente para incorporar a fonte no PDF exportado; origem, licença e limites permanecem no [README do diretório](../../apps/web/public/fonts/README.md) e a derivação é reproduzível por `scripts/prepare-pdf-font.py`. Servi-la exige o tipo `font/ttf` correto, com o mesmo cuidado de cache dos demais assets.

## Configuração cartográfica

| Arquivo | Uso |
|---|---|
| `apps/web/public/maps/urban-style.json` | Estilo, fontes e tiles do mapa vetorial |
| `apps/web/public/maps/raster-provider.json` | URL, atribuição e limites do fallback Leaflet |
| `apps/web/public/maps/areas-territoriais.geojson` | Camada territorial estática com proveniência documentada |

A configuração atual do Stadia Maps permite desenvolvimento local em `localhost`/`127.0.0.1`. Antes de usar outro domínio, configure a autorização apropriada do provedor e revise termos, limites e atribuição descritos em [visual-reference.md](../maps/visual-reference.md). As duas bases precisam estar disponíveis, inclusive durante recuperação do mapa.

Tudo em `public/` e no bundle é acessível ao navegador. Credenciais de servidor ficam fora do frontend; uma chave de cliente eventualmente exigida pelo provedor precisa de restrições próprias de domínio e uso.

## Antes de liberar uma versão

Execute lint, testes unitários, build e a matriz Playwright em Chromium/Firefox. No host escolhido, confira carregamento de mapas, fontes e sprites; alternância de temas; fluxo de consulta/cadastro; teclado e apresentação móvel. Mantenha o aviso de demonstração enquanto houver dados fictícios.

O baseline do fechamento de 19/10/2026 foi **836,58 kB** iniciais, acima do alerta então vigente de 500 kB; os números são históricos. A anotação de **850 kB** feita na rodada do ticket 35 estava incorreta: em 20/10/2026 o responsável confirmou **900 kB** como D4 vigente para `initial.maximumWarning`, preservando o limite de erro de 1 MB e os orçamentos de estilos. Isso reconhece o tamanho atual, não reduz download/parse. A medição final da rodada ficará no [checkpoint do 35](../history/ticket-35-progress-2026-10-19.md); `pako` CommonJS permanece no chunk PDF lazy. Nenhuma alteração de dependência/carregamento foi autorizada ou realizada. QA em aparelho físico e leitor de tela permanece pendente.

Na rodada do ticket 20 (coleta autorizada), a seção administrativa «Coleta» levou o `initial` de 841,23 kB para **864,12 kB** e o responsável aprovou explicitamente **900 kB** (margem de 35,88 kB), mantidos o erro de 1 MB e os orçamentos de estilos. A tentativa daquela rodada, que envolvia cada componente em `@defer` mantendo-os em `imports` do componente raiz, **piorou** o inicial para 873,38 kB e foi revertida; a conclusão registrada então («exige `import()` dinâmico») estava **incorreta** e é retificada aqui. `pako`/`fontkit` seguem no chunk lazy do PDF, sem alteração de dependência.

**Retificação medida em 22/10/2026 (ticket 22):** o que faltava não era `import()`, e sim um **componente-agrupador** que possua os imports. `AdminSourcesPanels` reúne operação, fontes, coleta e revisão e é o alvo do `@defer`; com isso o Angular separa o grafo inteiro em um chunk preguiçoso. Medição real do build: `initial` **872,43 kB → 841,05 kB** e chunk `admin-sources-panels` de **79,20 kB** (margem até 900 kB: **58,95 kB**). Com os painéis de confiabilidade, ocorrências e campos de área (22/10/2026), o `initial` ficou em **848,07 kB** e o chunk diferido em **132,55 kB** — margem de **51,93 kB**. Envolver os mesmos componentes em `@defer` sem o agrupador não reduz o pacote, porque eles continuam estaticamente importados pelo componente raiz. Conta e logs ficaram fora do diferimento: o foco do `h1` da view é verificado em navegador e o carregamento diferido o perdia (`audit-log.spec.ts`).

A medição mais recente da implementação do ticket 21, em 21/10/2026, foi de **871,81 kB** iniciais; a árvore final de 22/10/2026 ficou em **872,28 kB** e, depois da carga diferida do bloco administrativo, em **841,05 kB** — margem de **58,95 kB** até o orçamento confirmado de 900 kB. `angular.json` e manifests de dependências não mudaram. A fatia de carga diferida da área administrativa de fontes/coleta/revisão está concluída; restam apenas conta e logs, mantidos no pacote inicial pelo motivo de foco descrito acima.

Hospedagem da demonstração e liberação operacional são etapas diferentes. Uma versão operacional depende de API/banco, autorização, moderação, políticas de dados, cobertura e recuperação verificadas. Commit e push não publicam a aplicação.

## Fechamento persistido do 25 — atualização em 19/10/2026

A decisão aprovada na retomada da Trilha A substitui a pendência de mapas vazios registrada acima:
V14 persiste verificação humana por efeito/versão, e a política produtiva usa esse histórico.
Prazos e permissões completos estão no [contrato atualizado](../architecture/active-reports-local-v1.md#trilha-a--decisão-aprovada-em-19102026).
Não configurar mapas legados para simular confirmação humana. Aplicar V14 somente pelo Flyway no
startup normal; nunca repair/reset nem alteração de V1–V13. O banco sintético existente não foi recriado.

ADMIN com MFA recebe toast persistente para expiradas. Clicar abre Informes e a fila no início;
Tratar carrega o editor. Renovação exige nova evidência humana e confirmação não futura, pelo mesmo
prazo do tipo; a próxima expiração avisa novamente. Autor também pode confirmar seu efeito.
409 exige recarregar e revisar antes de tentar outra decisão; nunca repetir a escrita automaticamente.
Expiração é UNKNOWN na projeção, sem encerrar o fato. Polling de cinco segundos só em sessão aberta,
sem serviço de push, coleta ou geofencing. Falha não significa fila vazia.
