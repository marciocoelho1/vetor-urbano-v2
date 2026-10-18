# Ticket 26 — retomada da persistência territorial

## Baseline e declaração anterior às alterações de implementação

18/10/2026. Branch `integration/functional-spec-v1`, HEAD `84fba01`. Árvore sem alterações rastreadas; `docs/product/tickets-checklist.html` e `scripts/generate-tickets-checklist.py` são trabalho preexistente e não pertencem aos commits desta entrega. Somente ticket 26 autorizado; não executar `ticketctl.py`, push, deploy ou coletar dados reais.

O núcleo anterior é um protótipo inativo: 18 casos históricos de repositório/PostGIS, SQL somente de teste, sem bean, autoria, aprovação, HTTP ou integração web. Esses resultados não foram reexecutados nesta declaração e não comprovam o incremento atual. A camada demonstrativa do 09, os contratos do 27 e as migrações V1–V12 devem ser preservados. O material territorial original não recebeu nova avaliação de autorização, topologia, precisão ou evidência; nenhum aceite operacional é declarado.

## Decisões técnicas do incremento sintético

1. **Versão vigente aprovada:** snapshots incrementais imutáveis; a identidade territorial guarda um ponteiro para a versão explicitamente aprovada. Uma revisão acrescenta snapshot e autoria/papel/justificativa, mas não troca o ponteiro. A aprovação administrativa explícita publica o snapshot mais recente sob lock e comparação de versão, preservando snapshots e decisões anteriores. Antes da primeira aprovação, a área não aparece na consulta. Vigência é editorial, não prova início ou fim de domínio territorial. Sem política pública nova ou aprovação automática.
2. **Correções:** `correction_area_targets` será uma projeção transacional da versão aprovada, com ID textual do UUID territorial e número de versão idêntico. Não é fonte de edição independente. O canal existente permanece privado e sua comprovação de aplicação consulta uma versão efetivamente aprovada; preparar revisão não satisfaz essa comprovação. Fixtures legadas serão substituídas por aprovação territorial real no teste AREA.
3. **Geometria HTTP:** objetos GeoJSON Polygon/MultiPolygon, coordenadas `[longitude, latitude]`, WGS 84/SRID 4326. EWKT permanece interno ao repositório/experimento. Sem reprojeção, ST_MakeValid, alteração de coordenadas sintéticas existentes ou alteração do GeoJSON original. Preservar geometry sem typmod e todos os CHECKs explícitos do protótipo.

## Contrato acordado entre implementação API e web

- `GET /api/v1/risk-areas`: sessão completa, `{items: [...]}` somente versões aprovadas.
- `GET /api/v1/admin/risk-areas`: ADMIN com MFA, `{items: [...]}` snapshots mais recentes.
- `GET /api/v1/admin/risk-areas/{id}`: ADMIN com MFA, `{items: [...]}` histórico em ordem crescente.
- `POST /api/v1/admin/risk-areas/{id}/versions`: ADMIN/MFA/CSRF, corpo `expectedVersion`, `name`, `indicatedGroup`, `sourceId`, `evidenceReference`, `referenceDate` (dia ou null), `limitations`, `geometry` (GeoJSON), `justification`; expectedVersion=0 cria identidade e primeira revisão.
- `POST /api/v1/admin/risk-areas/{id}/approvals`: ADMIN/MFA/CSRF, corpo `expectedVersion`, `justification`; aprova apenas a revisão mais recente, recusando replay/conflito.
- Snapshot: `territoryId`, `version`, `approvedVersion` (null antes de aprovação), `name`, `indicatedGroup`, `sourceId`, `sourceName`, `sourceUrl`, `evidenceReference`, `referenceDate`, `limitations`, `recordedAt`, `geometry`, `actor`, `historicalActor`, `actorRole`, `justification`. Escritas retornam snapshot. Leituras comuns não expõem autoria/justificativa administrativa.
- Null não é data atual/grupo presumido. `Disputado` exige evidência específica, não divergência automática. Fonte/evidência/referência temporal/registro técnico são distintos.

## Baseline reexecutado nesta retomada

- `bash scripts/verify.sh api` no host: bloqueado (status 2), `javac` ausente, conforme esperado.
- `VETOR_API_INTEGRATION_TESTS=TerritorialVersionRepositoryIT bash "$TMPDIR/vu26-verify-api.sh"`: status 0. O runner executa o próprio `scripts/verify.sh api` em `docker.io/library/maven:3.9.11-eclipse-temurin-21`, `--network host`, `--security-opt label=disable`, socket Podman e shim `docker info`; sem `--userns=keep-id`. XMLs agregados: 18 unitários + 18 integrações, zero falhas/erros/pulados. Log `$TMPDIR/vu26-baseline-api.log`. Este resultado é baseline anterior ao incremento, não aceite das funcionalidades novas.
- Manifesto SHA-256 fora do Git (`$TMPDIR/vu26-preservation.json`) registra V1–V12, os dois arquivos preexistentes e o GeoJSON original. GeoJSON: `8848047b48da0859a8410b11804340eecac0692e214f85a4d9def30e09797ceb`.
- Material/procedência consultado em [territorial-sources.md](../maps/territorial-sources.md): autorização declarada para demonstração não é validação independente; atualização, topologia, cobertura/precisão e comunicação operacional continuam pendentes. Sem buscar fonte nova.

