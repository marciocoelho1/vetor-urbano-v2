# Informes integrados locais — ticket 25

Contrato sintético de D05/D06 e CA07/CA08 da [spec](../product/specification.md). RF02; não implementa RF03, rastreamento, notificações ou geofencing. A Trilha A de 19/10/2026 acrescenta verificação humana persistida e os parâmetros aprovados abaixo, em ambiente local sintético.

## Leitura e acesso

`GET /api/v1/active-reports?longitude=...&latitude=...&radiusMeters=...` exige sessão completa (USER é suficiente), verificada pelo `AccessBoundary` no servidor. Sem sessão: 401; acesso indisponível: 503. Centro WGS84 explícito pelo value object `Coordinates`; raio inteiro de 1 a 5000 metros. Parâmetros ausentes, repetidos, desconhecidos ou inválidos: 400 `error.code=INVALID_QUERY`. Não aceita filtros de Histórico/Relatórios.

Resposta `Cache-Control: no-store`:

- `evaluatedAt`: instante UTC único da seleção e da avaliação de vigência;
- `limitation`: limitação explícita sobre vigência da evidência e preservação da situação factual;
- `items`: lista de `{occurrence, effectiveSituation, validity, verification}`. `occurrence` reutiliza `OccurrenceView`, que já embute `effectiveSituation` e `verification` (última verificação humana da versão atual, quando existir), com situação **armazenada**, precisão, referências e `temporalMatch`; a situação efetiva é consultiva, sem UPDATE factual.

Recentes na janela `[evaluatedAt−24h,evaluatedAt)` entram inclusive encerradas/desconhecidas; antigas em andamento entram apenas quando confirmadas pela política. União deduplicada mantém ordem do repositório, sem expandir relacionados. Uma antiga vigente pode ter `temporalMatch=OUTSIDE`: refere-se à janela recente, não à pertinência ao conjunto inteiro. PostGIS `ST_DWithin(geography)` valida o raio; não se reaplica corte aproximado no cliente. Registros apenas territoriais não ganham ponto artificial.

`validity`: `CONFIRMED`, `MISSING_CONFIGURATION`, `MISSING_EVIDENCE`, `NO_APPROVED_EXTENSION` (tipos aprovados sem extensão automática: roubo, furto e confronto — a confirmação humana é registrada, mas não abre janela de vigência), `EXPIRED`, `NOT_CONFIRMED` (porta alternativa que não confirmou) ou `NOT_APPLICABLE`. `ONGOING` armazenado sem confirmação tem situação efetiva `UNKNOWN`, nunca `CLOSED`. Encerrada/desconhecida armazenada permanece assim. Falha de banco/transação/política retorna 503 `error.code=QUERY_UNAVAILABLE`, não lista vazia. `items: []` com 200 é somente consulta vazia bem-sucedida.

## Evidência persistida

A política produtiva lê exclusivamente o histórico humano V14 da revisão factual atual. Sem registro válido, não confirma andamento. O instante do fato/publicação/coleta/revisão nunca supre confirmação. Prazos, autorização, concorrência e HTTP estão na seção Trilha A abaixo. Configurações legadas por mapas não certificam evidência humana nem substituem esse caminho.

## Auditoria e web

`ACTIVE_REPORT_QUERY` usa módulo `query`, classe USE já existente: somente `hasSpatialFilter=true` e `occurrences`. A allowlist existente de leitura dos logs conserva esses campos; centro, coordenadas, raio, bounds, evidência e textos não são armazenados nem expostos em `/api/v1/admin/logs`. Não é necessário novo módulo/CHECK/migração. Leitura administrativa de logs permanece ADMIN/MFA; isso não substitui a sessão USER usada na prova da consulta.

No modo opt-in `?consulta=api`, entrar em Informes solicita localização pontual com timeout de 10 segundos. Não há watchPosition nem armazenamento local da localização. Negativa/falha mantém inputs WGS84 e escolha no mapa; editar centro/raio invalida o resultado anterior e exige consulta explícita. Callback de localização ultrapassado não substitui escolha manual. Sucesso consentido ou clique no mapa consulta o servidor. Consulta nova aborta anterior; navegação/logout descartam resposta em curso. Carregamento, falha, vazio e consulta ainda não realizada são distintos; nunca se mostra zero como sucesso antes de resposta.

Lista apresenta situação consultiva e armazenada, insuficiência, horário da consulta em America/Sao_Paulo e distância aproximada somente informativa. Detalhes compartilhados abrem por teclado e retornam foco. Posicionar câmera não transfere filtros: lista dos Informes é o conjunto independente, enquanto o mapa mantém seu próprio recorte. Sem parâmetro, demonstração do 08 preservada.

## Evidências e limites

`ActiveReportQueryIT` preserva bordas 4999/5000/5001 m e casos temporais existentes; `ActiveReportHttpIT` usa sessões reais USER/ADMIN com MFA, PostGIS descartável, evidência sintética persistida e relógio controlado; provas de ausência, expiração, autorização, concorrência, encerramento e falha. `ConfiguredValidityPolicyTest` cobre evidência incompleta/futura/tipo divergente e duração inválida. Playwright tem jornadas reais em Chromium/Firefox; somente a fronteira geolocalização/tiles e os estados visuais de carga/falha são simulados. Esses testes não certificam cobertura/cartografia/operacionalidade ou dispositivo físico. Resultados exatos no [checkpoint](../history/ticket-25-progress-2026-10-18.md).

## Trilha A — decisão aprovada em 19/10/2026

