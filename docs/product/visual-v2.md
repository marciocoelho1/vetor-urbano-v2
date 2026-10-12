# Vetor Urbano 02 — estudo visual

Autorização: 11/10/2026. Esta versão foi solicitada como alternativa visual para comparação, com cópia do repositório em `marciocoelho1/vetor-urbano-v2`. Não decide o visual final da versão principal nem inicia outro marco do produto.

## Origem e requisitos aprovados

- Base: `311875a`, da `main` do repositório `marciocoelho1/vetor-urbano`; histórico, documentação, fixtures, referências originais, ferramentas e vídeo preservados.
- Referência fornecida: `imagemReferenciaVetorUrbano2.png` na raiz da versão principal. Cópia íntegra em [reference.png](../references/ui/v2/reference.png).
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

Navegação horizontal com todas as seis áreas existentes; mapa em largura total; pesquisa acima do mapa; categorias e período em uma barra concisa abaixo dele. Ferramentas completas permanecem em “Filtros avançados”, inicialmente recolhidas no navegador. O intervalo personalizado abre o painel e foca o primeiro campo. Indicadores usam `eventCount()` e `categoryMetrics()`, derivados do mesmo conjunto da lista, inclusive quando vazio. Relatórios têm um acesso direto contextual. Corrigido um problema herdado na apresentação dos seletores de comparação: `ngModel` mantém o valor visível alinhado ao estado consultado quando as opções dinâmicas são criadas e ao retornar à tela; as regras de cálculo permanecem iguais.

O botão Buscar e Enter centralizam o primeiro resultado da pesquisa existente. A lista de sugestões continua disponível para escolher outro resultado; não foi adicionado geocoder, pedido de geolocalização, perfil fictício ou sistema de notificações.

As outras telas recebem a mesma paleta, tipografia e hierarquia. Filtros acumuláveis, período, horário, raio, territórios, POIs, mancha térmica, expansão, lista, detalhes inline, formulário progressivo, exportação, importação, comparação, filtros salvos e triagem continuam locais. As contagens não representam ocorrências reais ou cobertura operacional.

## Código e trade-offs

- `visual-v2.scss`: layout da alternativa visual e seus breakpoints, aplicado pelo componente raiz.
- `controls.scss`: controles compartilhados de mapa, filtros, formulário e resultados, delimitados por `app-root`. `workspace.scss` mantém as visões de consulta/relatório e controles já compartilhados. Essa divisão mantém estilos comuns fora do orçamento por componente, sem aumentar nenhum limite de build.
- `view-motion.ts`: diretiva Angular com GSAP **3.15.0**, carregado por importação dinâmica. Uma entrada curta para título e pesquisa/mapa, com contexto descartado na troca de visão e na destruição. `gsap.matchMedia()` interrompe/reverte movimento quando `prefers-reduced-motion` muda. Uma falha no carregamento de animação deixa o conteúdo utilizável.
- GSAP acrescenta aproximadamente 71 kB brutos em um chunk separado; não entra no pacote inicial. Não foram adicionados plugins de animação ou outra biblioteca de componentes.
- Newsreader e Manrope são WOFF2 locais, com subconjuntos Latin/Latin Extended e `font-display: swap`; somente Latin é pré-carregado. Não há requisição de fontes para Google durante o uso. Origem/licenças em [fonts/README.md](../../apps/web/public/fonts/README.md).
- Chaves de armazenamento `vu2.*` isolam preferências, filtros salvos e triagem da v1. Arquivos abertos continuam somente na memória da aba. Nenhum dado da v1 é migrado ou apagado.
- `npm start` e Playwright usam porta **4201**, para comparar com a v1 em 4200. `origin` da cópia aponta exclusivamente para `vetor-urbano-v2`.
- Angular, MapLibre, Leaflet, contratos, dados geográficos, regras de domínio e suas versões foram preservados. Apenas GSAP foi acrescentado ao lockfile.

## Verificação e limites

### Modo escuro — incremento autorizado em 11/10/2026

O responsável solicitou modo escuro para esta versão. O botão de lua/sol no cabeçalho alterna as paletas, tem área de 44 × 44 px, foco visível e estado acessível por `aria-pressed`. Sem escolha explícita, a interface acompanha `prefers-color-scheme`; após alternar, a preferência `vu2.theme` prevalece, é restaurada ao recarregar e sincronizada entre abas. Armazenamento bloqueado mantém a escolha na aba atual. `theme-init.js`, servido localmente, aplica a paleta antes da inicialização Angular; `theme.ts` acompanha mudanças posteriores e descarta os listeners ao encerrar a aplicação.

`theme.scss` centraliza cores para as duas paletas. O modo escuro usa fundo `#10151b`, superfícies `#181f28`, texto `#e7ecf2` e destaque `#8fd7b6`; navegação, pesquisa, filtros, indicadores, lista, formulários, relatórios, fontes, mensagens e controles/popups dos mapas recebem esses tokens. Newsreader, Manrope e animações existentes permanecem. A cartografia Bright e as cores dos pins/territórios são preservadas para manter a leitura das categorias e a comparação entre consultas; a alternância reaproveita mapa, câmera e dados.

