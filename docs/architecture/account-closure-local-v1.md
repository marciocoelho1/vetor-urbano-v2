# Encerramento da própria conta (local) — v1

Status: aceito para o ambiente local sintético (perfil `local`). Pertence à fatia 15C do ticket 15 e
implementa E07/E09–E11/E19, CA24 e o [ADR 0001](../adr/0001-historical-authorship-after-account-closure.md)
sob o contrato de auditoria de [audit-local-v1.md](audit-local-v1.md).

## Percursos

1. **Encerrar todas as sessões (E19)** — exige a senha atual (e código novo do autenticador para
   Administrador); a conta continua válida, todo acesso aberto é revogado e o próximo login é
   obrigatório.
2. **Encerrar a conta (E07)** — exige senha atual (e código novo do autenticador para Administrador)
   e a confirmação digitada `ENCERRAR`. Elimina o cadastro ativo, desliga os vínculos recuperáveis e
   preserva ocorrências, fontes, versões e auditoria sob autoria histórica.

## Contrato HTTP

Base `/api/v1/account` (mesmas regras do autoatendimento: sessão completa no servidor, id da
autorização, CSRF no POST, resposta `no-store`).

| Método | Caminho | Corpo | Respostas |
| --- | --- | --- | --- |
| POST | `/account/sessions/revocations` | `currentPassword` (Administrador: + `mfaCode`) | 200 `SESSIONS_REVOKED`; 400 `INVALID_REQUEST` (campo não declarado) / `INVALID_CURRENT_PASSWORD`; 401 `INVALID_MFA`; 429 `REQUEST_LIMIT` |
| POST | `/account/closure` | `currentPassword` (Administrador: + `mfaCode`) | 200 `ACCOUNT_CLOSED`; 400 `INVALID_REQUEST` / `INVALID_CURRENT_PASSWORD` / `INVALID_CLOSURE` (conta não confirmada); 401 `INVALID_MFA`; 429 `REQUEST_LIMIT` (limite próprio `ACCOUNT_CLOSURE`, janela de 5 minutos) |

As duas ações têm limite próprio de tentativas por conta (`vetor.accounts.sensitive-attempts`): a
recusa por limite responde 429 e **não** revoga sessão nem encerra conta (o evento `LIMITED` fica
registrado).

A senha digitada na tela é conferida no servidor: a interface apenas exige o campo e a confirmação
`ENCERRAR` (botão inativo sem ela). `INVALID_MFA` (401) continua distinto de `SESSION_REQUIRED` (401).

## Efeito transacional do encerramento

Numa única transação, na ordem:

1. `historical_actors` recebe **duas referências residuais novas** (UUIDs aleatórios, distintos do
   identificador de login e nunca reutilizados), com o papel do autor e o instante do encerramento:
   uma para segurança/conta e outra para autoria de domínio. A separação é exigida por
   `audit-local-v1.md`/E16 — sem ela seria possível correlacionar o uso administrativo com a autoria
   de domínio, e os dois prazos de retenção não poderiam expirar de forma independente.
2. Aviso de encerramento vai à caixa sintética do próprio endereço, sem token.
3. `auth_audit_events` com classe `USE` do ator é **eliminada** (E10).
4. `auth_audit_events` SECURITY e `account_audit_events` recebem a referência de **segurança**;
   `auth_audit_events` ADMIN, `source_audit_events`, `source_access_configurations` e
   `source_versions` recebem a referência de **domínio**. Em todos, `account_id`/`actor_id`/
   `created_by`/`author_id` ficam nulos (E09/E16/ADR 0001).
5. Os snapshots JSONB `before_snapshot`/`after_snapshot` de `source_audit_events` também trocam o
   campo `authorId`, que embute o identificador de login do autor, pela referência de domínio —
   sem isso o UUID sobreviveria legível no próprio registro de auditoria.
6. Tokens de confirmação, recuperação e troca de e-mail, sessões e chaves de limite individual
   (`account_request_limits`, `auth_request_limits`) do ator são **removidos**, inclusive o balde
   `login:<sha256(e-mail)>`, que é derivado do endereço eliminado; nenhum identificador recuperável
   — coluna ou campo JSONB — permanece em qualquer tabela.
7. Um evento `ACCOUNT_CLOSURE`/`CLOSED` é gravado sob a referência de segurança.
8. `local_accounts` é **apagada** (nome, e-mail, credencial, fator): sem reativação e sem mapa de
   correspondência (E07). Ocorrências, fontes e versões não sofrem cascata.

