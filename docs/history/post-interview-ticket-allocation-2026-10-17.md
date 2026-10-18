# Tickets após entrevista: modelos, lotes e condições — 17/10/2026

Revisão solicitada após a entrevista. Substitui a distribuição de modelos anterior para planejamento; não implementa nem encerra tickets.

## Evidências e alcance

HEAD continua `2e43914`; trabalho preexistente rastreado/não rastreado preservado. Lidos plano, [inventário](../product/tickets-status.md), tickets individuais, spec, [política E01–E19](../product/account-and-records-policy.md), [entrevista](decision-interview-2026-10-17.md), [pesquisa da fonte](initial-source-research-2026-10-17.md), ADR 0001 e contratos. Inspeção do código confirma ausência de novas jornadas completas de recuperação/encerramento, códigos de recuperação/QR e rotinas de backup no recorte investigado. Sem reexecução funcional.

Nova tentativa de `gh issue list --state all --limit 100 --json number,title,state,url,updatedAt` falhou por conexão; conector GitHub retornou `issues: []`. Estado remoto não confirmado. IDs abaixo são dos arquivos locais, não números do GitHub.

Permanecem **22 tickets locais restantes**: 07/36 com pendências de aceite e 20 por implementar (15, 17–35). A entrevista não é implementação. O JSON antigo do controlador não prevalece sobre checkpoints posteriores dos tickets já aceitos.

## O que mudou na documentação

E01–E19 foram aprovadas para conta/registros: links sensíveis de dez minutos, QR e recuperação MFA, encerramento definitivo, autoria histórica separada, minimização de logs de uso, retenções 60/180/365 dias, backups com teto de sete dias, preservação excepcional e revogação de todas as sessões.

A documentação ainda registra entrevista **em andamento** e E20 **pendente**. Agência Brasil/RSS é candidata condicionada, não fonte autorizada para coleta. Fórmula/rubrica/amostra de 23/24, prazos operacionais de vigência, ordenação/granularidade/arquivos e parte dos canais/textos continuam abertos. Não afirmar que a entrevista resolveu todos os blocos.

## Distribuição completa

