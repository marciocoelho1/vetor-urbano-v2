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

Verificação final em 19/10, depois de toda a implementação da Trilha A: seleção acima **21 unitários + 50 integrações**; suíte completa **21 + 100**, zero falhas/erros/pulados (`final-directed.log`, `final-full.log`, XMLs em `final-directed-*`/`final-full-*`). Evidências no [checkpoint da rodada](../history/closure-round-2026-10-19.md#estado-final-da-trilha-a). Playwright segue separado e exige API real em 8080/caixa 8025 contra `vetor-spec-postgis`/`vetor_spec_test` em 55436; use `VETOR_ACCOUNTS_E2E=1 VETOR_E2E_DATABASE_CONTAINER=vetor-spec-postgis` e `--workers=1` para serializar fixtures compartilhadas entre browsers. Seleção autorizada final: **42/42** em Chromium/Firefox com o ciclo de expiração/renovação. A família `VETOR_PERSISTED_E2E` (`persisted-query`, `history-pagination`, `report-*`, `occurrence-heatmap-http`) está **fora da seleção** e depende de contêineres sintéticos históricos ausentes (`vu-ticket30-db`); não a execute como regressão desta árvore.

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

O baseline do fechamento de 19/10/2026 foi **836,58 kB** iniciais, acima do alerta então vigente de 500 kB; os números são históricos. Na rodada do ticket 35, o responsável aprovou explicitamente **850 kB** para `initial.maximumWarning`, preservando o limite de erro de 1 MB e os orçamentos de estilos. Isso reconhece o tamanho atual, não reduz download/parse. A medição final desta rodada ficará no [checkpoint do 35](../history/ticket-35-progress-2026-10-19.md); `pako` CommonJS permanece no chunk PDF lazy. Nenhuma alteração de dependência/carregamento foi autorizada ou realizada. QA em aparelho físico e leitor de tela permanece pendente.

Na rodada do ticket 20 (coleta autorizada), a seção administrativa «Coleta» levou o `initial` de 841,23 kB para **864,12 kB** e o responsável aprovou explicitamente **900 kB** (margem de 35,88 kB), mantidos o erro de 1 MB e os orçamentos de estilos. O `@defer` foi tentado e **piorou** o inicial para 873,38 kB, sendo revertido — ou seja, adiar a área administrativa por `@defer` sobre import estático não funciona: exige `import()` dinâmico, que é uma fatia própria, com medição comparativa, registrada como próxima ação e ainda **não** executada. `pako`/`fontkit` seguem no chunk lazy do PDF, sem alteração de dependência.

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
