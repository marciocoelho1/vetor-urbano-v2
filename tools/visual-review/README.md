# Revisão visual

Os scripts capturam a aplicação local com Chromium/Playwright e tiles raster reais. Exigem as dependências web, navegador instalado e servidor Angular ativo.

Na raiz do repositório:

```bash
npm start --prefix apps/web
```

Em outro terminal, escolha a revisão:

| Comando | Captura | Saída local padrão |
|---|---|---|
| `node tools/visual-review/capture.mjs` | Mapa desktop/mobile e demais telas | `apps/web/test-results/visual-review/light/` |
| `VU_PREVIEW_THEME=dark node tools/visual-review/capture.mjs` | Mesmas telas no tema escuro | `apps/web/test-results/visual-review/dark/` |
| `node tools/visual-review/capture-motion.mjs` | Estágios da troca de tema e botão | `apps/web/test-results/theme-motion/` |
| `node tools/visual-review/capture-ui-ux-gallery.mjs` | Alternativas da galeria, com servidor 4210 | `apps/web/test-results/ui-ux-gallery/` |

A galeria exige `npm run prototype:ui --prefix apps/web`. Os dois scripts da aplicação aceitam `VU_PREVIEW_URL` para outro endereço; o padrão é `http://127.0.0.1:4201`.

`VU_CAPTURE_DIR` escolhe o destino em qualquer um dos scripts. Use um diretório datado em `docs/evidence/` quando quiser preservar uma revisão no Git; as saídas padrão são ignoradas e mantêm os registros históricos intactos.

As capturas documentam aparência. A suíte E2E verifica fluxos e estados de falha; captura de tela não comprova FPS, acessibilidade com leitor de tela ou disponibilidade do provedor.
