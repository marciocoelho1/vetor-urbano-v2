# Verificação — Mapa Público na primeira tela

14/10/2026. Implementação local; documentação de produto em `docs/product/public-map-first-screen-2026-10-14.md`.

- `bash scripts/verify.sh web`: lint, 59 testes e build passaram. Inicial 502,64 kB; aviso de orçamento de 500 kB excedido em 2,64 kB, sem alterar limites.
- `bash scripts/verify.sh planning` e `git diff --check`: passaram.
- Playwright: 12 cenários direcionados validados em Chromium e Firefox. Comando: `npm run test:e2e -- e2e/visual-v6.spec.ts e2e/visual-v2.spec.ts --grep 'proposal 6|keeps the same map|fits the public map|viewport-sized map|uses filters and radius|resizes the topic panel' --workers=1 --output=/tmp/vetor-first-screen-final`. Resultado: 11 passados e uma comparação de subpixel do painel (`220,00003` contra `220`). Corrigida a comparação para tolerância de 0,005 px; `--grep 'resizes the topic panel' --output=/tmp/vetor-first-screen-resize-final` passou nos dois motores.
- Geometria: sete janelas × dois temas × dois motores, 28 PNGs nas pastas `chromium/` e `firefox/`. Tiles simulados; mapa, barra, seta e rodapé medidos, Enter/foco do link verificados.
- Mapa-base real: 46 PNGs e dois `review.json` em `../interface-refinements-2026-10-14/`, gerados pela revisão completa das vistas. Zero erros JavaScript e tiles HTTP 200 exigidos pelo teste. Vistas finais de mapa desktop, mapa móvel nos dois temas e lista móvel inspecionadas; resumo/rodapé sem sobreposição.
- Suíte geral inicial: 89 passados, 9 falhas. Não representa aprovação da versão final. As expectativas de altura foram atualizadas e as regressões de fluxo/rodapé foram verificadas na matriz direcionada.
- Problemas anteriores confirmados: tema local do mapa de cadastro MapLibre após alternância da página (`browser-smoke.spec.ts:219`) e largura de cadastro a 320 px (`browser-smoke.spec.ts:818`). Quatro cenários falharam igualmente na cópia `/tmp/vetor-first-screen-baseline/apps/web`, com os três arquivos da aplicação anteriores ao ajuste. Cópia isolada, porta 4212, sem mudar os arquivos de trabalho. Resultados em `/tmp/vetor-baseline-results`. Não corrigidos neste incremento.

Não houve commit, push, publicação ou nova dependência. Janelas muito baixas, zoom elevado e filtros móveis expandidos preservam acesso por rolagem; o encaixe inicial foi comprovado nas janelas registradas.
