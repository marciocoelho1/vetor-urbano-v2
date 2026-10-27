# Lotes de UX/UI — critério, estado e evidência

Registro de execução da rodada UX-0…UX-7. Decisões: [ADR 0003](../adr/0003-ux-lotes-e-tokens.md) (tokens) e [ADR 0002](../adr/0002-publicacao-territorial-e-reveal.md) (catálogo e reveal). Baseline medida em 25/10/2026, `HEAD b8c6027`.

## 1. Tokens

Fonte única: `apps/web/src/styles/tokens.scss`, importado uma vez em `src/styles.scss`, depois de `theme.scss`. Cor fica em `theme.scss`.

| Número | Token |
|---|---|
| 12 px | `--vu-text-xs` |
| 13 px | `--vu-text-sm` |
| 14 px | `--vu-text-base` |
| 16 px | `--vu-text-md` |
| 20 px | `--vu-text-lg` |
| 22 → 24 px | `--vu-text-xl` — `clamp(1.375rem, 2.2vw, 1.5rem)` |
| 28 → 32 px | `--vu-text-2xl` — `clamp(1.75rem, 2.6vw, 2rem)` |
| 36 → 44 px | `--vu-text-3xl` — `clamp(2.25rem, 3.4vw, 2.75rem)` |
| 400 | `--vu-weight-regular` |
| 500 | `--vu-weight-medium` |
| 700 | `--vu-weight-strong` |
| 4 px | `--vu-space-1` |
| 8 px | `--vu-space-2` |
| 12 px | `--vu-space-3` = `--vu-sheet-gap` |
| 16 px | `--vu-space-4` |
| 20 px | `--vu-space-5` |
| 24 px | `--vu-space-6` |
| 32 px | `--vu-space-8` |
| 120 ms | `--vu-motion-fast` |
| 240 ms | `--vu-motion-base` |
| 400 ms | `--vu-motion-slow` |
| `cubic-bezier(0.2, 0.8, 0.2, 1)` | `--vu-ease-out` |
| `cubic-bezier(0.4, 0, 0.2, 1)` | `--vu-ease-inout` |
| 44 px | `--vu-target` |
| 48 px | `--vu-target-comfortable` |

7 degraus de espaço (não existe `--vu-space-7`). `prefers-reduced-motion: reduce` zera as três durações.

## 2. Lotes

