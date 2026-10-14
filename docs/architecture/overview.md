# Arquitetura

O Vetor Urbano tem hoje uma aplicação Angular executada no navegador. Dados e regras funcionam localmente; não existe serviço Java ou banco de dados integrado.

## Fluxo atual

```text
Dados demonstrativos + importações manuais
    → estado e regras de consulta no Angular
    → mapa, lista, indicadores e exportação
```

Mapa e lista compartilham o resultado filtrado. As 75 ocorrências e os dois pontos de interesse são fictícios. Arquivos importados ficam na memória da aba; tema e filtros salvos usam armazenamento local do navegador. Não há coleta automática, geocodificação real ou envio do cadastro.

## Frontend

Angular, TypeScript e SCSS compõem a interface. Versões e resoluções ficam em [package.json](../../apps/web/package.json) e [package-lock.json](../../apps/web/package-lock.json). O Node.js usado para verificação está em [.nvmrc](../../.nvmrc).

O componente `App` ainda concentra a navegação e o estado das telas. Regras, fixtures, mapas, troca de dados, tema e diretivas ficam em pastas próprias; os testes acompanham os módulos. Os estilos globais ficam em `src/styles/`. A [estrutura](../development/repository-layout.md) detalha os caminhos.

MapLibre é o renderizador principal. Leaflet recupera ambientes sem WebGL2, renderizadores por software reconhecidos e falhas de inicialização do mapa vetorial. Bibliotecas e CSS são carregados sob demanda. A lista continua como alternativa quando o mapa falha.

Configurações e recursos cartográficos ficam em `public/maps/`: estilo vetorial, provedor raster, sprites, pins e GeoJSON territorial. Atribuição, procedência e limites estão nos [documentos de mapas](../maps/visual-reference.md) e nas [fontes territoriais](../maps/territorial-sources.md).

GSAP anima entradas de tela; a troca de tema usa View Transitions com alternativa CSS. Movimento reduzido desativa as animações correspondentes. Manrope é servida localmente; Newsreader permanece na galeria experimental.

A galeria tem entrada e `tsconfig` próprios em `apps/web/prototypes/`. O build principal começa em `src/main.ts` e não compila os experimentos.

## Convenções de dados

- GeoJSON usa `[longitude, latitude]`, WGS 84; a proposta de banco usa SRID 4326.
- Raio é expresso em metros. A demonstração calcula distância no cliente; o backend deverá validar consultas espaciais com PostGIS.
- Instantes usam UTC; a apresentação usa `America/Sao_Paulo`.
- Localização da ocorrência e identidade de quem informa são conceitos separados.
- Eventos geolocalizados e estatísticas agregadas mantêm unidades e origem próprias.

## Backend previsto

A direção proposta é um serviço Spring Boot, com pacotes por funcionalidade, API HTTP JSON, PostgreSQL/PostGIS e migrações versionadas. A primeira integração deverá demonstrar leitura persistida com testes no banco real. Cadastro, autorização, sessões, MFA e moderação entram após a definição das regras de acesso.

Versões Java/Spring/PostgreSQL, catálogos e contrato HTTP ainda precisam de decisão. O [contrato preliminar P1.1](../archive/architecture/proposal-2026-10.md#5-contrato-preliminar-p11--somente-leitura) e a [especificação de implementação](../archive/planning/implementation-2026-10.md) são propostas preservadas para reconciliação em R0, sem endpoints ativos.

## Verificação e operação

O projeto tem testes unitários e Playwright para Chromium/Firefox. O executor local é `scripts/verify.sh`; ainda não há workflow de CI ou deploy. Build de produção não significa serviço pronto para operação: persistência, segurança, cobertura territorial e testes em dispositivos reais continuam pendentes.

Consulte o [plano](../../PLAN.md) para resultados atuais e o [guia de operação web](../operations/web.md) para preparar o artefato estático.