As evidências e capturas deste incremento ficam em [dark-mode-2026-10-11.json](../evidence/dark-mode-2026-10-11.json) e [dark-mode/](../evidence/dark-mode/). Os testes verificam inicialização antes de Angular, preferência do sistema, teclado, recarga, sincronização entre abas, armazenamento bloqueado, seis visões, campos, contraste em amostras CSS e larguras 1024/961/768/390/320 px. Essa amostragem não equivale a uma auditoria completa de acessibilidade. O pacote inicial passou a 466,73 kB, dentro do orçamento existente; nenhuma dependência foi acrescentada.

### Animação de tema — incremento autorizado em 11/10/2026

O botão agora representa o modo atual: sol no claro e lua no escuro; título e `aria-pressed` mantêm a ação e o estado acessíveis. Um SVG local transforma os dois símbolos por rotação, escala, opacidade e desenho dos raios, em até 500 ms. A referência [Moon to Sun, de Christopher Raeside](https://lottiefiles.com/free-animation/moon-to-sun-8pIVQU59J1) foi inspecionada em vídeo; o movimento foi adaptado ao traço da interface. Não há player Lottie nem redistribuição do asset externo.

A nova paleta se expande em um círculo a partir do centro real do botão, nos dois sentidos, cobrindo toda a viewport em 640 ms. Essa é a interpretação adotada da direção de transição fluida da [referência de Sol Kiernan no Dribbble](https://dribbble.com/shots/23756585-Light-Dark-mode-button-animation); a descrição da página foi acessível, mas a mídia completa dessa referência não pôde ser reproduzida na sessão. `theme-motion.ts` usa `document.startViewTransition()` e `Element.animate()` sobre `::view-transition-new(root)`; `theme-motion.scss` mantém as regras globais do SVG e dos snapshots. Nenhum elemento da aplicação ou mapa é clonado ou remontado. GSAP permanece nas entradas de tela existentes.

Sem View Transitions, as superfícies recebem interpolação CSS de cores por 420 ms. `prefers-reduced-motion` desativa ambos os movimentos, inclusive quando muda durante uma alternância. Novos cliques cancelam a transição anterior e a última escolha prevalece; a preferência é atualizada antes do callback adiado, evitando inversões por estado antigo. Chromium exclui conteúdo capturado do hit-testing durante o snapshot: um listener temporariamente ativo encaminha somente cliques sobre os limites reais do botão ao próprio controle e restaura seu foco. O listener é removido na destruição; nenhum outro controle recebe encaminhamento. Troca do sistema e sincronização entre abas aplicam a paleta diretamente. Scroll, foco, dados e instância do mapa são preservados.

Evidências em [theme-motion-2026-10-11.json](../evidence/theme-motion-2026-10-11.json), com [estágios desktop/mobile](../evidence/theme-motion/). Os dez cenários novos de navegador exercitam origem e conclusão da revelação, estados finais do SVG, cliques consecutivos por eventos e por ponteiro real durante o snapshot, mapa/scroll, foco, fallback CSS efetivamente animado e redução dinâmica de movimento. O pacote inicial é 471,37 kB, sem alteração de orçamento ou dependências. As capturas pausam e avançam as animações para comparar aparência; não são medição de fluidez ou desempenho de GPU.

Evidências finais em [visual-v2-2026-10-11.json](../evidence/visual-v2-2026-10-11.json). A suíte herdada permanece, com seletores adaptados à navegação e abertura explícita do painel recolhido. A suíte adicional verifica sincronização dos atalhos/indicadores/lista, intervalo e foco, fontes locais, isolamento da v1, larguras 1440/1280/768/390/320 px e redução dinâmica de movimento e consistência dos seletores de comparação.

As capturas para comparação visual ficam em [v2-desktop.png](../evidence/visual-v2/v2-desktop.png) e [v2-mobile.png](../evidence/visual-v2/v2-mobile.png). Os mapas nessas capturas usam o provedor raster real; os registros são fictícios. As capturas de testes com tiles simulados ficam em `apps/web/test-results/`, ignorado pelo Git.

Não há backend, conta/autorização, banco ou persistência nova. A avaliação manual em leitor de tela e aparelho físico, R0 e os limites municipais continuam pendentes. O mapa fora de localhost/127.0.0.1 continua sujeito à configuração autorizada do provedor existente. Próxima ação: comparar esta versão com a principal e alinhar qual direção visual será adotada.

## Referências técnicas

- [GSAP: contexto e descarte](https://gsap.com/docs/v3/GSAP/gsap.context/)
- [GSAP: preferências de movimento](https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/)
- [Licença padrão GSAP](https://gsap.com/community/standard-license/), consultada em 11/10/2026; uso desta aplicação está no escopo de interfaces permitido.
- [MDN: início de View Transitions](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition)
- [MDN: animação e pseudoElement](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate)
- [MDN: cancelamento de uma transição](https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition/skipTransition)
- [W3C: modelo de pintura e hit-testing durante View Transitions](https://www.w3.org/TR/css-view-transitions-1/#hit-testing)
