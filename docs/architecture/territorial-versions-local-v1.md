# Versões territoriais locais — v1

Contrato sintético do ticket 26, D07/D12–D13 e CA11 da [especificação](../product/specification.md).
Não importa nem altera a camada original; não certifica autorização, atualização, topologia,
precisão ou evidência de qualquer área real. Dados dos testes são fictícios. Sem prontidão operacional.

## Identidade, revisão e aprovação

`V13__territorial_versions_and_approval.sql` acrescenta identidades territoriais com UUID estável,
revisão incremental e ponteiro `approved_version`. V1–V12 permanecem intactas. O SQL experimental
sombra de teste foi removido, evitando duas definições divergentes; os 18 casos de repositório agora
usam diretamente a migração V13 real, única definição executável do schema territorial.

Cada revisão é um snapshot imutável com nome, grupo indicado, fonte, versão do catálogo da fonte,
evidência, dia de referência conhecido (ou null), limitações, geometria, instante técnico de registro,
autor/papel e justificativa. Nome/URL da fonte são lidos da versão do catálogo fixada na revisão:
uma edição posterior da fonte não reescreve o contexto da versão territorial anterior.

Revisar não publica. Aprovação explícita aceita somente a revisão mais recente, comparando
`expectedVersion` sob lock da identidade. Aprovar novamente ou editar com versão obsoleta resulta
em 409; nenhum snapshot é sobrescrito ou número consumido por uma transação inválida. Antes da
primeira aprovação, a consulta comum não contém a área. Durante uma nova revisão, continua lendo
a versão anteriormente aprovada. Vigência editorial não prova início/fim de domínio territorial.

A mesma transação grava decisão de aprovação, troca o ponteiro, atualiza `correction_area_targets`
e acrescenta os registros de domínio/administração. Falha na projeção desfaz todos esses efeitos.
A projeção usa o UUID como texto e o mesmo número da versão aprovada; não é fonte de edição
independente. O canal privado confere também identidade e decisão de aprovação correspondente:
uma revisão preparada ou uma fixture isolada na projeção não comprova correção aplicada.

## Fronteira HTTP

Todas as respostas são `no-store`. A consulta comum exige sessão completa; caminhos `/admin/`
exigem ADMIN e MFA completo no servidor. Ambos os POSTs exigem CSRF da sessão.

| Método | Caminho | Resultado |
| --- | --- | --- |
| GET | `/api/v1/risk-areas` | `{items: [...]}` das versões aprovadas, sem autoria/justificativa administrativa |
| GET | `/api/v1/admin/risk-areas` | `{items: [...]}` das últimas revisões |
| GET | `/api/v1/admin/risk-areas/{id}` | `{items: [...]}` histórico em ordem crescente de versão |
| POST | `/api/v1/admin/risk-areas/{id}/versions` | snapshot da nova revisão; `expectedVersion=0` cria identidade |
| POST | `/api/v1/admin/risk-areas/{id}/approvals` | snapshot explicitamente aprovado |

Corpo de revisão, com campos explícitos: `expectedVersion`, `name`, `indicatedGroup`, `sourceId`,
`evidenceReference`, `referenceDate`, `limitations`, `geometry`, `justification`. Campos opcionais
usam null, não strings vazias. Aprovação recebe somente `expectedVersion` e `justification`.

Snapshot administrativo: `territoryId`, `version`, `approvedVersion` (null antes de aprovação),
`name`, `indicatedGroup`, `sourceId`, `sourceName`, `sourceUrl`, `evidenceReference`, `referenceDate`,
`limitations`, `recordedAt`, `geometry`, `actor`, `historicalActor`, `actorRole`, `justification`.
`approvedVersion` informa o ponteiro atual da identidade; não altera o conteúdo factual do snapshot.
As leituras comuns omitem os quatro campos administrativos finais.

`referenceDate` usa dia ISO ou null, nunca `recordedAt` como substituto. Grupo ausente não é
presumido. `Disputado` exige referência explícita à evidência de disputa; divergência simples não
muda automaticamente grupo/classificação. Evidência, fonte, data conhecida e cadastro são distintos.
A validação sintética de presença não certifica conteúdo factual de uma evidência real.

GeoJSON aceita objetos Polygon/MultiPolygon com `type` e `coordinates`, em longitude/latitude,
WGS 84/SRID 4326; sem CRS alternativo. EWKT é exclusivamente interno. PostGIS verifica polígono
válido/não vazio, 2D e faixas geográficas, preservando geometria sem typmod para recusar SRID 0.
Não há reprojeção, `ST_MakeValid`, inferência ou reparo silencioso de coordenadas. Geometria inválida,
fonte inexistente ou campos inválidos respondem 400; conflito/replay responde 409. Falha de acesso
ou persistência não responde com lista vazia bem-sucedida.

## Autoria e auditoria

`territorial_versions`, `territorial_approvals` e `territorial_audit_events` preservam autor ativo ou
referência histórica, papel e justificativa. Triggers recusam UPDATE/DELETE de conteúdo; a única
atualização ordinária permitida é o desligamento irreversível de autoria no encerramento.
`territorial_audit_events` conserva antes/depois factuais completos, sem UUID de login embutido no
JSON. Decisões anteriores continuam preservadas. Esse histórico de domínio não é log de uso nem
participa do expurgo de logs de administração.

O encerramento troca os três vínculos territoriais e o validador da projeção pela mesma referência
histórica de domínio já prevista no [ADR 0001](../adr/0001-historical-authorship-after-account-closure.md).
Ela é distinta da referência residual de segurança. A transação elimina o cadastro e não cria mapa
de correspondência. Papel/justificativa e registros coletivos permanecem; autoria histórica não é
promessa de anonimização de contexto/textos. Ver [encerramento](account-closure-local-v1.md).

Eventos `TERRITORY_REVISED`, `TERRITORY_APPROVED`, `TERRITORIES_READ` e `TERRITORY_HISTORY_READ`
entram em `auth_audit_events`, módulo `territories`, classe ADMIN, sujeitos à retenção administrativa.
O log armazena somente ID/versão/ponteiro e resumo permitido do antes/depois: identidade, versão,
ponteiro, nome, grupo indicado, fonte, data de referência e registro técnico. Não duplica geometria,
evidência, limitações ou justificativa. A [projeção de logs](audit-local-v1.md) aplica novamente
allowlist inclusive aos documentos legados e mantém `actor`/`historicalActor` separados.

## Verificações e limites

Fronteiras: `TerritorialVersionRepositoryIT` (PostGIS real), `TerritorialHttpIT` e
`CorrectionHttpIT` (HTTP real e PostGIS descartável). Os testes cobrem proteção USER/ADMIN sem MFA,
CSRF, datas null/conhecidas, evidência de Disputado, geometria, concorrência/replay, consulta anterior
até aprovação, fonte versionada, rollback de publicação/projeção e encerramento sem UUID residual.
Os comandos e resultados da entrega são registrados no checkpoint pelo coordenador.

Este contrato não substitui as jornadas web/Chromium/Firefox, nem valida material territorial real,
coleta, cobertura, política pública, implantação ou operação. Nenhum dado real foi carregado.
