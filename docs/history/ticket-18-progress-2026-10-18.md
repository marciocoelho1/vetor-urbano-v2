# Ticket local 18 — 18/10/2026

Rodada autorizada `19 → 11 → 07 → 18`, em um checkout. O ticket 18 foi o último; não houve seleção automática de outros tickets.

## Baseline e isolamento

- Branch `integration/functional-spec-v1`; início desta fatia no commit do ticket 07, `8832013` (`test(e2e): prove unique cluster membership and map states`). Baseline original da rodada: `0da31f5dce4bd91eb0c1dba3e31e54f2d66fe691`.
- O arquivo preexistente não rastreado `docs/product/tickets-checklist.html` permaneceu intacto e fora do escopo. Nenhum segredo foi registrado.
- A fixture SQL só permite os containers/bancos sintéticos explicitamente allowlisted em `apps/web/e2e/helpers/synthetic-admin.ts`; a rodada usou `vetor-spec-postgis` / `vetor_spec_test`. Não houve leitura, reset ou alteração do banco original `vetor_urbano`.

## Causa e correção

**Causa-raiz:** o template exibia os campos antes de `openPublication()` concluir a leitura assíncrona, e a resposta tardia hidratava os campos vazios do servidor por cima da digitação do usuário.

O diagnóstico mínimo bloqueou por rota o GET real de `/api/v1/admin/corrections/{id}/publication`: com a resposta pendente, o campo já existia (RED: esperado zero, recebido um); a instrumentação temporal confirmou que `openPublication()` ainda não havia terminado após a digitação. O teste de regressão agora exige os campos ausentes e um estado acessível de carregamento enquanto a leitura está bloqueada.

A implementação mantém o editor oculto até o detalhe e a revisão de referência estarem carregados, renderiza controles apenas no item selecionado, descarta respostas obsoletas por sequência e invalida a edição quando a identidade da sessão muda. O binding padrão `ngModel` foi preservado; as sondas temporárias foram removidas. Erro de leitura continua visível na região de status existente e o botão de abertura permite nova tentativa.

## Verificações

- RED antes da correção: `VETOR_ACCOUNTS_E2E=1 VETOR_E2E_DATABASE_CONTAINER=vetor-spec-postgis npx playwright test publication-editor.spec.ts --project=chromium --workers=1 --grep "ADMIN prepara"` — falhou exatamente porque o campo aparecia durante a carga.
- GREEN direcionado: o mesmo caso passou em Chromium após o gate de carregamento.
- E2E final: `VETOR_ACCOUNTS_E2E=1 VETOR_E2E_DATABASE_CONTAINER=vetor-spec-postgis npx playwright test publication-editor.spec.ts --project=chromium --project=firefox` — **4/4**, incluindo fila ADMIN vazia antes do pedido, GET real bloqueado durante loading, erro HTTP 503 com retry por teclado, formulário vazio após hidratação, POST com título/motivo/evidência, aprovação e retirada em 390 px sem overflow. `playwright.config.ts` limita a um worker quando `VETOR_ACCOUNTS_E2E=1`, pois a fixture reinicia tabelas sintéticas compartilhadas. A tentativa inicial com quatro workers falhou em dois casos por interferência entre resets concorrentes; a execução serial passou.
- `correction-channel.spec.ts` opt-in: **4/4** Chromium/Firefox; comprova fila vazia, envio por teclado, persistência, carga, erro/retry e 390 px.
- `PublishedEditorHttpIT` usa filtro de categoria e confirma que, após retirar, as contagens da consulta e da exportação futura caem exatamente uma unidade; o registro some de ambas. A trilha `CORRECTION_RETRACTED` persiste autor igual ao ADMIN autenticado e snapshots `PUBLISHED → WITHDRAWN`. A seleção direcionada passou (18 unitários + 3 integrações). Uma asserção inicial presumiu revisão 1 e falhou porque a suíte compartilha a ocorrência seed entre métodos; passou a comparar com a revisão capturada no início do cenário.
- `bash scripts/verify.sh api` diretamente no host ficou bloqueado por ausência de `javac`. Alternativa equivalente executou o próprio script em `docker.io/library/maven:3.9.11-eclipse-temurin-21`, com o socket Podman rootless para Testcontainers: **18 testes unitários + 86 integrações PostGIS**, zero falhas/erros/pulados; `BUILD SUCCESS`. Os bancos dos testes foram containers efêmeros.
- `bash scripts/verify.sh web`: lint, **124 testes unitários** e build passaram. Build inicial 798,33 kB, 298,33 kB acima do orçamento de 500 kB; `pako` CommonJS.
- `bash scripts/verify.sh planning`: **433 links Markdown**; âncoras e URLs externas não verificadas pelo script. `git diff --check` e `git diff --cached --check`: passaram.
- Revisão final Standards + Spec pós-ajustes: nenhuma violação documentada, gap de requisito, comportamento incorreto ou scope creep. Os três achados de cobertura da revisão Spec anterior foram fechados com os testes citados acima. O cheiro heurístico `Duplicated Code` nas consultas/contagens paralelas de query e exportação e na leitura do ADMIN foi mantido: a simetria explícita facilita auditar cada cenário.

## Estado e limites

O critério de navegador do ticket 18 está fechado localmente; não permanece bloqueio de binding/formulário. Isso não representa prontidão operacional, QA físico, implantação ou validação com dados reais. Sem push, merge remoto, deploy, coleta ou dados reais.

A divergência do controlador permanece sem reconciliação: `ticketctl.py` não foi usado; seus checkpoints ainda só reconhecem 01–09 e 11 como aceitos, enquanto as fases obrigatórias 06/36/07/10/`integrated-review` estão incompletas. Nenhum estado do controlador ou issue remota foi alterado.
