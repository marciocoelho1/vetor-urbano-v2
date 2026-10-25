# Cartografia territorial — pendência de prioridade extrema

Estado: **pendente, prioridade extrema atribuída pelo responsável em 23/10/2026**. Registro de escopo, não execução de coleta, edição ou importação. Decisão vinculada à [entrevista](../history/map-and-hosting-interview-2026-10-23.md).

## Escopo solicitado

1. Mapear polígonos dos municípios da Região Metropolitana do Rio de Janeiro.
2. Mapear os respectivos bairros e a relação de cada bairro com seu município.
3. Para a cidade do Rio de Janeiro, mapear bairros e Regiões Administrativas, mantendo a relação com Áreas de Planejamento como unidade distinta (Q28). Não equiparar zonas informais, Regiões Administrativas e Áreas de Planejamento.
4. Manter Áreas de Risco como camada e identidade distintas de divisões administrativas.

A cobertura desejada é metropolitana, não somente a existência de uma lista de nomes. A [lista legal existente](../../apps/api/src/main/resources/collection/metropolitan-municipalities-v1.json) não contém polígonos e não certifica a cobertura espacial.

## Entregas necessárias para considerar concluído

- Inventário conferível de municípios, bairros e regiões, com total esperado, disponível e pendente por fonte/data. Se uma prefeitura não disponibilizar limites oficiais de bairros, registrar a lacuna sem desenhar limites fictícios ou chamá-los de oficiais.
- Origem, licença/autorização, referência temporal, data de obtenção, limitações e responsável pela validação de cada conjunto. Priorizar fontes oficiais; divergências entre fontes devem ser reconciliadas/documentadas.
- Identificadores estáveis, nomes e homônimos desambiguados; relações município–bairro e, no Rio, bairro–região segundo o recorte escolhido. Geometrias e divisões evoluem por versões, sem sobrescrever a história silenciosamente.
- Geometrias Polygon/MultiPolygon apropriadas, não vazias, com validação topológica e WGS 84/SRID 4326; GeoJSON em `[longitude, latitude]`. Conferir pertencimento, fronteiras, sobreposições/lacunas e explicitar divergências de escala/data; não inventar tolerâncias de aceite para eliminar problemas.
- Ponto representativo interno calculado a partir da geometria validada, não por média das ocorrências, bounding box ou centroide que possa cair fora. Identificar qual versão territorial fundamenta o ponto.
- Catálogo territorial usado pela busca, seleção e filtros geográficos, com indicação explícita de cobertura parcial e de indisponibilidade. Não declarar o requisito completo com apenas municípios ou apenas Áreas de Risco.
- Verificação com PostgreSQL/PostGIS real e jornadas de busca/ambiguidade/erro/vazio, teclado/lista e móvel. Preservar geometrias originais e evidências da transformação, sem publicar extrações brutas ou dados sem autorização.

## Dependências e limites

Bloqueia a declaração de cobertura territorial completa e a seleção de centro por localidades sem geometria validada. Não implica suspender correções independentes de interface, responsividade e segurança.

O responsável confirmou que as Áreas de Risco locais atuais devem integrar o piloto hospedado (Q23). Isso não supre a cartografia municipal/de bairros nem significa validação automática da licença da fonte, topologia, atualidade ou segurança. Registrar sua autorização de envio e cumprir a [auditoria territorial](../maps/territorial-sources.md) antes da publicação efetiva.

## Fonte candidata já localizada — ainda não incorporada

O serviço oficial [Bairros_Censo_2022 da Prefeitura do Rio](https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Censo/Limites_administrativos_Censo_2022/MapServer/2) foi consultado apenas em seus metadados. Declara geometrias de polígonos, saída GeoJSON e campos `codbairro`, `regiao_adm`, `codra` e `area_plane`. É um ponto de partida para bairro/Região Administrativa/Área de Planejamento, não prova de cobertura atual ou licença de redistribuição. A referência Censo 2022 exige verificar mudanças legais posteriores; não fixar contagem de bairros com base nessa data. Nenhum polígono baixado ou importado nesta consulta.

## Próxima ação

Inventário de fontes/cobertura e ingestão/versionamento organizados em UXH-02–UXH-06 no [plano consolidado](ui-ux-pilot-plan.md), usando Regiões Administrativas/Áreas de Planejamento confirmadas em Q28. São tickets propostos para revisão e seleção, não execução autorizada. Nenhuma fonte incorporada, custo aprovado ou banco acessado por este registro.
