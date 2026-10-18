# Ticket 06 — retomada em 15/10/2026

Execução `3a9b5e2bcd16`, solicitação `9e27e909278c4735bf38f51fa655d20c`, fase `implement`. HEAD observado: `505a0b1`. Implementação histórica integrada em `01a005a`; sem novo commit, publicação, dados reais ou subagentes.

## Continuidade e arquivos

Lidos `PLAN.md`, `AGENTS.md`, ticket original 06, log anterior indicado em `.scratch/consulta-coerente/controller-logs/06-implement-9e27e909278c4735bf38f51fa655d20c.log`, dependências 04/05, spec D03–D05/CA02/CA03/CA06 e documentos de escopo, arquitetura, estrutura e operação web. O log indicado contém o início desta mesma solicitação; não contém uma conclusão anterior adicional. A evidência histórica do ticket foi preservada, sem convertê-la em aceite atual. A dependência 04 registra conclusão histórica; 05 tem código integrado, mas seu checklist original permanece desmarcado, sem novo aceite nesta retomada.

Inspecionados alternância/suspensão/reconciliação em `apps/web/src/app/app.ts`, controles em `app.html`, testes em `app.spec.ts` e jornada `apps/web/e2e/two-modes.spec.ts`. O escopo já tem implementação e testes locais; nenhuma alteração funcional nova foi feita sem a possibilidade de demonstrar a jornada exigida. Hashes SHA-256 de `app.ts`, `app.spec.ts`, `src/styles.scss` e `e2e/clustering-and-overlap.spec.ts` conferem com o baseline recebido. Alterações preexistentes, inclusive do Ticket 07, preservadas.

Novas edições desta retomada: este histórico, acréscimo de estado em `PLAN.md` e entrada em `CHANGELOG.md`. Logs novos ficam no diretório local ignorado `.scratch/consulta-coerente/evidence/06-3a9b5e2bcd16/`; checklist original e estado do controlador não foram editados manualmente.

## Verificações novas

- `bash scripts/verify.sh web`: concluído com mensagem final de sucesso; lint passou, 7 arquivos/85 testes unitários passaram e build passou, bundle inicial 600,60 kB. Aviso de 100,60 kB acima do orçamento de 500 kB. Log completo: `ticket06-web.log` no diretório de evidências acima.
- Em `apps/web/`, `npx playwright test e2e/two-modes.spec.ts --project=chromium --project=firefox`: falhou antes dos cenários, com `Process from config.webServer was not able to start. Exit code: 127`. Log: `ticket06-playwright.log`. O wrapper usado para exibir o log terminou com status 0 por executar `cat` depois do Playwright; esse status não é sucesso do Playwright. Nenhum teste de navegador foi declarado aprovado.
- `curl -I --max-time 3 http://127.0.0.1:4201`: exit 7, `failed to open socket: Operation not permitted`. Confirma restrição de socket local; não depende de credencial nem de parâmetro de produto.
- `bash scripts/verify.sh planning`: exit 0, 193 links locais conferidos; âncoras e URLs externas não verificadas. `git diff --check`: exit 0 antes e depois das edições documentais.

## Bloqueio e próxima ação

A política do executor não permite elevar permissões. É necessário um executor com sockets HTTP locais e Chromium/Firefox disponíveis para reexecutar a suíte direcionada e conferir a jornada original: preferência sem restaurar consulta, filtros visíveis por modo, suspensão/reaplicação e incompatibilidade, município conservado, Histórico/Relatórios/calor, foco/teclado, lista, estados de carregamento/erro/vazio e apresentação móvel. QA físico e matriz E2E completa permanecem não verificados. Nenhum aceite novo por resultados históricos ou por build. Retomada bloqueada na demonstração em navegador, com código local existente preservado e registros prontos para revisão independente.

## Reexecução local em 15/10/2026

Servidor HTTP local e Playwright Chromium/Firefox foram validados neste executor. `npx playwright test e2e/two-modes.spec.ts --project=chromium --project=firefox --workers=1`: **10/10 passaram** (cinco jornadas por engine). Cobriu primeira visita simples e preferência de modo, suspensão/reconciliação, subtipo incompatível/compatível, mudança de município para Niterói sem restauração do município anterior, filtros avançados e erro de faixa, teclado/foco e viewport móvel de 390 px.

`bash scripts/verify.sh web`: passou com lint, 85 testes unitários e build de 600,60 kB (aviso de 100,60 kB acima do limite de 500 kB). `bash scripts/verify.sh planning`: 193 links locais; `git diff --check`: passou. Este ticket não exige API/PostGIS. Estados de atualização/falha/vazio e alternativa da lista são cobertos pelos critérios e E2E próprios dos tickets 05/10; não duplicamos os fluxos aqui. Essa execução conjunta permanece registrada por ticket separado. Dependência 04 tem critérios concluídos. A dependência 05 mantém critérios próprios em aberto, enquanto a mudança de município e preservação de consulta requeridas especificamente por 06 passaram nesta jornada.

Revisão própria desta sessão: diff funcional de 06 já existia em `01a005a`; não foi refeito nem alterado. O registro anterior que bloqueava por socket é histórico; esta reexecução substitui seu estado para os testes direcionados. Sem novo commit porque `PLAN.md`, `CHANGELOG.md` e outros arquivos já continham alterações de trabalho anterior, não isoláveis sem incluir conteúdo preexistente. Modo, preferências e consulta continuam demonstrativos locais; dispositivo físico e matriz E2E completa não foram verificados.
