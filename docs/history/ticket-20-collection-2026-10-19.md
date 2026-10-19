# Checkpoint da rodada do ticket 20 — coleta autorizada Fogo Cruzado v2 — 19/10/2026

Rodada de implementação local do ticket 20 (e preparação de 21/22), com a fonte real autorizada pelo
responsável. Decisões e contrato da fonte estão em
[`ticket-20-decisions-2026-10-19.md`](ticket-20-decisions-2026-10-19.md) e o contrato técnico da fatia em
[`../architecture/collection-local-v1.md`](../architecture/collection-local-v1.md).

## Decisões recebidas do responsável nesta rodada

| Assunto | Decisão | Registro |
|---|---|---|
| Orçamento do bundle | Elevar `initial.maximumWarning` de 850 kB para **900 kB**, e tratar o lazy loading da área administrativa como fatia medida da próxima rodada | `docs/operations/web.md` |
| Fonte, recorte geográfico e temporal | API Fogo Cruzado v2; RM-RJ + cidade do Rio; desde 01/06/2026 (limite único) | `ticket-20-decisions-2026-10-19.md` |
| 21 e 22 | Seguem o mesmo recorte e a mesma fonte do 20 | idem |
| 23 e 24 | Bloqueados: a regra de confiabilidade ainda será definida | idem |
| Termo de consentimento da fonte | Texto integral fornecido pelo responsável; contrapartida = citar a fonte | idem |
| Credencial | Arquivo privado `~/.config/vetor-urbano/fogo-cruzado.env` (0600), fora do repositório | verificado, valores nunca lidos em claro pelo agente |

## O que foi implementado

**Servidor (`apps/api`, migração nova, sem tocar V1–V14 — conferido byte a byte contra `2f58fcb`, 14/14 idênticos):**
`V15__authorized_collection.sql` com `collection_sources`, `collection_runs` (cursor `next_page`, contadores,
estado, classe de erro, `municipalities_missing`), `collection_run_events` (append-only) e `collection_items`
(PK `(source_id, source_reference)`) mais `sources.provenance` JSONB com a ficha de procedência; cliente HTTP
da fonte (login/renovação, paginação, cabeçalhos de atualização, classes de erro incluindo o bloqueio por
assinatura), mapeador com minimização por allowlist, serviço com máquina de estados (`NOT_CONFIGURED`,
`RUNNING`, `PAUSED`, `SUCCEEDED_NO_CHANGES`, `SUCCEEDED_NEW_ITEMS`, `PARTIAL`, `FAILED` + classes), agendador e
quatro endpoints administrativos (ADMIN + MFA no servidor, CSRF nas escritas). Nenhum `pom.xml` alterado.

**Cliente web (`apps/web`):** seção administrativa «Coleta» na área `sources` de `?consulta=api`, transporte
`collection-api.ts`, crédito «Fonte: Instituto Fogo Cruzado» no painel e no item originado da coleta na fila de
revisão, além do ajuste no rascunho de publicação (o `spread` do `extracted` enviava `sourceCredit`, `victims` e
`documentNumber`; o servidor recusa campo factual não declarado — confirmado em `PublicationDraft.parse`, que
lança «Campo factual não declarado»).

## Correção encontrada na revisão independente (e corrigida)

O cliente enviava `typeOccurrence=withVictim` fixo, o que **estreitava o recorte aprovado** sem decisão:
medido na própria fonte, a janela RM-RJ de 01/06/2026 a 19/10/2026 tem **807** ocorrências no recorte do
responsável e apenas **379** com `withVictim` — 428 seriam descartadas em silêncio. O parâmetro foi removido
e o recorte passou a incluir disparos sem vítima (ocorrência do produto, tipo `DISPAROS` com zero mortos).

- **RED real:** com o filtro ainda no cliente, `FogoCruzadoClientTest.paginatesWithOrderAscRepeatedCitiesAndDateWindow`
  falhou — `expected: <false> but was: <true>` para `query.contains("typeOccurrence")`.
- **GREEN:** `FogoCruzadoClientTest` 11/11 e `CollectionMapperTest` 9/9 (com caso novo de disparo sem vítima),
  `Tests run: 20, Failures: 0`.
- **Efeito medido:** a execução real coletou **807**, exatamente o total do recorte sem filtro.

## Execução real delimitada (autorizada pelo responsável)

Contra o banco dedicado `vu-fogo-cruzado-db` (127.0.0.1:55438, base `vetor_urbano`), com a conta Fogo Cruzado do
responsável, cadência de 60 s, janela desde 2026-06-01, `take=100`, teto de 20 páginas. Flyway aplicou as 15
migrações no banco dedicado.

