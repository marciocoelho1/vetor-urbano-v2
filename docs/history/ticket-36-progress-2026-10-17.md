# Ticket local 36 — 17/10/2026

Após o canal 27 (`5af44ed`), os quatro documentos públicos foram revisados para **rascunho local v1.3, 17/10/2026**. Termos/metodologia mantêm dados sintéticos, precisão e limites de cobertura; privacidade distingue demonstração sem login do modo HTTP autenticado, prazos aprovados de produto (60/180/365 dias), histórico de domínio e backups ainda não operados. Conta/encerramento e minimização de pedidos refletem o comportamento implementado, sem promessa de anonimização garantida.

Correções explica canal autenticado efetivo, protocolo, quatro estados, motivo/versão comprovada, acompanhamento na aplicação e separação de novos relatos/alteração automática. Áreas experimentais continuam inelegíveis. Na demonstração sem API há link para o ambiente integrado; os documentos continuam públicos. Nenhum texto foi aprovado como publicação jurídica, serviço operacional ou conformidade certificada.

## Verificação

- RED Playwright Chromium: a expectativa v1.3 falhou contra o documento v1.2, antes da alteração do conteúdo (`/tmp/vetor-36-red.log`).
- GREEN direcionado: jornada dos quatro documentos em Chromium/Firefox, teclado/foco/retorno e 390 px; resultado final registrado abaixo.
- Estados de carregamento/erro/vazio do canal pertencem ao 27 (4/4 nos dois motores), com HTTP/PostGIS real; textos institucionais são estáticos e esses estados não se aplicam ao conteúdo.
- Suítes completas web/api/planning serão consolidadas no lote; testes direcionados não substituem esses comandos. Revisão Standards+Spec independente solicitada sobre delta pós-27.

Baseline de staging deste ticket: `/tmp/vetor-after27`. Os hunks preexistentes de aplicação/plano/changelog continuam fora dos commits. `tickets-status.md` era não rastreado antes do lote: manter atualização local sem incorporar conteúdo preexistente. Sem push, deploy, dados reais ou contratação.

GREEN final: **2/2 Chromium/Firefox** (`/tmp/vetor-36-green.log`); `verify.sh planning` passou. Revisões Standards e Spec independentes sem findings acionáveis. Staging: `app.html` 7 hunks próprios aplicados, hunk preexistente excluído; PLAN e CHANGELOG 1 hunk próprio cada, sem incorporar alterações anteriores.
