# Vetor Urbano — A cidade, em perspectiva

Motion graphics de 15 segundos para a marca, em Full HD horizontal a 60 fps, com trilha instrumental original. Conceito: um ponto vira vetor, mapa, contexto e assinatura. A inspiração vem do MP4 fornecido e da biblioteca [Prompt Motion](https://prompt-motion.com/templates/showreel), preservando as fontes e os verdes da versão visual 02.

O mapa é um diagrama autoral e os dados são fictícios. A peça apresenta o protótipo e sua proposta de consulta, sem afirmar cobertura operacional, alertas ou tempo real.

## Arquivos

- `index.html`: composição principal editável, com geometria SVG, estilos e timeline GSAP pausada.
- `BRIEF.md`, `design.md`, `shot-plan.json`: pedido, decisões e tempos de direção; são documentação da peça, não um roadmap concorrente do produto.
- `assets/`: fontes, runtime e áudio locais; procedência em `assets/index.md`.
- `tools/make_soundtrack.py`: fonte reproduzível da música e dos acentos de transição.
- `renders/vetor-urbano-showreel-15s.mp4`: entrega final.
- `renders/verification.json`, `renders/ffprobe.json`, `verification.md`: evidências do arquivo e da composição.

## Reprodução e edição

Requisitos: Node.js 22+, npm, FFmpeg/FFprobe, navegador Chromium suportado pelo HyperFrames; Python 3 para regenerar/verificar o áudio/arquivo. Docker, credenciais e serviços pagos não fazem parte da produção local. O CLI fica fixado em 0.8.150. Assets são locais; o npm pode precisar de rede para baixar o CLI quando ainda não estiver em cache.

Execute dentro deste diretório:

```bash
npm run dev -- --background
npm run check
npm run soundtrack
npm run render
npm run verify:output
```

O comando de render usa 60 fps e qualidade de entrega; alterar `data-duration` na composição altera o comprimento, portanto mantenha 15 para reproduzir esta versão. A música de 128 BPM usa 32 batidas em 15 segundos. Depois de editar, conferir snapshots e o resultado visual além de executar o check. O script de saída falha se duração, dimensões, FPS, codecs, áudio estéreo ou os 900 quadros não corresponderem à entrega.

Os arquivos antigos em `assets/brand/video/` permanecem independentes. Este projeto guarda a nova fonte final; não reconstrói a composição ausente do vídeo anterior.
