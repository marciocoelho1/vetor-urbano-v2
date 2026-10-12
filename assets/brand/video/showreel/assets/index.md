# Procedência dos ativos

Registro: 12/10/2026. Todos os ativos usados pelo filme ficam neste projeto; a reprodução da composição não precisa de rede para carregar fontes, áudio ou GSAP.

| Ativo | Origem e licença | Uso e limitação |
|---|---|---|
| `fonts/manrope-*.woff2` | Cópia idêntica de `apps/web/public/fonts/`; Manrope Project Authors, SIL OFL 1.1 em `fonts/manrope-OFL.txt`. Origem original: [Google Fonts / Manrope](https://github.com/google/fonts/tree/main/ofl/manrope). | Família variável aprovada na v2. Fontes não modificadas. |
| `fonts/newsreader-*.woff2` | Cópia idêntica de `apps/web/public/fonts/`; Production Type, SIL OFL 1.1 em `fonts/newsreader-OFL.txt`. Origem original: [Google Fonts / Newsreader](https://github.com/google/fonts/tree/main/ofl/newsreader). | Serif aprovada na v2. Fontes não modificadas. |
| `gsap.min.js` | GSAP 3.15.0 copiado do pacote já instalado em `apps/web/node_modules/gsap/dist/`; aviso de copyright preservado no cabeçalho. [Licença oficial](https://gsap.com/community/standard-license/), consultada em 12/10/2026. | Runtime local. Não se incorpora licença MIT fictícia. |
| `MotionPathPlugin.min.js` | GSAP MotionPathPlugin 3.15.0, congelado do pacote `gsap@3.15.0/dist/MotionPathPlugin.min.js` em jsDelivr em 12/10/2026. Cabeçalho original preservado; mesma licença GSAP. | Trajetória do único ponto condutor. Não faz requisições durante preview/render. |
| `audio/vetor-urbano-original.wav` | Síntese original por `tools/make_soundtrack.py`, com Python padrão e seed 1282026. Sem amostras externas. Metadados em `audio/metadata.json`. | 15 s, 128 BPM, estéreo PCM 16 bit/48 kHz; plucks, pads, baixo, percussão e transições. Sem voz/áudio da referência. |
| SVG, caminhos e planos da composição | Geometria autoral escrita para esta peça; mecanismos do catálogo HyperFrames têm origem registrada em `catalog-searches.json` e `registry-reference/README.md`, com licença Apache 2.0 preservada em `registry-reference/LICENSE`. | Diagramas abstratos. Nenhuma geometria territorial, ocorrência real ou estatística operacional. |
| Marca Vetor Urbano | Nome do projeto e SVG existente em `apps/web/src/app/app.html`, `viewBox="0 0 32 38"`, caminho `M3 11 12 3h5v31h-6L2 15m14 19h4L30 8`. | Reaproveitado na assinatura; a composição não redefine o logotipo da aplicação. |

## Referências de direção, sem incorporação de mídia

- MP4 fornecido pelo usuário: `ssstwitter.com_1791837741253.mp4`. Inspecionado em folha com 15 quadros. Tem 1920 × 1080, 60 fps e aproximadamente 15,061 s. Não se presume licença de redistribuição; não é copiado para a entrega e nenhum trecho/áudio é utilizado.
- [Bold typographic motion showreel, Prompt Motion](https://prompt-motion.com/motiondsgnr-9dcfa6) e [Easing and morphing showreel, Prompt Motion](https://prompt-motion.com/roundtablespace-d3a1be): referências de ritmo, tipografia e transformação de formas. A biblioteca informa que os vídeos pertencem aos respectivos criadores. Não foram importados vídeos, marcas ou prompts como código.

Fontes originais do repositório e vídeo anterior preservados. As cores partem dos tokens atuais de `apps/web/src/app/theme.scss`; o desenho não apresenta cobertura validada nem aconselhamento de segurança.