| Lote | Dono | Entrega | Depende de | Status |
|---|---|---|---|---|
| **C0** | @infra | C0-1 catálogo (API), C0-2 seletor (web), C0-3 docs, C0-4 harness E2E | — | **C0-1** `c0b70ac`, **C0-2** `b8c6027`, **C0-4** `5346f70` (16 caminhos; harness em `vu-uxh01-five-db`, allowlist por família); **C0-3** fechado no commit de doc de 26/10 (texto de produto em `scope.md` e `overview.md` + evidência do lote) |
| **UX-0** | @executor | `styles/tokens.scss` + import único | C0 | **aplicado** em `51fe617` |
| **UX-1** | @executor | escala aplicada + `strong` por regra | UX-0 | **aplicado** em `51fe617` — gate `EXIT=0`: 24 arquivos / 258 declarações / 0 fora / 3 pesos / 0 fantasma / 0 palavra em `aria-hidden`; **não medido**: prosa ≤72 ch/linha |
| **UX-1b** | @executor | par `--color-on-accent`, `#ef4444` → `--color-error`, âmbar do glifo em token, `--surface`/`--text` pareados | UX-1 | **aplicado** em `00bca0f` |
| **UX-1c** | @executor | fantasma IACVT → token declarado; auditor + `--selftest` no `verify.sh` | UX-1b | **aplicado** em `f03974a` (9 caminhos, com a spec de contraste) |
| **UX-1d** | @executor | `--color-on-error` em par; badge de coincidentes consumindo o token | UX-1c | **aplicado** em `6c4ca14` (3 caminhos) |
| **UX-2** | @executor | ritmo e container dos painéis | UX-0 | **aplicado** em `284bbf1` — paddings [12,16], gap 12, medido com sessão na pilha sintética |
| **UX-3** | @executor | alvos 44/48, feedback 120 ms | UX-0, régua do @qa | **alvos aplicados** em `84a308e`; feedback de 120 ms segue no UX-4 |
| **UX-5** | @executor | corte de copy: prosa da tela de entrada → 1 bloco ≤60 ch | — | **aplicado** em `dd4bad8` — prosa 1 bloco (51 ch), obrigação intocada, `<details>` de escopo 0 |
| **UX-4** | @executor | 3 durações + par `reduce` | UX-0, UX-3 | **aplicado** em `c07d781` — durações e easings por token, par `reduce` preservado |
| **UX-6** | @executor | shell móvel: topbar ≤64, barra ≤72, FAB 48 | UX-3, UX-4 | **aplicado** em `e1954d7` — topbar 54 px, barra 61, folha e FAB no lugar |
| **UX-7** | @executor | `data-state` + CLS <0,1 | UX-1…UX-6 | **aplicado** em `c2f9a0c` — 6 estados cobertos (5 no DOM + `initial` no teste unitário); CLS `0,0000` (320) / `0,0566` (1440) / **`0,1394` (390) → dívida do UX-7b** |
| **UX-8** | @executor | contraste do `reliability-panel` — **2,11 / 2,80 / 2,54** no escuro (medido pelo @ux) | UX-1 | pendente, sem lote atribuído |
| **UX-9** | @arquiteto → @user | contorno de controle a 3:1 no tema claro | decisão do dono | **aplicado** em `cedcfa9` (contorno `3,17/3,36` no claro, âmbar `5,41`), `5d054dd` (guarda do par base) e `9d710eb` (escuro `4,30`, chip `6,81 > 4,30`) |

Um lote = um commit (código + linha deste documento). `add -A` proibido. Exceção registrada em 25/10: o UX-1c fechou o código em `f03974a` e esta linha entrou em commit `docs:` próprio, por ordem do dono — a regra segue valendo para os lotes seguintes até ruling em contrário.

## 3. Critério por lote

