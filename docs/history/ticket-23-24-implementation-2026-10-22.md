# Ticket 23 e 24 — implementação local da regra de confiabilidade e da decisão de nota de fonte

Data: 22/10/2026. Escopo: backend (API Java + PostgreSQL/PostGIS) com testes de integração reais.
Não inclui interface nem jornada de navegador; por isso os tickets **não** estão aceitos.

## O que foi autorizado

O responsável aprovou em bloco a proposta de calibração registrada em
[ticket-23-24-calibration-proposal-2026-10-22](ticket-23-24-calibration-proposal-2026-10-22.md), com
os quatro pontos de cada ticket resolvidos conforme a mensagem de aprovação:

- 23: reprodução conta uma vez pela origem; referência = maior nota de fonte independente com
  referência; bônus 0/0,5/1,0; desconhecido neutro (nunca zero); essencial ausente e conflito essencial
  bloqueiam.
- 24: rubrica por afirmação, amostra mínima 10 na janela de 90 dias, descer com ≥30% incorretas e ≥3
  casos, subir com ≥20 verificações e nenhuma incorreta, aprovação humana versionada.

## O que foi construído

- `V20__reliability_rules_and_evaluations.sql`: `reliability_rules` (imutável, proveniência
  `SEEDED_APPROVED` ou `ACCOUNT`), `occurrence_reliability_evaluations` (versions por ocorrência, chave
  de idempotência, fatores e contexto internos, estado `RECORDED`→`PUBLISHED` irreversível) e módulo de
  auditoria `reliability` como `ADMIN`.
- `V21__source_rating_verifications_and_decisions.sql`: `source_statement_verifications`,
  `source_rating_decisions` e `source_reevaluation_flags`, todos append-only com guarda de resolução.
- `ReliabilityService`/`ReliabilityController`: regra vigente, avaliação, reprodução, publicação da nota
  e guarda de publicação.
- `SourceRatingService`/`SourceRatingController`: registro de afirmações, recomendação server-side,
  decisão, sinalização e resolução.
- `SourceService.reRate`: nova versão da fonte com a nota decidida, copiando configuração de acesso e
  campos da versão vigente.
- `ReviewService`: guarda versionada antes de criar ou associar ocorrência.
- `OccurrenceQueryRepository`: a nota pública passa a vir da avaliação publicada (COALESCE), sem expor
  fatores.

## Evidência executada

| Suíte | Resultado |
|---|---|
| `ReliabilityHttpIT` | 4/4 |
| `SourceRatingHttpIT` | 3/3 |
| `PublicationHttpIT` | 5/5 (sem regressão pela guarda) |
| `OccurrenceQueryHttpIT` | 13/13 |
| `ActiveReportQueryIT` | 1/1 |
| `DatabaseMigrationIT` | 2/2 |
| `SourceManagementHttpIT` | 1/1 |

Comando: `bash scripts/verify-api-container.sh` (JDK 21 em contêiner, PostgreSQL/PostGIS real via
Testcontainers no socket Podman).

## Correções de projeto durante a implementação

- `reliability_rules.author_id` **sem FK** para `local_accounts`: com FK, o `TRUNCATE` das fixtures de
  conta (e o encerramento de conta) derrubaria a regra aprovada. A autoria continua validada na escrita,
  com ator da sessão autenticada, e auditada.
- `occurrence_reliability_evaluations` entrou no reset compartilhado de fixtures
  (`AccountFixtureReset`), que antes falhava por FK.
- Parâmetros com `?` dentro de `INSERT ... SELECT` receberam cast explícito: sem ele o PostgreSQL infere
  `text` para a coluna de instante e a escrita falha.
- `UNKNOWN` entrou em `notInformedValues` da regra v1, porque é o marcador de situação desconhecida no
  catálogo — sem isso, «situação desconhecida» seria lida como informação presente.

## Interface e jornada de navegador (mesma data)

- `apps/web/src/app/data/reliability-api.ts`: transporte tipado das seis rotas administrativas, com
  erro de sessão (401/403) e bloqueio (409) distintos de falha genérica.
- `apps/web/src/app/reliability/reliability-panel.{ts,html,scss}` dentro do bloco diferido
  `AdminSourcesPanels`: avaliação com fatores internos, reprodução da versão, publicação condicionada,
  recomendação com amostra e decisão justificada; foco no cabeçalho do resultado e leitura em 390 px.
- `reliability-panel.spec.ts` (unitário, 8 casos): nota registrada, bloqueio por essencial ausente,
  erro de leitura que não vira vazio, vazio explícito, reprodução com diferenças, decisão aprovada com
  justificativa, amostra insuficiente e ocorrências sinalizadas.
- `e2e/reliability-panel.spec.ts` (Playwright): duas jornadas em Chromium e Firefox com fixtures
  exclusivas no contêiner sintético `vu-ticket29-e2e-db`.

| Verificação | Resultado |
|---|---|
| `ng test` | **188 testes em 25 arquivos**, zero falhas |
| `npm run lint` | limpo |
| `npm run build` | inicial **847,61 kB** (chunk diferido `admin-sources-panels` **102,06 kB**); margem **52,39 kB** até 900 kB |
| Playwright `reliability-panel` + `operations-panel` + `admin-local-sources` + `audit-log` | **14/14** Chromium/Firefox |

Limite mantido: incremento local verificado; sem dados reais, contratação ou publicação externa.
