# Exploração de UI/UX — alternativas visuais

Atualização: 14/10/2026. Briefing confirmado via `grill-with-docs`; galeria construída e retomada por solicitação explícita do responsável após a pausa de 13/10. Histórico da pausa em [ui-ux-recovery-2026-10-13.md](ui-ux-recovery-2026-10-13.md). **Direção final escolhida: proposta 6, com integração à interface completa restrita a UI/UX e preservação dos recursos existentes.** Registro em [visual-v6.md](visual-v6.md).

## Solicitação e decisões confirmadas

Solicitação original: apresentar pelo menos cinco opções visuais diferentes para que o responsável escolha uma para implantar no Vetor Urbano.

Respostas da primeira rodada (`A, A/B, B`):

- Priorizar encontrar ocorrências próximas de um lugar ou dentro de um período.
- Melhorar tanto a compreensão dos resultados quanto o uso dos filtros.
- Considerar mudanças amplas de navegação e identidade visual.

Respostas da segunda rodada (`3, A, A`):

- Usar mapa e resultados lado a lado como direção de organização da consulta.
- Incluir busca por endereço ou nome de local na experiência desejada.
- Adotar identidade cívica e serena, com cores sóbrias e leitura acolhedora.

Respostas da terceira rodada (`Galeria interativa, Mapa / Lista, Sugestões fictícias`):

- Apresentar as cinco propostas em uma galeria local interativa.
- No celular, alternar Mapa / Lista preservando a consulta.
- Simular sugestões de endereço durante a comparação; escolher/integrar um serviço real depois da seleção visual.

A direção escolhida orienta as cinco alternativas; não reduz a entrega a um único desenho. As alternativas construídas diferem em composição, navegação, hierarquia dos filtros, apresentação dos resultados e tratamento visual, com a mesma tarefa de consulta como referência.

## Escolha visual em 14/10

O responsável escolheu **Verde institucional (proposta 1)** como base, com o tamanho do mapa da **proposta 5**, preservando a seleção de categorias sempre à mostra como na proposta 1. A variante 1 da galeria foi ajustada para comparar essa combinação: área mapa/lista usa altura `clamp(680px, 79vh, 900px)` e coluna lateral de 410 px no desktop, como na proposta 5. Os breakpoints existentes continuam compartilhados, com coluna lateral de 360 px até 1200 px e 490 px a partir de 1900 px; no celular as propostas já usavam a mesma altura de mapa. Identidade, navegação superior, filtros visíveis e cartões da proposta 1 foram preservados. A consulta acima do mapa permanece visível e, com o mapa ampliado, a página exige mais rolagem vertical.

A galeria compara somente a consulta básica. Filtros avançados e acesso às demais seis visões da aplicação existente não foram incluídos nessa comparação; sua ausência não representa decisão de removê-los. A próxima etapa deve harmonizar a direção escolhida com esses controles, os demais fluxos e o tema escuro. A busca nesta prévia continua fictícia.

Validação do ajuste: `lint:prototype` e build da configuração `ui-ux-prototype` passaram; servidor 4210 recompilou os fontes com sucesso. `bash scripts/verify.sh web` passou com lint, 56 testes e build padrão de 490,91 kB sem avisos; essa suíte verifica a aplicação existente, não o layout da galeria. `git diff --check` passou. Não houve nova captura de navegador devido à restrição de sockets identificada na retomada; as capturas de 13/10 permanecem evidência histórica da proposta 1 original, antes deste ajuste.

## Comportamento existente e extensão desejada

O protótipo tem busca textual de ocorrências e áreas territoriais, seleção do centro por clique/coordenadas e filtros locais por categoria, período e raio. A busca existente não resolve endereços arbitrários. Evidências: `apps/web/src/app/app.ts` (`setSearchQuery`, `selectMapSearchResult`, `acceptMapPick`) e `apps/web/src/app/app.html`.

A busca por endereço é uma extensão desejada aprovada para a experiência. Nesta galeria, as sugestões são fictícias; a integração real fica para depois da escolha visual. Nenhum provedor, credencial, custo, contrato ou cobertura foi escolhido. Ao iniciar uma integração real, registrar origem, licença, precisão, limites e tratamento de resultados ambíguos.

RF02 continua sendo o requisito de referência para mapa e filtros. A busca por endereço é uma extensão de UX sem novo ID RF aprovado. Não altera os IDs existentes nem resolve os gates full-stack em `scope.md` e `PLAN.md`.

## Sexta alternativa solicitada em 14/10

Após escolher a combinação da proposta 1 com mapa da 5, o responsável solicitou mais uma alternativa: **layout e tipografia da proposta 5 com as cores originais do Vetor Urbano v2**. Ela foi acrescentada como **6 — Vetor Urbano v2**, em `http://127.0.0.1:4210/?variant=6`, preservando as cinco opções anteriores. É candidata adicional para comparação; o pedido não declara substituição da escolha anterior.

