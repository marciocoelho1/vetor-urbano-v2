# Administração local: ocorrências, campos de área e retenção

Implementação local de 22/10/2026, a pedido do responsável. Sem dados reais, publicação externa ou
operação comprovada. As ocorrências fictícias existentes foram **preservadas**.

## Retenção de logs

Decisão do responsável em 22/10/2026: **15 dias** para todas as classes de log (uso, segurança e
administração), substituindo 60/180/365 dias. O teto de cada classe no código passou a ser a própria
política aprovada, e os valores vigentes estão em `application.properties`
(`vetor.audit.*-retention=15d`). Cópias de segurança têm teto de sete dias. Versões e decisões de
domínio continuam fora do expurgo de log: são rastreabilidade, não log.

## Ocorrências: lista, edição e ações em lote

| Rota | Uso |
|---|---|
| `GET /api/v1/admin/occurrences?sort=last_update\|alphabetical&status=ACTIVE\|INACTIVE\|CONCLUDED\|ALL` | lista administrativa, `no-store`, com contagens por estado |
| `PUT /api/v1/admin/occurrences/{id}` | edição de **todos** os campos do núcleo factual com `expectedVersion` |
| `POST /api/v1/admin/occurrences/bulk` | `{ids, action: ACTIVE\|INACTIVE\|CONCLUDED\|DELETE, password?}` |

Regras de comportamento:

- **Ordem padrão por última atualização** (`COALESCE(updated_at, occurred_at) DESC NULLS LAST`).
  Registro sem atualização registrada vai ao fim e a interface diz «Atualização não registrada» —
  nunca inventa data. A ordenação alfabética é a segunda opção.
- **Estados administrativos** são `ACTIVE`, `INACTIVE`, `CONCLUDED` (e `DELETED`, interno). São
  independentes de `publication_status`: mudar o estado administrativo não publica nem retira a
  ocorrência da consulta pública. Ligar «inativo» a visibilidade pública é decisão de produto ainda
  aberta — registrada aqui como pendência explícita, não como comportamento escondido.
- **Concluído espelha o domínio**: ocorrências já com `situation='CLOSED'` foram marcadas uma única
  vez pela migração; `updated_at` permaneceu nulo.
- **Edição** reusa `PublicationDraft.parse` (o mesmo núcleo obrigatório da publicação), incrementa
  `revision`, registra `updated_at` e grava uma versão `ADMIN_EDIT` em `publication_versions`.
- **Exclusão é lógica**: `administrative_status='DELETED'` + `deleted_at`. O histórico de publicação é
  imutável e continua auditável; a ocorrência sai da lista administrativa.
- **Senha uma única vez por lote**: `DELETE` exige a senha do administrador, conferida com
  `AccountPassword.matches` sobre o próprio cadastro do ator. Um único `POST` cobre as N ocorrências
  selecionadas — nunca uma confirmação por item. Senha errada devolve **400** (entrada inválida) e
  nada é excluído; 401/403 continuam reservados ao filtro de acesso. A tentativa recusada é auditada
  (`OCCURRENCE_BULK_DELETE_DENIED`).
- **Atomicidade**: a ação em lote confere o número de linhas afetadas; se alguma ocorrência mudou ou
  já foi excluída, responde 409 e não aplica nada.

Módulo de auditoria: `occurrences`, classe `ADMIN`.

## Áreas de Risco: edição de campos sem tocar o polígono

`POST /api/v1/admin/risk-areas/{id}/versions` passou a aceitar o corpo **sem** `geometry`. Nesse caso
o servidor herda a geometria da versão vigente (`ST_AsEWKT`), sem reinterpretar coordenadas. Nome,
grupo informado, fonte, referência de evidência, referência temporal e limitações são editáveis; cada
salvamento cria uma versão nova e a consulta pública continua na versão aprovada até a aprovação
explícita (`POST .../approvals`), como antes. Os polígonos atuais permanecem exatamente como estão.

Isso responde ao ponto levantado pelo responsável: a fonte é confiável, mas «quem domina a área» pode
mudar sem aviso — a edição de campos fica rápida e versionada, sem exigir reenvio de geometria.

## Interface

No bloco diferido `AdminSourcesPanels`, dois painéis novos:

- **Ocorrências** — lista com ordenação, filtro por estado, seleção múltipla, barra de ações em lote,
  diálogo de exclusão com senha (foco no campo ao abrir; uma confirmação para o lote) e formulário de
  edição de todos os campos.
- **Áreas de Risco** — seleção de área e edição de campos, com botão de aprovação da versão; a
  mensagem de sucesso informa que o polígono foi preservado.

Ambos com estados de carregamento, erro e vazio distintos, sem transformar falha de leitura em lista
vazia.

## Limites e pendências

- «Inativo» ainda não altera a visibilidade na consulta pública (decisão de produto pendente).
- Exclusão física não é oferecida: contraria a imutabilidade do histórico de publicação.
- Sem dados reais, contratação ou publicação externa.
