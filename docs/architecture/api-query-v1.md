# Contrato local de consulta persistida — v1

Este contrato implementa o Ticket 12 em desenvolvimento local. O banco e as quatro ocorrências de exemplo são sintéticos. A API não está liberada como produto integrado, não recebe gravações e não consulta fontes externas. Antes da autenticação do Ticket 14, somente o ambiente local pode acessá-la.

## Versões selecionadas

- JDK 21 para compilar e testar, extraído da imagem Maven 3.9.11 já disponível localmente. O host contém runtime Java 25, mas não `javac`; o contrato inicial foi corrigido após essa verificação. Spring Boot 4.1.1 requer Java 17 ou superior e é compatível até Java 26, conforme [requisitos oficiais](https://docs.spring.io/spring-boot/system-requirements.html).
- Maven Wrapper 3.9.11 e wrapper 3.3.4, conforme [documentação Apache](https://maven.apache.org/tools/wrapper/).
- PostgreSQL 17 com PostGIS 3.5. O container local disponível foi conferido via HTTP em `127.0.0.1:55432`: PostgreSQL 17.5 e PostGIS 3.5.2. A série PostGIS 3.5 suporta PostgreSQL 12–18 nas versões atuais, segundo [notas oficiais](https://www.postgis.net/docs/manual-3.5/en/release_notes.html).
- Testcontainers 2.0.5 para JUnit Jupiter e PostgreSQL; o teste usa a imagem real `postgis/postgis:17-3.5`, compatível com `PostgreSQLContainer`, conforme [módulo JUnit](https://java.testcontainers.org/test_framework_integration/junit_5/) e [módulo Postgres/PostGIS](https://java.testcontainers.org/modules/databases/postgres/).

## Endpoint

`GET /api/v1/occurrences`

`GET /api/v1/reports/occurrences` usa os mesmos filtros e resposta, inclusive ocorrências relacionadas, e exige sessão completa no servidor. Executa a consulta autenticada sobre PostGIS e devolve todos os itens do recorte na mesma leitura repetível. `generatedAt` identifica o instante da resposta. O relatório fica apenas na sessão do navegador; o servidor não persiste um relatório ou uma fotografia de filtros. A ação Atualizar faz outra leitura explícita com os filtros guardados no relatório.

Filtros podem ser repetidos para alternativas do mesmo campo; campos diferentes se combinam. O cliente envia o intervalo consultado e o servidor valida todos os valores:

| Parâmetro | Formato e regra |
|---|---|
| `periodStart`, `periodEnd` | Instantes RFC 3339 com fuso obrigatório; intervalo `[início, fim)`, com início incluído e fim excluído. Obrigatórios e `periodStart < periodEnd`, exceto na seleção exclusiva `situation=ONGOING`, que admite omitir ambos para não inventar uma data inicial. |
| `category` | `TRANSITO`, `SEGURANCA` ou `CONTINGENCIA`; pode repetir. |
| `categorySelection` | `NONE` representa uma seleção explicitamente vazia; não pode vir com `category`. Sem este parâmetro e sem `category`, todas as categorias continuam selecionadas. |
| `type`, `subtype` | Identificadores do catálogo; podem repetir. Subtipo aceita `TIPO:SUBTIPO` para preservar o vínculo; o cliente normaliza os rótulos para maiúsculas, sem acentos e com `_` nos espaços. |
| `municipality`, `neighborhood` | Texto literal sintético; não representa limite oficial. |
| `sourceId` | Identificador público da fonte; pode repetir. |
| `text` | Busca sem distinção de caixa em título, descrição e localidade. |
| `minReliability`, `maxReliability` | Inteiros de 1 a 5; limite mínimo não pode exceder o máximo. Nota pública da ocorrência, nunca nota interna da fonte ou confiança de extração. |
| `situation` | `ONGOING`, `CLOSED` ou `UNKNOWN`; pode repetir. |
| `longitude`, `latitude` | Devem vir juntos, em graus WGS 84 e ordem conceitual longitude/latitude; longitude `[-180,180]`, latitude `[-90,90]`. |
| `timeStart`, `timeEnd` | Opcionais `HH:mm`, horário diário em `America/Sao_Paulo`; limites inclusivos por minuto, inclusive quando a faixa atravessa meia-noite, como no cliente anterior. Intervalos incertos sem hora exata não são excluídos artificialmente. |
| `west`, `south`, `east`, `north` | Recorte de área visível explicitamente aplicado, todos juntos em WGS 84, oeste < leste e sul < norte; bordas inclusivas. Registros territoriais sem geometria não correspondem. |
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

Além de `items`, a resposta inclui `relatedItems`: ocorrências publicadas do mesmo acontecimento que ficaram fora dos filtros. São contexto para o detalhe e nunca entram nos totais, na lista ou nos pins do recorte. As leituras de resultados, relações e referências usam a mesma transação com snapshot repetível. Em `relatedItems`, `temporalMatch` conserva a classificação temporal da janela (`CERTAIN`, `POSSIBLE` ou `OUTSIDE`); o cliente também indica contexto fora dos filtros. `OUTSIDE` nunca entra em `items` ou nos totais da consulta.

`occurrences` conta fatos/efeitos únicos e `happenings` conta contextos únicos; `clippings` são referências e não aumentam nenhum desses totais. Os três efeitos de um mesmo acontecimento continuam três ocorrências. A resposta só considera `publicationStatus=PUBLISHED`; rascunhos, registros internos de avaliação e campos privados não são serializados. `mappedOccurrences + listOnlyOccurrences = occurrences` para ocorrências retornadas.

## Erros

Parâmetro malformado ou combinação inválida retorna HTTP 400 com `{"error":{"code":"INVALID_QUERY","message":"..."}}`. Falha de banco ou consulta retorna HTTP 503 com código `QUERY_UNAVAILABLE`. Erro nunca é convertido em resposta 200 com contagem zero. O cliente local traduz 503 em estado visível de falha.

## Migração e fixtures

V1 cria contextos de acontecimento, fontes, clippings, ocorrências, vínculos e índices espaciais/temporais; carrega quatro ocorrências sintéticas publicadas, três efeitos relacionados e três clippings ligados a um único efeito, além de um rascunho de controle que não pode aparecer na consulta. Uma ocorrência é localizada somente por bairro. Filtrar `TRANSITO` no intervalo que inclui o fato exato na borda inicial retorna 1 ocorrência e 1 acontecimento. Testes reais também conferem o fim exclusivo, fuso, raio exatamente na borda, raio fora da borda e persistência após reinício da aplicação.

## Integração local do navegador

Com a API em `127.0.0.1:8080` e o Angular em `127.0.0.1:4201`, abra `http://127.0.0.1:4201/?consulta=api`. A ativação exige host de loopback e mantém aviso explícito de desenvolvimento sintético. Sem o parâmetro, a demonstração anterior continua disponível. O caminho persistido não usa fixtures como fallback e não reaplica distância esférica sobre o resultado geodésico do PostGIS. Mudanças de filtros cancelam a requisição anterior e respostas antigas não substituem as atuais. A seleção sem categorias representa seleção vazia no cliente; não muda o significado HTTP de categoria omitida (todas).

O cliente conserva opções territoriais e fontes já observadas na sessão; não é um catálogo oficial ou completo de fontes/territórios. Resultados relacionados preservam a situação publicada no banco; não recebem a regra de expiração das fixtures locais. A seleção Em andamento lê essa situação, sem afirmar validade operacional ainda não definida. Contas, moderação e regras operacionais seguem os tickets correspondentes.

Indisponibilidade de conexão, consulta ou transação retorna 503; o servidor limita espera de conexão/socket/consulta. O navegador apresenta erro com retry e não chama esse estado de vazio. Durante carregamento/falha, o mapa anterior é identificado como último resultado, os totais atuais ficam suspensos. Uma resposta vazia válida continua distinta de erro.
