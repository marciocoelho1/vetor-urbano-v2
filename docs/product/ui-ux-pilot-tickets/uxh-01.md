# UXH-01 — Reproduzir e reconciliar o candidato de integração

**Estado:** parcela técnica local verificada em 24/10/2026; aceite do responsável pendente, sem publicação no GitHub.
**Lote:** A.
**Bloqueado por:** Nenhum ticket; Lote A autorizado localmente em 24/10/2026.
**Condição adicional:** Sem commit/push/merge, alteração do controlador, dados reais ou deploy. Retomada da seleção interrompida depende da decisão do responsável após três falhas.

## Entrega verificável

Reproduzir a aplicação integrada com ambiente sintético identificado e reconciliar a documentação de entrada antes de escolher um candidato para merge.

## Critérios de aceite

- [ ] Conferir branch, alterações existentes e origem dos processos/bancos antes dos testes; preservar todo trabalho anterior.
- [ ] Revalidar planning, web, controlador, API/PostGIS e jornadas integradas obrigatórias em Chromium/Firefox; informar contagens, falhas e skips reais. Diagnosticar pré-requisitos ausentes sem reduzir os testes.
- [ ] Reconciliar documentos defasados sobre backend, contas, coleta e migrações a partir do código e evidências; não reimplementar capacidades por diagnóstico antigo.
- [ ] Registrar proposta explícita para a especificação anterior/tickets ignorados chegarem a clone novo, sem publicá-los ou mudar ignore por presunção; decisão de publicação é pendência própria.
- [ ] Entregar parecer atualizado de merge e destino de alterações documentais, sem executar commit/merge/push. Ausência de conflito textual não encerra aceite funcional.

## Rastreabilidade e prova

Critérios compartilhados: **UXH-CA29**, na [especificação](../ui-ux-pilot-specification.md). Este ticket cobre sua parcela, não declara todo critério compartilhado encerrado isoladamente.

Aplicar verificações pertinentes da especificação; registrar versão, comandos, ambiente e limitações. API/PostGIS real quando houver seleção/persistência; navegador integrado quando houver jornada. Resultados de testes pulados ou de outra árvore não comprovam entrega. Preservar critérios antigos não superados explicitamente e não reduzir aceite para obter verde.

Ao concluir futuramente, preencher evidência real e pendências remanescentes, atualizar plano/checklist e submeter ao responsável. Não marcar este arquivo como entregue nesta consolidação.

## Recuperação validada localmente — estado atual

- Pedido: «Retome pelo ponto de recuperação de 24/10/2026.» [Registro final das correções](../../history/uxh-01-five-fixes-2026-10-24.md). Sessão 6/6; fontes 4/4; associação com ADMIN efetivo 2/2; correção com acompanhamento pelo USER original 4/4; XLSX completo 8/8 em 8080 e 8/8 em 8081, conteúdo/loading/503 preservados. Web final lint/205/build852,03 kB.
- Consolidação de 24 famílias: 184 aprovações/24 skips dos modos opostos de coleta/zero falhas ou erros em 208 entradas, XMLs históricos válidos + retestes afetados, não execução integral nova. Parcelas antigas substituídas, não somadas. Sessões/fontes e fluxo de solicitante antes incompletos agora provados; API59+145/controlador43/demonstrativas46/46 são evidências anteriores, não novas execuções.
- Critérios: baseline/proveniência preservados, revalidação pertinente documentada, entradas reconciliadas, proposta explícita para materiais ignorados e parecer apresentados. Aceite continua com o responsável; não declarar UXH-CA29 hospedado concluído. Limitação: colisão de versões reproduzida em SQL, não reprodução determinística do sintoma Firefox original; jornada final passou nos dois navegadores.
- Parecer: apto à conferência da parcela técnica local, sem recomendar merge/publicação antes da decisão sobre materiais ignorados e do candidato completo. UXH-02 permanece parcial. Checkboxes mantidos desmarcados para conferência do responsável. Registros abaixo são históricos.

## Retomada autorizada — 24/10/2026

Responsável: «Autorizo. Retome a tarefa.» Baseline sintético isolado e correções dirigidas realizados; sem ampliar permissões Git/dados reais. [Relatório](../../history/uxh-01-resume-2026-10-24.md): persistida **54/54 Chromium/Firefox**, guards **8/8**, demonstrativas **46/46**, web lint/205/build. As três falhas originais foram superadas sem mudar contagens nem dispensar conteúdo XLSX. API/controlador não reexecutados nesta retomada.

**Ainda parcial:** ampliação integrada atingiu limite de três seleções. Segunda execução: 70 aprovados, 2 falhas, 1 erro, 29 skips configurados e 26 interrompidos; suplemento: 29 aprovados, 1 falha, 22 skips configurados. Renovação, clique no mapa, contaminação de fila e associação Firefox pendentes; flags adicionais de sessão/fontes também não comprovadas. Próxima ação: decisão do responsável sobre diagnóstico mínimo/isolar famílias e risco de encadeamento da interceptação XLSX em porta alternativa apontado pela revisão Standards antes de repetir. Sem aceite ou recomendação de merge; resultados do checkpoint abaixo são históricos da primeira execução.

## Checkpoint — 24/10/2026

- Escopo realizado: baseline/proveniência sintética, reexecução técnica parcial, reconciliação de AGENTS/arquitetura/estrutura/escopo e proposta para materiais ignorados.
- Evidências: [verificação técnica](../../history/uxh-01-verification-2026-10-24.md) e [reconciliação](../../history/uxh-lot-a-reconciliation-2026-10-24.md). API 59+145 sem skips; web 205/build; controlador 43; demonstrativas 46/46. XMLs recalculados pela sessão principal.
- Critérios pendentes: prova persistida completa Chromium/Firefox (13 aprovados, 3 falhas, 36 não executados); demais famílias integradas não reexecutadas. Não recomendar merge; destino dos materiais ignorados é proposta, não autorização de publicação.
- Próxima ação: decisão do responsável sobre baseline sintético isolado e correção dirigida das fixtures/asserção transitória XLSX, antes da repetição completa. Aceite não marcado; checkboxes acima preservados para conferência.

[Plano e dependências](../ui-ux-pilot-plan.md). ID local do incremento UXH, sem equivalência com números antigos 01–36 ou issues do GitHub.
