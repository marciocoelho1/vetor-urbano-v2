# Interface baseada na proposta 6 — 14/10/2026

O responsável escolheu a proposta **6 — Vetor Urbano v2** e autorizou aplicá-la à interface completa, preservando menus, filtros e recursos existentes. Esta decisão substitui a escolha anterior da proposta 1 com mapa da 5. Escopo limitado a UI/UX; a comparação em `apps/web/src/app/prototypes/ui-ux-gallery/` permanece como referência local.

**Refinamento posterior aprovado em 14/10:** corpo mais presente, textos auxiliares ampliados e mais contrastantes, altura desktop de 800–1.020 px com coluna lateral alinhada, altura móvel preservada, tema dos dois mapas acompanhando a página com escolha local temporária e retirada da frase explicativa da legenda. Estes pontos atualizam as dimensões e o comportamento descritos no registro original abaixo. Estado de implementação e limites de verificação em [interface-refinements-2026-10-14.md](interface-refinements-2026-10-14.md).

## Direção aplicada

Paleta original clara/escura da v2, sem alteração em `theme.scss`. Tipografia Manrope nos títulos, textos, cartões e controles, como na proposta 6. Newsreader continua disponível nas alternativas da galeria; sua declaração e carregamento saíram da entrada principal. Os arquivos das fontes e suas licenças foram preservados.

Cabeçalho em uma superfície arredondada, com seis acessos: Mapa público, Informes ativos, Histórico, Relatórios, Fontes e Registrar ocorrência. Em telas menores a navegação tem rolagem horizontal dentro do cabeçalho, mantendo todos os acessos. O botão de tema mantém a preferência e a animação existentes.

No desktop, mapa à esquerda e busca/filtros/resultados à direita. A área de consulta usa altura `clamp(680px, 79dvh, 900px)`; coluna lateral de 410 px, 360 px até 1200 px e 490 px a partir de 1900 px. O mapa recebe o espaço restante após seu resumo/legenda. Resultados em cartões de uma coluna, com rolagem própria. Indicadores e acesso contextual aos relatórios continuam abaixo da consulta.

Busca existente por ocorrências, locais e áreas, filtros rápidos por categoria/período e mancha térmica ficam na coluna lateral. O grupo de filtros rápidos começa aberto e pode ser recolhido. “Filtros avançados e camadas” abre o painel original do mapa; o atalho interno também foi mantido. Esse painel conserva módulos, horários/intervalos, tipos/crimes, POIs, territórios, avisos, rolagem, teclado e redimensionamento. No mapa ampliado, os filtros rápidos aparecem dentro do diálogo, com todos os controles alcançáveis pelo teclado.

Até 960 px, Mapa / Lista alterna a apresentação com a consulta compartilhada. O mapa permanece na mesma instância; voltar ao mapa redimensiona o canvas pelos observadores existentes. Abrir filtros avançados ou iniciar uma escolha de ponto mostra o mapa. A lista permanece disponível automaticamente se o mapa falhar. O layout móvel usa mapa de 570 px, ou 520 px até 560 px, além de resumo e legenda.

Os demais fluxos recebem Manrope, a mesma hierarquia de títulos e superfícies arredondadas. Cadastro progressivo, mapas das categorias, seleção de coordenadas, detalhes inline, limite de cinco detalhes, dados importados, XLSX, filtros salvos, reprodução, comparação e triagem continuam funcionando com os mesmos bindings e regras.

Trade-off: a coluna lateral concentra os controles e exibe menos cartões de uma vez no desktop; há rolagem própria nos resultados. No celular, filtros abertos consomem espaço acima do mapa e podem ser recolhidos. Nenhuma busca real por endereços ou funcionalidade de backend foi acrescentada.

## Implementação e preservação

- `app.html`: reorganização dos elementos existentes e template compartilhado dos filtros rápidos; controles móveis com nomes acessíveis.
- `app.ts`: somente estado da apresentação Mapa / Lista e sua coordenação ao abrir filtros/escolher ponto.
- `visual-v2.scss`, `public-map.scss`, `styles.scss`, `index.html`: composição, tipografia, breakpoints e carregamento de fontes.
- `ui-icons.svg`: dois símbolos para os controles de apresentação.
- E2E existentes adaptados às posições/fontes escolhidas; novos cenários em `visual-v6.spec.ts` verificam composição, seis menus, temas, consulta compartilhada e instância do mapa.

Auditoria de ações: **84 bindings de ação anteriores preservados; 87 após a reorganização**, sem ação anterior ausente. SHA-256 confirma integridade de regras de domínio, fixtures, tema, animação de tema, redimensionamento e lockfile. Referências originais, galeria e trabalho anterior em `AGENTS.md`/`docs/agents/` preservados. Nenhuma dependência nova, publicação ou implantação externa.

## Evidências

`bash scripts/verify.sh web` passou: lint, **56 testes unitários e build 499,60 kB sem avisos**, sem alterar limites. `npm run test:e2e -- --workers=1` encerrou com **92 testes passados, zero ignorados**, em Chromium/Firefox. `lint:prototype` também passou após restringir Newsreader à galeria. Revisão em navegador produziu **46 capturas**, com JSON em `docs/evidence/visual-v6/{chromium,firefox}/`; mapa raster real e dados fictícios. Auditoria de preservação em `docs/evidence/visual-v6/preservation.json`.

A execução integral anterior passou em 89 de 92 cenários; houve leitura de geometria antes da atualização da vista e interferência entre execuções nos artefatos de captura. O teste foi corrigido para aguardar visibilidade; quatro cenários direcionados passaram em execução sequencial, e a matriz completa foi então repetida e passou integralmente. As medições do painel também passaram a usar posições posteriores à rolagem automática do clique. Nenhuma falha foi ignorada, e os motores/regras não foram alterados para obter aprovação.

Capturas inspecionadas incluem mapa desktop de 1440/1024 px, mapa/lista a 390 px, mapas a 320 px nos dois temas e as cinco telas adicionais em tema escuro. A inspeção não equivale a teste com leitor de tela ou aparelho físico; esses gates permanecem abertos.

Próxima ação: revisar a interface em `http://127.0.0.1:4201/`. Backend, dados reais e serviço de endereços permanecem nos gates anteriores.