| Lote | Alvo (número) | Asserção | Baseline 25/10/2026 |
|---|---|---|---|
| **UX-0** | ≤8 degraus de texto, 3 pesos, 7 de espaço, 3 durações, 2 easings, `--vu-target: 44px`, `--vu-sheet-gap: 12px` | grep dos tokens + `ng build` exit 0 | `theme.scss` só cor; `tokens.scss` inexistente |
| **UX-1** | 0 declarações fora da escala; ≤8 tamanhos computados; ≤3 pesos; h1 ≥28 px a 390; prosa ≤72 ch/linha | estático nos 23 `.scss` **e** CSS computado nos 4 viewports | **68 fora (régua v1, extremo de token aceito) / 265 literais (régua v2, literal nunca) — alvo 0 em ambas**; DOM 5 tamanhos; **7 pesos** (DOM; a régua estática contava 6 com peso por literal — depois do UX-1 são 3 nos dois instrumentos) |
| **UX-2** | ≤6 paddings distintos, todos 12–32 px; `gap` ∈ {8,12,16} | CSS **computado** de painel e cartão, 390/768/1440, com sessão sobre a pilha sintética — os painéis **são** alcançáveis, não é classificação estática | baseline "não medido (painéis atrás do gate)" **deixou de valer** em 26/10: vermelho medido com `.vu-sheet-panel` a 8 px e gap 14 em três containers |
| **UX-3** | 0 alvos efetivos <44×44; separação ≥8 px | `getBoundingClientRect` de `a,button,input,select,textarea,summary,[role]` visíveis, 390 **e** 320 | **14 de 20** <44 (8 <32) a 390/320; **9 de 20** a 1440 |
| **UX-5** | prosa ≤20 blocos, **máximo ≤60 ch por bloco** (a média é registro impresso, não asserção); 0 frase repetida; 0 instrução padrão; **`<details>` de escopo ≤1** — hoje **0**, e criar um para bater contagem está proibido | contagem no DOM por texto próprio, com obrigação separada da prosa | em ata 25/10: **54 linhas**, média **92 ch**, maior **421**; medido na árvore em 26/10: **7 blocos / 605 ch / média 86 / maior 121**. Os dois lados ficam: a baseline antiga não era reproduzível nesta árvore |
| **UX-4** | durações ⊆ {120,240,400}, exceto `0s`; ≤2 easings; abrir painel ≤240 ms até pintado; par `reduce` zera duração **e** transform | `transition-*`/`animation-*` incl. pseudo-elementos + `MutationObserver`→`rAF` | **[150,180,260,420,480]** (+640 ms em `theme-motion.scss:92`); par `reduce` já zera; painel **37/59 ms** |
| **UX-6** | topbar ≤64; barra ≤72 com safe area; conteúdo ≥80% do viewport; 0 paradas de foco cortadas; folga = altura medida da barra + 12 | rect a 390/320/768 + hit-test do disclosure + `pxVisiveis == largura` | topbar **157**; faixa **80,0%** (390) / **76,5%** (320); **2 paradas cortadas** a 390 e 2 a 320 |
| **UX-7** | 6 estados por tela alterada com `data-state`; CLS <0,1 com altura reservada | `PerformanceObserver` de `layout-shift` | CLS **0** (390/320), **0,004** (1440) |

**Regra de evidência — anti-vacuidade (25/10/2026, permanente).** Toda asserção que existe para provar ausência — de achado, de regressão, de defeito — registra na célula de evidência do §4 **dois** números: o valor medido e a **mutação** que a faz falhar. Sem o segundo, `N passed` não distingue asserção de tautologia. Duas portas de fuga apareceram nesta rodada com o mesmo sintoma, verde: o gate de ≤3 pesos imprimindo `pesos: []` quando o peso vinha de `var(--vu-weight-*)`, e a guarda do badge de coincidentes injetando o próprio objeto de medida. As duas foram fechadas com contraprova — `peso_por_token` reprovando 4 degraus distintos, e `getByTestId('coincident-badge')` falhando (1 failed, "element(s) not found") quando o badge real é apagado em cena.

### UX-4 — leitura do par `reduce`

Sob `prefers-reduced-motion: reduce`, **nenhum movimento em curso**: `transitionDuration === 0s`, `animationDuration ≤ 1ms`, `animationIterationCount !== 'infinite'` e `document.getAnimations()` sem animação em `running`. O critério original dizia "zera duração **e** transform"; literal, reprovaria código correto no primeiro elemento posicionado — `.map-canvas`, pinos do Leaflet e o `translate` dos painéis usam `transform` para posicionar, não para mover, e `transform: none` aparece **0 vezes** na árvore. A leitura é do @arquiteto, registrada em 26/10.

**Dívida datada 26/10:** "abrir painel ≤240 ms até pintado" segue **sem asserção** — a baseline é `37/59 ms` e já passa, e instrumentar pintura com `PerformanceObserver`/`rAF` num alvo que não está em disputa gastaria rodada sem provar nada. Número e data ficam aqui; a medição entra quando o painel for tocado.

### UX-6 — escopo autorizado

