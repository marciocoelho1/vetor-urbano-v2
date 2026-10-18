# Reconciliação da spec e proposta local de tickets — 15/10/2026

Tarefa autorizada: converter a spec interna v1.1 em tarefas, reconciliar documentos, preservar alterações/IDs e apresentar divisão antes de implementar. Validação principal pelo navegador já aprovada; publicação no GitHub público ainda pendente. Aplicadas as skills to-tickets e domain-modeling. Não houve implementação, teste da aplicação, fonte nova, contratação, commit/push ou operação no GitHub.

## Fontes e estado inspecionados

Lidos AGENTS, PLAN, GLOSSARY, spec integral, escopo, definição, inventário, interface, entrevista Q1–Q14, arquitetura, estrutura, operação, guias de tracker/triagem/domínio, requisitos originais e procedência territorial. Não existe ADR ou mapa de glossários nesta árvore. Inspecionados modelo/fixtures, componente/interface, testes de domínio e navegador, configuração Playwright e executor de verificação.

Branch `feat/ui-ux-gallery`. Já havia alterações locais em CHANGELOG, GLOSSARY, PLAN, índice e escopo, além de entrevista/definição/inventário/spec e ODT não rastreados. O ODT e seu lock não foram tocados. Nenhuma alteração anterior foi descartada: cópias integrais do estado recebido de plano, glossário e documentos de produto ficaram em [product-before-spec-2026-10-15](product-before-spec-2026-10-15/README.md). A entrevista e o changelog anteriores permanecem integrais.

## Reconciliação de decisões

| Registro anterior | Decisão vigente da spec | Tratamento |
|---|---|---|
| Q9 aguardava material; catálogo aberto | D04 aprova catálogo/pilares/tipos/subtipos | Atualizados documentos correntes; entrevista antiga preservada. |
| Rio/Baixada com municípios em aberto | D03 deseja toda a RMRJ | Registrar mudança de direção; limites oficiais ainda necessários, sem declarar cobertura real. |
| Acesso anônimo/autenticado pendente | D03/D11 exigem conta para módulos e páginas institucionais anônimas | “Mapa público” é termo legado para consulta comum autenticada. |
| Administrador sem relação com perfis legados | D11 aprova Usuário/Administrador | Não equiparar Gestor/Operador nem declarar RF06 encerrado; MFA e sessão legados preservados para reconciliação. |
| Histórico/reprodução/Inteligência de Dados em brainstorm | D03/D08 aprovam Histórico avançado e Análise e Inteligência; reprodução fora do MVP | Atualizar escopo, sem redesenho ou remoção de código agora. |
| Instante de 24 h/raio inicial/alternativa de localização abertos | D05/D06: data do fato, 5 km inicial/máximo, manual disponível, recentes + vigentes antigas | Validar fixtures agora; geolocalização real com backend. |
| “Inativas” sem relação com estados existentes | D06: Em andamento/Encerrada/Desconhecida, confirmação expira para Desconhecida | Não mapear quatro estados antigos automaticamente. |
| Ações da fila e correções não ratificadas | D12 aprova conferir/corrigir/associar/aprovar/descartar/manter pendente e versões/retirada | Tickets de revisão/autorização no servidor; triagem atual não basta. |
| Avaliação pública e fonte em aberto | D10: número/link da ocorrência; fonte/rubrica/fórmula internas, URL opcional da fonte | Glossário/páginas alinhados; fórmula/amostra seguem parâmetros pendentes. |
| Relatórios apenas direção inicial | D08: independência, transferência explícita, snapshot, síntese/comparação/XLSX/PDF | Tickets futuros com aceite próprio e sem herdar recorte do mapa silenciosamente. |

IDs RF01–RF07/RNF01–RNF08 preservados, bem como referências/aceites legados. CA01–CA25 são exclusivos da spec. Severidade de RF01 não é confiabilidade e RF06 continua sem equivalência aprovada. RNF de segurança, desempenho e operação não são encerrados por frontend.

## Divisão e limites

