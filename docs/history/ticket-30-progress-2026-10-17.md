# Ticket local 30 — síntese determinística — 17/10/2026

## Baseline e escopo

Baseline resolvido: `602856d501b209d59da12ad1bd30d930fe381a3d`, branch atual preservada. Antes da edição, 21 arquivos rastreados modificados e arquivos não rastreadados; patch e inventário em `/tmp/vu-30-preexisting.patch` e `/tmp/vu-30-preexisting-status.txt`. Nenhum desses conteúdos integra automaticamente a entrega. A revisão deve usar somente o delta próprio, inclusive nos arquivos compartilhados PLAN.md, CHANGELOG.md e app.ts.

Ticket 30: D02/D05/D08, CA10/CA15 e RF02; dependência 29 concluída localmente. A seleção atual autoriza 30 → 31 e supera a anotação antiga de “integração posterior não autorizada” sem ampliar os limites. E04/E08 e contrato de relatório do 29 preservados: síntese usa o snapshot autenticado, sem nova base, retenção ou dados pessoais.

## Decisão aprovada nesta sessão

Tabelas acessíveis por pilar/tipo, situação, município/bairro disponível e precisão territorial. Distribuição temporal por mês de Brasília somente se todo o intervalo conhecido couber no mês; intervalos entre meses e datas ausentes têm grupos próprios. Certas e possíveis disjuntas, sem inflar por clipping ou relacionados externos. Categorias sobrepostas recebem aviso; soma das categorias não infere total distinto.

Exemplo aprovado: três efeitos de um acontecimento = 3/1; somente Trânsito = 1/1. Fronteiras de teste autorizadas: Chromium/Firefox e HTTP → Java → PostgreSQL/PostGIS real. Sem nova migração quando não houver mudança persistida.

## Execução

Concluído no recorte local sintético. Ambiente anterior temporário ausente; banco exclusivo `vu-ticket30-db`, somente sintético. Tentativas no sandbox falharam por EPERM em sockets; execução local fora dele autorizada pela revisão automática. Esses erros de preparação não contam como vermelho funcional.


## TDD e verificações

- Vermelho funcional: `VETOR_PERSISTED_E2E=1 npm run test:e2e -- --project=chromium --workers=1 e2e/report-summary.spec.ts`: falhou pela ausência de `report-summary` após gerar relatório autenticado. Implementação mínima passou 2/2 Chromium/Firefox.
- Segunda fatia: distribuição exclusiva por pilar, além do detalhamento por pilar/tipo. Asserção de tabela Pilar falhou no Firefox; implementação acrescenta contagem deduplicada por pilar. Uma execução simultânea indevida com cenário de indisponibilidade falhou no acesso; descartada como evidência funcional e suítes repetidas em série.
- API: `JAVA_HOME=<JDK21 local> PATH=<JDK21 local>/bin:$PATH DOCKER_HOST=unix:///tmp/vu30-podman.sock bash scripts/verify.sh api`: 14 unitários + 29 integrações HTTP/PostGIS, BUILD SUCCESS. Inclui autorização de relatório e persistência após reinício. Nenhum código/migração da API alterado.
- A primeira verificação web passou 111 testes e build de 698,65 kB; a execução final está registrada abaixo.

A rodada completa final após implementação passou 18/18 (`VETOR_PERSISTED_E2E=1 VETOR_E2E_DATABASE_CONTAINER=vu-ticket30-db npm run test:e2e -- --project=chromium --project=firefox --workers=1 e2e/report-summary.spec.ts e2e/persisted-query.spec.ts`, em apps/web). `verify.sh web` passou lint, 111 unitários e build 698,79 kB (aviso +198,79 kB). `planning` passou 347 links; diff-check passou. Captura móvel em `/tmp/vu30-summary-mobile.png` inspecionada: tabelas sem transbordamento, alternativa textual/lista preservada.

Revisão em dois subagentes contra `602856d...b5cbde5`: Standards sem findings; Spec sem finding funcional, solicitando apenas consolidar este registro antes de encerrar. A checagem adicional de 3/1 passou 4/4 Chromium/Firefox após corrigir um erro de roteiro (bairro desabilitado sem município). Revisão Spec adicional desse delta sem findings.


**Checkpoint:** ticket 30 concluído localmente; commit funcional `b5cbde5`, reforço do cenário e checkpoint neste registro. Todos os critérios locais marcados com evidência atual. Sem prontidão operacional, coleta ou base externa. Próxima ação: ticket 31, somente após este checkpoint.
