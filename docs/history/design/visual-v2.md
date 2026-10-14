# Vetor Urbano 02 — estudo visual

**Direção atual:** a proposta 6 foi escolhida e aplicada em 14/10/2026; composição lateral, Manrope também nos títulos e preservação dos recursos existentes estão em [visual-v6.md](visual-v6.md). As decisões e evidências abaixo registram o visual anterior e sua evolução em 11–12/10.

Autorização: 11/10/2026. Esta versão foi solicitada como alternativa visual para comparação, com cópia do repositório em `marciocoelho1/vetor-urbano-v2`. Não decide o visual final da versão principal nem inicia outro marco do produto.

## Origem e requisitos aprovados

- Base: `311875a`, da `main` do repositório `marciocoelho1/vetor-urbano`; histórico, documentação, fixtures, referências originais, ferramentas e vídeo preservados.
- Referência fornecida: `imagemReferenciaVetorUrbano2.png` na raiz da versão principal. Cópia íntegra em [reference.png](../../references/ui/v2/reference.png).
- Adaptar o layout da imagem às capacidades existentes: mapa, cadastro demonstrativo, informes ativos, histórico, relatórios e fontes.
- Newsreader nos títulos. Após esclarecimento, o responsável aprovou substituir Mori por uma alternativa gratuita semelhante, **sem preparar integração futura para Mori**. Escolhida Manrope; sem arquivos, regras CSS ou dependências de Mori.
- GSAP nas animações de interface. Envio do código ao repositório indicado autorizado; hospedagem da aplicação não faz parte desta entrega.

## Direção visual

| Papel | Decisão |
|---|---|
| Fundo | `#f7f8fa`, cinza frio próximo da referência |
| Superfícies | `#ffffff` |
| Texto principal | `#252c36` |
| Texto secundário | `#626d7b` |
| Divisórias | `#dde1e6` |
| Seleção | `#24765b`, preservando a associação de Trânsito ao verde |
| Títulos | Newsreader, peso regular e tamanho responsivo |
| Interface, subtítulos e botões | Manrope, fonte sem serifa gratuita com licença OFL |

Navegação horizontal com todas as seis áreas existentes; mapa em largura total; pesquisa acima do mapa; categorias, período e mancha térmica em uma barra flutuante dentro dele. Ferramentas completas ficam em “Filtros e camadas”, em um painel interno inicialmente recolhido no navegador. O intervalo personalizado abre o painel e foca o primeiro campo. Indicadores usam `eventCount()` e `categoryMetrics()`, derivados do mesmo conjunto da lista, inclusive quando vazio. Relatórios têm um acesso direto contextual. Corrigido um problema herdado na apresentação dos seletores de comparação: `ngModel` mantém o valor visível alinhado ao estado consultado quando as opções dinâmicas são criadas e ao retornar à tela; as regras de cálculo permanecem iguais.

O botão Buscar e Enter centralizam o primeiro resultado da pesquisa existente. A lista de sugestões continua disponível para escolher outro resultado; não foi adicionado geocoder, pedido de geolocalização, perfil fictício ou sistema de notificações.

As outras telas recebem a mesma paleta, tipografia e hierarquia. Filtros acumuláveis, período, horário, raio, territórios, POIs, mancha térmica, expansão, lista, detalhes inline, formulário progressivo, exportação, importação, comparação, filtros salvos e triagem continuam locais. As contagens não representam ocorrências reais ou cobertura operacional.

## Código e trade-offs

