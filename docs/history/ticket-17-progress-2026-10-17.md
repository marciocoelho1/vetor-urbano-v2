# Ticket local 17 — 17/10/2026

Ordem preservada: commits 27 `5af44ed` → 36 `a7469e4` → revisão/publicação sintética 17. Baseline da fatia compartilhada: `/tmp/vetor-after36`; baseline original completo permanece em `/tmp/vetor-baseline-20261017-192820`.

Implementados fila ADMIN/MFA, original/extração, prioridade/espera, catálogo/núcleo obrigatório no servidor, conflito essencial com resolução humana explícita, publicação de vários efeitos no mesmo acontecimento, associação versionada sem duplicar ocorrência, pendência/descarte justificados, idempotência e concorrência com histórico/autoria. V11 nova; [contrato](../architecture/publication-review-local-v1.md).

## Testes e revisão

- RED HTTP/PostGIS: fila ausente respondeu 404 em vez de 200 após ADMIN/MFA; usuários comuns já eram recusados pelo limite de acesso.
- GREEN direcionado: `JAVA_HOME=/tmp/vu-selected-jdk21 PATH=/tmp/vu-selected-jdk21/bin:$PATH VETOR_API_INTEGRATION_TESTS=PublicationHttpIT bash scripts/verify.sh api`: **15 unitários + 5 integrações HTTP/PostGIS**, zero falhas/erros/pulados, `/tmp/vetor-17-effects-tests.log`. Comprova exclusividade administrativa/CSRF, campos essenciais, conflito e nota alta, associação/pending/descarte, replay após reinício, replay HTTP concorrente e autoria histórica após encerramento; também dois efeitos de uma referência e local somente municipal sem coordenadas.
- Build Angular passou (`/tmp/vetor-17-build2.log`), com avisos de bundle/pako; suíte completa será consolidada no lote.
- Playwright separado usa banco sintético próprio `vetor_batch_review` no contêiner do lote, preservando os bancos de rodadas anteriores. A primeira rodada teve 2 falhas por seletor exato de label com opções; corrigido. A rodada final ampliou efeitos relacionados e localização municipal; resultado abaixo.
- Standards independente sem finding acionável. Spec encontrou limitação a um efeito/clipping e bairro obrigatório; corrigidos com publicação transacional de múltiplos efeitos e bairro desconhecido explícito, com teste HTTP e navegador.

Não há scraping, calibração automática, dados reais, deploy, push ou declaração de prontidão operacional. Conteúdo sintético não comprova qualidade de fontes reais. Verificação web/api/planning completa do lote ainda pendente.
