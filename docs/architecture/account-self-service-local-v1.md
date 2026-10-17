# Autoatendimento da própria conta (local) — v1

Status: aceito para o ambiente local sintético (perfis `local`). Pertence à fatia 15B do ticket 15.

## Percurso

Conta confirmada usa `Minha conta` para:

1. Ver o perfil (nome de exibição, e-mail, papel) e pendências de troca de e-mail.
2. Alterar o nome de exibição — mantém a sessão.
3. Alterar a senha — exige senha atual; efetivar encerra todas as sessões e revoga links pendentes, inclusive troca de e-mail pendente (E02).
4. Trocar de e-mail — exige senha atual; o novo endereço só substitui o atual após confirmar o link recebido no próprio endereço novo. Até lá, o endereço atual continua válido. O endereço antigo recebe aviso sem link.

## Contrato HTTP

Base `/api/v1/account` (fora da lista liberada do `AccessBoundary`; exige sessão completa e o id vem da autorização do servidor, nunca do corpo):

| Método | Caminho | Corpo | Respostas |
| --- | --- | --- | --- |
| GET | `/account` | — | 200 `ACCOUNT_PROFILE`; 401 `SESSION_REQUIRED` |
| POST | `/account/display-name` | `displayName` | 200 `DISPLAY_NAME_CHANGED`; 400 `INVALID_REQUEST` / `INVALID_DISPLAY_NAME` |
| POST | `/account/password` | `currentPassword`, `newPassword` (Administrador: + `mfaCode`) | 200 `PASSWORD_CHANGED`; 400 `INVALID_REQUEST` / `INVALID_CURRENT_PASSWORD` / `INVALID_NEW_PASSWORD` / `INVALID_PASSWORD_CHANGE`; 401 `INVALID_MFA` (código do autenticador ausente ou errado, só Administrador); 429 `REQUEST_LIMIT` |
| POST | `/account/email-changes` | `currentPassword`, `newEmail` (Administrador: + `mfaCode`) | 202 `EMAIL_CHANGE_PENDING`; 400 `INVALID_REQUEST` / `INVALID_CURRENT_PASSWORD` / `INVALID_EMAIL_CHANGE`; 401 `INVALID_MFA`; 429 `REQUEST_LIMIT` |

Confirmação do novo e-mail permanece em `POST /api/v1/accounts/email-changes/confirmations` (módulo público de contas): 200 `EMAIL_CHANGED`; 400 `INVALID_EMAIL_CHANGE` (formato inválido, inexistente ou conta que deixou de estar confirmada); 409 `USED_EMAIL_CHANGE` (link já usado) e `EMAIL_TAKEN` (endereço passou a pertencer a outra conta); 410 `REPLACED_EMAIL_CHANGE` (substituído por pedido mais recente) e `EXPIRED_EMAIL_CHANGE` (prazo encerrado).

POSTs autenticados exigem `X-CSRF-Token` da sessão; resposta do servidor é `no-store`. Corpo fora dos campos declarados → `INVALID_REQUEST`, sem alterar estado (mesma regra da recuperação).

## Ações sensíveis (E14/E15)

Senha e e-mail reutilizam a confirmação sensível do módulo de acesso: sessão completa + CSRF e, para Gestor/Administrador, código novo do autenticador (MFA). Ações sensíveis têm limite próprio de tentativas (`vetor.accounts.sensitive-attempts`, janela de 5 minutos); exceder responde 429 sem revelar estado.

## Migração

Migração `V8__account_email_change.sql`: tabela `account_email_change_tokens` (`account_id`, `pending_email`, `token_hash`, `expires_at`, `consumed_at`, `revoked_at`, carimbos) e colunas `email_change_sent_at/email_change_window_start/email_change_count` em `local_accounts` para reexpedição limitada.

## Auditoria e mensagens

Eventos: `DISPLAY_NAME` (CHANGED/REJECTED), `PASSWORD_CHANGE` (CHANGED/INVALID/REJECTED/LIMITED), `EMAIL_CHANGE_REQUEST` (SENT/SUPPRESSED/INVALID/REJECTED/LIMITED), `EMAIL_CHANGE` (CHANGED/CONFLICT/EXPIRED/REPLACED/USED/INVALID/REJECTED). Mensagens (sintéticas, em `local_mailbox`): `EMAIL_CHANGE_CONFIRMATION` com link `#trocar-email=` para o endereço NOVO, `EMAIL_CHANGE_NOTICE` sem link para o antigo, `PASSWORD_CHANGED` sem credenciais. Nunca registram texto de pesquisa, senha, token em claro, coordenadas ou credenciais.

## Interface

Painel `Minha conta` (sessão ativa): resultado com foco gerenciado, campos de senha limpos após cada tentativa, aviso de sessão encerrada ao concluir senha/e-mail, pendência visível com expiração, estados de carregamento/erro/vazio, teclado, 390 px.

## Evidências

`.scratch/consulta-coerente/evidence/ticket-15-2026-10-17/` e `docs/history/ticket-15-progress-2026-10-17.md`.
