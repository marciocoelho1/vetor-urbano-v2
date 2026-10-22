# Painel de operação local v1 (ticket 22)

Contrato da leitura administrativa do estado real de coleta e de fila. Implementado em
`apps/api/src/main/java/br/com/vetorurbano/api/operations/` e `apps/web/src/app/operations/`.
Nada aqui dispara coleta, publica conteúdo ou altera revisão.

## Endpoint

`GET /api/v1/admin/operations` — `ADMIN` com segundo fator, definido pelo caminho sob
`/api/v1/admin/` no filtro de acesso. Respostas: `401` sem sessão, `403` para `USER`,
`503` `OPERATIONS_UNAVAILABLE` quando o banco não responde. Sempre `Cache-Control: no-store`.

A leitura é auditada em `auth_audit_events` com `module='operations'`, `action='OPERATIONS_VIEW'` e
`event_class='ADMIN'` (V19). O parâmetro auditado contém apenas contagens agregadas
(`sources`, `pendingReviews`, `expiringConfirmations`) — nunca título, descrição ou identidade.

## Corpo

```json
{
  "generatedAt": "2026-10-22T12:00:00Z",
  "sources": {"state": "CONFIGURED|NOT_CONFIGURED", "items": [], "label": "...", "detail": "..."},
  "queue": {"state": "EMPTY|HAS_PENDING", "pending": 0, "highPriority": 0,
            "oldestQueuedAt": null, "longestWaitSeconds": 0, "label": "..."},
  "confirmations": {"state": "CONFIGURED|NOT_CONFIGURED", "windowSeconds": 86400,
                    "expiring": [], "expired": 0, "typesWithoutDeadline": [],
                    "typesWithoutAutomaticExtension": [], "label": "...", "detail": "..."},
  "limitations": "..."
}
```

### Fontes

Uma entrada por fonte em `collection_sources`, com o cadastro público de `sources` (nome e
`provenance.credit`/`provenance.attribution`) e a última execução (`collection_runs`). `assessment`
é um estado fechado:

| `assessment` | Significado |
|---|---|
| `PAUSED` | conector pausado por decisão administrativa |
| `NEVER_ATTEMPTED` | configurada e nunca executada — não é ausência de ocorrências |
| `FAILING` | última tentativa falhou e não houve sucesso posterior (classe preservada) |
| `RUNNING` | execução em andamento; totais são os já persistidos |
| `PARTIAL` | parou no limite/cursor no meio da janela |
| `UP_TO_DATE_NO_NEW_ITEMS` | execução bem-sucedida sem publicação nova — sucesso, não falha |
| `NEW_ITEMS` | execução bem-sucedida com itens novos na fila |
| `IDLE` | sem execução correspondente aos parâmetros atuais |

`NOT_CONFIGURED` (bloco) é a ausência de conector: também não é falha nem zero. O painel não expõe
contagem de ocorrências por fonte, para que falha de conector não seja lida como «nenhuma ocorrência».

### Fila

`pending` e `highPriority` contam `clipping_reviews` em `PENDING`; `oldestQueuedAt` e
`longestWaitSeconds` são medidos no instante de geração (`Clock` injetado). Fila vazia tem rótulo
próprio e `EMPTY`, distinto de falha.

### Confirmações

A janela de antecedência vem de `vetor.operations.expiry-window` (padrão de repositório: `24h`).
Sem configuração, o bloco responde `NOT_CONFIGURED` e não lista nada — nenhum prazo é inventado.
Prazos por tipo continuam os aprovados no ticket 25 (`OccurrenceVerificationService.duration`):

- tipos sem prazo aprovado aparecem em `typesWithoutDeadline` e **não** são listados como expirando;
- tipos com decisão aprovada de não prorrogar (`ROUBO`, `FURTO`, `CONFRONTO`) aparecem em
  `typesWithoutAutomaticExtension`, separados de falta de configuração;
- `expired` conta confirmações já vencidas de ocorrências publicadas `ONGOING`, cuja verificação
  corresponde à revisão atual;
- `expiring` limita-se a 50 linhas por leitura.

## Interface

`app-operations-panel` dentro da área administrativa já existente, antes de fontes/coleta/revisão.
Somente leitura: não usa CSRF e não altera dados. Tem estado de carregamento, erro com repetição,
vazio explicado, navegação por teclado para as seções existentes (`collection-heading`,
`review-heading`) e apresentação a 390 px.

## Limites

Ambiente sintético local: não comprova coleta real, cobertura, SLA ou prontidão operacional. O painel
observa o que o fluxo já registra; não cria agendador, limiar ou alerta novo.