## Implementação e evidências da retomada

- V13 promove os CHECKs espaciais, autoria histórica e aprovação. O schema sombra de teste foi removido: `TerritorialVersionRepositoryIT` aplica as migrações reais, eliminando divergência entre teste e produção. V1–V12 mantiveram os hashes originais.
- Bean de repositório e serviço transacional preservam append/lock/conflito. Revisão, aprovação, projeção de correção e auditoria factual são atômicas; a versão anterior continua consultável até aprovação explícita. Snapshots fixam a versão do catálogo da fonte, evitando alteração histórica por edição posterior do nome/URL.
- Encerramento desliga autoria em versões, aprovações e auditoria territorial, usando a referência de domínio distinta da de segurança. HTTP/PostGIS comprova ausência do UUID eliminado em tabelas públicas e resposta de logs.
- Canal AREA usa território aprovado real. Projeção isolada ou revisão preparada não comprova aplicação; a decisão exige aprovação correspondente. Auditoria usa módulo `territories`, classe ADMIN e allowlist de parâmetros.
- Web segue `?consulta=api` em loopback; demo padrão preservada. Editor exibe antes/depois, geometria GeoJSON, fonte, data/limitações, autoria e justificativa; aprovação explícita e conflito não substituem formulário silenciosamente. Correções recebem AREA e abrem o editor territorial.
- TDD: HTTP inicialmente falhou por rotas inexistentes; teste de correção revelou aceitação indevida de projeção isolada; geometria malformada revelou 503 em vez de 400. Logs locais: `$TMPDIR/vu26-http-red.log`, `vu26-correction-red.log` e `vu26-http-expanded.log`. Web começou com módulo de domínio/controle administrativo ausentes. Esses resultados vermelhos foram corrigidos antes da validação final.
- Primeiro E2E contra JVM antiga recebeu 404. API reiniciada contra o único banco sintético allowlisted `vetor-spec-postgis`/`vetor_spec_test`/55436, aplicando V13 sem repair/reset. Depois, teste falhou porque exigia contêiner de lista presente no estado vazio; oráculo corrigido para exigir ausência do botão pelo nome exato e ausência da identidade na leitura HTTP. Não foi removida a comprovação de não publicação.

### Comandos e resultados reais

1. `VETOR_API_INTEGRATION_TESTS=TerritorialVersionRepositoryIT,CorrectionHttpIT bash "$TMPDIR/vu26-verify-api.sh"`: status 0; 18 unitários + 20 integrações, zero falhas/erros/pulados. Log `vu26-required-directed.log`. O runner executa `scripts/verify.sh api`, não substitui o executor por Maven manual.
2. `bash "$TMPDIR/vu26-verify-api.sh"`: reexecutado pelo coordenador após remover o SQL sombra, status 0; XMLs agregados com 18 unitários + 93 integrações, zero falhas/erros/pulados. Log `vu26-full-api-parent-final.log`.
3. `bash scripts/verify.sh web`: status 0; lint, 125 testes em 17 arquivos e build. Log `vu26-web-final.log`. Houve uma recusa de formatação no E2E editado pelo coordenador; Prettier foi aplicado somente nele antes da execução verde.
4. `VETOR_ACCOUNTS_E2E=1 VETOR_E2E_DATABASE_CONTAINER=vetor-spec-postgis npm run test:e2e --prefix apps/web -- --project=chromium --project=firefox --workers=1 e2e/risk-areas.spec.ts e2e/risk-area-versions.spec.ts e2e/correction-channel.spec.ts`: **12/12**, status 0, 38,4 s. Log `vu26-e2e-final.log`. Inclui 4 regressões do 09, 4 casos novos de versões/estados e 4 regressões do canal. Revisões/aprovações/consulta/pedido AREA usam HTTP real; apenas respostas de carga/falha/vazio e conflito visual são simuladas. Concorrência/conflito real têm prova PostGIS/HTTP.
5. Manifesto de preservação conferido pelo coordenador: 15 arquivos (V1–V12, GeoJSON e dois preexistentes), nenhum hash alterado.

### Limites e verificações não executadas

Bundle inicial 815,65 kB (aviso +315,65 kB sobre orçamento de 500 kB); `pako` CommonJS continua com aviso. Sem QA físico, leitor de tela ou carga/desempenho operacional. Não foi reexecutada toda a suíte Playwright do repositório nem validados todos os 36 tickets; a seleção contempla as fronteiras alteradas e regressões diretas. Sem dados reais, fonte nova, publicação externa, push ou deploy. Aceite operacional continua aberto: autorização/material, atualização, topologia/precisão, cobertura e evidência reais exigem validação própria.

