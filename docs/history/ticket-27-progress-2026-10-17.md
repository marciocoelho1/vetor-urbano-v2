# Ticket local 27 — 17/10/2026

Branch `integration/functional-spec-v1`. Baseline completo anterior a qualquer edição: `/tmp/vetor-baseline-20261017-192820`, 732 arquivos e hashes, HEAD e patches staged/unstaged. Os arquivos de ambiente foram excluídos da leitura. Trabalho anterior preservado; commits usam patches do baseline para separar os deltas próprios.

Implementado canal privado autenticado de pedidos e acompanhamento, validação de alvo publicado/área validada separada do experimento 26, fila ADMIN/MFA, quatro estados, motivos e controle de versão transacional. Migração V10 nova, sem modificar migrações existentes, sem ativar edição territorial. [Contrato](../architecture/corrections-local-v1.md).

## Evidências

- RED: `VETOR_API_INTEGRATION_TESTS=CorrectionHttpIT bash scripts/verify.sh api` com JDK 21 local: falhou 403 esperado/404 observado, endpoint ausente. A primeira tentativa sem JDK não executou testes (`javac` ausente).
- GREEN direcionado: mesmo comando, JDK `/tmp/vu-selected-jdk21`, Podman/Testcontainers PostgreSQL 17/PostGIS 3.5 isolado: 15 unitários + 2 integrações HTTP, zero falhas/erros/pulados. Registro local `/tmp/vetor-27-tests2.log`. Cobre autenticação/CSRF, alvo inválido/experimental, privacidade entre usuários, reinício do Java com persistência, nenhum efeito na ocorrência, ADMIN/MFA, motivo, conflito, referência aplicada inválida, alvo de área validada e encerramento do solicitante com continuidade factual e revisão de minimização.
- `npx ng build` em `apps/web`: passou, avisos de bundle/pako preservados; não equivale à suíte web completa.
- `VETOR_ACCOUNTS_E2E=1 npm run test:e2e --prefix apps/web -- correction-channel.spec.ts --workers=1`: **2/2 Chromium/Firefox**, HTTP real em banco novo `vu-batch-27361718-db`, porta 55439; vazio, envio por teclado/foco, recarga/persistência, carga, erro/recuperação e 390 px. Falha de rede simulada somente no cenário de erro; recebimento/persistência reais.

Suítes completas web/api/planning e revisão Standards+Spec serão consolidadas no lote antes do encerramento. Não declarar aceite completo antes dessas evidências. Documentação institucional será reconciliada no ticket 36, na ordem autorizada. Sem push, deploy, contratação, dados reais ou alteração dos bancos preexistentes.

## Revisão Standards + Spec

Dois agentes independentes revisaram o delta do baseline. Standards encontrou perda de evidência factual no encerramento; Spec confirmou esse achado e apontou ausência de auditoria no detalhe e jornada administrativa insuficiente. Corrigidos: minimização em lugar de destruição indiscriminada, marca obrigatória de revisão humana antes da decisão, detalhe auditado sem duplicar eventos internos e jornada ADMIN/MFA→decisão→titular. A minimização heurística não homologa anonimização de textos reais; esse limite operacional permanece explícito.

Verificação adicional: `verify.sh web` passou (lint, 124 testes e build); `verify.sh planning` passou com 390 links. A jornada ADMIN expôs dependência reativa indevida que voltava da fila administrativa para pedidos próprios; corrigida usando `untracked` na recarga inicial. A rodada intermediária teve 1 falha Chromium/3 passados e não conta como aceite; repetição final registrada no checkpoint do lote. A referência aplicada válida de área também foi comprovada via HTTP.

Staging compartilhado por delta do baseline: `app.ts` 2 hunks próprios, 20 preexistentes preservados fora do índice; `app.html` 1 próprio, 1 preexistente; `PLAN.md` 1 próprio e 3 preexistentes; `CHANGELOG.md` 1 próprio e 5 preexistentes. `styles.scss` não alterado por este ticket. `tickets-status.md` já era arquivo não rastreado do responsável: alterações de estado serão mantidas na árvore e registradas no histórico, sem incorporar o arquivo anterior inteiro ao commit.

Repetição final após as correções: **4/4 Playwright Chromium/Firefox** (`/tmp/vetor-27-accepted2-e2e.log`), incluindo Administrador com MFA iniciando análise/concluindo e titular observando o motivo. A rodada anterior ainda selecionava fixture antiga pelo texto; corrigido usando referência única por execução. API direcionada final: 15 unitários + 2 integrações, zero falhas, `/tmp/vetor-27-accepted-api.log`. Revisão Standards reavaliou a minimização sem novo finding acionável. A suíte completa do lote continua como próxima verificação.
