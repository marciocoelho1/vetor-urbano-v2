# Contrato local de consulta persistida — v1

Este contrato implementa o Ticket 12 em desenvolvimento local. O banco e as quatro ocorrências de exemplo são sintéticos. A API não está liberada como produto integrado, não recebe gravações e não consulta fontes externas. Antes da autenticação do Ticket 14, somente o ambiente local pode acessá-la.

## Versões selecionadas

- Java 25 no executor local. Spring Boot 4.1.1 requer Java 17 ou superior e é compatível até Java 26, conforme [requisitos oficiais](https://docs.spring.io/spring-boot/system-requirements.html).
- Maven Wrapper 3.9.11 e wrapper 3.3.4, conforme [documentação Apache](https://maven.apache.org/tools/wrapper/).
- PostgreSQL 17 com PostGIS 3.5. O container local disponível foi conferido via HTTP em `127.0.0.1:55432`: PostgreSQL 17.5 e PostGIS 3.5.2. A série PostGIS 3.5 suporta PostgreSQL 12–18 nas versões atuais, segundo [notas oficiais](https://www.postgis.net/docs/manual-3.5/en/release_notes.html).

## Endpoint

`GET /api/v1/occurrences`

Filtros podem ser repetidos para alternativas do mesmo campo; campos diferentes se combinam. O cliente envia o intervalo consultado e o servidor valida todos os valores:

| Parâmetro | Formato e regra |
|---|---|
| `periodStart`, `periodEnd` | Instantes RFC 3339 com fuso obrigatório; intervalo `[início, fim)`, com início incluído e fim excluído. Obrigatórios e `periodStart < periodEnd`. |
| `category` | `TRANSITO`, `SEGURANCA` ou `CONTINGENCIA`; pode repetir. |
| `type`, `subtype` | Identificadores do catálogo; podem repetir. |
| `municipality`, `neighborhood` | Texto literal sintético; não representa limite oficial. |
| `sourceId` | Identificador público da fonte; pode repetir. |
| `text` | Busca sem distinção de caixa em título, descrição e localidade. |
| `minReliability`, `maxReliability` | Inteiros de 1 a 5; limite mínimo não pode exceder o máximo. Nota pública da ocorrência, nunca nota interna da fonte ou confiança de extração. |
| `situation` | `ONGOING`, `CLOSED` ou `UNKNOWN`; pode repetir. |
| `longitude`, `latitude` | Devem vir juntos, em graus WGS 84 e ordem conceitual longitude/latitude; longitude `[-180,180]`, latitude `[-90,90]`. |
| `radiusMeters` | Inteiro em metros; exige ambas as coordenadas e fica entre 100 e 25.000 m, limites dos controles atuais. Usa distância geodésica inclusiva na borda. |

Datas exatas entram quando `occurredAt >= periodStart AND occurredAt < periodEnd`. Intervalos de fato incerto são semiabertos `[occurredFrom, occurredUntil)`: inclusão é certa se todo o intervalo cabe no consultado; possível se há somente sobreposição. O fuso do contrato é explícito; a apresentação atual continua em `America/Sao_Paulo`.

Sem filtro espacial, ocorrências com precisão territorial permanecem na lista com `coordinates: null`. Com raio, somente geometrias sustentadas pelo dado podem corresponder; a API nunca cria ponto ou centroide para registro de bairro.

## Resposta 200

```json
{
  "generatedAt": "2026-10-15T15:45:00Z",
  "counts": {
    "occurrences": 4,
    "happenings": 2,
    "mappedOccurrences": 3,
    "listOnlyOccurrences": 1,
    "temporallyCertain": 4,
    "temporallyPossible": 0
  },
  "items": [
    {
      "id": "vu-demo-occurrence-traffic-001",
      "happeningId": "vu-demo-happening-001",
      "title": "Colisão demonstrativa",
      "description": "Fato inteiramente sintético para desenvolvimento.",
      "category": "TRANSITO",
      "type": "ACCIDENTE",
      "subtype": "COLISAO",
      "situation": "UNKNOWN",
      "reliability": 3,
      "municipality": "Rio de Janeiro",
      "neighborhood": "Centro",
      "locationPrecision": "POINT",
      "coordinates": [-43.1915, -22.9033],
      "temporalMatch": "CERTAIN",
      "temporal": { "occurredAt": "2026-10-15T15:00:00Z" },
      "clippings": [
        {
          "id": "vu-demo-clipping-001",
          "title": "Publicação sintética A",
          "source": { "id": "vu-demo-source-001", "name": "Fonte demonstrativa" },
          "sourcePublishedAt": "2026-10-15T15:10:00Z",
          "collectedAt": "2026-10-15T15:12:00Z"
        }
      ]
    }
  ]
}
```

`occurrences` conta fatos/efeitos únicos e `happenings` conta contextos únicos; `clippings` são referências e não aumentam nenhum desses totais. Os três efeitos de um mesmo acontecimento continuam três ocorrências. A resposta só considera `publicationStatus=PUBLISHED`; rascunhos, registros internos de avaliação e campos privados não são serializados. `mappedOccurrences + listOnlyOccurrences = occurrences` para ocorrências retornadas.

## Erros

Parâmetro malformado ou combinação inválida retorna HTTP 400 com `{"error":{"code":"INVALID_QUERY","message":"..."}}`. Falha de banco ou consulta retorna HTTP 503 com código `QUERY_UNAVAILABLE`. Erro nunca é convertido em resposta 200 com contagem zero. O cliente local traduz 503 em estado visível de falha.

## Migração e fixtures

V1 cria contextos de acontecimento, fontes, clippings, ocorrências, vínculos e índices espaciais/temporais; carrega quatro ocorrências sintéticas publicadas, três efeitos relacionados e três clippings ligados a um único efeito, além de um rascunho de controle que não pode aparecer na consulta. Uma ocorrência é localizada somente por bairro. Filtrar `TRANSITO` no intervalo que inclui o fato exato na borda inicial retorna 1 ocorrência e 1 acontecimento. Testes reais também conferem o fim exclusivo, fuso, raio exatamente na borda, raio fora da borda e persistência após reinício da aplicação.
