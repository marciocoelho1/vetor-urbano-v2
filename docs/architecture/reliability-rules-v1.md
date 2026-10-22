# Confiabilidade versionada — regra v1 e decisão mensal de fonte

Estado: implementação local de 22/10/2026 (tickets 23 e 24). Sem operação real, sem publicação
externa e sem dados de veículos reais.

## Regra v1 (ticket 23)

A regra é um registro **imutável e versionado** (`reliability_rules`), semeado pela migração `V20`
com proveniência `SEEDED_APPROVED`. Mudar qualquer parâmetro exige **nova versão**; avaliações
antigas continuam apontando para a versão com que foram feitas e nunca são recalculadas em silêncio.

| Parâmetro | Valor v1 |
|---|---|
| Referência | maior nota entre fontes **independentes com referência rastreável** |
| Reprodução | mesmo título normalizado com diferença ≤ 120 min conta **uma vez, pela origem** |
| Corroboração | fontes independentes distintas, saturando em 3 → bônus 0 / 0,5 / 1,0 |
| Base neutra | 3 quando não há fonte com nota (desconhecido nunca é zero) |
| Divergência | conflito essencial **bloqueia**, não desconta |
| Completude | essencial ausente bloqueia, não subtrai |
| Arredondamento | meio-acima, faixa 1–5 |
| Marcadores | `notInformedValues` (NAO_INFORMADO, «Não informado», DESCONHECIDO, UNKNOWN) e `notApplicableValues` («Não se aplica») |
| Essenciais | title, description, category, type, situation*, municipality, locationPrecision, temporal (*situation aceita «não informado» e «não se aplica») |

Nota = `clamp(1..5, HALF_UP(base + bônus))`, onde `base` é a nota da fonte de referência ou a base
neutra. Quantidade bruta de clippings não entra; detalhe sem referência não eleva a nota.

### Garantias verificadas em integração (PostgreSQL/PostGIS real)

- Reprodução com nota maior **não** vira referência (nota 5 da cópia não supera 4 da origem).
- Ocorrência com essencial vazio tem nota alta **bloqueada** para publicação (`ESSENTIAL_NOT_INFORMED:description`).
- Conflito essencial bloqueia (`ESSENTIAL_CONFLICT_UNRESOLVED`) mesmo com nota alta.
- «Não informado» (`NOT_INFORMED`) e «não se aplica» (`NOT_APPLICABLE`) aparecem distintos nos fatores internos.
- Reexecutar a mesma versão sobre os mesmos dados devolve `reproduced: true` e nenhuma diferença.
- Nova versão de regra cria nova avaliação; a nota histórica e a publicada anterior permanecem íntegras.
- A consulta pública expõe **apenas** a nota 1–5 (fatores, fórmula, base neutra e nota da fonte não aparecem).

### Endpoints (ADMIN + MFA; escrita com CSRF)

| Rota | Uso |
|---|---|
| `GET /api/v1/admin/reliability/rules` | versões de regra e versão vigente |
| `POST /api/v1/admin/reliability/rules` | publica a versão seguinte (parâmetros completos) |
| `POST /api/v1/admin/reliability/occurrences/{id}/evaluations` | avalia com chave de idempotência |
| `GET /api/v1/admin/reliability/occurrences/{id}/evaluations/latest` | última avaliação com fatores internos |
| `GET /api/v1/admin/reliability/occurrences/{id}/evaluations/{version}/reproduction` | reprodução da versão |
| `POST /api/v1/admin/reliability/occurrences/{id}/evaluations/{version}/publication` | publica a nota (recusa se bloqueada) |

A guarda da regra também roda no fluxo de revisão (`ReviewService.guard`/`guardOccurrence`), antes de
criar ou associar ocorrência. O núcleo obrigatório do servidor continua sendo a primeira barreira; a
regra acrescenta a barreira versionada.

## Decisão mensal de fonte (ticket 24)

Parâmetros aprovados, aplicados no servidor a partir dos resultados guardados:

| Parâmetro | Valor |
|---|---|
| Janela | 90 dias acumulados |
| Amostra mínima | 10 afirmações aplicáveis |
| Descer | ≥ 30% demonstradas incorretas **e** ≥ 3 casos |
| Subir | ≥ 20 verificações aplicáveis **e** nenhuma incorreta |
| Erro do sistema | fora da amostra; nunca rebaixa a fonte |
| Correção pela fonte | neutraliza a incorreta anterior (vale o último resultado por afirmação) |
| Inconclusivo | não pune |

Resultados por afirmação: `CONFIRMED`, `DISPROVEN`, `CORRECTED_BY_SOURCE`, `INCONCLUSIVE`,
`SYSTEM_ERROR`. `source_statement_verifications` e `source_rating_decisions` são append-only.

Decisão aprovada cria **nova versão da fonte** (`source_versions`) com a nota alterada em um ponto na
direção da recomendação, registra a decisão com amostra e justificativa, e **sinaliza** as ocorrências
publicadas ligadas à fonte (`source_reevaluation_flags`) sem tocar nas notas delas. Resolver o sinal
não altera nota: a mudança exige nova avaliação explícita do ticket 23.

## Interface administrativa (22/10/2026)

`apps/web/src/app/reliability/reliability-panel.ts` fica dentro do bloco diferido
`AdminSourcesPanels` e oferece duas leituras:

- **Avaliação da ocorrência** — escolhe uma ocorrência publicada (lista vem de
  `admin/review-clippings/options`, não é inventada no cliente), mostra nota, estado, bloqueios
  traduzidos, fatores internos (qualidade, corroboração, divergência, completude e situação de cada
  campo), fontes de suporte e reproduções; permite avaliar, reproduzir a mesma versão e publicar a
  nota quando não há bloqueio.
- **Nota da fonte** — escolhe a fonte cadastrada, mostra a recomendação com amostra completa, a
  justificativa calculada no servidor, os limites da regra, exige justificativa de 20 caracteres para
  aprovar mudança e lista as ocorrências sinalizadas sem alterar a nota delas.

O painel não calcula nota nem recomendação: só apresenta o que a API decidiu. 401/403 viram erro de
sessão com mensagem própria; falha de leitura nunca aparece como lista vazia. O foco vai para o
cabeçalho do resultado depois de avaliar ou decidir, e a leitura se mantém sem rolagem horizontal em
390 px.

Riscos e limites conhecidos:

- Amostra insuficiente nunca produz mudança; aprovada só quando a recomendação é subir ou descer.
- A regra não usa a nota calculada da ocorrência como prova da própria fonte.
- A jornada de navegador está coberta em `e2e/reliability-panel.spec.ts` (Chromium e Firefox), com
  teclado, bloqueio visível, publicação e amostra insuficiente. Nada aqui representa prontidão
  operacional: não há dados reais, contratação nem publicação externa.
- `reliability_rules.author_id` não tem FK para `local_accounts` (a regra aprovada precisa sobreviver
  ao expurgo de contas de teste e ao encerramento de conta); a autoria é validada na escrita.
