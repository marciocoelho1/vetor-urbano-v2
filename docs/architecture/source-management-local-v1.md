# Gestão local de fontes — contrato do Ticket 16

Data: 15/10/2026. Incremento de desenvolvimento com fontes e avaliações inteiramente sintéticas. Baseia-se nas migrações aplicadas V1–V4 e na sessão/MFA local do Ticket 14. Não é contrato operacional nem autoriza conectar fontes, coletar ou redistribuir conteúdo.

## Projeções e identidade

Uma fonte representa um canal concreto, não a rede ou marca inteira. Seu `id` é estável e continua sendo a referência usada por `clippings.source_id`; mudanças cadastrais nunca recriam a fonte nem alteram referências de clippings/ocorrências.

O endpoint público `GET /api/v1/sources` não exige sessão e retorna `{"items":[...]}`. Cada item contém somente `name` e `url`; `url` é `null` quando não existe. Nome e link são os únicos campos da lista pública. ID estável, canal concreto, nota, justificativa, território, pilares, método/configuração de acesso, autoria e histórico são internos. A resposta é `no-store`.

O endpoint administrativo `GET /api/v1/admin/sources` e os demais endpoints sob `/api/v1/admin/sources` exigem conta ADMIN autenticada com MFA verificado. O filtro do servidor aplica a permissão a cada requisição. POST/PUT ainda exigem o token CSRF associado à sessão. Visitante recebe 401; USER e ADMIN com sessão parcial recebem 403. Uma falha do serviço de acesso/banco retorna 503, nunca dados internos.

## Campos de cadastro

Campos editáveis: `name` (1–160 caracteres), `channel` (1–160, obrigatório e concreto), `url` (nulo ou HTTP/HTTPS até 2048, sem usuário/senha, query ou fragmento), `territories` (um ou mais rótulos livres de até 120 caracteres, sem inferir ou prometer limite municipal oficial), `pillars` (um ou mais entre `TRANSITO`, `SEGURANCA`, `CONTINGENCIA`), `accessMethod` (`MANUAL`, `PUBLIC_PAGE`, `RSS`, `PUBLIC_API` ou `OTHER`, sempre descritivo e sem executar conector), `rating` (inteiro de 1 a 5) e `ratingJustification` (1–2000 caracteres). A avaliação sintética não habilita recomendação mensal ou fórmula automática.

O cliente não informa `id`, versão, autoria, instante nem referência de configuração. Criação gera ID UUID textual no servidor. Edição exige `expectedVersion`; divergência devolve 409 sem gravar nada. Não há exclusão neste incremento.

## Versões e auditoria

Cada criação/edição grava uma linha em `source_access_configurations` com o método descritivo e UUID próprio, e uma nova linha imutável em `source_versions` com número crescente, os campos acima, a referência à configuração, `author_id` obtido da sessão e instante UTC. Não existe armazenamento de senha, token, cookie, chave ou segredo de fonte neste ticket. A tabela-base `sources` mantém ID e nome atual para preservar compatibilidade com a consulta/clippings. Versões de origem migradas recebem autoria nula identificada como carga sintética inicial; toda mudança HTTP exige e registra um ator ADMIN.

`source_audit_events` registra ator, instante, ação, ID da fonte, versão anterior/nova, referências de configuração anterior/nova e snapshots JSONB antes/depois. Os snapshots contêm apenas metadados cadastrais e referências UUID, sem credenciais. Versão e auditoria são gravadas na mesma transação; falha em qualquer gravação reverte ambas.

`GET /api/v1/admin/sources/{id}/versions` retorna todas as versões, inclusive campos internos, autoria, instante e referência de configuração. `GET /api/v1/admin/sources/{id}` retorna a versão atual. Os DTOs administrativos nunca são usados como DTO público.

## Endpoints e erros

| Método e caminho | Acesso | Resultado |
|---|---|---|
| `GET /api/v1/sources` | Público | Lista mínima com `{name,url}` |
| `GET /api/v1/admin/sources` | ADMIN + MFA | Fontes atuais e campos internos |
| `POST /api/v1/admin/sources` | ADMIN + MFA + CSRF | Cria fonte, versão 1 e auditoria |
| `GET /api/v1/admin/sources/{id}` | ADMIN + MFA | Fonte e versão atual |
| `PUT /api/v1/admin/sources/{id}` | ADMIN + MFA + CSRF | Nova versão com `expectedVersion` |
| `GET /api/v1/admin/sources/{id}/versions` | ADMIN + MFA | Histórico imutável |

Erros têm `{code,message}` e `Cache-Control: no-store`: `400 INVALID_SOURCE` para campos inválidos/corpo malformado; `401 SESSION_REQUIRED`; `403 ACCESS_DENIED`/`CSRF_REQUIRED`; `404 SOURCE_NOT_FOUND`; `409 SOURCE_VERSION_CONFLICT`; `503 ACCESS_UNAVAILABLE`. Caminho/método não listado não amplia permissões.

Todas as fontes novas são metadados somente. Nenhuma configuração liga uma fonte ou inicia acesso à rede. O placeholder de G1 permanece separado, explicitamente não avaliado e com coleta desativada. URL ausente é válida; a rastreabilidade de uma publicação continua no identificador/URL próprio do clipping.
