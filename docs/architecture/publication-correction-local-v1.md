# Correção e retirada de publicação — v1

Ticket 18, D12–D13, CA18 e CA22. Exclusivamente ADMIN com MFA completo, autorização no servidor e CSRF em toda escrita. Dados sintéticos; não é prontidão operacional.

## Fila e preparação

- `GET /api/v1/admin/corrections/publication-queue` devolve pedidos de correção com alvo de ocorrência em `RECEIVED`/`IN_REVIEW`, a preparação atual (quando existe) e a lista fechada de razões essenciais (`correction_essential_reasons`).
- `GET /api/v1/admin/corrections/{id}/publication` lê o pedido com a preparação e o histórico de auditoria interno do editor.
- `POST /api/v1/admin/corrections/{id}/publication/preparations` recebe `action` (`CORRECTION`/`RETRACTION`), `changes`, `reason`, `evidence`, `essentialReason` e `expectedVersion` — a revisão vigente da **ocorrência**, não a do pedido. Preparar não altera nada consultável.
- `POST /api/v1/admin/corrections/{id}/publication/decisions` recebe `decision` (`APPROVE`/`DISCARD`), `reason` e `expectedVersion` do pedido. Aprovar aplica; descartar conserva o motivo. Replay do mesmo pedido é recusado com 409 em vez de reaplicar.

Preparar exige `reason` e `evidence`. `RETRACTION` recusa `changes` material, exige `essentialReason` da lista fechada e evidência não vazia; `CORRECTION` recusa `essentialReason` e exige ao menos um campo sustentado que realmente altere o registro.

## Correção aprovada

O núcleo proposto é mesclado sobre o registro publicado e revalidado com as mesmas regras da publicação: catálogo tipo/pilar, subtipo conhecido ou `NAO_INFORMADO`, situação operacional, nota 1–5, precisão `POINT` com coordenadas sustentadas ou `TERRITORY` sem ponto inventado, instante ou intervalo UTC exclusivo e válido, município e bairro (bairro desconhecido permanece `Não informado`). Campo ausente mantém o valor publicado; nada é inferido. Um par tipo/pilar já publicado permanece legível mesmo fora do catálogo de moderação.

A aprovação grava somente as chaves propostas e incrementa `revision`. A versão resultante fica em `correction_requests.applied_version` e `occurrence_editor_preparations.applied_version`, com `applied_revision` preservando a base anterior, antes/depois em `correction_editor_audit` e autoria da sessão — convertida para referência histórica de domínio no encerramento da conta.

## Retirada

Aprovar uma retirada muda `publication_status` para `WITHDRAWN` e grava `withdrawn_at`. O registro sai da consulta, do Histórico, das contagens, das relações, do calor, do XLSX e do PDF, que já leem apenas `PUBLISHED`. `GET /api/v1/occurrences/{id}` responde apenas com `status: UNAVAILABLE`, `unavailable: true`, o instante da retirada e uma mensagem de indisponibilidade: o conteúdo comprometido não é reapresentado, e o endereço antigo continua explicando-se em vez de virar uma página sem relação. A trilha interna (versões, decisões, snapshots e autoria) é preservada e não é apagada.

## Concorrência e conflitos

Cada pedido é serializado por chave do próprio ID. A aprovação bloqueia a ocorrência, exige que a revisão publicada ainda seja a `target_revision` da preparação e recusa a aplicação quando existe outra preparação pendente e em análise para a mesma ocorrência — 409 nomeando o pedido concorrente, sem sobrescrever a decisão mais nova. Nenhuma das duas decisões é perdida: ambas permanecem legíveis e o administrador reconcilia (aplicar uma exige descartar a concorrente). Uma ocorrência já retirada não aceita nova preparação nem segunda retirada.

## Leitura por endereço

`GET /api/v1/occurrences/{id}` é auditado como `RECORD_LOOKUP` (módulo `query`, sem copiar conteúdo). No modo local autenticado, essa leitura exige sessão, como o restante da consulta integrada; a projeção pública da consulta comum segue sem conteúdo de pedidos privados. Identificador inexistente responde 404 — distinto de retirado, que responde 200 com indisponibilidade explícita.
