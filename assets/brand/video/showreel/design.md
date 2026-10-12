# Vetor Urbano — A cidade, em perspectiva

Peça autoral de motion graphics de 15 segundos, 1920 × 1080, 60 fps, português brasileiro, sem narração. O filme apresenta o valor de organizar a leitura da cidade sem afirmar cobertura, monitoramento, alertas ou tempo real. A abertura surpreende pela escala tipográfica; o meio mostra distância, categorias e período; o fim respira e assina a marca.

## Direção e referência

A referência local foi vista no contact sheet `/tmp/vetor-motion-reference/contact.jpg`. Ela combina fundo claro, texto preto, contraste de famílias tipográficas, um verde vivaz e pequenos planos em perspectiva. Esses princípios orientam a peça; não se reutilizam marca, texto, áudio, interface ou animação quadro a quadro do vídeo original.

O motivo dominante é **um vetor verde que nasce de um ponto e encontra contexto**. A linha não funciona como decoração isolada: conecta palavra, mapa, raio e assinatura. A câmera varia os verbos: pequeno recuo editorial, mergulho em um plano cartográfico, giro para frente, retirada do ruído e repouso final. Isso cria um reel coeso e evita uma sucessão de caixas flutuantes. A assinatura reutiliza o símbolo SVG existente em `apps/web/src/app/app.html` (`viewBox="0 0 32 38"`, caminho `M3 11 12 3h5v31h-6L2 15m14 19h4L30 8`), sem criar uma marca alternativa.

A seriedade vem de poucos elementos, contraste, linguagem factual e movimentos que assentam. A leveza vem de uma página aberta, da curva verde e do contraste Manrope/Newsreader. Não usar glitch, sirenes, vermelho de alerta, flashes, sacudidas de câmera ou bounce cartunesco. A referência permite elasticidade visual, mas aqui a maioria das entradas usa `power4.out` ou `power3.out`, com pequena antecipação e desaceleração longa. Câmera nunca usa elastic/back.

## Fontes e paleta

Usar os WOFF2 aprovados da v2, congelados em `apps/web/public/fonts/`:

- Manrope, pesos variáveis 400–700: mensagens claras, filtros e marca.
- Newsreader, pesos 400–600: verbos e benefício, tamanho editorial.
- Latin e Latin Extended quando preciso; nenhuma chamada a Google Fonts em execução.
- Os arquivos locais não exigem novo itálico. O contraste de Newsreader regular com Manrope entrega o caráter editorial sem alterar fontes existentes.

Tokens reais consultados em `docs/product/visual-v2.md`: fundo `#f7f8fa`, texto `#252c36`, seleção `#24765b`, fundo escuro `#10151b`, mint `#8fd7b6`, divisórias `#dde1e6`. A peça acrescenta papel aquecido `#f4f1ea` em abertura e assinatura, como adaptação reversível à atmosfera da referência. Não é mudança do tema da aplicação.

A área principal segue margem segura de 150 px nas laterais e 100 px em cima/baixo. Títulos entre 132 e 196 px; labels de filtros entre 28 e 32 px; avisos entre 24 e 26 px. Notícias e rótulos precisam ficar nítidos em um downscale 960 × 540. As palavras devem assentar antes do próximo gesto; efeitos não podem mascarar o texto durante o hold.

## Sequência

| Tempo | Texto/ação | Movimento e leitura |
|---|---|---|
| 0–2,34375 s | **A cidade acontece.** | Ponto verde nasce em até 0,15 s. “A cidade” entra com máscara; “acontece.” é o maior elemento. Linha desenha sublinhado e conduz o olhar à direita. Leitura completa em 0,72 s. |
| 2,34375–4,6875 s | **Entenda o que muda.** | Match cut no ponto; composição assimétrica. Newsreader lidera, Manrope responde. Um arco fino prepara o giro em profundidade. Leitura assentada em 2,93 s. |
| 4,6875–7,03125 s | **Localização** + **1.000 m** | Um único plano cartográfico abstrato cresce do vetor em perspectiva e gira de 48° para 16°. Rotas aparecem, pontos fictícios se assentam e um raio delimita o entorno. Labels permanecem no plano da tela. |
| 7,03125–9,375 s | **Categoria · Período** | Mesma cartografia quase frontal. Trânsito, Segurança, Contingência entram como um conjunto. Trânsito organiza a seleção de pontos; “Últimos 7 dias” e uma régua curta mostram tempo. Nada de números de ocorrências. |
| 9,375–12,1875 s | **Menos ruído. Mais contexto.** | Pontos se alinham em vetor; ele cobre a tela e abre um capítulo escuro. Primeira linha Manrope clara; segunda Newsreader mint. Sublinhado conduz à assinatura. Hold de mais de 1,3 s. |
| 12,1875–15 s | **Vetor Urbano** / **A cidade, em perspectiva.** | Abertura diagonal de papel guiada pelo vetor. Símbolo derivado de vias e nome assentam; tagline chega. Tudo fica estático desde 13,65 s, para memória da marca. Rodapé: “Protótipo demonstrativo”. |

A grade instrumental é 128 BPM: uma batida a cada 0,46875 s, 32 batidas no filme inteiro. Os seis capítulos começam em beats 0, 5, 10, 15, 20 e 26. A narrativa não depende de o som estar ligado. A trilha original deve ter acentos leves nesses pontos e cair para um fechamento confortável; nenhuma referência sonora comercial será copiada.

## Cartografia abstrata e produto

O projeto atual é um protótipo local com mapa/lista, categorias, período e raio. O filme representa somente esse núcleo. Nenhuma animação implica publicação de ocorrência, API, alertas automáticos, app móvel nativo, geolocalização de quem informa ou atualização em tempo real.