[36 rascunhos locais](../../.scratch/consulta-coerente/README.md), um por arquivo, numerados com bloqueadores anteriores. 01–11 são o primeiro lote demonstrativo; 12–36 são proposta de integrações posteriores do MVP e não recebem autorização implícita de execução. Cada arquivo declara comportamento, critérios de aceite, dependências e condições de início. Estado inicial `needs-triage` até a divisão ser aprovada; `ready-for-agent` somente após aprovação/fechamento das pendências necessárias. Ausência de bloqueador de ticket não significa autorização de execução.

Fronteira inicial sugerida: 01. Nenhum prefactor amplo é necessário; adaptar catálogo/dados legados junto à primeira consulta e extrair regras somente para uso concreto. API/contas não são bloqueios inventados das fixtures; análise persistida não espera coleta real se há dados sintéticos revisados.

Spec e tickets foram explicitamente ignorados pelo Git para reduzir inclusão acidental em commit. Os demais documentos também não foram publicados. Links internos/rascunhos precisarão de revisão de conteúdo/destino antes de eventual publicação; não há autorização de exposição de material interno por essa reconciliação.

## Verificação desta etapa

`bash scripts/verify.sh planning` passou: 175 links locais, presença documental e sintaxe Bash. `git diff --check` passou. Auditoria local passou: 36 arquivos individuais, campos/aceites presentes, bloqueadores anteriores sem ciclos e cobertura documental de CA01–CA25; não é aceite funcional. SHA-256 confirmou spec e cinco cópias anteriores intactas; diferenças em apps, referências e mapas ausentes. Índice/spec tiveram 98 links locais adicionais conferidos. Âncoras e URLs externas não foram verificadas. [Relatório local](../../.scratch/consulta-coerente/verification.json). Testes de aplicação/browser não foram executados porque a etapa não altera aplicação e pede divisão antes de implementação. A aprovação anterior do navegador define a estratégia, não é evidência de que estes cenários passaram.

## Continuidade

Revisar se cada tarefa cabe em um contexto, se as dependências bloqueiam de fato e se algum item deve ser unido/dividido. Consolidar somente após aprovação da divisão. Nenhuma publicação ou implementação nesta etapa. Textos institucionais têm planejamento aprovado, mas redação/revisão própria; landing page e parâmetros de operação não foram inventados.

A primeira verificação documental detectou links relativos deslocados nas cópias históricas; as cópias foram movidas sem alteração de bytes para a área local de preservação, mantendo um índice histórico com navegação atual. A nova execução de planning passou; não se alterou o verificador para ignorar falhas.


## Consolidação autorizada do lote 01–11 — 15/10/2026

Após esclarecimento do total de 36 tarefas, o responsável autorizou consolidar as primeiras 11 e avaliar ao final a viabilidade de seguir às 25 restantes. Escopo executado: planejamento local, sem implementação ou publicação. 01–11 passam de `needs-triage` a `ready-for-agent`, preservando os números e bloqueadores; checkboxes de entrega continuam vazios. Status indica prontidão de escopo, não conclusão ou autorização automática de iniciar código.

Cada ticket recebeu demonstração de conclusão e limite da fatia, eliminando exigências prematuras de subtipo avançado, página explicativa completa e geolocalização real nas tarefas-base. O primeiro ticket registra a recuperação do executor E2E se a falha histórica se repetir, sem declará-la reproduzida. Verificação do lote especifica web/Playwright, sem exigir backend para fixtures. Conteúdo anterior à consolidação fica preservado na área local, e os tickets 12–36 permanecem byte a byte.

[Viabilidade individual das 25 restantes](../../.scratch/consulta-coerente/remaining-feasibility.md): é possível avançar para revisão, com 7 tarefas suficientemente definidas para detalhar, 15 que precisam de propostas/parâmetros e 3 com material externo necessário ao aceite integrado. Isso não transforma o restante em pronto para execução. Próxima revisão recomendada: 12–19; análise persistida pode evoluir sem esperar coleta real. Nenhuma decisão funcional da spec foi reaberta ou parâmetro operacional inventado.

