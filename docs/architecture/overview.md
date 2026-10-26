# Arquitetura

O Vetor Urbano tem uma aplicação Angular demonstrativa e uma API Java de leitura local. Em `http://127.0.0.1:4201/?consulta=api`, o navegador consulta ocorrências publicadas no PostgreSQL/PostGIS real com migrações e dados sintéticos. A ativação é explícita em loopback; sem o parâmetro, permanece a demonstração com dados locais.

## Fluxo atual

```text
Consulta persistida local (?consulta=api)
    → API Java GET /api/v1/occurrences
    → PostgreSQL/PostGIS + Flyway (dados sintéticos)
    → lista e mapa com precisão preservada

Demonstração sem o parâmetro: dados locais + importações manuais
    → regras no Angular → mapa, lista, indicadores e exportação
```

Mapa e lista compartilham o resultado filtrado. As 75 ocorrências e os dois pontos de interesse são fictícios. Arquivos importados ficam na memória da aba; tema e filtros salvos usam armazenamento local do navegador. A demonstração não executa coleta nem envia o cadastro de ocorrência. A API possui coleta administrativa configurável; isso não autoriza ativá-la nesta rodada ou no piloto. Não há geocodificador externo integrado.

## Frontend

Angular, TypeScript e SCSS compõem a interface. Versões e resoluções ficam em [package.json](../../apps/web/package.json) e [package-lock.json](../../apps/web/package-lock.json). O Node.js usado para verificação está em [.nvmrc](../../.nvmrc).

O componente `App` ainda concentra a navegação e o estado das telas. Regras, fixtures, mapas, troca de dados, tema e diretivas ficam em pastas próprias; os testes acompanham os módulos. Os estilos globais ficam em `src/styles/`. A [estrutura](../development/repository-layout.md) detalha os caminhos.

MapLibre é o renderizador principal. Leaflet recupera ambientes sem WebGL2, renderizadores por software reconhecidos e falhas de inicialização do mapa vetorial. Bibliotecas e CSS são carregados sob demanda. A lista continua como alternativa quando o mapa falha.

Configurações e recursos cartográficos ficam em `public/maps/`: estilo vetorial, provedor raster, sprites, pins e GeoJSON territorial. Atribuição, procedência e limites estão nos [documentos de mapas](../maps/visual-reference.md) e nas [fontes territoriais](../maps/territorial-sources.md).

GSAP anima entradas de tela; a troca de tema usa View Transitions com alternativa CSS. Movimento reduzido desativa as animações correspondentes. Manrope é servida localmente; Newsreader permanece na galeria experimental.

A galeria tem entrada e `tsconfig` próprios em `apps/web/prototypes/`. O build principal começa em `src/main.ts` e não compila os experimentos.

## Convenções de dados

- GeoJSON usa `[longitude, latitude]`, WGS 84; o banco usa SRID 4326.
- Raio é expresso em metros. A demonstração calcula distância no cliente; a consulta persistida usa distância geodésica inclusiva no PostGIS, sem reaplicar a aproximação do cliente.
- Instantes usam UTC; a apresentação usa `America/Sao_Paulo`.
- Localização da ocorrência e identidade de quem informa são conceitos separados.
- Eventos geolocalizados e estatísticas agregadas mantêm unidades e origem próprias.

## Backend local integrado

A API usa Spring Boot 4.1.1, Java 21, PostgreSQL 17/PostGIS 3.5 e Flyway. A fatia do Ticket 12 implementa `GET /api/v1/occurrences`, migração versionada e dados fictícios locais; o navegador consome esse endpoint no modo local explícito, inclusive relações fora do recorte sem alterar as contagens. O código também implementa cadastro/confirmação, recuperação e encerramento de conta, sessões revogáveis, MFA administrativo, fontes, auditoria, correções, revisão/publicação, versões territoriais, coleta configurável, confiabilidade e administração de ocorrências. As migrações atuais vão de V1 a V23; sua presença não prova aplicação em qualquer banco. A V23 introduz o catálogo territorial administrativo (`catalog_datasets`/`catalog_territories`/`catalog_territory_versions`), separado de `territorial_versions` (Áreas de Risco) e servido por `/api/v1/territories` apenas na versão aprovada — decisões e limites no [ADR 0002](../adr/0002-publicacao-territorial-e-reveal.md), consumidas pelo seletor da tela de entrada (`b8c6027`). Cobertura do catálogo é municipal e parcial. Consulte os contratos específicos nesta pasta e as verificações da rodada no plano. Hospedagem, cobertura cartográfica e condições operacionais permanecem pendentes.

Contrato HTTP atual e versões estão no [api-query-v1](api-query-v1.md). O [contrato preliminar P1.1](../archive/architecture/proposal-2026-10.md#5-contrato-preliminar-p11--somente-leitura) e a [especificação de implementação](../archive/planning/implementation-2026-10.md) permanecem referências históricas; não são requisitos para a API atual.

## Verificação e operação

O projeto tem testes unitários e Playwright para Chromium/Firefox. O executor local é `scripts/verify.sh`; ainda não há workflow de CI ou deploy. Build de produção não significa serviço pronto para operação: segurança operacional, cobertura territorial e testes em dispositivos reais continuam pendentes. A persistência de leitura sintética tem verificações HTTP/PostGIS e navegador próprias do Ticket 12.

Consulte o [plano](../../PLAN.md) para resultados atuais e o [guia de operação web](../operations/web.md) para preparar o artefato estático.

## Reconciliação funcional em 15/10/2026

A [spec interna v1.1](../product/specification.md) orienta catálogo, ocorrência/acontecimento, precisão, modos e situações. D01–D13 continuam a descrever intenção de produto. A [proposta local de tickets](../../.scratch/consulta-coerente/README.md) organiza os incrementos. O estado da consulta persistida, evidências e limites está no [plano](../../PLAN.md) e no [checkpoint do Ticket 12](../history/ticket-12-progress-2026-10-15.md); não indica prontidão operacional.