| Execução | Estado | Vistas | Criadas | Duplicadas | Páginas | Janela |
|---|---|---|---|---|---|---|
| 1 | `SUCCEEDED_NEW_ITEMS` | 807 | 807 | 0 | 9 | 2026-06-01 → 2026-10-19 |
| 2 | `SUCCEEDED_NO_CHANGES` | 807 | 0 | 807 | 9 | 2026-06-01 → 2026-10-19 |

Persistência conferida por SQL no banco dedicado: **807 clippings** da coleta (todos com `collected_at`),
**807 entradas** em `collection_items`, **807 revisões em `PENDING`** (20 delas `HIGH`, por chacina), **0 revisões
fora de `PENDING`**, **0 revisões com `occurrence_id`** e **0 publicações** produzidas pela coleta — os 5
registros de ocorrência e os 3 clippings fora da coleta são semente de demonstração de 14/10/2026
(`vu-demo-source-001/002`), anteriores à execução.

Eventos reais registrados (amostra): `RUN_STARTED {kind: RECENT, take: 100, maxPages: 20}`,
`MUNICIPALITIES_MISSING {missing: ["Petrópolis"]}`, `STATE_RESOLVED {cityIds: 21, stateId: …}`,
`PAGE_DONE` por página e `RUN_SUCCEEDED_NO_CHANGES`.

Minimização conferida no próprio dado persistido: a extração guarda tipo, categoria, município, bairro,
localidade, coordenadas `[longitude, latitude]`, precisão, instante UTC, `documentNumber`, `relatedRecord`,
`policeAction`, `agentPresence`, `massacre`, motivo principal e complementares, contagens por vítima
(`total`/`dead`/`injured`/`agents`/`civilians`/`other`), número de vítimas animais, transportes e os campos de
procedência. **Nenhum atributo pessoal por vítima** (idade, gênero, raça, corporação, unidade, partido, situação
de serviço) e nenhum endereço ou identificação de pessoa.

Vazamento de segredo verificado empiricamente: em 121 linhas de log da API subida para conferência,
**0 ocorrências** da senha, **0 do e-mail da conta** e **0 de token/JWT**.

## Verificações desta rodada (executadas pelo coordenador)

| Verificação | Resultado real |
|---|---|
| `bash scripts/verify.sh web` | lint OK, **160 testes / 22 arquivos** verdes, build OK |
| Bundle inicial | 841,23 kB → **864,12 kB** (main 789,78 kB); orçamento elevado a 900 kB por decisão |
| `bash scripts/verify-api-container.sh` (suíte completa na árvore final, PostgreSQL/PostGIS reais via Testcontainers) | **54 unitários + 112 integrações, 0 falhas/erros/pulos**; `BUILD SUCCESS` |
| Suíte dirigida da correção | `FogoCruzadoClientTest` + `CollectionMapperTest` = **20 testes, 0 falhas** |
| Unidade de coleta dentro da suíte completa | `CollectionHttpIT` 8/8, e 32 unitários de coleta (credenciais 3, mapeador 9, desfecho 5, cliente 11, municípios 4) |
| Migrações | V1–V14 idênticas ao baseline; V15 aplicada; 15/15 no banco dedicado |
| `git diff --check` / `--cached --check` | limpos |

## Defeito encontrado pelo Playwright e corrigido nesta rodada

O agente do Playwright **não** afrouxou asserção: reportou defeito real de acessibilidade na seção «Coleta».
Ao concluir pausa/retomada, a seção devolvia o foco ao controle que iniciou a ação — mas o próprio comando
troca o estado e desabilita esse controle, e o navegador **ignora `focus()` em elemento desabilitado**, de modo
que o foco caía no `<body>`. Evidência registrada pelo agente em Chromium e Firefox: após confirmar,
`document.activeElement` era `BODY`, o controle estava `disabled` e o log de `focus()` mostrava a intenção.

**Correção:** `apps/web/src/app/collection/collection-panel.ts` devolve o foco ao controle iniciador **quando ele
continua acionável** e, quando o comando o desabilita, ao **título estável da seção** (`#sectionHeading`,
`tabindex="-1"`, `data-testid="collection-heading"`), sempre com `preventScroll: true`. O foco nunca sai da tela.
Teste de unidade novo cobre o caminho do título; as asserções do spec passaram a exigir o título estável nesses
dois pontos, mantendo a exigência de retorno de foco e a de não rolar a página.

**Segundo ajuste, também do spec:** o histórico administrativo exibia o token cru `UPSTREAM_BLOCKED`; agora
`collection-api.ts` tem rótulo próprio («Assinatura do cliente bloqueada pela fonte») e o spec exige o rótulo e
**proíbe** o token cru na interface, mantendo o valor de banco.

