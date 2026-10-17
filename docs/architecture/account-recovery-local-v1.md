# Recuperação de acesso local — fatia do Ticket 15

Contrato sintético de desenvolvimento/teste, 2026-10-17. Aplica D11/CA24, RF05/RNF02 e [E01/E14/E15/E16](../product/account-and-records-policy.md). Complementa [contas](accounts-local-v1.md) e [sessão](session-local-v1.md); não homologa operação com dados reais, transporte de e-mail, prazos operacionais ou atendimento.

## Desdobramento do Ticket 15

O ticket 15 cobre três percursos independentes e não cabe num único incremento verificável. Desdobrado preservando o ID 15 como referência:

| Fatia | Percurso | Estado |
|---|---|---|
| **15A** | recuperar acesso (esqueci a senha) | implementada localmente nesta entrega |
| **15B** | alterar a própria conta (nome, senha, e-mail com confirmação do novo endereço) | pendente, depende de 15A |
| **15C** | encerrar a própria conta e encerrar todas as sessões, com eliminação cadastral e desvinculação de logs/histórico | pendente, depende de 19 e de 15B |

Nenhum ticket novo é criado. MFA/QR (E05) e backup/restauração permanecem fora deste recorte.

## Endpoints

| Endpoint | Corpo | Resposta |
|---|---|---|
| `POST /api/v1/accounts/recovery-requests` | `email` | 202 `RECOVERY_PENDING`. Resposta idêntica para conta confirmada, pendente, inexistente e pedido suprimido por limite; nunca informa existência, papel ou estado da conta, e **não encerra sessões**. |
| `POST /api/v1/accounts/recoveries` | `token`, `password` | 200 `PASSWORD_RECOVERED`; 400 `INVALID_REQUEST` (corpo fora dos campos declarados); 400 `INVALID_RECOVERY` (token fora do formato ou desconhecido, senha fora do exigido ou conta que não está confirmada); 410 `EXPIRED_RECOVERY`; 410 `REPLACED_RECOVERY`; 409 `USED_RECOVERY`. |

Sem sessão, sem cookie e sem CSRF: são operações públicas de posse do link, sob o mesmo limite global por ação do cadastro — mesmos valores configurados, contadores e janelas próprios, porque a ação é distinta (`RECOVERY_REQUEST`). 400 `INVALID_REQUEST` para corpo fora dos campos declarados; 429 `REQUEST_LIMIT` com `Retry-After: 60`; 503 `ACCOUNTS_UNAVAILABLE` para indisponibilidade. Todas as respostas são `no-store` e não devolvem token, senha, hash, e-mail de terceiro ou estado interno. O link da mensagem chega ao navegador como fragmento `/?conta=local#recuperar=<token>`: o cliente remove o fragmento, mantém o token só em memória e só o envia no POST explícito — seguí-lo não abre a conta.

## Regras aplicadas

- **E01** — recuperação pelo e-mail confirmado, em jornada distinta da confirmação de cadastro (tabela própria, `account_recovery_tokens`). Pedir o link não encerra sessões. Ao concluir: troca a senha, revoga todas as sessões (via `AuthService.revokeAll`, na mesma transação) e exige login novo. MFA administrativo é preservado — a recuperação não remove nem contorna o segundo fator, e o autenticador já cadastrado continua valendo para o próximo login administrativo. A conclusão também revoga links pendentes da conta; nesta fatia só o link de recuperação usado e os já substituídos existem, então a revogação dos demais é **defensiva** hoje e passa a ter efeito observável quando 15B criar o link de troca de e-mail (mesmo ponto de extensão, `revokePendingLinks`).
- **E15** — o link vale **10 minutos após a emissão** (`vetor.accounts.recovery-ttl`, padrão `10m`), é de uso único e o reenvio efetivo substitui o anterior sem renovar o token antigo. Prazo e estado da conta são revalidados **depois** de bloquear conta e token, não no início da requisição; a conclusão é única mesmo com pedidos simultâneos do mesmo link.
- **E14** — conclusão gera aviso transacional na caixa local (`kind=RECOVERY_COMPLETED`) com ação, instante UTC e orientação de contestação, sem senha, token ou código.
- **E16** — só o SHA-256 do token é persistido; nenhuma credencial, código ou token em claro no banco ou no log.

Conclusão recusada não altera nada: senha fraca, token fora do formato, expirado, substituído, usado ou conta não confirmada deixam credencial, sessões e o próprio link exatamente como estavam. O valor derivado (PBKDF2-HMAC-SHA256, 600.000 iterações) é calculado antes dos bloqueios, para não segurar a linha durante a derivação cara.

Reexpedição usa os mesmos valores configurados do cadastro (`resend-cooldown`, `resends-per-hour`), com contador e janela próprios por conta; repetição suprimida **não** revoga o link ativo, não gera mensagem nova e responde igual ao pedido bem-sucedido. O evento `SUPPRESSED` cobre três causas distintas — conta inexistente, conta não confirmada e repetição barrada por cooldown ou limite — de propósito, porque separá-las na auditoria reintroduziria sinal de existência de conta; a leitura de logs mostra o mesmo resultado para as três.

## Configuração de desenvolvimento/teste

| Propriedade `vetor.accounts.*` | Desenvolvimento | Ensaio de navegador |
|---|---|---|
| `recovery-ttl` | 10m (valor aprovado em E15) | `5s`, para exercitar a expiração sem esperar |
| `token-ttl`, `resend-cooldown`, `resends-per-hour`, `requests-per-minute` | inalterados nesta fatia | idem cadastro |

`recovery-ttl` aceita 1s a 1 dia; valores fora disso impedem a inicialização. O texto da mensagem cita dez minutos porque esse é o valor aprovado; no ensaio de navegador o prazo configurado é propositalmente menor, então o texto não descreve o prazo efetivo dessa instância. Parâmetros locais reversíveis não são política operacional.

## Auditoria

Em `account_audit_events` (classe SECURITY, por finalidade): `RECOVERY_REQUEST` com `REJECTED`/`SUPPRESSED`/`SENT`/`LIMITED` e `RECOVERY` com `INVALID`/`USED`/`REPLACED`/`EXPIRED`/`REJECTED`/`RECOVERED`/`LIMITED`. A revogação das sessões permanece em `auth_audit_events` (`REVOKE_ALL`/`REVOKED`). Eventos não carregam e-mail, senha, hash nem token. Expurgo segue E16/`audit-local-v1.md`; nada aqui antecipa a desvinculação do encerramento, que pertence a 15C.

## Verificação autorizada

Fronteiras: HTTP real → Java → PostgreSQL/PostGIS (relógio controlado, uso único sob pedidos simultâneos do mesmo link, revalidação de prazo e de estado da conta depois do bloqueio, persistência e ausência de segredo no que ficou gravado) e Chromium/Firefox (jornada com link real da caixa, teclado/foco, 390 px, indisponibilidade, erros e vazio). O ensaio de navegador segue o link da própria mensagem e comprova, no servidor, que a sessão anterior morreu e que a senha antiga não entra.

## Limitações

- Aceite é sintético e local: sem transporte real de e-mail, sem coleta de dados reais, sem prontidão operacional, sem leitor de tela ou aparelho físico.
- A resposta indistinguível limita, mas não elimina, sinais indiretos de tempo; não há defesa de tráfego distribuído.
- Perda de e-mail/autenticador (E05/E12) e o procedimento excepcional continuam pendentes.
- 15B e 15C permanecem pendentes: sem alteração autenticada de credenciais, sem confirmação de novo e-mail e sem eliminação cadastral/desvinculação.
