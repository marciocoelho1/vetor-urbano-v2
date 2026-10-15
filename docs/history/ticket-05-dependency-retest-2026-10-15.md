# Ticket 05 — reteste de dependência

Data: 15/10/2026. Fonte de critérios: [issue original](../../.scratch/consulta-coerente/issues/05-territorio-mapa-lista.md). O registro mantém os critérios originais; este reteste corrige apenas o oráculo E2E que confundia pins individuais renderizados na janela com o conjunto completo de registros mapeados.

## Critérios e evidências atuais

1. **Município/bairro, câmera e aplicação explícita:** selecionar Rio de Janeiro e Setor demonstrativo mantém os filtros; uma referência fictícia move só a câmera; pan/zoom não altera a lista; “Usar área visível” aplica o recorte apenas após ação explícita. Os detalhes abertos permanecem acessíveis. Verificado em Leaflet/Chromium e Firefox.
2. **Precisão territorial, lista e contagens:** as duas ocorrências sem coordenadas permanecem somente na lista. O E2E compara os IDs mapeados com a coleção GeoJSON produzida para o mapa e verifica a contagem exata de mapeadas/apenas em lista antes, durante e depois do recorte. Raio, calor e recorte visível não incluem uma localização territorial sem sustentação; o raio é removido antes da jornada de área visível. Verificado em Chromium/Firefox; o segundo fluxo usa MapLibre real.
3. **Referência fora da cobertura sintética:** “Fora do recorte” informa que está fora da cobertura sintética, mantém os resultados e oferece retorno ao recorte demonstrativo, sem declarar limites metropolitanos oficiais. Verificado em Chromium/Firefox.
4. **Renderizadores, lista e falha cartográfica:** o fluxo de área visível passa por Leaflet e MapLibre; a lista conserva contagem/detalhes e a alternativa de lista é apresentada em 390 px sem overflow horizontal. A retenção da lista após falha/retry cartográfico foi verificada na suíte atual do Ticket 10 (12/12 em Chromium/Firefox). Não houve QA em dispositivo físico.
5. **Comandos e limitações:** `bash scripts/verify.sh web` passou com lint, 85 testes unitários e build de 600,60 kB; aviso do bundle excedendo o limite de 500 kB em 100,60 kB. `bash scripts/verify.sh planning` passou com 198 links locais. `git diff --check` passou. Playwright direcionado passou 4/4 em Chromium/Firefox.

## Reteste e revisão própria

A asserção antiga `#map-canvas .occurrence-pin == quantidade de registros mapeados` falhou: Chromium renderizou 3 pins individuais e Firefox 2, pois agrupamento/recorte da janela não representam um marcador DOM por registro. Ela foi substituída por uma comparação entre os IDs elegíveis do modelo visível e os IDs da coleção GeoJSON preparada para o mapa, junto com as contagens apresentadas à pessoa usuária. Uma tentativa de ler o campo interno `_data.features` do MapLibre não foi compatível com os objetos observados no Chromium/Firefox; foi removida em favor da coleção gerada pela própria integração do mapa. A jornada real no MapLibre permaneceu ativa e passou.

Revisão própria do diff: a correção altera somente o teste E2E. Mantém seleção territorial, câmera, aplicação/remoção de área, referências fora do recorte, detalhes, raio, calor, ambos renderizadores e apresentação móvel; não altera critérios nem código de produto. O mapa real terminou sem `pageerror` e sem estado de fallback.

Comandos finais: `npx playwright test e2e/territory-query.spec.ts --project=chromium --project=firefox --workers=1` — 4/4 passaram; `bash scripts/verify.sh web` — lint, 85 testes unitários e build passaram, bundle 600,60 kB (aviso +100,60 kB); `bash scripts/verify.sh planning` — 198 links passaram; `git diff --check` passou. As capturas móveis de 390 px foram conferidas visualmente; a lista permaneceu selecionada e a página não teve overflow horizontal.

Estado: pré-requisito 05 do Ticket 12 implementado e verificado localmente nesta retomada. O teste corrigido e este registro foram isolados para commit. Nenhum limite oficial, geocodificador ou dado real foi introduzido.