- `visual-v2.scss`: layout da alternativa visual e seus breakpoints, aplicado pelo componente raiz.
- `controls.scss`: controles compartilhados de mapa, filtros, formulário e resultados, delimitados por `app-root`. `workspace.scss` mantém as visões de consulta/relatório e controles já compartilhados. Essa divisão mantém estilos comuns fora do orçamento por componente, sem aumentar nenhum limite de build.
- `view-motion.ts`: diretiva Angular com GSAP **3.15.0**, carregado por importação dinâmica. Uma entrada curta para título e pesquisa/mapa, com contexto descartado na troca de visão e na destruição. `gsap.matchMedia()` interrompe/reverte movimento quando `prefers-reduced-motion` muda. Uma falha no carregamento de animação deixa o conteúdo utilizável.
- GSAP acrescenta aproximadamente 71 kB brutos em um chunk separado; não entra no pacote inicial. Não foram adicionados plugins de animação ou outra biblioteca de componentes.
- Newsreader e Manrope são WOFF2 locais, com subconjuntos Latin/Latin Extended e `font-display: swap`; somente Latin é pré-carregado. Não há requisição de fontes para Google durante o uso. Origem/licenças em [fonts/README.md](../../../apps/web/public/fonts/README.md).
- Chaves de armazenamento `vu2.*` isolam preferências, filtros salvos e triagem da v1. Arquivos abertos continuam somente na memória da aba. Nenhum dado da v1 é migrado ou apagado.
- `npm start` e Playwright usam porta **4201**, para comparar com a v1 em 4200. `origin` da cópia aponta exclusivamente para `vetor-urbano-v2`.
- Angular, MapLibre, Leaflet, contratos, dados geográficos, regras de domínio e suas versões foram preservados. Apenas GSAP foi acrescentado ao lockfile.

## Verificação e limites

### Layout horizontal, resultados em cartões e painel redimensionável — 12/10/2026

Pedido autorizado: aumentar a área horizontal de toda a aplicação, organizar Resultados visíveis em blocos lado a lado e empilhados, redimensionar Explore por tema com o mouse e usar Manrope no corpo/Newsreader nos títulos e subtítulos.

Cabeçalho e conteúdo passam a ocupar 100% da largura, com margens de 32 px acima de 1.200 px, 28 px em telas intermediárias e as margens móveis existentes. O limite geral de 1.568 px e os limites de 1.180 px nas vistas internas/1.120 px no formulário deixam de restringir desktop. O mapa mede 1.856 px numa tela de 1.920 px e 2.496 px em 2.560 px. Altura, controles e comportamento de câmera seguem o incremento do mapa existente.

Resultados continuam numa lista semântica, apresentada por CSS Grid com cartões de pelo menos 300 px (ou a largura disponível em telas menores). A captura de 1.920 px mostra cinco colunas; o celular mantém uma coluna. Títulos quebram linha, detalhes permanecem dentro do respectivo cartão e as linhas acompanham a altura do maior cartão. Trade-off: abrir detalhes aumenta a altura daquela linha; a ordem de leitura e a correspondência com o mapa permanecem previsíveis.

Explore por tema começa com 360 px e oferece alças na borda direita, base e canto inferior direito. Pointer Capture mantém o arraste quando o cursor sai da alça; limites de 260 × 220 px e de espaço disponível evitam cobrir a barra inferior ou sair do mapa. Conteúdo tem rolagem própria e cabeçalho fixo. Setas ajustam 24 px (48 px com Shift), Home restaura o tamanho inicial, e os controles têm nomes e instruções acessíveis. As dimensões ficam somente na instância da tela, inclusive ao fechar/reabrir; não há preferência persistida. Até 560 px, largura se adapta automaticamente e as alças ficam ocultas. O mapa não é remontado e conserva centro/zoom. Nenhuma biblioteca adicional.

Manrope e Newsreader já eram assets locais aprovados. O corpo e todos os controles continuam em Manrope; a regra agora também prevalece sobre as fontes padrão de Leaflet/MapLibre. Títulos h1–h6 e nomes dos cartões usam Newsreader. A regra geral de movimento reduzido passa de transições de 0,01 ms para transições desativadas: mesmo a duração mínima atrasava medições durante arrastes rápidos e mudanças de viewport.

Verificação: `bash scripts/verify.sh web` passou (lint, 56 testes unitários, build inicial 490,91 kB sem avisos). A execução completa de E2E passou em 86 de 88 cenários; os dois cenários novos de redimensionamento foram corrigidos para arrastar dentro da janela, aguardar o painel reabrir e aceitar precisão subpixel do Firefox, e passaram na reexecução direcionada nos dois motores. Os 88 cenários ficaram validados, zero ignorados. Incluem seis vistas desktop, fontes efetivas, grade em 320/390/768/1.280/1.920/2.560 px, detalhes, três alças, teclado, limites, redução da janela, rolagem móvel e instância/câmera preservadas. Oito capturas com mapa raster real foram inspecionadas, com 46 respostas de tiles HTTP 200 e zero erros JavaScript. Evidências em [horizontal-layout-2026-10-12.json](../../evidence/horizontal-layout-2026-10-12.json) e imagens em `docs/evidence/horizontal-layout/`. Aparelho físico/leitor de tela continuam pendentes. Próxima ação: revisão visual deste incremento pelo responsável.