Desenhar um SVG autoral com 10–16 trajetórias, poucas quadras e um recorte orgânico suave. Ele deve evocar uma estrutura urbana, sem contorno identificável de município, nomes de bairro ou polígono de presença criminal. Não usar basemap nem fonte externa. Posicionar 18–24 pontos determinísticos de três categorias. A seleção atenua o conjunto não correspondente, sem números que pareçam estatística real.

Durante toda a cartografia, manter “Visualização demonstrativa · dados fictícios” em 26 px no rodapé. “1.000 m” representa uma opção demonstrativa de raio existente. “Últimos 7 dias” representa um filtro, não uma promessa de eventos ou intervalo com dados reais. A assinatura mantém “Protótipo demonstrativo”.

O mapa existe num único plano visual sem janela, smartphone ou excesso de bordas. Um plano de papel cartográfico em perspectiva é aceitável, com sombra muito suave. Os filtros são tags/labels do próprio espaço, não uma sequência de cards grandes. A dinâmica precisa vir da relação entre pontos, linha e câmera.

## Reuso e lacunas

O catálogo HyperFrames foi consultado em inglês antes do desenho para tipografia editorial, cartografia abstrata, perspectiva, line draw e fechamento de marca. Resultados principais:

- `caption-editorial-emphasis`: sistema dual-font; adaptar conteúdo, fontes, cores e timing.
- `ui-3d-reveal`: mecanismo de plano em perspectiva; substituir completamente o UI de exemplo por nosso SVG.
- `arc-motion-path`: viagem do ponto sobre trajetória autoral.
- `marker-highlight`: traço de ênfase; adaptar para linha verde limpa, sem grunge/boil.
- `logo-brand-close`: assentamento final da marca; remover URL/CTA/pill.

A consulta de mapas retorna principalmente EUA/mundo/Espanha e conexões territoriais. Essa geometria é inadequada ao universo local e à intenção abstrata. Por isso a topologia autoral é uma lacuna documentada, junto do gesto dos pontos se alinhando no vetor. Não enviar relatórios de feedback público: o responsável não autorizou mensagens externas.

Reuso significa instalar o source via catálogo e adaptar o mecanismo, não expor o exemplo padrão no filme. Registrar itens usados no ledger. Usar as regras `waterfall-entry`, `svg-path-draw`, `3d-camera-flight` e `spring-pop-entrance` (modo suave sem overshoot). O IR em `shot-plan.json` contém poses, tempos e papel de cada item.

## Orientações ao Builder

1. Leia `shot-plan.json`, o contrato de Builder e o core HyperFrames. Construa seis cenas/subcomposições editáveis, root de 15 s, áudio separado e registro `window.__timelines`. O framework controla clips; GSAP controla wrappers internos.
2. Copie apenas fontes locais e runtime GSAP local; nenhuma fonte, asset ou fetch remoto durante render. Aguarde fontes antes de registrar a timeline, mas mantenha inicialização determinística.
3. Instale/adapte os itens do catálogo e preserve as origens. Quando um item não for compatível com reprodução local ou não entregar o gesto necessário, documente o motivo e use a regra correspondente.
4. Faça a cartografia em um único `.world` com `preserve-3d` limpo, perspectiva estática de aproximadamente 1.300 px, sem filtro/overflow/opacity no wrapper 3D. Sombras e fade em folhas. Texto que precisa ser lido permanece na tela, fora desse mundo.
5. O vetor pode existir em SVGs distintos por capítulo; o match cut preserva endpoint/cor/espessura/velocidade. Meça `getTotalLength()` uma vez na montagem para draws. Nunca use números aleatórios ou relógio de parede.
6. Use entradas 0,35–0,55 s para frases, 0,20–0,35 s para labels; manter palavras ≥1 s depois de assentarem. Dentro do mapa, uso de 3D é expressão, e a fase de leitura é próxima do plano frontal.
7. Bloqueie o lockup em 13,65 s. Não terminar ainda movendo/pendendo/pulsando marca. O vídeo deve acabar em um quadro deliberado, sem fade preto final.
8. Renderize 15,000 s, 900 frames, H.264/AAC, 1920 × 1080 a 60 fps. Inspecione os seis holds, todos os seams e primeiro/último frame. Verifique versão final editável junto do render.

## Escolha do framework

**HyperFrames com GSAP** é a escolha. A peça tem tipografia, SVG, perspectivas CSS e um único filme autoral; a timeline pausada torna cada quadro reproduzível, e o catálogo evita reconstruir primitivas. Remotion seria uma opção forte para séries de vídeos parametrizados em React; aqui criaria uma segunda aplicação sem vantagem proporcional.

A compensação é obedecer rigorosamente ao contrato de seek e aos limites do compositor CSS. O resultado final precisa guardar fontes editáveis e validação local, porque o vídeo anterior do repositório tem render preservado, mas fontes finais ausentes. O novo projeto não altera esse material antigo.

## Critérios de aceite visual

O hook deve ser identificável até 0,5 s; a peça deve chamar atenção em silêncio. A linha-vetor precisa conectar pelo menos quatro capítulos, o mapa deve ser uma coreografia contínua e a frase de benefício deve ser o clímax. O vídeo deve mostrar contraste de tamanho, rotação/câmera com propósito, timing variado e hold final deliberado. Não pode parecer slideshow de cards.

Passam somente versões sem erros de lint/check, sem crop acidental do texto, sem frames vazios nos seams, com avisos fictícios legíveis e sem capacidade do produto inventada. Isso não certifica acessibilidade do vídeo; assegura as condições observáveis de leitura descritas. Manter MP4 e fontes anteriores intocados.