Julgamento de engenharia sobre risco/escopo, não requisito técnico do modelo nem benchmark. Medium pode ser elevado se aparecer dificuldade concreta; High concentra invariantes de identidade, escrita editorial e avaliação. [Documentação oficial de modelos](https://developers.openai.com/api/docs/models) caracteriza Sol como equilíbrio capacidade/custo e Luna para trabalho focado de maior volume; [uso do Codex](https://learn.chatgpt.com/docs/pricing) não oferece equivalência fixa de cota por effort/ticket.

| ID | Ticket resumido | Modelo | Entrada/limite |
|---|---|---|---|
| 07 | Agrupamentos/sobreposições | Sol Medium | Retomar falha MapLibre/Firefox e lacunas de aceite; sem nova decisão de produto. |
| 15 | Recuperar/alterar/encerrar conta | Sol High | Aplicar E01–E19 pertinentes e ADR; alinhar autoria/logs com 19 antes da eliminação. Caixa sintética para mensagens locais; operação externa separada. |
| 17 | Revisão/publicação | Sol High | 16 aceito localmente; associação manual, sem aguardar fórmula/coleta. Preservar contratos de identidade/atores vigentes. |
| 18 | Correção/retirada | Sol High | Após 17; concorrência, versões e propagação consistente. |
| 19 | Logs/retenção | Sol High | E04/E08–E10/E16/E18 ampliam risco de migração/minimização/expurgo. Já não recomendar Luna para o conjunto atual. |
| 20 | Coleta recente | Sol Medium | Após 17 e fechamento de E20/direitos/frequência/custo/extração; não executar coleta real só porque fonte existe no 16. |
| 21 | Coleta retroativa | Sol Medium | Após 20 e limites/acesso histórico definidos; elevar se concorrência/checkpoints exigirem. |
| 22 | Painel operacional | Luna XHigh | Após 20 aceito e contratos reais de coleta/fila disponíveis. |
| 23 | Confiabilidade da ocorrência | Sol High | Após 17 e fórmula/casos/calibragem aprovados. |
| 24 | Reavaliação de fontes | Sol High | Após 17 e rubrica/amostra/janela aprovadas; não depende de 23. |
| 25 | Proximidade/vigência | Sol Medium | 08/14 atendidos; configuração sintética explícita permite incremento local, não aprovação de prazos reais. |
| 26 | Versões de Áreas de Risco | Sol Medium | 09/14 atendidos; versões sintéticas possíveis, operação cartográfica exige evidências próprias. |
| 27 | Solicitações de correção | Luna XHigh | Após 26; fechar apresentação de resposta/canal no incremento e aplicar E11 ao conteúdo/vínculo. |
| 28 | Histórico paginado | Luna XHigh | 06/14 atendidos; propor/aprovar ordenação de datas imprecisas, desempate e página antes da conclusão. |
| 29 | Relatório independente | Luna XHigh | 06/14 atendidos; fluxo mínimo pode iniciar sem 28/30/33. |
| 30 | Síntese determinística | Sol Medium | Após 29; proposta de granularidade com precisão preservada. |
| 31 | Comparação de recortes | Sol Medium | Após 30; definir duração/base zero/cobertura/apresentação. |
| 32 | Mancha térmica | Sol Medium | 06/14 atendidos; regra sem pesos já aprovada, calibragem de renderização técnica. |
| 33 | XLSX completo | Luna XHigh | 06/14 atendidos; definir colunas/ordem/limites. Não depende do 28; testar massa maior que porção visível. |
| 34 | PDF | Luna XHigh | Após 30 e aprovação do exemplo visual/composição. Não depende de 31. |
| 35 | Avisos de atualização | Sol Medium | Após 18 (10 já atendido); mecanismo/frequência técnicos no escopo. |
| 36 | Documentos institucionais | Luna XHigh | Após fluxo do 27 para recebimento/acompanhamento; políticas/textos/canais finais continuam condição de aceite. Rascunho local não equivale a publicação aprovada. |

Totais dos 22: **7 Luna XHigh, 9 Sol Medium, 6 Sol High**.

## Lotes Luna

“Juntos” significa lista de trabalho no mesmo chat, **sequencialmente e com checkpoint por ticket**. Não significa vários agentes/chats editando simultaneamente este checkout: App, migrações e documentos são compartilhados. As setas internas indicam ordem de execução proposta, não novas dependências do grafo.

| Lote | Ordem de execução | Condição de entrada |
|---|---|---|
| L1 — consulta e arquivo | **29 → 28 → 33** | 29 pronto no recorte local; 28/33 exigem exemplos/propostas delimitadas ainda não aprovadas. Não bloquear 29 esperando essas decisões. 28 e 33 não se bloqueiam; se um depender de resposta, avançar no outro pronto. |
| L2 — correções e conteúdo | **27 → 36** | 26 aceito e contratos de eliminação/autoria compatíveis com E11; recomenda-se integrar 15/19 antes. Concluir 27 antes do conteúdo funcional do 36; textos/canais externos não resolvidos impedem aceite definitivo de 36. |
| L3 — PDF | **34** | 29/30 aceitos e composição aprovada. Nenhuma espera por 31 ou coleta. |
| L4 — operação | **22** | 17/20 aceitos com integração autorizada e contratos de estado reais. Nenhuma espera por 21/23/24. |

L3 e L4 ficam separados por terem bloqueadores diferentes; reuni-los aumenta espera/contexto sem benefício concreto. Não enviar os sete como lote indiferenciado.

Precedência recomendada para reduzir retrabalho, sem alterar arestas originais: alinhar contrato de atores/expurgo do 19 → concluir 15. Isso não significa depender do 15 para implementar o núcleo de retenção do 19: 19 define mecanismos/contrato, 15 consome na transação de encerramento. Entregar cada incremento em fatias verificadas. 17 pode avançar no seu núcleo manual; 18 segue depois. Trilhas analíticas e espaciais podem trabalhar com dados fictícios persistidos, sem esperar coleta real.

## Lacunas novas sem IDs criados

Os 22 não cobrem sozinhos toda a política aprovada. Antes de declarar cobertura E01–E19, mapear explicitamente:

- E05: QR local e códigos de recuperação/substituição de MFA, ausentes do aceite histórico do 14; **complemento recomendado com Sol High**, mantendo o aceite antigo restrito ao escopo anterior.
- E19: ação de encerrar todas as sessões; pode ser critério explícito do 15, sem fingir que a função interna `revokeAll` já oferece a jornada.
- E14: avisos transacionais; testes locais podem usar caixa sintética, mas transporte/provedor/contestação de produção não definidos.
- E17/E18: supressões, restore, expiração de cópias e preservação excepcional não se resumem à tela de logs. **Planejar entrega própria com Sol High**, separando demonstração local de infraestrutura/custo/guarda legal pendentes.

Sem criação/publicação de tickets nesta revisão. Registrar propostas de complementos/desdobramento antes de absorver tudo num único ticket; não inflar a contagem oficial por tarefas ainda não criadas.

## Skills e execução

Lidos `implement`, `implement-spec` e `diagnosing-bugs` locais e `mattpocock-skills:tdd`/`code-review` do plugin. Recomendar `implement` por ticket (ou fila sequencial pequena), TDD nas fronteiras já aprovadas e revisão Standards + Spec por incremento. 07 deve usar diagnosing-bugs e regressão do clique real. A revisão code-review usa dois subagentes; isso deve ser explícito no prompt de execução e no planejamento de cota. Não executar revisão vazia ou de alterações alheias como se fossem desta entrega.

`implement-spec` lê o grafo inteiro e distribui implementações por subagentes/worktrees com integração; seu escopo completo não é o pedido de lotes pequenos/controlados. Para esta organização, recomendar implement sequencial. Nenhuma skill de implementação/revisão foi executada nesta análise; foram lidas para preparar a orientação.

Prompt reutilizável: [iniciar lote](../../tools/prompts/implement-selected-batch.md). Ele diferencia IDs locais/GitHub, contratos recentes/propostas e aceites locais/operacionais. Escolha modelo/effort na interface; texto do prompt não altera a configuração sozinho.

## Verificação

Somente revisão/documentação: `bash scripts/verify.sh planning` passou (333 links locais; âncoras e URLs externas não verificadas); `git diff --check` passou. Sem novos testes web/API/navegador ou aceite funcional. Próximo passo: selecionar lote e resolver apenas seus parâmetros pendentes.