Um novo cadastro com o mesmo endereço é aceito, começa como `USER`, sem histórico e sem privilégios.

## Migração

`V9__account_closure_historical_authorship.sql`: tabela `historical_actors`; coluna
`historical_actor_id` (FK) em `auth_audit_events`, `account_audit_events`, `source_audit_events`,
`source_access_configurations` e `source_versions`; `actor_id`/`created_by`/`author_id` passam a
aceitar nulo; CHECKs de `account_audit_events` ganham as ações `ACCOUNT_CLOSURE`/`SESSIONS_REVOKED` e
os resultados `CLOSED`/`REVOKED`. Migração nova; V1–V8 preservadas.

## Auditoria e mensagens

Ações: `SESSIONS_REVOKED` (REVOKED/REJECTED/INVALID/LIMITED) e `ACCOUNT_CLOSURE` (CLOSED/INVALID/REJECTED/LIMITED).
Mensagem sintética `ACCOUNT_CLOSED` sem token. A auditoria preservada não contém nome, e-mail,
credencial ou fator: apenas a referência residual, o papel, a ação, o resultado e o instante.

## Interface

Painel `Minha conta`: card **Sessões** com "Encerrar todas as sessões" e card **Encerrar conta**
(destrutivo, borda e botão de alerta) com senha atual, confirmação digitada e código do autenticador
para Administrador. O card **Sessões** pede senha atual e, para Administrador, o código do
autenticador — sem eles a ação é recusada pelo servidor. Ao concluir qualquer uma das ações, a sessão deixa de valer, a interface volta ao
acesso com aviso em foco e os campos sensíveis são limpos. Estados de carregamento/erro/vazio,
teclado, 390 px e alternativa em lista permanecem os do painel.

## Pendência encerrada — projeção de logs (ticket 19, 18/10/2026)

`GET /api/v1/admin/logs` agora mantém `actor` (conta ativa, se houver) e projeta `historicalActor` em campo separado para `auth_audit_events`, `account_audit_events` e `source_audit_events`. A integração HTTP/PostGIS prova a referência viva antes do encerramento, as duas referências residuais diferentes depois dele e a ausência do UUID eliminado na resposta. Ver [ticket-19-progress-2026-10-18.md](../history/ticket-19-progress-2026-10-18.md).

## Extensão territorial — ticket 26

A migração [territorial v1](territorial-versions-local-v1.md) integra `territorial_versions`,
`territorial_approvals` e `territorial_audit_events` ao desligamento transacional. Seus `author_id`
ficam nulos e `historical_actor_id` recebe a referência de domínio; papel, justificativa e conteúdo
factual são preservados. `correction_area_targets.validated_by` segue o mesmo desligamento.
Antes/depois territoriais não embutem UUID de login; por isso não é necessário reescrever seus JSONs.
Triggers protegem conteúdo histórico e permitem somente a troca irreversível de autoria.
O teste HTTP territorial verifica as referências históricas distintas, a consulta preservada e busca
o UUID eliminado em todas as tabelas públicas do banco descartável antes de abrir novo ADMIN.
A projeção administrativa de logs continua distinguindo `actor` e `historicalActor`.

## Limites

Sintético e local: sem dados reais, sem transporte de e-mail, sem guarda legal, sem preservação
excepcional (E18) e sem backups/restauração (E17). O canal privado de correções preserva o conteúdo
factual com minimização e desligamento do solicitante no encerramento; isso não certifica tratamento
operacional de dados pessoais. A separação de autoria é irreversível, mas não é
anonimização garantida: contexto, datas e textos podem permitir identificação e exigem avaliação
própria em operação real.

## Extensão de vigência — ticket 25 (V14)

`occurrence_verifications` participa do mesmo desligamento transacional: `author_id` é anulado e
`historical_actor_id` recebe o residual de domínio. Papel, evidência factual por efeito, versões,
situações e instantes são preservados. A tabela não guarda UUID do autor em JSON/texto gerado pelo
sistema. O trigger de imutabilidade permite apenas essa troca irreversível de autoria. Não há mapa
recuperável. A prova HTTP/PostGIS encerra o autor real e procura seu UUID em todas as tabelas
públicas, incluindo o novo histórico; conferir resultados da [rodada](../history/closure-round-2026-10-19.md).