### Área e controles do mapa público — incremento autorizado em 12/10/2026

O responsável solicitou ampliar o mapa, inserir filtros/camadas dentro dele e reduzir/centralizar a barra de raio com a mesma altura de tema/ampliação. No desktop, a altura passa do limite anterior de 410 px para `clamp(540px, 72dvh, 840px)`; no celular, dos 360 px anteriores para `clamp(560px, 78dvh, 720px)`. As margens laterais do mapa móvel são menores para aproveitar a largura disponível. Cabeçalho, pesquisa, legenda e alternativa em lista continuam acessíveis.

A barra superior distribui filtros/camadas à esquerda, raio no centro geométrico do mapa e tema/ampliação à direita. O raio usa 224 × 44 px no desktop, frente aos 270 px anteriores; todos os controles próprios superiores têm 44 px de altura. No celular, rótulos concisos e ícones com nomes acessíveis evitam sobreposição; o zoom desce à direita. Abaixo, uma barra flutuante mantém categorias, período e mancha térmica à mão. POIs, territórios, tipos, datas e horários ficam no painel detalhado com cabeçalho fixo, fechamento e rolagem interna. Ambos permanecem dentro do modo ampliado.

Os ajustes de raio abrem abaixo do resumo. Abrir filtros fecha somente as opções do raio, e abrir o raio recolhe o painel de filtros; as seleções aplicadas permanecem. A barra continua com 44 px quando o filtro está ativo. A roda sobre a barra ajusta a distância; sobre as opções permite rolagem dos campos em telas baixas. Escape fecha primeiro o painel aberto e devolve o foco ao controle; outro Escape sai do mapa ampliado. A contenção de foco do diálogo inclui inputs, selects e summaries e exclui elementos escondidos. A ordem de exibição dos popups vetoriais mantém seu botão de fechar acessível sobre a barra. Abrir painéis não remonta nem redimensiona a cartografia; expansão e ResizeObserver preservam o comportamento existente.