**Terceiro ajuste, do próprio teste:** a asserção de rolagem media `window.scrollY` do início do caso, mas
`locator.focus()` do Playwright rola até o elemento por conta própria — a referência passou a ser medida depois
do último foco acionado pelo teste, e a página retomada tem sua resposta liberada no stub antes do desfecho.

## Jornadas Playwright desta fatia (Chromium e Firefox, `--workers=1`)

Spec próprio: `apps/web/e2e/collection-recent.spec.ts`, com o stub local da fonte em
`apps/web/e2e/helpers/fogo-cruzado-stub.ts` (porta fixa 8788, valores sintéticos, **nenhuma URL real da fonte**).
Dois arranques da API, porque «não configurada» e «configurada» são estados de servidor distintos:

| Arranque | Chromium | Firefox | Resultado |
|---|---|---|---|
| Configurado (stub + credencial sintética) | 10 ✓ · 1 skip | 10 ✓ · 1 skip | **20 passaram, 2 pulados, 0 falhas** |
| Desligado (`vetor.collection.enabled` ausente) | 1 ✓ · 10 skip | 1 ✓ · 10 skip | **2 passaram, 20 pulados, 0 falhas** |

Cobertura verificada: seção e crédito «Fonte: Instituto Fogo Cruzado»; «não configurada» textual ≠ falha ≠ vazio
≠ «concluída sem novidades»; falha `AUTH_FAILED`; bloqueio `error code: 1010` → classe própria com rótulo humano;
disparo manual só por ativação explícita; pausa/retomada em dois passos com foco de volta ao título estável e sem
rolagem; teclado alcançando a seção e acionando por Tab/Enter com foco visível; 390 px sem rolagem horizontal;
item coletado nasce `PENDING` na fila com crédito e referência da fonte; disparo sem vítima entra como
`DISPAROS` com zero mortos; nenhuma credencial ou token no DOM nem na resposta administrativa; nenhuma consulta
pede `typeOccurrence`.

## Limitações e pendências reais

- **Atribuição exigida pela fonte** aparece no painel de coleta e no item da fila; **exportações e relatórios
  (29/33/34) ainda não exibem o crédito** — pendência nomeada para as fatias desses artefatos.
- **Petrópolis** integra a RM-RJ pela redação consolidada e **não consta da fonte**: relatado em banco e na
  interface, nunca inventado.
- **Sem promessa de instantaneidade ou SLA**; a fonte é de terceiros e pode mudar de contrato. A ambiguidade
  entre a documentação (America/Sao_Paulo) e a resposta real (instante com `Z`) está registrada; valor sem fuso
  explícito é recusado como `INVALID_RESPONSE`.
- **21 e 22 ainda não implementados**: 21 (carga retroativa com retomada) e 22 (painel de operação) seguem a
  fatia; 23 e 24 continuam bloqueados pela definição da regra de confiabilidade.
- **Lazy loading da área administrativa** registrado como próxima ação medida, não executado: `@defer` sobre
  import estático piorou o inicial (873,38 kB) e foi revertido; o caminho é `import()` dinâmico.
- Aceite do ticket 20 é decisão do responsável; esta rodada entrega implementação e evidência, não aceite.
- **Comportamento declarado, não defeito:** o disparo manual exige ativação explícita do controle (nenhum comando é enviado em carga ou navegação) mas **não** abre diálogo de confirmação — só pausa e retomada têm confirmação em dois passos. O teste prova a ausência de envio acidental, um único POST por acionamento e a confirmação de pausa/retomada.
- **`errorDetail` de `AUTH_FAILED`** varia conforme exista token em cache («Renovação…» vs «Autenticação…»); por ser ordem-dependente, não é asserido.
- O estado **carregando** é observado atrasando a requisição real, e **RUNNING/PAUSED** são observáveis de forma determinística só com o stub segurando a resposta — dispositivos sintéticos, declarados.
- «Nada é publicado automaticamente» foi provado por banco (`clipping_reviews.state='PENDING'` e nenhuma ocorrência publicada da coleta) e pela fila, não por uma recusa humana de publicação.
- Playwright desta rodada: **somente** o spec do 20. A suíte completa de navegador não foi reexecutada; a família `VETOR_PERSISTED_E2E` continua fora por depender de contêiner sintético histórico.
- **Não reexecutados nesta rodada** (citados como checkpoint, sem prova própria): os números de fechamento do
  25 (21+20 / 21+101 / 127 / 42-42) e as demais suítes Playwright do 35.
