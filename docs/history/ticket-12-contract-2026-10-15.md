# Ticket 12 — contrato local de consulta persistida

Data: 15/10/2026. Fonte integral dos critérios: [issue original](../../.scratch/consulta-coerente/issues/12-consulta-persistida.md). Critérios preservados; esta é somente a primeira etapa retomável do mesmo Ticket 12, não um aceite final.

## Critérios completos e estado

1. **Navegador → Java → PostgreSQL/PostGIS, novas migrações e reinício preservando relações:** pendente de modelo/migração, API e integração.
2. **Somente publicadas, fatos sem coordenadas em lista e clipping sem duplicar fato:** regras registradas no contrato; ainda pendente a verificação do banco/HTTP/navegador.
3. **Filtros, intervalo/fuso, borda espacial real e API indisponível visível:** parâmetros e erros registrados; testes PostGIS/HTTP/navegador ainda pendentes.
4. **Até o Ticket 14, somente desenvolvimento local com dados sintéticos:** decidido explicitamente no contrato e a reforçar em configuração/execução. Sem módulo integrado de produto.
5. **Totais distintos, precisão temporal, entradas inválidas/falhas sem zero válido e fronteira pública sem rascunhos/avaliação interna:** formato e respostas registrados; verificação por HTTP real ainda pendente.
6. **Chromium/Firefox, foco/teclado, carregamento/erro/vazio/mobile e modos `api`, `web`, `planning`:** pendentes da integração e execução final.

## Contrato decidido para este incremento

O endpoint de leitura é `GET /api/v1/occurrences`. Datas são RFC 3339 com fuso e intervalo `[início,fim)`; intervalo incerto semiaberto distingue sobreposição possível de inclusão certa. Coordenadas seguem `[longitude, latitude]`, WGS 84; raio em metros de 100 a 25.000 e borda geodésica inclusiva. Filtros do catálogo se combinam como no lote anterior, com alternativas repetidas em OR e campos diferentes em AND.

A resposta distingue ocorrências, acontecimentos, registros mapeados/apenas em lista e inclusão temporal certa/possível. Referências de publicação ficam em `clippings`, sem multiplicar fatos. Campos privados não fazem parte da resposta; rascunhos são excluídos pela consulta. Entrada inválida retorna 400/`INVALID_QUERY`; indisponibilidade retorna 503/`QUERY_UNAVAILABLE`, nunca zero válido. O detalhe está em [api-query-v1.md](../architecture/api-query-v1.md).

Versões escolhidas pelo executor conforme o ticket: Java 25 local, Spring Boot 4.1.1, Maven Wrapper 3.3.4/Maven 3.9.11 e PostgreSQL 17/PostGIS 3.5. O container disponível respondeu em loopback como PostgreSQL 17.5/PostGIS 3.5.2. Os testes devem usar contêiner PostGIS real.

## Revisão própria e próximos passos

Revisão própria do contrato: mantive o recorte somente leitura local, fixtures inteiramente sintéticas, sem fontes reais, credenciais, publicação, coleta, usuário, autorização ou escrita. Identificadores e campos mínimos acompanham ocorrências/acontecimentos/referências e precisão temporal/espacial do código atual. Nenhum parâmetro operacional além dos limites já existentes no controle de raio foi inventado.

Infraestrutura previamente conferida nesta retomada: Java 25.0.4; Podman rootless 5.8.7 com API Docker compatível acessível via socket; HTTP em `127.0.0.1`; Chromium e Firefox instalados; PostgreSQL/PostGIS real em `127.0.0.1:55432`. Maven de host não está instalado; será usado o Maven Wrapper e Testcontainers com o socket Podman. O teste final ainda não foi iniciado nesta etapa.

Estado: contrato v1 registrado; modelo/migração, API, navegador, testes e aceite completo do Ticket 12 continuam pendentes. Sem revisão independente declarada.
