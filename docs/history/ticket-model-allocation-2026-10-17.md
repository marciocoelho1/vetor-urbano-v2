# Situação dos tickets e recomendação de modelos — 17/10/2026

Consulta solicitada pelo responsável para distribuir trabalho entre GPT-6.1 Sol Medium/High e GPT-6 Luna XHigh, considerando sua cota Plus. Recomendação de planejamento; nenhum ticket iniciado, configuração alterada ou aceite novo concedido.

## Base e limites da conferência

Lidos plano, inventário de tickets, especificações individuais, escopo, arquitetura, configuração do controlador e checkpoints; inspecionados estado do Git, commits recentes e estrutura do código Java. HEAD local `2e43914`, branch de integração, com trabalho preexistente sem commit preservado. O inventário recente e checkpoints prevalecem sobre resumos antigos: o JSON de execução ainda marca 12/13/14/16 como pendentes, embora existam commits e evidências posteriores. Escopo/arquitetura também contêm descrições anteriores às contas e MFA implementadas.

`gh issue list --state all --limit 100 --json number,title,state,url,updatedAt,body` falhou por conexão a api.github.com. Busca pelo conector GitHub com `repo:marciocoelho1/vetor-urbano-v2 is:issue` retornou `issues: []`. Isso não comprova ausência de issues; o estado remoto permanece não confirmado. Os IDs abaixo são locais, sem equivalência presumida com números do GitHub.

Base funcional: [inventário de 16/10](../product/tickets-status.md), [plano](../../PLAN.md) e tickets em `.scratch/consulta-coerente/issues/`. Há 14 tickets com implementação/testes locais registrados (01–06, 08–14 e 16), 2 com pendências (07/36) e 20 por implementar (15 e 17–35). Não houve nova execução funcional; evidências anteriores não representam prontidão operacional.

## Distribuição sugerida

Esta tabela expressa julgamento de engenharia para este projeto, sem benchmark comparativo dos modelos. High concentra risco de segurança e regras de domínio; Medium atende integração/depuração; Luna XHigh atende incrementos delimitados com contratos e critérios explícitos. Não substitui parâmetros aprovados nem verificações HTTP/PostGIS e navegador exigidas.

| ID | Restante | Modelo/effort sugerido | Motivo principal |
|---|---|---|---|
| 07 | Agrupamentos e pins sobrepostos: aceite pendente | Sol Medium | Depuração MapLibre/Firefox; última evidência 7/8, sem causa/correção confirmada. |
| 15 | Recuperar, alterar e encerrar conta | Sol High | Identidade, tokens, revogação, reconfirmação e preservação de histórico. |
| 17 | Revisar e publicar ocorrências | Sol High | Núcleo de escrita, deduplicação, relações, permissões e transições persistidas. |
| 18 | Corrigir ou retirar publicação | Sol High | Versões concorrentes, auditoria e efeito consistente nas consultas. |
| 19 | Consulta de logs e retenção | Luna XHigh | Consulta administrativa delimitada; classificação/eliminação precisam ser definidas antes. |
| 20 | Coleta recente autorizada | Sol Medium | Primeiro conector, idempotência, erros e integração com fila; High se extração/retomada se mostrar complexa. |
| 21 | Coleta retroativa com retomada | Sol Medium | Reutilizar conector do 20; comprovar checkpoints e deduplicação concorrente, elevando a High se necessário. |
| 22 | Painel de operação | Luna XHigh | Apresentar estados reais de coleta/fila com contratos existentes. |
| 23 | Confiabilidade de ocorrência | Sol High | Fórmula versionada, calibragem, incerteza e prevenção de circularidade. |
| 24 | Recomendação mensal de fontes | Sol High | Amostragem, independência da evidência e aprovação humana versionada. |
| 25 | Proximidade e vigência integradas | Sol Medium | Geodésia, precisão, consentimento e expiração por tipo. |
| 26 | Versões persistidas de Áreas de Risco | Sol Medium | Persistência temporal/espacial, procedência e seleção coerente de versões; elevar se topologia exigir. |
| 27 | Solicitar e acompanhar correção | Luna XHigh | Fluxo delimitado; verificar isolamento de solicitações entre usuários pelo HTTP. |
| 28 | Histórico avançado paginado | Luna XHigh | Leitura filtrada; definir ordenação estável de intervalos e desempate. |
| 29 | Relatório com recorte independente | Luna XHigh | Reutilizar consulta, separar filtros e fixar momento gerado. |
| 30 | Síntese determinística | Sol Medium | Contagens distintas, categorias sobrepostas e precisão temporal/territorial. |
| 31 | Comparar períodos/territórios | Sol Medium | Denominadores, base zero, cobertura e duração desigual. |
| 32 | Mancha térmica avançada | Sol Medium | Coerência mapa/consulta, concentração sem pesos e ensaio de renderização. |
| 33 | XLSX completo do recorte | Luna XHigh | Exportação delimitada, sem truncamento silencioso ou dependência da página visível. |
| 34 | PDF do relatório | Luna XHigh | Composição visual sobre síntese existente; validar renderização e paginação. |
| 35 | Avisos de atualização integrada | Sol Medium | Cursor/versão de publicação, correções/retiradas e preservação do contexto. |
| 36 | Documentos institucionais: aceite pendente | Luna XHigh | Páginas já existem; finalizar rastreabilidade com 27 e textos aprovados. |

