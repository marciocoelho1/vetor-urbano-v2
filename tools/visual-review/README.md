# Capturas para comparação visual

Inicie a demonstração com `npm start --prefix apps/web`. Em outro terminal, a partir da raiz, execute:

```bash
node tools/visual-review/capture.mjs
```

Exige as dependências de `apps/web` e Chromium instalado pelo Playwright. Não altera dados, intercepta tiles ou publica a aplicação. Escolhe Leaflet somente para obter a mesma base raster real em cada captura, aguarda os tiles/fontes/animações e registra mapa desktop/mobile e as cinco outras visões em `docs/evidence/visual-v2/`.

`VU_PREVIEW_URL` permite mudar o endereço local (padrão `http://127.0.0.1:4201`). As capturas são evidências de renderização, não garantia de disponibilidade do provedor ou auditoria com leitor de tela. Use a suíte E2E para os fluxos e estados de erro, pois este script serve à comparação visual.

O tema padrão da captura é claro. Para gerar a paleta escura em `docs/evidence/dark-mode/`, preservando as capturas claras:

```bash
VU_PREVIEW_THEME=dark node tools/visual-review/capture.mjs
```
