# Lotes de UX e tokens de interface

Aceita em 25/10/2026. Quatro decisões que fecham o vocabulário numérico da rodada de UX/UI (UX-0…UX-7) e a origem de cada número. Cor não entra: `styles/theme.scss` permanece só com paleta, intocado.

## 1. Escala de texto de 8 degraus e três pesos

Fonte única em `apps/web/src/styles/tokens.scss`, importado **uma vez** em `src/styles.scss`, depois de `theme.scss`. Oito degraus: `--vu-text-xs` 12, `--vu-text-sm` 13, `--vu-text-base` 14, `--vu-text-md` 16, `--vu-text-lg` 20, `--vu-text-xl` `clamp(1.375rem, 2.2vw, 1.5rem)` (22→24), `--vu-text-2xl` `clamp(1.75rem, 2.6vw, 2rem)` (28→32), `--vu-text-3xl` `clamp(2.25rem, 3.4vw, 2.75rem)` (36→44). Os `clamp` foram escolhidos para computar **8 valores por viewport**, nem 7 nem 9.

Pesos: **400 / 500 / 700** (`--vu-weight-regular/medium/strong`). Decisão de UX registrada, não reaberta: 550→500, 600/650/700→700. Recusamos 400/500/600 porque em painel denso o topo de hierarquia desaparece. O `900` observado no DOM **não existe em CSS nenhum** — é `bolder` do agente de usuário sobre `<strong>` dentro de pai 600 (37 ocorrências em `app.html`); resolve-se por uma regra, `strong { font-weight: var(--vu-weight-strong) }`, sem tocar em HTML.

Aceite não é «parece uma escala»: **0 declarações `font-size` fora da escala nos 23 `.scss` de `apps/web/src`** (estático) **e** ≤8 tamanhos computados na tela alcançável. Valor unitário só é on-scale se **igual a um extremo** de token; `clamp` só se o par `(min, max)` bate exato — `23px` e `30px` cabem no intervalo dos `clamp` e **não** existem em viewport nenhum. Token referenciado e ausente é **erro duro (exit 2)**, nunca «fora da escala».

## 2. Vocabulário fechado de movimento

Três durações — `--vu-motion-fast` 120 ms, `--vu-motion-base` 240 ms, `--vu-motion-slow` 400 ms — e dois easings (`--vu-ease-out`, `--vu-ease-inout`). Nenhuma duração fora dessa lista, exceto `0s`. Toda animação tem par em `@media (prefers-reduced-motion: reduce)` que zera duração **e** transform, não apenas a duração. Nenhuma dependência nova: `gsap` 3.15.0 já instalado é o teto; as galerias de padrão são referência na documentação, não pacote.

Consequência registrada: `theme-motion.scss` hoje declara 640/480/420/260/180 ms e a régua mede `[150,180,260,420,480]`. **UX-4 não fecha** enquanto esses valores não entrarem no vocabulário — isso é trabalho do lote, não exceção.

## 3. Alvo efetivo, não caixa declarada

Alvo mínimo **44×44 px efetivos** (`--vu-target`), 48 px quando o controle é a ação primária da tela (`--vu-target-comfortable`). Efetivo = área que recebe o toque, incluindo `::after` e padding, medida por `getBoundingClientRect` de `a, button, input, select, textarea, summary, [role=…]` visíveis, com separação ≥8 px entre alvos vizinhos. Medido a 390 **e** 320 px: zero alvos abaixo de 44 e nenhum nome acessível alterado. Aumentar a altura declarada sem aumentar a área clicável não conta.

Baseline travada em 25/10/2026: **14 de 20** alvos abaixo de 44 px a 390 e a 320 (8 abaixo de 32), **9 de 20** a 1440.

## 4. Folga da folha derivada da barra medida

A folga da folha móvel deixa de ser constante: `bottom = altura medida da barra + --vu-sheet-gap` (12 px), com a altura lida de `getBoundingClientRect()` da barra no DOM — nunca `56 + 12` calculado, porque a barra carrega `env(safe-area-inset-bottom)` e erra por até 34 px em aparelho com recorte. `--vu-sheet-gap` é a fonte única do número; o valor no TypeScript é espelho e a spec é a guarda contra deriva. A asserção continua **exata** — ela compara com o valor medido, não com uma constante.

`z` da folha acima da barra: barra ≤940, folha 950 (colapsada) / 1200 (expandida). O hit-test do disclosure continua obrigatório: clicar onde a folha cobre a barra tem de acertar a folha.

## Consequências

- Baseline estática do UX-1 medida nesta árvore: **265 declarações `font-size`** em **14** dos 23 `.scss` de `apps/web/src`, **68 fora** da escala, **35 valores distintos** entre 8,96 e 30 px, em **12 arquivos**. Pesos no DOM: **7 → 3**.
- Dois conflitos que o lote não pode resolver por conta própria, e que ficam com o @ux: duas declarações `h1` computam **22 px** a 390 (`.page-header h1`, `controls.scss:67` — `clamp(1.35rem, 2vw, 1.75rem)`; `.map-first-screen .map-page-header h1`, `public-map.scss:796` — `22px`) e portanto reprovam «h1 ≥28 px a 390» se o mapeamento for mecânico; e `.query-error-icon` (`controls.scss:847`, `1.5rem` = 24 px, extremo máximo do `--vu-text-xl`) é aceito pelo estático mas computa **24 px** a 390, virando **9º tamanho** no DOM móvel — ícone dimensionado por token de texto é decisão de UX, não de executor.
- `scripts/verify.sh web` **não** cobre navegador (lacuna registrada em D7, issue #2). Nenhum aceite de UI o cita como cobertura; a evidência é spec nomeado.
- Critério de aceite nunca é reduzido para o teste passar. Lote com critério não atendido fica aberto, mesmo com o resto verde.