## Revisão em dois eixos e correções

Primeira revisão independente contra `84fba01`:

- **Standards:** uma violação P2 (instante administrativo mostrado somente no JSON UTC) e um smell P3 (listas de minimização repetidas na escrita/leitura). P2 corrigido: antes/depois e histórico apresentam registro técnico em `America/Sao_Paulo`, com snapshot UTC original identificado separadamente. Unidade usa o caso conhecido 12:00Z → 09:00 e Playwright confere a apresentação do instante persistido. O smell foi avaliado e mantido intencionalmente: escrita e leitura são fronteiras independentes de minimização; a projeção de logs não depende do serviço de edição para decidir sua allowlist. A duplicação pequena é uma escolha de isolamento, não desvio normativo.
- **Spec:** dois P2: projeção cartográfica confundia Disputado com desconhecido; evidências territoriais de autorização/leitura estavam concentradas no ADMIN. Corrigidos: classificação distinta com evidência em ambos os motores, sem inferência por divergência; unidade também recusa disputa sem evidência. HTTP e browser agora autenticam USER, comprovam versão aprovada e ausência dos controles administrativos, além de 403 na listagem e no histórico administrativos reais.
- Testes de domínio das correções foram executados vermelhos antes da implementação (`vu26-review-unit-red.log`). Após correções: `bash scripts/verify.sh web` passou com **127 testes**, lint e build, log `vu26-web-reviewed.log`; bundle **816,47 kB**, aviso +316,47 kB e `pako` CommonJS. API completa reexecutada: **18 unitários + 93 integrações**, zero falhas/erros/pulados (`vu26-api-reviewed.log`). Playwright nos mesmos três arquivos e dois browsers: **12/12**, 39,8 s (`vu26-e2e-reviewed.log`).

- Após as correções, também reexecutados isoladamente: `VETOR_API_INTEGRATION_TESTS=TerritorialVersionRepositoryIT bash "$TMPDIR/vu26-verify-api.sh"` (**18 unitários + 18 integrações**, log `vu26-migration-territorial.log`) e a seleção exigida `TerritorialVersionRepositoryIT,CorrectionHttpIT` (**18 + 20**, log `vu26-directed-reviewed.log`), ambos status 0. `bash scripts/verify.sh planning`: **443 links**, status 0; `git diff --check`: status 0.

Segunda revisão independente dos dois eixos concluída contra o diff final de `84fba01`: **Standards: zero violações pendentes**, P2 de fuso encerrado; **Spec: zero achados pendentes**, ambos os P2 encerrados. Os revisores executaram independentemente os três testes de domínio territorial (todos verdes), e Spec também `git diff --check`; não reexecutaram as suítes completas API/Playwright. O coordenador reexecutou as suítes completas descritas acima. Nenhuma mudança de produto ou seleção de ticket adicional.

**Fechamento local:** critérios de persistência, autoria/revisão/aprovação, HTTP, consulta, auditoria/correções e web do incremento sintético concluídos. Permanece aberto somente o aceite operacional delimitado no ticket: autorização/material/evidência reais, atualização e validação cartográfica próprias. Próxima ação: aguardar seleção explícita do responsável, sem ampliação automática. O controlador não foi executado ou reconciliado.


## Commits e preservação

- `778679e` — `feat(api): persist and approve territorial revisions`: migração, núcleo/HTTP, autoria, correções e provas de API, com contratos correspondentes.
- `e90d172` — `feat(web): review approved territorial versions in API mode`: leitura opt-in, editor territorial, projeção e testes unitários.
- As jornadas E2E e este fechamento são agrupados no commit isolado `test(e2e): verify territorial approval and close ticket 26`; o hash é informado no relatório final, evitando autorreferência dentro do próprio commit.
- Documentos compartilhados revisados integralmente no diff desta fatia e incluídos por caminho exato: `PLAN.md` 1 hunk, `CHANGELOG.md` 1 hunk, `docs/product/tickets-status.md` 5 hunks (contagem com `--unified=0`); zero hunks descartados em cada um, pois não havia alterações rastreadas preexistentes. Sem inclusão dos dois não rastreados do baseline.

## Fronteiras de verificação autorizadas

Fronteiras já autorizadas pelo responsável: repositório/PostGIS (incluindo os 18 casos), HTTP real de autorização/MFA/CSRF, revisão/aprovação, fechamento de conta, auditoria/correções e navegador Chromium/Firefox. Ciclos TDD verticais nas fronteiras existentes; revisão independente em Standards e Spec contra `84fba01` antes dos commits. API por Maven/JDK 21 em contêiner com socket Podman; web/planning pelo executor e Playwright separado. Resultados e limitações registrados acima após execução real.