Compartilha template, dimensões, breakpoints, tipografia e filtros recolhíveis com a 5. A paleta reutiliza os tokens claros da aplicação em `apps/web/src/app/theme.scss`: fundo `#f7f8fa`, superfície `#fff`, texto principal `#252c36`, secundário `#626d7b`, borda `#dde1e6`, verde `#24765b` e superfície selecionada `#f0f6f3`. Mantém os significados das cores de categoria. Contagem, navegação circular, URL e miniatura de comparação incluem a sexta opção.

Validação: lint do protótipo e build `ui-ux-prototype` passaram; servidor 4210 recompilou com sucesso. `bash scripts/verify.sh web` passou com lint, 56 testes e build padrão de 490,91 kB sem avisos. Fonte da revisão preparado para incluir todas as alternativas pelo número de botões da galeria; sintaxe JavaScript e `git diff --check` passaram. Sem nova captura/revisão no navegador pela restrição de sockets já identificada; a revisão anterior não cobre a opção 6.

## Propostas para a comparação

Alternativas apresentadas na comparação; a proposta 1 foi escolhida com o ajuste registrado acima:

| Alternativa | Tratamento visual e composição | Diferença de interação a explorar |
|---|---|---|
| Verde institucional | Marfim, verde profundo, títulos com presença editorial; lista à direita do mapa | Navegação superior e filtros em barra visível; cartões com leitura confortável |
| Azul cívico | Branco, azul sóbrio, tipografia objetiva; lista à esquerda do mapa | Navegação lateral compacta e filtros agrupados junto aos resultados |
| Grafite e areia | Superfícies neutras, contraste marcado, poucos elementos decorativos | Consulta resumida em uma barra e resultados em linhas compactas |
| Terracota urbana | Tons quentes discretos, superfícies claras e títulos expressivos | Campos de lugar, período e categoria em blocos claros; resultados com contexto textual |
| Verde-azulado contemporâneo | Verde-azulado, cinzas frios e cantos suaves | Busca destacada, filtros recolhíveis por grupo e seleção de resultado com painel de detalhes |
| Vetor Urbano v2 (sexta alternativa) | Paleta clara original da v2; mesma tipografia e composição da proposta 5 | Mapa amplo, consulta integrada à coluna de resultados e filtros recolhíveis |

As cores de categoria e severidade precisam continuar acompanhadas de texto/ícones; cor decorativa não deve mudar a interpretação dos dados. Dados demonstrativos permanecem identificados. A base visual escolhida orienta a integração; os detalhes dos demais fluxos ainda precisam ser harmonizados.

## Questões abertas

- Revisar a proposta 6 aplicada à interface principal, com filtros avançados e navegação completa preservados.
- Escolher fonte/serviço, limites e custos da busca real após a seleção visual.
- Completar QA manual em aparelho físico e leitor de tela; demais fluxos e tema escuro foram harmonizados na integração de UI/UX autorizada em 14/10.

## Estado na pausa

Fonte em `apps/web/src/app/prototypes/ui-ux-gallery/`, entrada Angular própria na configuração `ui-ux-prototype`; iniciar com `npm run prototype:ui --prefix apps/web` e abrir `http://127.0.0.1:4210/?variant=1`. Servidor encerrado na pausa. Nenhuma dependência nova. A galeria usa 71 fixtures do gerador suplementar existente, Leaflet/base raster atual e fontes locais; filtros, seleção e câmera são preservados durante as trocas.

`bash scripts/verify.sh web` passou em lint, 56 testes e build 490,91 kB sem avisos. `npm run lint:prototype --prefix apps/web` passou. Revisão de navegador: **26 verificações passaram**, **18 capturas**, Chromium/Firefox, 320/390 px e desktop, **156 respostas de tiles HTTP 200 e zero erros JavaScript**. Resultado em `docs/evidence/ui-ux-gallery/review.json`; fonte da revisão preservado em `tools/visual-review/capture-ui-ux-gallery.mjs`. São verificações de protótipo; não comprovação de serviço operacional, leitor de tela ou aparelho físico.

A tarefa foi pausada antes da entrega final da galeria para escolha. O ponto de recuperação registra o que resta revisar e os comandos de retomada.

## Retomada em 14/10

As 18 capturas válidas enumeradas em `review.json` foram inspecionadas nesta retomada, incluindo todas as listas móveis, detalhe selecionado e mapa a 320 px. Servidor reiniciado pelo comando acima; compilação de desenvolvimento concluída sem erros e endereço local anunciado em `http://127.0.0.1:4210/`. A checagem HTTP pelo terminal foi bloqueada pelo sandbox ao abrir socket; execução ampliada rejeitada pela política do ambiente. Não houve nova revisão de navegador nem alteração da aplicação; os resultados dos testes de 13/10 permanecem evidências anteriores.

A escolha registrada acima ocorreu depois da entrega da galeria. O briefing confirmado continua válido.

As decisões desta entrevista são reversíveis; não há trade-off arquitetural fechado que justifique um ADR neste momento. Nenhum termo novo de domínio foi definido para o glossário.
