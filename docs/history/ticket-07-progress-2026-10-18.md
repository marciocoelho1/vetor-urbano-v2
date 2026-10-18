# Ticket 07 — aceite de agrupamentos e estados do mapa (18/10/2026)

## Baseline e preservação

- Baseline deste incremento: branch `integration/functional-spec-v1`, HEAD `7633fc674c2162299421328b02aa683e1acaf3ca` (commit do ticket 11).
- A árvore rastreada estava limpa antes da edição. O não rastreado preexistente `docs/product/tickets-checklist.html` permaneceu intacto e fora do trabalho.
- Issue: `.scratch/consulta-coerente/issues/07-agrupamentos-sobreposicoes.md`; histórico anterior: `docs/history/ticket-07-resume-2026-10-15.md`.
- Nenhum comportamento visual nem coordenada foi alterado. Além da cobertura E2E, foi acrescentado somente o atributo DOM não visual `data-cluster-members` em clusters Leaflet para permitir prova de identidade; sessão, mapa, tiles e registros são sintéticos locais.

## Oráculo e cobertura adicionada

O baseline dos testes apenas exigia `point_count > 1` e a verificação de POI consultava o campo privado `source._data`; a sonda mostrou que esse campo não fornecia o GeoJSON carregado (`0`), tornando a asserção de exclusão ineficaz. A seleção de ocorrências mapeáveis agora usa um único predicado compartilhado e prova que os 17 IDs do modelo são únicos. MapLibre compara folhas reais (`getClusterLeaves`) com IDs esperados; Leaflet expõe `data-cluster-members` como atributo DOM não visual e verifica contagem de cada grupo, ausência de duplicatas e partição exata dos IDs entre clusters e marcadores individuais. Pins visíveis não são usados como total.

- **MapLibre:** 17 ocorrências mapeáveis no recorte; clusters renderizados no viewport com contagens exatas **2, 3, 4 e 7** e IDs de folha esperados; 16 ocorrências estão nesses clusters visíveis, sem presumir que o viewport contenha todos os pins. As folhas são únicas, pertencem ao modelo de ocorrências e não incluem POIs/polígonos.
- **Leaflet:** 17 ocorrências mapeáveis e IDs únicos; grupos exatos **2, 2, 3 e 3**, mais 7 ocorrências individuais. A união dos IDs dos clusters e marcadores individuais corresponde exatamente, sem repetição, ao conjunto de 17 IDs do modelo.
- O estado vazio é obrigatório na Lista móvel de 390 px: seleciona o município sintético Belford Roxo, sem ocorrências no recorte atual, exige lista vazia e mensagem acessível, limpa o filtro e recupera a seleção.
- Em cada motor, durante carregamento a Lista seleciona `demo-002` com Enter; durante erro, seleciona o mesmo item com clique, mantém o total 17, oferece retry acessível e recupera o mapa. No caso MapLibre, a recuperação usa o fallback Leaflet após a falha do estilo e dos tiles sintéticos.
- Coordenadas coincidentes e teste de seleção existente foram preservados. O aceite mantém identidade, total, coordenadas, teclado, foco, lista e 390 px.

## RED/GREEN e verificações

- Diagnóstico direcionado de clusters, após expor os membros Leaflet: `npm run test:e2e -- --project=chromium --project=firefox --workers=2 --grep "afastar o mapa exibe agrupamentos" e2e/clustering-and-overlap.spec.ts`: **4/4 passaram**.
- TDD da identidade Leaflet: a asserção nova ficou vermelha em 2/4 (Leaflet não expunha IDs; MapLibre passou); a adição de `data-cluster-members` tornou o oráculo verde. Os dois primeiros comandos completos anteriores ficaram 12/16 por setup desatualizado do vazio (toggle de mapa oculto e placeholder legado); o vazio foi então exercitado pelo filtro municipal na Lista móvel sem condicional.
- Foco de carga/erro: `npm run test:e2e -- --project=chromium --project=firefox --workers=2 --grep "está carregando|mostra erro" e2e/clustering-and-overlap.spec.ts`: **8/8 passaram**, incluindo seleção via teclado durante carga e clique durante erro.
- Comando de aceite exigido, após as correções de revisão: `npm run test:e2e -- --project=chromium --project=firefox --workers=2 e2e/clustering-and-overlap.spec.ts`: **16/16 passaram**; inclui clusters, vazio móvel, seleção por lista em carga/erro e pins coincidentes.
- `bash scripts/verify.sh web`: final run passou; Prettier, **16 arquivos de teste / 124 testes unitários**, build concluído. Uma execução intermediária foi interrompida pelo Prettier no novo hunk e ficou verde após o ajuste. Avisos não bloqueantes: bundle inicial **797,72 kB**, acima do orçamento de 500 kB em **297,72 kB**, e CommonJS `pako` via `@pdf-lib/fontkit`.
- `bash scripts/verify.sh planning`: passou com **429 links locais**; âncoras e URLs externas não são verificadas. `git diff --check`: passou.
- `bash scripts/verify.sh api` não foi executado: este incremento é web-only e não alterou API nem banco.
- Não foi reexecutada separadamente a bateria histórica de seleção com `--repeat-each=2` (16/16 em duas repetições); o comando obrigatório executou uma vez o arquivo completo, incluindo a seleção existente em Chromium/Firefox e nos dois motores. Nenhuma coordenada foi alterada.

## Revisão e limites

Revisão final Standards: nenhuma violação documentada e nenhum smell relevante; o predicado comum elimina a duplicação apontada na primeira revisão. Revisão final Spec: critérios do ticket 07 atendidos no recorte sintético, inclusive identidade/partição, lista em carga/erro e vazio móvel; “concluído localmente” é adequado, não aceite operacional.

O arquivo-fonte `.scratch/consulta-coerente/issues/07-agrupamentos-sobreposicoes.md` permanece com status `ready-for-agent` e caixas originais intactas; a conclusão deste lote é registrada em `tickets-status.md` e neste checkpoint. O controlador `ticketctl.py` não foi executado nem reescrito. Aceite sintético local; sem dados reais, prontidão operacional, QA em aparelho físico, coleta, API, novas dependências, push, merge remoto ou deploy. Próximo item autorizado: ticket 18.
