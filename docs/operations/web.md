# Operação da aplicação web

Este guia descreve o artefato frontend atual. O Vetor Urbano ainda é uma demonstração; não há ambiente de produção ou deploy automatizado configurado.

## Gerar o artefato

Na raiz do repositório, com o Node.js de `.nvmrc`:

```bash
npm ci --prefix apps/web
bash scripts/verify.sh web
```

O build otimizado fica em **`apps/web/dist/web/browser/`**. Esse diretório é o artefato para um servidor de arquivos estáticos. `npm start` inicia o servidor de desenvolvimento; não é o comando de hospedagem.

O frontend usa caminhos absolutos para mapas e fontes. A configuração atual espera publicação na raiz do domínio; hospedagem em subdiretório exige ajustar esses caminhos e validar o build. O servidor deve resolver a entrada da aplicação e servir JS, CSS, WOFF2, TTF e GeoJSON com seus tipos de conteúdo corretos.

Além dos WOFF2 da interface, `apps/web/public/fonts/manrope-pdf-regular.ttf` é a derivação estática usada somente para incorporar a fonte no PDF exportado; origem, licença e limites permanecem no [README do diretório](../../apps/web/public/fonts/README.md) e a derivação é reproduzível por `scripts/prepare-pdf-font.py`. Servi-la exige o tipo `font/ttf` correto, com o mesmo cuidado de cache dos demais assets.

## Configuração cartográfica

| Arquivo | Uso |
|---|---|
| `apps/web/public/maps/urban-style.json` | Estilo, fontes e tiles do mapa vetorial |
| `apps/web/public/maps/raster-provider.json` | URL, atribuição e limites do fallback Leaflet |
| `apps/web/public/maps/areas-territoriais.geojson` | Camada territorial estática com proveniência documentada |

A configuração atual do Stadia Maps permite desenvolvimento local em `localhost`/`127.0.0.1`. Antes de usar outro domínio, configure a autorização apropriada do provedor e revise termos, limites e atribuição descritos em [visual-reference.md](../maps/visual-reference.md). As duas bases precisam estar disponíveis, inclusive durante recuperação do mapa.

Tudo em `public/` e no bundle é acessível ao navegador. Credenciais de servidor ficam fora do frontend; uma chave de cliente eventualmente exigida pelo provedor precisa de restrições próprias de domínio e uso.

## Antes de liberar uma versão

Execute lint, testes unitários, build e a matriz Playwright em Chromium/Firefox. No host escolhido, confira carregamento de mapas, fontes e sprites; alternância de temas; fluxo de consulta/cadastro; teclado e apresentação móvel. Mantenha o aviso de demonstração enquanto houver dados fictícios.

O build atual ultrapassa o aviso de orçamento inicial de 500 kB em 2,64 kB. Há dois problemas de navegador registrados: tema local no mapa vetorial do cadastro e largura do cadastro a 320 px. Eles permanecem no [plano](../../PLAN.md), junto do QA em aparelho físico e leitor de tela.

Hospedagem da demonstração e liberação operacional são etapas diferentes. Uma versão operacional depende de API/banco, autorização, moderação, políticas de dados, cobertura e recuperação verificadas. Commit e push não publicam a aplicação.