A escolha de controles flutuantes recolhíveis segue a convenção de [Expand com Layer List da Esri](https://developers.arcgis.com/javascript/latest/references/map-components/components/arcgis-expand/). É uma referência de interação; nenhuma biblioteca Esri foi acrescentada. Trade-off: os painéis cobrem parte da cartografia enquanto abertos, compensado pelo aumento da área, rolagem interna e fechamento rápido. A direção foi implementada como detalhe reversível do pedido autorizado, sem alterar dados, contratos ou IDs RF/RNF.

Verificação: `bash scripts/verify.sh web` passou em lint, 56 testes e build; lint/build finais passaram, com pacote inicial de 484,97 kB e sem avisos. Matriz final de 84 E2E em Chromium/Firefox, zero ignorados, incluindo alinhamento/centralização de 320 a 1440 px, painéis dentro do mapa, teclado, datas, temas, dois motores, popups, raio/clique/arraste, câmera e mapa ampliado a 320 px. Ajustados seletores da regressão de animação para distinguir os SVGs do cabeçalho/mapa. Oito capturas com raster real foram inspecionadas (18 respostas HTTP 200, zero erros JS), nos dois temas e em celular. Evidências em [public-map-layout-2026-10-12.json](../../evidence/public-map-layout-2026-10-12.json); exemplos [desktop](../../evidence/public-map-layout/desktop.png), [mobile](../../evidence/public-map-layout/mobile.png) e [filtros](../../evidence/public-map-layout/mobile-filters.png). A avaliação em aparelho físico/leitor de tela continua pendente. Próxima ação: revisar o layout no navegador habitual.

### Modo escuro — incremento autorizado em 11/10/2026

O responsável solicitou modo escuro para esta versão. O botão de lua/sol no cabeçalho alterna as paletas, tem área de 44 × 44 px, foco visível e estado acessível por `aria-pressed`. Sem escolha explícita, a interface acompanha `prefers-color-scheme`; após alternar, a preferência `vu2.theme` prevalece, é restaurada ao recarregar e sincronizada entre abas. Armazenamento bloqueado mantém a escolha na aba atual. `theme-init.js`, servido localmente, aplica a paleta antes da inicialização Angular; `theme.ts` acompanha mudanças posteriores e descarta os listeners ao encerrar a aplicação.

`theme.scss` centraliza cores para as duas paletas. O modo escuro usa fundo `#10151b`, superfícies `#181f28`, texto `#e7ecf2` e destaque `#8fd7b6`; navegação, pesquisa, filtros, indicadores, lista, formulários, relatórios, fontes, mensagens e controles/popups dos mapas recebem esses tokens. Newsreader, Manrope e animações existentes permanecem. A cartografia Bright e as cores dos pins/territórios são preservadas para manter a leitura das categorias e a comparação entre consultas; a alternância reaproveita mapa, câmera e dados.

As evidências e capturas deste incremento ficam em [dark-mode-2026-10-11.json](../../evidence/dark-mode-2026-10-11.json) e [dark-mode/](../../evidence/dark-mode). Os testes verificam inicialização antes de Angular, preferência do sistema, teclado, recarga, sincronização entre abas, armazenamento bloqueado, seis visões, campos, contraste em amostras CSS e larguras 1024/961/768/390/320 px. Essa amostragem não equivale a uma auditoria completa de acessibilidade. O pacote inicial passou a 466,73 kB, dentro do orçamento existente; nenhuma dependência foi acrescentada.

### Animação de tema — incremento autorizado em 11/10/2026

O botão agora representa o modo atual: sol no claro e lua no escuro; título e `aria-pressed` mantêm a ação e o estado acessíveis. Um SVG local transforma os dois símbolos por rotação, escala, opacidade e desenho dos raios, em até 500 ms. A referência [Moon to Sun, de Christopher Raeside](https://lottiefiles.com/free-animation/moon-to-sun-8pIVQU59J1) foi inspecionada em vídeo; o movimento foi adaptado ao traço da interface. Não há player Lottie nem redistribuição do asset externo.

A nova paleta se expande em um círculo a partir do centro real do botão, nos dois sentidos, cobrindo toda a viewport em 640 ms. Essa é a interpretação adotada da direção de transição fluida da [referência de Sol Kiernan no Dribbble](https://dribbble.com/shots/23756585-Light-Dark-mode-button-animation); a descrição da página foi acessível, mas a mídia completa dessa referência não pôde ser reproduzida na sessão. `theme-motion.ts` prepara centro/raio em propriedades CSS antes de `document.startViewTransition()`; `theme-motion.scss` aplica máscara e keyframes diretamente a `::view-transition-new(root)`, com `fill-mode: both`. A imagem anterior permanece opaca e as animações padrão do grupo são desativadas. Nenhum elemento da aplicação ou mapa é clonado ou remontado. GSAP permanece nas entradas de tela existentes.

Sem View Transitions, as superfícies recebem interpolação CSS de cores por 420 ms. `prefers-reduced-motion` desativa ambos os movimentos, inclusive quando muda durante uma alternância. Novos cliques guardam somente a última escolha até a transição atual terminar; uma escolha igual ao tema concluído não inicia outro snapshot. A preferência é atualizada imediatamente, evitando inversões por estado antigo. Esse pequeno atraso evita expor a página já atualizada ao interromper uma revelação parcial. Chromium exclui conteúdo capturado do hit-testing durante o snapshot: um listener temporariamente ativo encaminha somente cliques sobre os limites reais do botão ao próprio controle e restaura seu foco. O listener é removido na destruição; nenhum outro controle recebe encaminhamento. Troca do sistema e sincronização entre abas aplicam a paleta diretamente. Scroll, foco, dados e instância do mapa são preservados.

As evidências da entrega inicial estão em [theme-motion-2026-10-11.json](../../evidence/theme-motion-2026-10-11.json), com [estágios desktop/mobile](../../evidence/theme-motion). A correção posterior tem suas próprias [evidências](../../evidence/theme-flash-2026-10-11.json). A suíte de animação agora tem 14 cenários nos dois motores, incluindo máscara antes da entrega de `ready`, preservação dos pixels anteriores no Chromium e agrupamento de cliques sem substituir o snapshot ativo. O pacote inicial atual é 471,87 kB, sem alteração de orçamento ou dependências. As capturas pausadas servem à aparência; não medem fluidez ou desempenho de GPU.

### Correção da piscada — 11/10/2026

O responsável observou uma piscada no Firefox. A implementação inicial desativava a animação CSS padrão e só criava a máscara via JavaScript após `transition.ready`; nesse intervalo, o novo snapshot não tinha recorte. Atrasar essa sinalização reproduziu no Chromium a sequência de tela inteira nova → anterior → revelação. Além disso, interromper uma revelação para iniciar outra expunha imediatamente o DOM já atualizado. A máscara/keyframes CSS desde o primeiro quadro e o agrupamento da última escolha corrigem esses dois caminhos.

O teste de regressão falhou antes do ajuste e passou depois. Os asserts de máscara inicial, preenchimento e opacidade são executados nos dois navegadores. Comparações de pixels durante o snapshot usam Chromium: o backend `drawSnapshot` do Firefox não captura a camada de View Transitions, conforme [Mozilla 2008417](https://bugzilla.mozilla.org/show_bug.cgi?id=2008417). A falha dessa captura foi documentada e os pixels do Firefox foram conferidos na janela própria, via X11, sem usar essa API. Dez estágios nos dois sentidos conservaram a cor anterior em 0/160 ms e a nova em 600 ms/encerramento. Em gravação contínua lossless de 420 amostras a 60/s, quatro cliques normais e seis rápidos produziram somente as seis mudanças esperadas na região de fundo acompanhada, sem inversões extras; os trechos intermediários permaneceram por pelo menos 40 amostras. Tiles dessa verificação são simulados e registros fictícios.

Essa amostragem não cobre cada pixel, GPU ou navegador e não é certificação de fotossensibilidade. A regressão final passou em 76 E2E Chromium/Firefox, além de lint, 56 testes de unidade e build sem avisos. A inicialização sem flash no carregamento, a alternativa CSS e o movimento reduzido continuam preservados.

Evidências finais em [visual-v2-2026-10-11.json](../../evidence/visual-v2-2026-10-11.json). A suíte herdada permanece, com seletores adaptados à navegação e abertura explícita do painel recolhido. A suíte adicional verifica sincronização dos atalhos/indicadores/lista, intervalo e foco, fontes locais, isolamento da v1, larguras 1440/1280/768/390/320 px e redução dinâmica de movimento e consistência dos seletores de comparação.

As capturas para comparação visual ficam em [v2-desktop.png](../../evidence/visual-v2/v2-desktop.png) e [v2-mobile.png](../../evidence/visual-v2/v2-mobile.png). Os mapas nessas capturas usam o provedor raster real; os registros são fictícios. As capturas de testes com tiles simulados ficam em `apps/web/test-results/`, ignorado pelo Git.

Não há backend, conta/autorização, banco ou persistência nova. A avaliação manual em leitor de tela e aparelho físico, R0 e os limites municipais continuam pendentes. O mapa fora de localhost/127.0.0.1 continua sujeito à configuração autorizada do provedor existente. Próxima ação: comparar esta versão com a principal e alinhar qual direção visual será adotada.

## Referências técnicas

- [GSAP: contexto e descarte](https://gsap.com/docs/v3/GSAP/gsap.context/)
- [GSAP: preferências de movimento](https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/)
- [Licença padrão GSAP](https://gsap.com/community/standard-license/), consultada em 11/10/2026; uso desta aplicação está no escopo de interfaces permitido.
- [MDN: início de View Transitions](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition)
- [MDN: animação e pseudoElement](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate)
- [MDN: cancelamento de uma transição](https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition/skipTransition)
- [W3C: modelo de pintura e hit-testing durante View Transitions](https://www.w3.org/TR/css-view-transitions-1/#hit-testing)
