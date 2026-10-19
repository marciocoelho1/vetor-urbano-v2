# Informes integrados locais — ticket 25

Contrato sintético de D05/D06 e CA07/CA08 da [spec](../product/specification.md). RF02; não implementa RF03, rastreamento, notificações ou geofencing. O incremento não encerra CA08 persistido nem aprova parâmetros operacionais.

## Leitura e acesso

`GET /api/v1/active-reports?longitude=...&latitude=...&radiusMeters=...` exige sessão completa (USER é suficiente), verificada pelo `AccessBoundary` no servidor. Sem sessão: 401; acesso indisponível: 503. Centro WGS84 explícito pelo value object `Coordinates`; raio inteiro de 1 a 5000 metros. Parâmetros ausentes, repetidos, desconhecidos ou inválidos: 400 `error.code=INVALID_QUERY`. Não aceita filtros de Histórico/Relatórios.

Resposta `Cache-Control: no-store`:

- `evaluatedAt`: instante UTC único da seleção e da avaliação de vigência;
- `limitation`: limitação explícita sobre evidência e ausência de transições persistidas;
- `items`: lista de `{occurrence, effectiveSituation, validity}`. `occurrence` reutiliza `OccurrenceView` com situação **armazenada**, precisão, referências e `temporalMatch`; `effectiveSituation` é consultiva, sem UPDATE factual.

Recentes na janela `[evaluatedAt−24h,evaluatedAt)` entram inclusive encerradas/desconhecidas; antigas em andamento entram apenas quando confirmadas pela política. União deduplicada mantém ordem do repositório, sem expandir relacionados. Uma antiga vigente pode ter `temporalMatch=OUTSIDE`: refere-se à janela recente, não à pertinência ao conjunto inteiro. PostGIS `ST_DWithin(geography)` valida o raio; não se reaplica corte aproximado no cliente. Registros apenas territoriais não ganham ponto artificial.

`validity`: `CONFIRMED`, `MISSING_CONFIGURATION`, `MISSING_EVIDENCE`, `EXPIRED`, `NOT_CONFIRMED` (porta alternativa que não confirmou) ou `NOT_APPLICABLE`. `ONGOING` armazenado sem confirmação tem situação efetiva `UNKNOWN`, nunca `CLOSED`. Encerrada/desconhecida armazenada permanece assim. Falha de banco/transação/política retorna 503 `error.code=QUERY_UNAVAILABLE`, não lista vazia. `items: []` com 200 é somente consulta vazia bem-sucedida.

## Configuração e evidência

`vetor.active-reports.validity-by-type` é mapa de ID do tipo para duração ISO-8601 positiva; `vetor.active-reports.confirmations` é mapa de ID da ocorrência para `{type, confirmedAt, reference}`. Ambos começam **vazios**. Duração nula/ausente não é infinita; configuração não positiva falha na inicialização. Sem evidência completa, tipo compatível, referência não vazia e confirmação não futura, negar. Vigência vale antes de `confirmedAt + duração`, expirando inclusive no limite. O instante do fato/publicação/coleta/revisão nunca supre confirmação.

Os testes HTTP usam explicitamente **configuração sintética**: `validity-by-type[ACIDENTE]=PT60S` e confirmação `old-confirmed` com referência `synthetic-evidence-25`. Não há valores sintéticos em application properties nem confirmação produtiva sem aprovação. Configuração somente referenciando uma evidência não certifica seu conteúdo, autoria, revisão ou correspondência a versão factual; esse fluxo operacional permanece pendente e não deve ser habilitado para dados reais.

A [recomendação ao responsável](../history/ticket-25-progress-2026-10-18.md#baseline-e-decisões-anteriores-ao-código) é proposta, não aprovação. Sem aprovação de semântica/autoria/origem e concorrência das transições, **não criar V14**. D06/CA08 de persistência e última verificação continua aberto. Não há agendamento de expiração ou código de escrita morto nesta fatia.

## Auditoria e web

`ACTIVE_REPORT_QUERY` usa módulo `query`, classe USE já existente: somente `hasSpatialFilter=true` e `occurrences`. A allowlist existente de leitura dos logs conserva esses campos; centro, coordenadas, raio, bounds, evidência e textos não são armazenados nem expostos em `/api/v1/admin/logs`. Não é necessário novo módulo/CHECK/migração. Leitura administrativa de logs permanece ADMIN/MFA; isso não substitui a sessão USER usada na prova da consulta.

No modo opt-in `?consulta=api`, entrar em Informes solicita localização pontual com timeout de 10 segundos. Não há watchPosition nem armazenamento local da localização. Negativa/falha mantém inputs WGS84 e escolha no mapa; editar centro/raio invalida o resultado anterior e exige consulta explícita. Callback de localização ultrapassado não substitui escolha manual. Sucesso consentido ou clique no mapa consulta o servidor. Consulta nova aborta anterior; navegação/logout descartam resposta em curso. Carregamento, falha, vazio e consulta ainda não realizada são distintos; nunca se mostra zero como sucesso antes de resposta.

Lista apresenta situação consultiva e armazenada, insuficiência, horário da consulta em America/Sao_Paulo e distância aproximada somente informativa. Detalhes compartilhados abrem por teclado e retornam foco. Posicionar câmera não transfere filtros: lista dos Informes é o conjunto independente, enquanto o mapa mantém seu próprio recorte. Sem parâmetro, demonstração do 08 preservada.

## Evidências e limites

`ActiveReportQueryIT` preserva bordas 4999/5000/5001 m e casos temporais existentes; `ActiveReportHttpIT` usa sessão USER real, PostGIS descartável, configuração sintética e relógio controlado; provas de ausência, expiração e falha. `ConfiguredValidityPolicyTest` cobre evidência incompleta/futura/tipo divergente e duração inválida. Playwright tem jornadas reais em Chromium/Firefox; somente a fronteira geolocalização/tiles e os estados visuais de carga/falha são simulados. Esses testes não certificam cobertura/cartografia/operacionalidade ou dispositivo físico. Resultados exatos no [checkpoint](../history/ticket-25-progress-2026-10-18.md).
