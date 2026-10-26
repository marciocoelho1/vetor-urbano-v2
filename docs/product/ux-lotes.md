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
| **C0** | @infra | C0-1 catálogo (API), C0-2 seletor (web), C0-3 docs, C0-4 harness E2E | — | **C0-1** `c0b70ac`, **C0-2** `b8c6027`, **C0-4** `5346f70` (16 caminhos; harness em `vu-uxh01-five-db`, allowlist por família); C0-3 pendente |
| **UX-0** | @executor | `styles/tokens.scss` + import único | C0 | **aplicado** em `51fe617` |
| **UX-1** | @executor | escala aplicada + `strong` por regra | UX-0 | **aplicado** em `51fe617` — gate `EXIT=0`: 24 arquivos / 258 declarações / 0 fora / 3 pesos / 0 fantasma / 0 palavra em `aria-hidden`; **não medido**: prosa ≤72 ch/linha |
| **UX-1b** | @executor | par `--color-on-accent`, `#ef4444` → `--color-error`, âmbar do glifo em token, `--surface`/`--text` pareados | UX-1 | **aplicado** em `00bca0f` |
| **UX-1c** | @executor | fantasma IACVT → token declarado; auditor + `--selftest` no `verify.sh` | UX-1b | **aplicado** em `f03974a` (9 caminhos, com a spec de contraste) |
| **UX-2** | @executor | ritmo e container dos painéis | UX-0 | pendente |
| **UX-3** | @executor | alvos 44/48, feedback 120 ms | UX-0, régua do @qa | pendente |
| **UX-5** | @executor | corte de copy 54 → ≤20 linhas | — | pendente |
| **UX-4** | @executor | 3 durações + par `reduce` | UX-0, UX-3 | pendente |
| **UX-6** | @executor | shell móvel: topbar ≤64, barra ≤72, FAB 48 | UX-3, UX-4 | pendente (escopo autorizado) |
| **UX-7** | @executor | `data-state` + CLS <0,1 | UX-1…UX-6 | pendente |
| **UX-8** | @executor | contraste do `reliability-panel` — **2,11 / 2,80 / 2,54** no escuro (medido pelo @ux) | UX-1 | pendente, sem lote atribuído |
| **UX-9** | @arquiteto → @user | contorno de controle a 3:1 no tema claro | decisão do dono | **em espera** — 68 sítios de borda a 1,24–1,31 por nome de token, mas sítio com fallback renderiza o fallback (`#8893a0` = 3,12): a medição é por `getComputedStyle`, sítio a sítio |

Um lote = um commit (código + linha deste documento). `add -A` proibido. Exceção registrada em 25/10: o UX-1c fechou o código em `f03974a` e esta linha entrou em commit `docs:` próprio, por ordem do dono — a regra segue valendo para os lotes seguintes até ruling em contrário.

## 3. Critério por lote

| Lote | Alvo (número) | Asserção | Baseline 25/10/2026 |
|---|---|---|---|
| **UX-0** | ≤8 degraus de texto, 3 pesos, 7 de espaço, 3 durações, 2 easings, `--vu-target: 44px`, `--vu-sheet-gap: 12px` | grep dos tokens + `ng build` exit 0 | `theme.scss` só cor; `tokens.scss` inexistente |
| **UX-1** | 0 declarações fora da escala; ≤8 tamanhos computados; ≤3 pesos; h1 ≥28 px a 390; prosa ≤72 ch/linha | estático nos 23 `.scss` **e** CSS computado nos 4 viewports | **68 fora (régua v1, extremo de token aceito) / 265 literais (régua v2, literal nunca) — alvo 0 em ambas**; DOM 5 tamanhos; **7 pesos** (DOM; a régua estática contava 6 com peso por literal — depois do UX-1 são 3 nos dois instrumentos) |
| **UX-2** | ≤6 paddings distintos, todos 12–32 px; gap ∈ {8,12,16} | CSS computado de painel e cartão, 390/768/1440 | não medido (painéis atrás do gate) |
| **UX-3** | 0 alvos efetivos <44×44; separação ≥8 px | `getBoundingClientRect` de `a,button,input,select,textarea,summary,[role]` visíveis, 390 **e** 320 | **14 de 20** <44 (8 <32) a 390/320; **9 de 20** a 1440 |
| **UX-5** | ≤20 linhas de apoio; média ≤60 ch; 0 frase repetida; 0 instrução padrão; 1 `<details>` de escopo | contagem no DOM por texto próprio | **54 linhas**, média **92 ch**, maior **421** |
| **UX-4** | durações ⊆ {120,240,400}, exceto `0s`; ≤2 easings; abrir painel ≤240 ms até pintado; par `reduce` zera duração **e** transform | `transition-*`/`animation-*` incl. pseudo-elementos + `MutationObserver`→`rAF` | **[150,180,260,420,480]** (+640 ms em `theme-motion.scss:92`); par `reduce` já zera; painel **37/59 ms** |
| **UX-6** | topbar ≤64; barra ≤72 com safe area; conteúdo ≥80% do viewport; 0 paradas de foco cortadas; folga = altura medida da barra + 12 | rect a 390/320/768 + hit-test do disclosure + `pxVisiveis == largura` | topbar **157**; faixa **80,0%** (390) / **76,5%** (320); **2 paradas cortadas** a 390 e 2 a 320 |
| **UX-7** | 6 estados por tela alterada com `data-state`; CLS <0,1 com altura reservada | `PerformanceObserver` de `layout-shift` | CLS **0** (390/320), **0,004** (1440) |

