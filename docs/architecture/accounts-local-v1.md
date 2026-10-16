# Contas locais — contrato do Ticket 13

Data: 15/10/2026. Base técnica: `067f9c0`. Incremento local sintético de RF05/RNF02/RNF06, D11/D13 e CA24. Caixa de e-mail local e confirmação de uso único já aprovadas. Este documento fixa escolhas reversíveis de desenvolvimento; não aprova política operacional. Sem sessão/MFA (14), recuperação/alteração/exclusão (15), entrega externa ou publicação.

## HTTP e estados

API existente, explicitamente habilitada por `vetor.accounts.enabled=true`, vinculada a loopback. POST JSON, sem cookies; aceita somente os campos declarados, inclusive rejeitando `role`, `profile`, `admin` e campos desconhecidos no servidor.

| Endpoint | Corpo | Resposta |
|---|---|---|
| `/api/v1/accounts/registrations` | `displayName`, `email`, `password` | 202 `CONFIRMATION_PENDING`, mensagem genérica de confirmação pendente. Repetir e-mail não altera conta/senha/nome, não reenvia e não informa existência/confirmação. |
| `/api/v1/accounts/confirmations` | `token` | 200 `ACCOUNT_CONFIRMED`, sem identidade nem sessão. Token desconhecido: 400 `INVALID_CONFIRMATION`; expirado: 410 `EXPIRED_CONFIRMATION`; substituído: 410 `REPLACED_CONFIRMATION`; usado: 409 `USED_CONFIRMATION`. Mensagens sem conta/e-mail. |
| `/api/v1/accounts/confirmation-requests` | `email` | 202 `CONFIRMATION_PENDING` para desconhecido, confirmado, pendente elegível ou limitado por conta. Somente pendente elegível recebe mensagem. |

400 `INVALID_REGISTRATION`/`INVALID_REQUEST` para entradas inválidas; 429 `REQUEST_LIMIT` para limite global de tentativas da ação, com `Retry-After`. 503 `ACCOUNTS_UNAVAILABLE` para indisponibilidade. Erros nunca significam cadastro/confirmacão bem-sucedidos. Respostas não devolvem senhas, hashes, tokens, papel ou dados de outra conta; `Cache-Control: no-store`. Sem endpoint público de consulta por e-mail. Conhecer um token permite somente sua confirmação e os estados desse token.

Criação é atômica e e-mail normalizado por trim + lowercase é único (escolha local explícita). Nome 2–80 caracteres; e-mail ASCII até 254, domínio `.test` obrigatório neste ambiente exclusivamente sintético. Papel imposto pelo servidor e por constraint: `USER`. Estado inicial `PENDING`; transição única para `CONFIRMED` em transação com bloqueio de linha. Reenvio efetivo revoga tokens anteriores ainda ativos; repetição suprimida por cooldown/limite não os revoga. Token usado continua inutilizável após restart/reenvio. Confirmações concorrentes: exatamente uma pode concluir.

## Configurações somente de desenvolvimento/teste

| Propriedade `vetor.accounts.*` | Desenvolvimento | Ensaio HTTP/navegador |
|---|---|---|
| `enabled` | false (ativação explícita) | true |
| `token-ttl` | 15m | HTTP: relógio controlado; navegador: 5s |
| `resend-cooldown` | 60s | HTTP: relógio controlado; navegador: 1s |
| `resends-per-hour` | 3 | 2 |
| `requests-per-minute` | 30 por ação, global nesta aplicação local | 30 (teste específico: 2) |
| `mailbox-port` | 8025 | HTTP: 0, porta efêmera; navegador: 8025 |
| `password-iterations` | 600000 | 600000 |

Senha: 15–128 caracteres Unicode, sem truncar/esconder transformações, sem regras de composição, aceita espaços/colar. Pequena lista local explícita de senhas triviais bloqueadas (não representa uma lista operacional de comprometidas). PBKDF2-HMAC-SHA256, salt aleatório de 128 bits, derivação de 256 bits, formato versionado com iterações; comparação constante para verificação dos testes. Escolha da primitiva nativa do JDK evita dependência sem uso; não é alegação de certificação FIPS. Não há login nesta fatia.

Token: 32 bytes criptograficamente aleatórios em base64url; só SHA-256 é persistido. Aleatoriedade alta permite hash rápido para o token (não para a senha). Expiração usa relógio UTC injetável, relido depois de aguardar bloqueios; produção local usa relógio real, teste HTTP pode avançá-lo sem dormir. Limites globais por ação/minuto e contadores/reenvios por conta persistem no PostgreSQL e sobrevivem ao restart. Tentativas com corpo válido, inclusive token desconhecido, consomem limite. Corpos malformados são rejeitados antes da operação; defesa de tráfego distribuído não é implementada.

Guardas técnicas da configuração: TTL de 1s a 1 dia, cooldown de 0 a 1h, 1–20 reenvios/hora, 1–1000 tentativas/minuto, porta 0–65535 e 600.000–2.000.000 iterações. Comprimentos e pequena blocklist da senha são constantes locais explícitas no serviço, sem uma política operacional dinâmica; sua alteração exige revisão e testes, não muda contas por suposição.

## Caixa local e auditoria

Servidor HTTP separado em `127.0.0.1:8025`, somente quando contas locais estão habilitadas. Página `/` e JSON `/messages` são caixa do operador de testes, sem CORS, validam Host e não aceitam Origin estrangeira. Nunca disponibilizada na API pública. Somente endereços `.test`, nenhum SMTP/provedor externo. Mensagens com token/link ficam somente em memória, no máximo 100; desaparecem ao reiniciar. Links usam fragmento no frontend `/?conta=local#confirmar=...`; cliente remove fragmento e só confirma por POST explícito. Nada de tokens em query string/log de acesso. Respostas da caixa: no-store, proteção contra framing e conteúdo HTML escapado.

A mensagem é entregue depois do commit; crash entre commit e memória pode exigir reenvio. Esta caixa não oferece garantia de transporte operacional. O banco persiste contas, hashes e eventos, nunca conteúdo de e-mail/token em claro. Auditoria restrita ao banco local: instante, ID interno opcional, ação, módulo e resultado; sem e-mail, senha, hash de senha ou código/token. Inclui pedidos de cadastro/reenvio, rejeições, confirmação válida/inválida/expirada/usada/substituída e limitação. Sem endpoint de auditoria ou retenção operacional presumida.

## Referências primárias consultadas em 15/10/2026

- [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html): referência para comprimento de senha, ausência de composição obrigatória, bloqueio de senhas comuns, armazenamento com salt e limitação de tentativas.
- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html): PBKDF2-HMAC-SHA256 com 600.000 iterações e salt por credencial. A preferência geral da OWASP é Argon2id; PBKDF2 é escolha técnica explícita deste incremento/JDK.
- [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html): orientação aplicável a tokens de posse, aleatoriedade, armazenamento seguro, expiração, uso único e respostas que evitem enumeração. Não implementa recuperação de senha.

As referências sustentam os mecanismos. Não prescrevem os prazos de 15m, cooldown de 60s ou os limites locais escolhidos aqui. Esses números são configurações sintéticas reversíveis; prazos/limites, reenvio, política de senha e entrega definitiva ainda precisam de aprovação operacional.