Esta decisão substitui as pendências e a proposta por mapas do incremento anterior. A aplicação usa exclusivamente `occurrence_verifications` (V14) como evidência de vigência; mapas de confirmações não habilitam confirmações produtivas. A classe de política configurada permanece como núcleo legado com teste unitário próprio e **não é injetada como bean**: a fábrica da política não recebe mais `Settings`, de modo que nenhum mapa de configuração pode estender vigência por si.

Autor é a primeira autoria humana da publicação do efeito, preservada como histórica no encerramento; uma edição posterior não transfere essa permissão. Autor com sessão completa ou ADMIN com MFA pode verificar; outro USER recebe 403. Não há perfis novos. Toda escrita exige CSRF, evidência humana específica/rastreável (até 4000 caracteres), instante UTC não futuro, versão factual e versão da última verificação. Renovar exige nova evidência; não se preenche a evidência anterior. Evidência é restrita aos autorizados; a consulta pública autenticada recebe somente resumo temporal/versionado, sem texto ou identidade do verificador.

| Tipo | Prazo aprovado desde a confirmação humana |
|---|---|
| CONGESTIONAMENTO, DISPAROS | 30 minutos |
| ACIDENTE, OPERACAO_POLICIAL, INTERDICAO, SEMAFOROS, ALAGAMENTO, INCENDIO | 2 horas |
| DESLIZAMENTO, ARVORE, ENERGIA, AGUA | 6 horas |
| OBRAS | 24 horas |
| ROUBO, FURTO, CONFRONTO | Sem extensão automática |

São limites de vigência da evidência, não estimativas de duração do fato, garantia de segurança ou confirmação automática. O limite final é exclusivo: em `expiresAt` a projeção passa a UNKNOWN. Nunca passa automaticamente a CLOSED. Resolver exige decisão humana com evidência de término/resolução. Sem evidência/versionamento atual, a situação efetiva é UNKNOWN. Efeitos do mesmo acontecimento têm decisões e prazos independentes.

### HTTP de verificação

- `GET /api/v1/active-reports/{id}/verification`: autor ou ADMIN/MFA; situação factual, `revision`, `verificationVersion`, `validityDurationSeconds` e histórico restrito ordenado. Sem registro: histórico vazio. Ausente/retirada: 404.
- `POST` no mesmo endereço: corpo exato `{effectVersion, verificationVersion, situation, confirmedAt, evidence}`. Evidência vazia/repetida ou instante futuro: 400; outro autor: 403; versão factual ou verificação ultrapassada: 409 sem escrita. O servidor trava o efeito, verifica ambas as versões e acrescenta uma decisão. Transição factual acrescenta também revisão de publicação; mera renovação não inventa edição factual.
- `GET /api/v1/active-reports/expired`: fila de confirmações expiradas da versão atual, todas para ADMIN/MFA e próprias para autor. Não recebe centro ou raio: não é geofencing. Retorna ID/título/versões/expiração. Ausência de confirmação não é disfarçada de confirmação expirada.
- A consulta de proximidade acrescenta `verification={effectVersion,verificationVersion,confirmedAt,expiresAt,appliesToCurrentVersion}` (ou nulo), preservando `occurrence.situation`. A última checagem exibida só se aplica à versão factual atual. Expiração temporal está registrada por `expires_at` imutável no histórico; leituras calculam sua consequência sem UPDATE factual nem inventar um autor automático.

V14 mantém autoria tipada `author_id XOR historical_actor_id`, papel, evidência, instantes, situação anterior/nova e as duas versões. Histórico é imutável, exceto desligamento irreversível no encerramento. Na mesma transação do encerramento, `author_id` fica nulo e recebe o residual de domínio, sem mapa recuperável. V1–V13 permanecem byte a byte.

### Aviso e tratamento na web

No modo `?consulta=api`, sessão aberta consulta expiradas a cada cinco segundos (sem push ou promessa de instantaneidade). Toast ADMIN é persistente enquanto há expiradas; clique navega a Informes ativos. O container aparece no início, antes da lista de proximidade, com botão Tratar por efeito. O editor carrega a revisão antes de mostrar campos, começa sem evidência e permite verificar a situação ou renovar pelo mesmo prazo padrão. Cada nova expiração recoloca o efeito na fila; autor também pode abrir o editor pela lista dos Informes. Carregamento/falha/vazio são distintos. Conflito mantém a evidência digitada e oferece recarregar; não refaz POST automaticamente. Salvar confirma resultado em foco; cancelar retorna ao botão quando ainda existe.

Evidências e limites atuais no [checkpoint da rodada](../history/closure-round-2026-10-19.md#estado-final-da-trilha-a); o aceite sintético depende das verificações novas, nunca dos resultados históricos acima. Execução final: API dirigida 21 unitários + 50 integrações e completa 21 + 100, sem falhas/erros/pulados; Playwright da seleção autorizada 42/42 em Chromium/Firefox. Não certifica dados reais, cobertura operacional, QA físico ou leitor de tela.

A consulta geral, Histórico, Relatórios e detalhe acrescentam `effectiveSituation` e `verification`
em `OccurrenceView`, conservando `situation` armazenada. O filtro estrito Em andamento usa a
situação efetiva; expiradas/sem confirmação atual passam ao filtro Desconhecida e continuam em
consultas sem restrição de situação. O cliente integrado usa a projeção do servidor, inclusive
última confirmação aplicável à revisão. Isso encerra a lacuna do filtro estrito de CA08 sem
reescrever fatos ou encerrar efeitos relacionados.
