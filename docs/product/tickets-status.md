# Status dos tickets

Atualização documental: 16/10/2026. Referência de código: `ba83696`, na branch `integration/functional-spec-v1`. Spec v1.1 e IDs preservados. Esta reconciliação não reexecuta testes nem concede novos aceites.

**14 verificados localmente, 2 parciais e 20 pendentes.** Não é percentual de produto concluído nem prontidão operacional.

Estado estruturado versionado: [implementation-state.json](implementation-state.json). Inventário: [development-status.md](development-status.md). Roadmap ativo: [PLAN.md](../../PLAN.md).

| Ticket | Entrega | Estado | Referência |
|---|---|---|---|
| 01 | Catálogo e consulta inicial | Verificado localmente | `5c99513` |
| 02 | Ocorrências e acontecimentos relacionados | Verificado localmente | `45c6401` |
| 03 | Filtros combinados e resumo | Verificado localmente | `10d316c` |
| 04 | Precisão temporal e situações | Verificado localmente | `95fffc1` |
| 05 | Território, mapa e registros apenas em lista | Verificado localmente | `c528644` · [histórico](../history/ticket-05-dependency-retest-2026-10-15.md) |
| 06 | Modos simples e avançado | Verificado localmente | `01a005a` · [histórico](../history/ticket-06-resume-2026-10-15.md) |
| 07 | Agrupamentos e pins coincidentes | Parcial — sem aceite integral | `b505ac6` · [histórico](../history/ticket-07-resume-2026-10-15.md) |
| 08 | Informes Ativos por ponto manual | Verificado localmente | `04be65e` |
| 09 | Áreas de Risco demonstrativas | Verificado localmente | `cab91b8` |
| 10 | Atualização simulada e estados da consulta | Verificado localmente | `8ca44bc` · [histórico](../history/ticket-10-retest-2026-10-15.md) |
| 11 | Fontes e explicação pública da confiabilidade | Verificado localmente | `2c34dd9` |
| 12 | Consulta persistida pela API Java/PostGIS | Verificado localmente | `067f9c0` · [histórico](../history/ticket-12-progress-2026-10-15.md) |
| 13 | Cadastro, confirmação e reenvio | Verificado localmente | `f93ad96` · [histórico](../history/ticket-13-progress-2026-10-15.md) |
| 14 | Sessão, autorização e MFA administrativo | Verificado localmente | `e9bb6e7` · [histórico](../history/ticket-14-progress-2026-10-15.md) |
| 15 | Recuperação, alteração e exclusão da conta | Pendente | — |
| 16 | Gestão administrativa de fontes | Verificado localmente | `ba83696` · [histórico](../history/ticket-16-progress-2026-10-15.md) |
| 17 | Revisão e publicação de ocorrências | Pendente | — |
| 18 | Correção, versões e retirada | Pendente | — |
| 19 | Logs administrativos e retenção | Pendente | — |
| 20 | Coleta recente de fonte autorizada | Pendente | — |
| 21 | Carga retroativa com retomada | Pendente | — |
| 22 | Monitoramento operacional da coleta | Pendente | — |
| 23 | Confiabilidade calibrada e versionada | Pendente | — |
| 24 | Recomendação mensal sobre notas de fontes | Pendente | — |
| 25 | Proximidade e vigência integradas | Pendente | — |
| 26 | Versões persistidas de Áreas de Risco | Pendente | — |
| 27 | Solicitação e acompanhamento de correções | Pendente | — |
| 28 | Histórico avançado paginado | Pendente | — |
| 29 | Relatório com recorte independente | Pendente | — |
| 30 | Síntese determinística do relatório | Pendente | — |
| 31 | Comparação de períodos/territórios | Pendente | — |
| 32 | Mancha térmica de concentração | Pendente | — |
| 33 | XLSX do recorte avançado | Pendente | — |
| 34 | PDF do relatório | Pendente | — |
| 35 | Avisos de publicação/correção persistida | Pendente | — |
| 36 | Documentos institucionais | Parcial — sem aceite integral | `a836616` · [histórico](../history/spec-implementation-2026-10-15.md) |

## Limites e próximos passos

- 07: clique físico no popup MapLibre/Firefox continua pendente; adaptar a preparação E2E à sessão do 14 sem remover autorização.
- 36: documentos locais são rascunhos; recebimento/acompanhamento de correções depende do 27.
- 10: preservação de câmera/centro e estados foi revalidada em `8ca44bc`; atualização continua simulada até 35.
- 12–14 e 16: aceites locais com dados sintéticos persistidos; cadastro/MFA e gestão de fontes não comprovam prontidão operacional.
- 15 segue pendente. Próximo incremento recomendado: 17 → 18, respeitando o ticket original e as dependências.
- Diretamente liberados por 14/16: 15,17,19,25,26,28,29,32,33. Seus parâmetros próprios ainda se aplicam.
- 20–22 exigem a cadeia de revisão e condições autorizadas da fonte. G1 permanece placeholder com coleta desativada.
- 23–24: fórmula/rubrica e calibragem operacionais não aprovadas; valores sintéticos não encerram aceite operacional.
- Bundle registrado no 16: 653,67 kB, aviso de +153,67 kB sobre 500 kB. QA integrado/operacional, cobertura oficial, recuperação e políticas definitivas continuam pendentes.
- O controlador não está ativo neste fluxo. Seu antigo estado local não é fonte de aceite atual; não reiniciá-lo sem reconciliar seu estado separado.

Os tickets originais privados continuam em `.scratch/consulta-coerente/issues/`; não foram publicados ou renumerados. Históricos anteriores permanecem históricos.