### UX-6 — escopo autorizado

| Item | Critério |
|---|---|
| topbar só marca | ≤64 px a 390/320/768 |
| barra inferior, 5 destinos | ≤72 px incluindo `env(safe-area-inset-bottom)` |
| «Registrar ocorrência» | FAB 48×48 rotulado; nome acessível idêntico (`Registrar ocorrência`) |
| conteúdo | ≥80% do viewport: 712 px a 390, 588 px a 320 |
| folha do D6 | `bottom = barra.getBoundingClientRect().height + --vu-sheet-gap`, nunca `56 + 12` |
| `z` | barra ≤940; folha 950 (colapsada) / 1200 (expandida) |
| hit-test | folha cobre a barra: clique no centro da barra acerta a folha |
| hooks | `data-vu="bottom-bar" \| "sheet" \| "sheet-disclosure"`, `data-vu-sheet-state` ∈ {`collapsed`,`expanded`}; ausente = falha, não pulo |
| teclado | 20 paradas, ordem do DOM, skip link primeiro, nome acessível idêntico |

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
| UX-1 | `python3 apps/web/e2e/tools/audit-font-scale.py --src apps/web/src` | baseline em `904f0a7`, antes do UX-0: `23 arquivos / 265 declarações`, `68 fora`, `6 pesos`, `8 fantasma(s)`, `1 palavra em aria-hidden`, `EXIT=2` |
| UX-1 | idem, com o censo de usos corrigido (elo 1 do @qa, ainda em `904f0a7`) | `8` com censo de usos só em `.scss` → **`10`** com censo único `.scss`+`.html`+`.ts`: `--text` de `verification-panel.ts:46` entrava como fantasma por assimetria do censo, não por defeito do código (reexecutado pelo @revisor, 25/10 20:41) |
| UX-1 | `python3 apps/web/e2e/tools/audit-font-scale.py --src apps/web/src` em `f03974a` | `24 arquivos / 258 declarações`, `0 fora`, `pesos ['400','500','700'] (3)`, `43 usados / 62 declarados / 0 fantasma`, `aria-hidden 0 palavra`, `EXIT=0` (reexecutado pelo @revisor, 25/10 21:25) |
| UX-1 | `python3 apps/web/e2e/tools/audit-font-scale.py --selftest` | `8/8 casos`, `EXIT=0` — o caso `peso_por_token` existe porque o gate de ≤3 pesos passava por vacuidade quando o peso vinha de `var(--vu-weight-*)`: `pesos: []` é sempre ≤ 3 |
| UX-1b / UX-1c | `npx playwright test e2e/contrast-tokens.spec.ts --project=chromium` no `:4201` (sem API e sem banco) | `6 passed (7,4 s)`, `EXIT=0` (reexecutado pelo @revisor, 25/10 21:26): badge/botão 5,50 / 11,02; nota, ícone e contorno de erro 6,11 / 8,49; agrupamento 5,50 / 11,02; IACVT do `fieldset.history-categories` em `solid 1px` nos dois temas; dívida do `.area-result-mark` em `test.fail` a 3,75:1 |
| UX-1 | `grep -rl "font-size" apps/web/src --include=*.scss \| wc -l` | `14` (reexecutado pelo @revisor) |
| UX-1 | `grep -o "<strong" apps/web/src/app/app.html \| wc -l` | `37` (reexecutado pelo @revisor) |
| UX-1 | `grep -rn "font-weight:\s*900" apps/web/src --include=*.scss \| wc -l` | `0` (reexecutado pelo @revisor) |
| UX-3 / UX-4 / UX-7 | `VU_UX_GATES=1 npx playwright test --project=mobile-chromium` | 6 failed / 4 passed / 2 skipped (régua do @qa, 25/10) |
| UX-6 | `npx playwright test e2e/ux6-folha-barra.spec.ts` | fixture: 4 passed / 1 skipped; app real pulada até o shell existir |

### 4.1 Contraste — pares medidos

WCAG 2.x por luminância, recalculado dos hexos de `theme.scss` pelo @revisor e conferido contra a leitura do DOM na spec de contraste. "Antes" é o que o repositório renderizava em `b8c6027`; "depois" é o par de token declarado.

| Par | Antes | Depois |
|---|---|---|
| texto branco sobre acento (badge do aviso, botão de atualizar, agrupamento) | `1,67:1` no escuro — `#ffffff` sobre `--accent` escuro `#8fd7b6` | **`11,02:1`** no escuro (`--color-on-accent` `#071711`) e **`5,50:1`** no claro |
| erro (`#ef4444` → `--color-error`) | `3,76:1` claro / `4,41:1` escuro | **`6,11:1`** claro / **`8,49:1`** escuro |
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