Verificação desta consolidação: `bash scripts/verify.sh planning` passou (180 links locais; âncoras/URLs externas não verificadas), e `git diff --check` passou. Auditoria local confirmou 11 tickets `ready-for-agent`, 25 `needs-triage`, zero aceites marcados como concluídos, demonstrações/limites presentes, IDs/arestas preservados e dependências sem ciclos. Confirmou também os 25 arquivos restantes byte a byte, spec e cinco cópias anteriores intactas e 126 links locais do índice/avaliação válidos. Aplicação, referências e mapas sem alterações; testes web/browser não executados nesta etapa documental. [Relatório local próprio](../../.scratch/consulta-coerente/consolidation-verification.json); a evidência anterior permanece preservada.


## Revisão de todas as 25 restantes — 15/10/2026

O responsável solicitou revisar todos os tickets 12–36 e indicar o próximo passo. Revisão concluída em cada arquivo, não limitada à avaliação anterior de viabilidade. Total permanece 36; spec, IDs RF/RNF e onze tickets consolidados preservados. Cada restante recebeu demonstração, limite de fatia, critério observável específico e condições de início revisadas; todos permanecem propostas em `needs-triage`, sem parâmetros presumidos ou implementação.

Mudanças de arestas: 13 passa a depender de 12 para reutilizar API/banco; 14/17/20/22/24 perdem dependências diretas redundantes preservadas por transitividade. 27 recebe/acompanhamento de pedido sem exigir 18; correção material usa 18/26 quando aplicável. 33 depende de 06/14 para consulta avançada autenticada, sem bloquear na tela Histórico de 28. Justificativas estão nos próprios tickets e na [revisão local completa](../../.scratch/consulta-coerente/remaining-review.md).

Prontidão de escopo após revisão: 8 comportamentos delimitados; 14 incrementos com propostas/parâmetros registrados e 3 com condições externas para aceite operacional. As [propostas](../../.scratch/consulta-coerente/increment-proposals.md) permanecem propostas: não aprovam ordenação, fórmula, vigência, sessão/conta, rubrica, limites de exportação ou política definitiva. Escolhas técnicas rotineiras são do agente no incremento, com fontes primárias atuais quando necessário; não criar novo questionário global.

Próximo passo recomendado: implementar ticket 01 em etapa própria, pois o lote 01–11 já tem divisão aprovada. Browser como validação principal continua aprovado; recuperação de executor E2E só será declarada após execução. Pendências de backend/coleta/nota não bloqueiam catálogo/consulta fictícia. Nada foi publicado ou implementado nesta revisão.

Verificação desta revisão: `bash scripts/verify.sh planning` passou (184 links locais), `git diff --check` passou e auditoria específica confirmou 25 revisados, 11 consolidados intactos, IDs preservados, oito ajustes de dependência sem ciclos e índice coerente. Verificados 155 links locais na área ignorada e integridade SHA-256 da spec/cópias/lote 01–11. Âncoras/URLs externas e testes da aplicação não executados nesta tarefa documental. [Relatório próprio local](../../.scratch/consulta-coerente/remaining-review-verification.json). Evidências da proposta inicial e da consolidação permanecem históricas, sem reescrita de seus resultados.


## Nota de reconciliação posterior — 15/10/2026

A revisão posterior dos tickets originais locais retifica o status acima: checklists de 06 e 10 estão marcados; o checklist de 07 permanece desmarcado. Verificações continuam registros históricos, sem reexecução/aceite nesta etapa. Ticket 11 corresponde a fontes/explicação (`2c34dd9`) e Ticket 36 a documentos institucionais (`84bfa04`), com correção posterior do texto de disponibilidade em `a836616`; `47cba99` não está no Git local. Ticket 12 é proposta de integração pela API Java e PostgreSQL/PostGIS reais, não persistência local. Ticket 09 é demonstração de camada/referência temporal; versões persistidas pertencem ao 26. O procedimento do 36 informa que não há recebimento de pedidos, formulário, fila, protocolo ou acompanhamento na demonstração; envio/acompanhamento efetivos dependem do Ticket 27. Detalhes na retificação datada em `spec-implementation-2026-10-15.md`.