Totais: **5 Sol High, 9 Sol Medium e 8 Luna XHigh**. O controlador existente recomenda Luna Medium em parte dessas tarefas; a tabela adota XHigh conforme a preferência solicitada, sem editar `tools/ticketctl.json`.

## Sequência e bloqueios

Dependências técnicas atendidas para retomar/iniciar 07, 15, 17, 19, 25, 26, 28, 29, 32 e 33; parâmetros particulares continuam valendo. Priorizar 07 para fechar a pendência e 17 para liberar o fluxo central. Cadeias: 17 → 18 → 35; 17 → 20 → 21/22; 17 → 23/24; 26 → 27 → conclusão funcional de 36; 29 → 30 → 31/34.

Antes de gastar execução extensa: delimitar recuperação/desvinculação do 15, retenção/classificação do 19, fonte/autorização/custos de 20/21, fórmula/rubrica/amostra de 23/24 e propostas específicas de ordenação/arquivos/análises. Dados sintéticos permitem apenas os recortes locais previstos; não substituem coleta real exigida em 20/21. Textos/publicação do 36 continuam sujeitos à aprovação própria.

## Uso da cota

A documentação oficial apresenta Sol como equilíbrio de capacidade/custo e Luna para tarefas focadas de maior volume: [modelos OpenAI](https://developers.openai.com/api/docs/models). A [documentação de uso do Codex](https://learn.chatgpt.com/docs/pricing) inclui ambos no Plus e informa que contexto, raciocínio, ferramentas e complexidade alteram consumo; estimativas por modelo não são limites fixos por effort. Não foi estabelecido fator exato de economia entre Sol Medium/High e Luna XHigh, nem equivalência de qualidade. Preço da API não determina cota incluída do Plus.

Recomendação: um incremento por execução, contrato/critério claro antes de Luna, revisão Sol focada em risco quando necessária e escalada de esforço somente após bloqueio técnico concreto. Para poupar cota, preferir velocidade Standard; a documentação informa multiplicador 2,5 de uso incluído em Fast. Não há garantia de concluir todos os tickets em determinada janela de cota.

## Verificação e próxima ação

Conferência documental, sem testes web/API/Playwright novos. `bash scripts/verify.sh planning` passou (292 links locais; não verifica âncoras/URLs externas) e `git diff --check` passou. Próxima ação: responsável escolher a execução seguinte usando dependências e distribuição acima. Nenhuma mudança no tracker, push ou publicação.