| Item | Critério |
|---|---|
| topbar só marca | ≤64 px a 390/320/768 |
| barra inferior, 5 destinos | ≤72 px incluindo `env(safe-area-inset-bottom)` |
| «Registrar ocorrência» | FAB 48×48; é o **único** com esse nome no móvel, asserido por igualdade (`ícone puro: nome por igualdade`) |
| conteúdo | ≥80% do viewport: 712 px a 390, 588 px a 320 |
| folha do D6 | `bottom = barra.getBoundingClientRect().height + --vu-sheet-gap`, nunca `56 + 12` |
| `z` | barra ≤940; folha 950 (colapsada) / 1200 (expandida) |
| `z` literal | 940/950/1200 são **constantes de contrato**, não escala: ficam literais e a régua assere o valor computado nos dois estados da folha |
| hit-test | **dois estados**: recolhida, o centro da barra acerta um item da barra e **não** a folha; expandida, acerta a folha (ou conteúdo dela) e **não** um item |
| hooks | `data-vu="bottom-bar" \| "sheet" \| "sheet-disclosure"`, `data-vu-sheet-state` ∈ {`collapsed`,`expanded`}; ausente = falha, não pulo |
| teclado | ordem do DOM, *skip link* primeiro; **nome acessível contém o texto visível**, após normalizar decoração (`×`, `⌄`, contadores) e NFD — igualdade literal não é requisito, nome que não contém o visível é falha (2.5.3). A contagem é **impressa, não asserida** (hoje 44; forçar 20 exigiria apagar conteúdo focável) |

**Dívida datada 26/10 (medida pelo @qa):** a caixa do contêiner da folha **expandida** mede `844→862` — 18 px, inteira fora do viewport — porque a cobertura da barra acontece pelos filhos, não pelo retângulo do contêiner. O hit-test prova a cobertura (`z` 1200 sobre 940, com mutação `z=800` que volta a acertar item), e **nenhum assert depende da caixa** hoje. Quando o UX-2 mexer em painéis, uma asserção de caixa na folha expandida vai encontrar essa discrepância.


**Dívida datada 26/10 (ambiente):** o helper `syntheticAdmin` espera o botão «Minha conta» visível ao fim do MFA; desde o UX-6 a topbar móvel esconde `.topbar-actions`, então **login a 390 falha**. A régua do UX-2 autentica a 1440 e só depois redimensiona. Qualquer spec futuro que faça login já no viewport móvel quebra pelo mesmo motivo — não é do banco.

### UX-7 — o que a régua não vê

**Dívida datada 26/10 (medida pelo @qa):** a 390 px o `section.results-panel` fica **`display: none`** no modo **Mapa** — o `data-state` existe no DOM, mas só é percebível depois de o usuário trocar para **Lista** (na Lista o mesmo painel mede `h=389`, com o banner de erro em `h=231`). A régua passou a entrar por Lista no móvel; a consequência que fica registrada é que "6 estados" **não é observável no modo padrão do celular**.

**Falso alarme — registro do erro, para não se repetir (26/10):** `npm run test:ci` falhou em `app.spec.ts:274` (`expected '2026-10-15T13:00:00Z' to be '2026-10-15T15:00:00Z'`, `1 failed / 224 passed`) enquanto o gate `@if (sessionResolved() && …)` do ruling 1 estava no working tree. Foi registrado aqui primeiro como "dívida datada (pré-existente)" e depois como "defeito de produto — exportação em voo reaplica snapshot anterior". **Nenhuma das duas leituras se sustenta**, e a prova é reprodutível: com `git stash -- apps/web/src`, `HEAD` limpo dá **`225 passed (225)`**; com só o `@if` do ruling 1 de volta, o teste reprova de novo. A causa é o ruling 1, não o produto — renderizar o ramo principal antes de a sessão resolver **antecipa o primeiro `fetch`**, e o teste fixa a ordem de três respostas mockadas; antecipar consome a resposta errada e o snapshot fica em 13:00. O gate foi revertido (`sessionResolved` não existe mais em `src`) e a suíte está em **`225 passed (225)`, `EXIT=0`** — medido por mim em 26/10, na árvore com o UX-7 parcial. **Lição de método:** ausência de `export|report|snapshot` no diff do lote não provava independência — o efeito era indireto, pela ordem de boot; quem afirma "pré-existente" precisa de `git stash` + suíte limpa, não de inferência por arquivo.

