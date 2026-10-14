# Ponto de recuperação — galeria de UI/UX

**Estado: pausada em 13/10/2026, a pedido explícito do responsável.** Não retomar automaticamente. Este documento registra continuidade; `PLAN.md` continua sendo o único roadmap ativo.

## Objetivo e decisões

Entregar pelo menos cinco opções visuais concretas para escolher a direção de UI/UX do Vetor Urbano. O responsável confirmou consulta por lugar/período, melhoria de resultados/filtros, liberdade de navegação e identidade, mapa/lista lado a lado no desktop, tom cívico/sereno, galeria interativa e Mapa / Lista no celular. Busca por endereço é desejada; **nesta comparação usar sugestões fictícias**, com serviço real depois da escolha visual.

Briefing e respostas das três rodadas: [ui-ux-exploration.md](ui-ux-exploration.md). Skills já lidas nesta sessão: `grill-with-docs`, `grilling`, `domain-modeling`, `prototype` e sua referência `UI.md`. Não há decisão de domínio irreversível que justifique ADR, nem termo novo resolvido para glossário.

## O que está pronto

- Cinco composições em `apps/web/src/app/prototypes/ui-ux-gallery/`: Verde institucional, Azul cívico, Grafite e areia, Terracota urbana, Verde-azulado contemporâneo.
- Entrada própria `main.ts`, configuração Angular `ui-ux-prototype`, comandos `prototype:ui` e `lint:prototype` em `apps/web/package.json`. Não altera a entrada/build padrão da interface principal.
- Busca simulada com sugestões e teclado, categorias, período, raio 100–25.000 m, ordenação, detalhe de resultado, seleção de centro por clique, zoom/pan, Mapa / Lista, troca de propostas por URL/setas e diálogos de comparação/ajuda/origem.
- Consulta, seleção e câmera compartilhadas durante as trocas; memória local sem persistência. Usa 71 fixtures suplementares existentes, relógio fixo `2026-10-13T18:00:00Z`, fontes Manrope/Newsreader locais e Leaflet/base raster já instalada. Nenhuma dependência nova.
- Fonte da revisão antes temporário agora preservado em `tools/visual-review/capture-ui-ux-gallery.mjs`. Resultados e capturas em `docs/evidence/ui-ux-gallery/`.

## Evidências já obtidas

- `bash scripts/verify.sh web`: lint, **56 testes em quatro arquivos**, build **490,91 kB**, sem avisos. A galeria não aparece no bundle padrão; nomes/hashes dos bundles principais coincidem com o build existente.
- `npm run lint:prototype --prefix apps/web`: passou.
- Revisão de navegador: **26 verificações passaram**, **18 capturas**, Chromium 156.0.8078.4 / Firefox 157.0, desktop 1440/1920 e móvel 390/320 px, **156 respostas de tiles HTTP 200 e zero erros JavaScript**. Conferiu filtros e seleção preservados, mapa/lista com mesmo conjunto, autocomplete/teclado, centro explícito, vazio, diálogos e alternativa em lista após falha de tiles provocada. Resumo em `review.json`.
- Corrigidos durante a construção: isolamento do CSS no build do protótipo; callbacks tardios após descarte do Leaflet; deslocamento de câmera ao redimensionar/tornar o mapa visível. A verificação do centro permite 0,0005° para arredondamento de pixels a zoom 12, além de exigir marcadores visíveis. O centro do filtro continua com suas coordenadas exatas.
- Capturas desktop das cinco propostas e amostras móveis foram inspecionadas; não afirmar inspeção final de todas as 18. Leitor de tela e aparelho físico não foram usados.

## Retomada, somente após novo pedido

1. Ler `PLAN.md`, este ponto e o briefing. Inspecionar Git, preservando o trabalho prévio listado abaixo.
2. A branch local é `feat/ui-ux-gallery`. Os arquivos permanecem sem commit; não publicar, mesclar ou implantar automaticamente.
3. Iniciar a galeria:

   ```bash
   npm run prototype:ui --prefix apps/web
   ```

4. Abrir <http://127.0.0.1:4210/?variant=1>; variantes de 1 a 5. **O servidor foi encerrado na pausa**, então o link exige reinício.
5. Conferir capturas finais ainda não inspecionadas, especialmente `selected-result-desktop.png`, `proposal-5-320-map.png` e as demais listas móveis; preparar a entrega da galeria com links/comando e solicitar escolha visual ou combinação. Não reiniciar a entrevista: o briefing já foi confirmado.
6. Repetir verificações somente se houver mudança/falha que justifique. Para reproduzir as capturas com o servidor ativo: `node tools/visual-review/capture-ui-ux-gallery.mjs`. Exige navegadores Playwright existentes e permissão para abrir navegador/rede no ambiente.
7. A escolha visual ainda não ocorreu. Integração real de endereços, harmonização dos demais fluxos/tema escuro e implantação são decisões/incrementos posteriores.

## Preservação do trabalho

Antes desta tarefa, já havia `AGENTS.md` e `PLAN.md` modificados e `docs/agents/` não rastreado. `AGENTS.md` e `docs/agents/` foram preservados; `PLAN.md` recebeu apenas o registro desta exploração/pausa além das mudanças preexistentes. Não incluir trabalho anterior em um commit de galeria sem separar os escopos.

Snapshot local adicional em `.hermes/cache/ui-ux-recovery-2026-10-13/workspace-checkpoint.tar.gz`, com fontes/configurações, documentos, evidências e os arquivos preexistentes para preservação. `manifest.json` registra SHA-256 de cada arquivo e do arquivo compactado; `working-tree.patch` registra o diff de arquivos rastreados. Essa pasta é ignorada pelo Git e permanece somente neste workspace. **Não extrair sobre trabalho novo sem comparar os arquivos**; a restauração deve ser feita primeiro em um diretório temporário.

O PNG `review-failure.png`, se presente, é um artefato intermediário de uma tentativa anterior da revisão; a evidência válida é `review.json` com `status: passed` e as 18 vistas que ele enumera. Nenhuma falha foi ignorada para alcançar o resultado final.
