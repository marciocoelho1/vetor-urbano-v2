# Continuidade após 29 → 28 → 33 — 17/10/2026

## Conferência

Conferidos PLAN.md, commits até `602856d`, checkpoints de 29/28/33, arquivos de implementação de Histórico/XLSX, tickets/dependências e pendências da entrevista. As três entregas estão concluídas no recorte local, com revisões e verificações registradas; não reexecutadas nesta consulta. Trabalho preexistente preservado.

Restam **19 tickets locais**: 07, 15, 17–27, 30–32 e 34–36. São 17 por implementar e 07/36 com pendências. Modelos recomendados: **4 Luna XHigh, 9 Sol Medium e 6 Sol High**. IDs locais não presumem números GitHub; estado remoto não reconsultado nesta rodada. A [distribuição anterior](post-interview-ticket-allocation-2026-10-17.md) fica como histórico, superada na contagem e no lote 29/28/33.

## Ordem recomendada

Esta é uma ordem de execução sugerida para aproveitar contratos existentes; não acrescenta dependências ao grafo. Tickets independentes podem ser antecipados. Executar um de cada vez no checkout compartilhado, mesmo em lote. Aprovações de produto não concedem automaticamente aceite operacional ou autorização de dados/coleta real.

| Ordem | Ticket / trabalho | Lote | Modelo / effort | Dependência ou condição |
|---|---|---|---|---|
| 1 | 30 — Síntese determinística | M1, 1/2 | GPT-6.1 Sol Medium | 29 concluído; fechar granularidade no incremento. |
| 2 | 31 — Comparação de recortes | M1, 2/2 | GPT-6.1 Sol Medium | Após 30; definir variação/base zero/duração/cobertura. |
| 3 | 34 — PDF | Individual | GPT-6 Luna XHigh | Após 30 e exemplo visual aprovado; pode preceder 31. |
| 4 | 19 — Logs/retenção | Individual | GPT-6.1 Sol High | Aplicar E04/E08–E10/E16/E18; definir contrato de atores/expurgo antes de integração do encerramento no 15. |
| 5 | 15 — Ciclo da conta | Individual | GPT-6.1 Sol High | 14 atendido; integrar com contrato de autoria/expurgo do 19, conforme política/ADR. |
| 6 | 07 — Agrupamentos/sobreposições | Individual | GPT-6.1 Sol Medium | 02/05 atendidos; diagnóstico/regressão MapLibre/Firefox. |
| 7 | 32 — Mancha térmica | Individual | GPT-6.1 Sol Medium | 06/14 atendidos; calibragem técnica sem pesos. |
| 8 | 25 — Proximidade/vigência | Individual | GPT-6.1 Sol Medium | 08/14 atendidos; configurações sintéticas explícitas; prazos reais ainda pendentes. |
| 9 | 26 — Versões de Áreas de Risco | Individual | GPT-6.1 Sol Medium | 09/14 atendidos; versões sintéticas possíveis, evidência territorial operacional separada. |
| 10 | 27 — Solicitar/acompanhar correção | L1, 1/2 | GPT-6 Luna XHigh | Após 26; fechar resposta/canal pertinentes e aplicar E11; integrar contrato de encerramento do 15. |
| 11 | 36 — Documentos institucionais | L1, 2/2 | GPT-6 Luna XHigh | Após 27 para procedimento real; texto final/canais/responsáveis ainda condicionam aceite. Sem publicar por inferência. |
| 12 | 17 — Revisar/publicar | Individual | GPT-6.1 Sol High | 16 atendido; pode ser antecipado, sem esperar coleta/fórmula. |
| 13 | 18 — Corrigir/retirar publicação | Individual | GPT-6.1 Sol High | Após 17. |
| 14 | 35 — Avisos de atualização | Individual | GPT-6.1 Sol Medium | Após 18 (10 atendido). |
| 15 | 20 — Coleta recente | Individual | GPT-6.1 Sol Medium | Após 17 e escolha/autorização/condições/custo/extração definidos; E20 segue pendente. |
| 16 | 22 — Painel operacional | Individual | GPT-6 Luna XHigh | Após 20 e seus contratos reais de fila/coleta; não depende de 21. |
| 17 | 21 — Coleta retroativa | Individual | GPT-6.1 Sol Medium | Após 20 e limites/acesso histórico definidos. |
| 18 | 23 — Confiabilidade da ocorrência | Individual | GPT-6.1 Sol High | Após 17 e fórmula/casos/calibragem aprovados; pode preceder coleta quando usar dados sintéticos persistidos. |
| 19 | 24 — Reavaliação de fontes | Individual | GPT-6.1 Sol High | Após 17 e rubrica/amostra/janela aprovadas; não depende de 23. |

M1 permite continuar a trilha analítica recém-entregue sem esperar conta/coleta. L1 é cadeia de correções/conteúdo, com checkpoint entre ambos. O 34 e o 22 usam Luna, mas ficam individuais por dependerem de trilhas diferentes; agrupá-los causaria espera desnecessária. Proposta pendente em 30 bloqueia 31; proposta pendente em 36 não desfaz o aceite do 27.

## Limites que permanecem

Entrevista registra E01–E19 aprovadas e E20 pendente; fórmulas/rubricas, vigência real e parte dos formatos/canais ainda exigem definição no incremento. Ordenação/página do Histórico e estrutura do XLSX já foram aprovadas em 28/33 e não devem ser reabertas como pendentes. Reusar o snapshot/recorte do 29 nas análises sem alterar dados silenciosamente.

QR/códigos de recuperação MFA e backup/restore continuam lacunas de cobertura dos tickets antigos, sem novos IDs criados nesta consulta. Não incluir tais complementos implicitamente na contagem dos 19 nem declarar E01–E19 integralmente implementadas.

## Prompt e verificação

[Prompt genérico](../../tools/prompts/implement-selected-batch.md) atualizado para selecionar um ticket ou lote, preservando modelo/effort escolhido e checkpoints. Foram consultadas as skills implement, TDD, code-review e diagnosing-bugs na preparação anterior; a orientação writing-for-agents foi aplicada à revisão do prompt. Nenhuma execução de implementação/revisão por subagentes nesta consulta.

Conferência documental sem novos testes web/API/Playwright. `bash scripts/verify.sh planning` passou (346 links locais, sem checar âncoras/URLs externas); `git diff --check` passou. Próxima execução sugerida: **30 → 31, GPT-6.1 Sol Medium**, fechando apenas os parâmetros correspondentes.