**Critério do sexto estado (ruling 26/10):** `initial` **não é pintado no DOM** — a região só ganha o atributo quando renderiza, e quando renderiza já houve consulta. Duas sondas provam: no demo a sequência começa em `ready@738ms` sem `initial`; em `?consulta=api` (família sintética, sessão real) é `loading@714ms → empty@733ms`. Não se rotula resultado visível como "inicial" nem se aceita 5/6 solto: **5 estados no DOM** (`ready`, `loading`, `empty`, `error`, `refreshing`) pela régua do @qa, e **`initial` no `app.spec.ts`** com duas asserções — zero resultados com `consultaConcluida` falso devolve `initial`, e com `consultaConcluida` verdadeiro devolve `empty` (esta é a que impede o defeito do vazio voltar). Seis cobertos, cada um pelo instrumento que o vê.

## 4. Evidência

| Lote | Comando | Saída |
|---|---|---|
| C0-1 | `podman exec vetor-spec-postgis psql -U vetor_spec_test -d vetor_spec_test -tAc "select count(*) from flyway_schema_history where success"` | `23` (reexecutado pelo @revisor em 25/10) |
| C0-1 | idem, `catalog_territories` / `catalog_territory_versions` | `22` / `22` (reexecutado pelo @revisor) |
| C0-2 | `npx prettier --check "src/**/*.{ts,html,scss}" "e2e/**/*.ts"` | exit 0 |
| C0-2 | `npm run test:ci` | 30 arquivos, 225 testes, exit 0 |
| C0-2 | `npm run build` | exit 0 (avisos CommonJS de `pako` e `leaflet` pré-existentes) |
| C0-2 | `npx playwright test e2e/territory-selector-visibility.spec.ts --project=chromium` | 5 passed, exit 0 (320/390/768/1024/1440) |
| C0-1+C0-2 | `bash scripts/verify.sh web` | exit 0 — lint, test:ci e build (reexecutado pelo @revisor em 25/10, `HEAD b8c6027`) |
| C0-3 | `git show --stat c0b70ac b8c6027 5346f70` | `c0b70ac` **10 arquivos** (módulo de catálogo + V23 + ingestor), `b8c6027` **12 arquivos** (seletor; 5 passed em `territory-selector-visibility.spec.ts`), `5346f70` **16 arquivos** (harness) |
| C0-3 | `ls apps/api/src/main/resources/db/migration/ \| wc -l` | `23`, com `V23__territorial_catalog.sql` na ponta; `scope.md` e `overview.md:43` deixam de dizer "V1 a V22" e passam a declarar o catálogo como módulo próprio, com cobertura **municipal e parcial** |
| UX-1 | `python3 apps/web/e2e/tools/audit-font-scale.py --src apps/web/src` | baseline em `904f0a7`, antes do UX-0: `23 arquivos / 265 declarações`, `68 fora`, `6 pesos`, `8 fantasma(s)`, `1 palavra em aria-hidden`, `EXIT=2` |
| UX-1 | idem, com o censo de usos corrigido (elo 1 do @qa, ainda em `904f0a7`) | `8` com censo de usos só em `.scss` → **`10`** com censo único `.scss`+`.html`+`.ts`: `--text` de `verification-panel.ts:46` entrava como fantasma por assimetria do censo, não por defeito do código (reexecutado pelo @revisor, 25/10 20:41) |
| UX-1 | `python3 apps/web/e2e/tools/audit-font-scale.py --src apps/web/src` em `f03974a` | `24 arquivos / 258 declarações`, `0 fora`, `pesos ['400','500','700'] (3)`, `43 usados / 62 declarados / 0 fantasma`, `aria-hidden 0 palavra`, `EXIT=0` (reexecutado pelo @revisor, 25/10 21:25) |
| UX-1 | `python3 apps/web/e2e/tools/audit-font-scale.py --selftest` | `8/8 casos`, `EXIT=0` — o caso `peso_por_token` existe porque o gate de ≤3 pesos passava por vacuidade quando o peso vinha de `var(--vu-weight-*)`: `pesos: []` é sempre ≤ 3. **Mutação:** laço de usos revertido ao censo só `.scss` → `6/7 casos`, `EXIT=3` (reproduzido pelo @revisor em cópia fora da árvore) |
| UX-1b / UX-1c | `npx playwright test e2e/contrast-tokens.spec.ts --project=chromium` no `:4201` (sem API e sem banco) | `6 passed (7,4 s)`, `EXIT=0` (reexecutado pelo @revisor, 25/10 21:26): badge/botão 5,50 / 11,02; nota, ícone e contorno de erro 6,11 / 8,49; agrupamento 5,50 / 11,02; IACVT do `fieldset.history-categories` em `solid 1px` nos dois temas; dívida do `.area-result-mark` em `test.fail` a 3,75:1 |
| UX-1d | `npx playwright test e2e/contrast-tokens.spec.ts --project=chromium` em `56fdf8e` | `8 passed (9,5 s)`, `EXIT=0` (reexecutado pelo @revisor, 25/10 21:44): badge de coincidentes `6,11` no claro e `9,22` no escuro, medido no elemento **real** (`getByTestId('coincident-badge')`, sem injeção), com tinta diferente entre os temas; hover do dispensar com `borderTopColor === color` nos dois temas. **Mutação:** badge real apagado em cena → `1 failed`, `expect(locator).toBeVisible() failed — element(s) not found` (reproduzido pelo @revisor) |
| UX-9 | `par base do contorno` | `10 passed (21,3 s)` (25/10, @arquiteto) — contorno `#838d9a` **3,36** sobre branco e **3,17** sobre `--color-bg-base`; chip selecionado **6,13** no próprio fundo e **6,71** no branco contra repouso **3,36**; escuro imprime `1,62`/`1,38` e chip `3,12`, sem asserção |
| UX-9 (fecho) | `contorno no escuro` | `#738399` sobre `--color-bg-surface` = **4,30** e sobre `--color-bg-base` = **4,75** — conta WCAG sobre os tokens, autorizada pelo dono em 25/10 |
| UX-9 (fecho) | `direção no escuro` | repouso `#738399` **4,30** na superfície / **3,66** na elevada; selecionado `#8aae9d` **6,81** / **5,80** / **5,18** no próprio preenchimento. Direção restaurada com margem, delta **1,46** contra o anel de foco (`#8fd7b6`), que fica em `outline-offset: 2px` (25/10, autorizado o valor do contorno pelo dono; o do selecionado é consequência do critério) |
| UX-7 | `npx playwright test e2e/layout-stability.spec.ts` em `c2f9a0c` | `data-state` na `section#map-results`: **5 estados no DOM** — `ready → loading → error → ready → empty@4408ms → ready → refreshing`, com o vazio visível e 0 itens. `initial` **não é pintado** (duas sondas: demo começa em `ready@738ms`; `?consulta=api` faz `loading@714ms → empty@733ms`) e é asserido no `app.spec.ts` — 0 resultados com `consultaConcluida` falso → `initial`; com ele verdadeiro → `empty`. **CLS**: 320 `0,0000` e 1440 `0,0566` ✓; 390 **`0,1394`** ✗ → dívida do **UX-7b** (origem: `footer` `688/156 → 0/0` em `t=482 ms`). **Mutação:** bloco de 240 px → `0,0566 → 0,1998` |
| UX-7 | `npm run test:ci` + `bash scripts/verify.sh web` em `c2f9a0c` | `226 passed (226)` e `OK: auditor estático, lint, test:ci e build`; auditor `0 fora / 3 pesos / 0 fantasma` + `--selftest 8/8` (medido pelo @executor) |
| UX-1 | `grep -rl "font-size" apps/web/src --include=*.scss \| wc -l` | `14` (reexecutado pelo @revisor) |
| UX-1 | `grep -o "<strong" apps/web/src/app/app.html \| wc -l` | `37` (reexecutado pelo @revisor) |
| UX-1 | `grep -rn "font-weight:\s*900" apps/web/src --include=*.scss \| wc -l` | `0` (reexecutado pelo @revisor) |
| UX-3 | `npx playwright test e2e/targets-touch.spec.ts --project=chromium` em `84a308e` | `4 passed (1,8 s)`: **0 alvos < 44 px** a 320, 390 e 1440, **separação mínima ≥ 8 px**, rolagem horizontal ok nos três viewports; baseline em ata era **14 de 20** abaixo de 44 a 390/320 e **9 de 20** a 1440, com separação de **4 px**. Controle negativo: sonda de 24 px listada, par a 2 px listado, caixa de 2000 px marcada como estouro |
| UX-4 | `npx playwright test e2e/motion-durations.spec.ts --project=chromium` em `c07d781` | `4 passed (1,8 s)`: **15 declarações, 0 fora** de `{120,240,400}`, **2 easings**; computado `120ms×3 / 240ms×2 / 400ms×3`, o resto `0ms`; sob `reduce` `0ms×144`, zero transições, zero animações, zero iterações infinitas — o `0.01ms` da casa passa porque a régua lê `animationDuration ≤ 1ms`. Substitui a linha `VU_UX_GATES=1 …`, comando que **nunca existiu no repositório** e por isso não era evidência |
| UX-5 | `npx playwright test e2e/copy-support.spec.ts --project=chromium` em `dd4bad8` | `2 passed (7,1 s)`: **prosa 1 bloco, maior 51 ch** («Explore ocorrências por território, período e tipo.»), **obrigação 6 blocos, maior 121 ch** (`p.query-note`, intocada), **`<details>` 2 no total e 0 de escopo**; controle negativo: parágrafo de 300 ch injetado vira o maior e reprova. A separação de `app.html:1537` tirou a explicação de interface e deixou a limitação («o mapa mostra localizações com precisão compatível») em nota própria, visível |
| UX-6 | `npx playwright test e2e/mobile-shell.spec.ts --project=chromium` em `e1954d7` | `14 passed (6,2 s)`: topbar **54 px** a 390/320/768; conteúdo **92,7% / 91,4% / 93,9%**; barra **61 px** (≤72 com safe area); folha `bottom` **73 px = 61 + 12**, medida em runtime por `--vu-bottom-bar-height`; `z` barra **940**, folha **950** recolhida / **1200** expandida (asserido); hit-test recolhida acerta item, expandida acerta a folha; FAB **48×48** único «Registrar ocorrência»; **44 paradas, 0 cortadas**; marca por contenção («Vetor Urbano Estudo 02 — mapa público»). Controles negativos: topbar a 50 px lida; `z 900`/`bottom 56` injetados lidos. Substitui a linha da `ux6-folha-barra.spec.ts`, que **pulava o app real** e por isso não era evidência |
| UX-2 | `VETOR_ACCOUNTS_E2E=1 VETOR_E2E_DATABASE_CONTAINER=vu-uxh01-five-db VETOR_E2E_DATABASE_NAME=vetor_final_operations_panel npx playwright test e2e/panel-rhythm.spec.ts --project=chromium` em `284bbf1` | `4 passed (6,5 s)`: 390/768 → **paddings distintos [12,16], gaps [12]**; 1440 → **[16] / [12]**; 10 painéis/cartões medidos (7 a 1440). Controle negativo: `padding: 7px` injetado → distintos `[7,12]` e reprovação da faixa. Antes do passe: `.vu-sheet-panel` a **8 px** (piso 12) e gap **14** em `.operations-panel`, `.source-management-form` e `.collection-panel` |


### 4.1 Contraste — pares medidos

WCAG 2.x por luminância, recalculado dos hexos de `theme.scss` pelo @revisor e conferido contra a leitura do DOM na spec de contraste. "Antes" é o que o repositório renderizava em `b8c6027`; "depois" é o par de token declarado.

| Par | Antes | Depois |
|---|---|---|
| texto branco sobre acento (badge do aviso, botão de atualizar, agrupamento) | `1,67:1` no escuro — `#ffffff` sobre `--accent` escuro `#8fd7b6` | **`11,02:1`** no escuro (`--color-on-accent` `#071711`) e **`5,50:1`** no claro |
| erro (`#ef4444` → `--color-error`) | `3,76:1` claro / `4,41:1` escuro | **`6,11:1`** claro / **`8,49:1`** escuro |
| tinta sobre erro (badge de ocorrências coincidentes) | `6,11:1` no claro / **`1,96:1`** no escuro — `#fff` fixo sobre `--color-error` | **`6,11:1`** / **`9,22:1`** com `--color-on-error` (`#ffffff` no claro, `#2a0d12` no escuro) |
| âmbar do glifo (`#f0a72b` → `--color-warning-dot`) | `2,05:1` claro / `8,11:1` escuro | **`4,08:1`** claro / **`7,38:1`** escuro — único número que piora, e passa o 3:1 de objeto gráfico |
| cartão do `.notice` (`--surface`/`--text` → par declarado) | **`15,92:1`** — fallback `#18232e` sobre `#fff`: cartão branco fixo no tema escuro | **`14,07:1`** no claro (`--color-text-main` sobre `--color-bg-surface`) / **`13,97:1`** no escuro. Não reprovava AA; quebrava o tema |
| contorno de controle (UX-9, em espera) | — | `--color-border-subtle` **`1,24:1`** sobre `--color-bg-base` e `1,31:1` sobre branco; `--color-line-strong` `2,84` / `2,67`; fallback `#8893a0` `3,12` / `2,94` |
| dívida registrada: `.area-result-mark` | — | **`3,75:1`** medido no DOM (`rgb(150,122,61)` sobre `rgb(253,244,230)`, isto é 12% do literal `#f0a72b` sobre o branco da linha); `3,54:1` se o fundo nomeado for `--color-bg-base`. Vive em `test.fail`: reprova 4,5 |

Dois números da mesma família, fundos diferentes, e é preciso nomear o fundo: `15,92` é o par de **fallback** (o defeito), `14,07`/`13,97` é o par **declarado** (o resultado); `3,75` é o composto do DOM, `3,54` é o mesmo par sobre a base. Razão sem fundo nomeado não é auditável.

Alcance declarado: tudo acima mede a **tela de entrada**. O mapa e os painéis ficam atrás do gate em `app.html:144` (D7, issue #2) e seguem inalcançáveis; UX-1 tem, por isso, asserção estática nos 23 `.scss`, e não só computada. `scripts/verify.sh web` cobre o gate **estático** (auditor, lint, unidade, build), não navegador: não é citado como evidência de UI.

Não verificado: Firefox, leitor de tela físico, painéis atrás do gate.

## 5. Fora de escopo

| Item | Por quê |
|---|---|
| Paleta e `theme.scss` | cor não é lote nesta rodada |
| Família tipográfica nova | licença e custo são decisão do @user |
| Dependência npm nova | as galerias (`navbar.gallery`, `cta.gallery`, `60fps.design`) são referência na doc, não pacote |
| `gsap` além de 3.15.0 | já instalado; teto |
| Redesenho do mapa | não é polimento de shell |
| Backend, migração, coleta | fora do escopo de UX |
| Bairros, RA e AP | dependem de fonte autorizada ([prioridade territorial](territorial-mapping-priority.md)) |
| `push` | só com pedido do @user |
