# Ticket local 15 — fatias de recuperação (15A) e autoatendimento (15B)

Data: 17/10/2026. Baseline Git desta entrega: `dda23e4` (commit da 15A), branch `integration/functional-spec-v1`. Aceite **sintético e local**; não indica prontidão operacional.

## Escopo executado

Somente o percurso de **recuperar acesso** do ticket 15 (E01/E15, com o aviso de E14 e a minimização de E16). Os outros dois percursos do ticket — alterar a própria conta (senha/e-mail com confirmação do novo endereço) e encerrar a conta com eliminação cadastral/desvinculação — **não** foram implementados nesta entrega e seguem como fatias 15B e 15C, preservando o ID 15. Nenhum ticket novo foi criado e a seleção não foi ampliada.

Motivo do desdobramento: os três percursos exigem migração, endpoints, interface, ITs e ensaio de navegador próprios; não cabem num incremento verificável. O próprio ticket previa propor desdobramento preservando o ID se isso acontecesse.

Decisões técnicas rotineiras tomadas dentro do escopo: tabela própria de tokens de recuperação (jornada distinta da confirmação, E01), `recovery-ttl` configurável com padrão 10m (valor aprovado em E15), reexpedição reusando cooldown/limite locais do cadastro, e revogação de sessões delegada a `AuthService.revokeAll` por contrato do ticket 14. Escolha reversível registrada no contrato; nenhuma decisão de produto nova foi tomada.

Requisito novo identificado fora desta fatia, **não** implementado: controle autônomo "encerrar todas as sessões" (E19) — a capacidade existe internamente (`revokeAll`) e é usada pelas jornadas implementadas, mas a ação exposta ao usuário pertence a 15C.

## Entregas

| Artefato | Conteúdo |
|---|---|
| `apps/api/src/main/resources/db/migration/V7__account_recovery.sql` | `account_recovery_tokens`, colunas de limite de reexpedição e extensão de `action`/`outcome` da auditoria de contas. Migração nova; V1–V6 não foram reescritas. |
| `AccountService` | `requestRecovery` (202 indistinguível, não encerra sessões) e `recover` (uso único, prazo e estado revalidados após bloqueio, troca de senha, revoga links pendentes e todas as sessões, aviso de conclusão). |
| `AccountController` | `POST /api/v1/accounts/recovery-requests` e `POST /api/v1/accounts/recoveries`. |
| `LocalMailbox` | Mensagem passa a distinguir `kind` (CONFIRMATION/RECOVERY/avisos), com corpo e sem token nos avisos; link de recuperação rotulado de forma distinta do link de confirmação. |
| `AccountSettings` / `AccountLocalConfiguration` | `vetor.accounts.recovery-ttl` (1s–1d, padrão 10m). |
| `account-page.ts` / `.html` / `.spec.ts` | Pedido de recuperação e definição de nova senha, fragmento `#recuperar=` removido sem confirmação automática, foco no título do percurso, estados de carregamento/erro/vazio e títulos por código de resposta. |
| `apps/web/e2e/account-recovery.spec.ts` | Quatro cenários de navegador com API, caixa e PostgreSQL/PostGIS reais. |
| `docs/architecture/account-recovery-local-v1.md` | Contrato local do percurso e do desdobramento. |

## Verificações e resultados

| Comando | Resultado |
|---|---|
| `VETOR_API_INTEGRATION_TESTS=RecoveryHttpIT bash scripts/verify.sh api` | 14 unitários + **9 ITs** da recuperação; verde |
| `bash scripts/verify.sh api` | 14 unitários + **43 integrações** HTTP/PostgreSQL/PostGIS (era 34 antes desta fatia), incluindo `AccountRegistrationHttpIT` 9/9 e `SessionHttpIT` 7/7; verde |
| `bash scripts/verify.sh web` | lint, **117 testes** (14 arquivos; era 113) e build OK |
| `npx ng build` | initial total **730,41 kB**, aviso de orçamento +230,41 kB (era 726,61 kB) e aviso preexistente `pako` não-ESM |
| Playwright (`account-recovery` + regressão `account-registration`) | **18/18** Chromium/Firefox, 1 worker |
| `bash scripts/verify.sh planning` | 359 links locais; verde |
| `git diff --check` | limpo |
| Banco sintético | `flyway_schema_history` com a migração 7 (`account recovery`) aplicada |

O ensaio de navegador prova, no servidor, o que a tela não pode provar sozinha: a sessão aberta antes da recuperação responde 401 depois, a senha antiga deixa de entrar, a nova entra, o link expirado não altera a senha e o reuso responde 409. A expiração é exercitada com `recovery-ttl=5s` (parâmetro local reversível), não com espera de dez minutos.

Cobertura dos critérios do ticket nesta fatia:

- recuperação válida/inválida/limite verificadas em HTTP e navegador, com relógio controlado nos ITs; nenhum caminho permite agir sobre conta alheia (o token só é aceito para a conta que o emitiu, e a resposta nunca revela existência);
- mensagens e logs não expõem senha/código: asserção no IT varre auditoria e cadastro procurando o token e a senha em claro, e o teste de navegador confere que o aviso não carrega token;
- exclusão de conta, alteração autenticada de credenciais e desvinculação de logs **não** foram implementadas — critérios correspondentes permanecem abertos.

## Revisões Standards + Spec (baseline `8cf04b8`)

Duas revisões independentes sobre o diff delimitado da fatia. Findings corrigidos antes do aceite:

| Finding | Origem | Correção |
|---|---|---|
| `/recoveries` devolvia `INVALID_RECOVERY` para corpo com campo não declarado, enquanto o contrato prometia `INVALID_REQUEST` | Standards (violação dura) e Spec F4 | Corpo fora dos campos declarados passa a devolver 400 `INVALID_REQUEST`; token/senha/estado continuam em `INVALID_RECOVERY`. IT novo prova que o corpo recusado não consome o link. |
| Ramo de revalidação do estado da conta marcado como verificado sem teste | Spec F1 (médio) | IT novo: conta volta a `PENDING` após a emissão → 400, credencial e token intactos; restaurada, o mesmo link conclui. |
| "Concorrência de estados" afirmada sem prova | Spec F2 (médio) | IT novo com dois pedidos simultâneos do mesmo link: exatamente um 200 e um 409, um `RECOVERED`, um `USED`. Contrato reescrito com a afirmação precisa. |
| "MFA administrativo preservado" afirmado sem asserção | Spec F3 (médio-baixo) e Standards | IT novo com ADMIN+MFA: após a recuperação, o login com a senha nova continua `MFA_REQUIRED` com o mesmo segredo, e um código novo concede sessão completa. |
| Revogação de links pendentes e supressão por cooldown declaradas sem teste | Spec F6 (baixo) | IT novo: repetição suprimida não gera mensagem e não revoga o link ativo. Contrato passa a declarar que a revogação dos demais links é **defensiva** nesta fatia (só existe um link ativo por conta) e ganha efeito visível em 15B. |
| Título da UI culpava o link quando a senha era recusada | Spec F5 (baixo) | `INVALID_RECOVERY` passa a "Recuperação não concluída" (o servidor distingue na mensagem); teste unitário novo fixa o comportamento. |
| `issueRecovery`/`recover` repetiam geração de token, SQL de revogação e `Duration.ofHours(1)` | Standards (smell) | Extraídos `freshToken()`, `revokeActiveLinks(tabela, …)` e `RESEND_WINDOW`; `resend` passou a usar o mesmo caminho. Sem mudança de comportamento (ITs de cadastro e sessão revalidados). |
| Leitura dupla de `local_accounts` na conclusão | Standards (smell) | Bloqueio e leitura de `status`/`email` em uma única consulta. |
| FQN inline do `AuthService` | Standards (estilo) | Import adicionado. |
| Colunas `recovery_*` nulas contra `NOT NULL` em V2 | Standards (smell) | Mantidas nulas com justificativa escrita na migração: "nunca pediu recuperação" é estado legítimo e distinto, sem alterar o registro de cadastro. |
| Sem cobertura de indisponibilidade nos endpoints novos | Standards (smell) | Cenário de navegador novo: contêiner sintético pausado → mensagem de indisponibilidade com `role=alert`, e o pedido volta a funcionar após o despauso. |
| Fragmento `#recuperar=` documentado só no histórico; exemplo de contêiner divergente do irmão no README | Standards (docs) | Fragmento descrito no contrato; README passa a usar o contêiner como parâmetro do operador. |
| Ambiguidade sobre o limite "do cadastro" e sobre `SUPPRESSED` | Spec F7 (informativo) | Contrato explicita: mesmos valores configurados, contador e janela próprios; `SUPPRESSED` cobre três causas de propósito, porque separá-las reintroduziria sinal de existência de conta. |
| Assimetria preexistente: `/confirmations` também devolve código específico para corpo com campo extra | Standards (observação) | **Não alterado**: comportamento aceito no ticket 13 e documentado em `accounts-local-v1.md`; mudar o código de resposta de uma entrega aceita está fora desta fatia. Registrado como observação para 15B. |

O ensaio de navegador ganhou o cenário de indisponibilidade com dados sintéticos; o `#recuperar=` continua chegando pelo link real da mensagem. Nenhum finding ficou aberto sem resposta.

## Limitações e ressalvas

- Sem transporte real de e-mail, sem dados reais, sem TLS/HTTPS, sem defesa de tráfego distribuído e sem medição de cobertura.
- A mensagem cita "dez minutos" (valor aprovado) mesmo quando a instância local usa `recovery-ttl=5s` no ensaio; a divergência é do parâmetro de teste, não do produto.
- `revokeAll` revoga sessões por versão de segurança; a revogação de links pendentes cobre recuperação e confirmação de cadastro — links de troca de e-mail ainda não existem (15B).
- E19 (encerrar todas as sessões exposto ao usuário), E05/E12 (perda de e-mail/autenticador) e backup/restauração continuam pendentes.

## Próxima ação

Implementar **15B** (alterar a própria conta) sobre esta base, depois **15C** (encerrar conta e desvincular registros), que já depende do expurgo do ticket 19 e precisa da migração de desvinculação prevista em `docs/architecture/audit-local-v1.md`. Aguardando alinhamento do responsável antes de iniciar 15B.

---

# Fatia 15B — autoatendimento da própria conta

Data: 17/10/2026. Baseline Git: `dda23e4`. Contrato: `docs/architecture/account-self-service-local-v1.md`. Aceite **sintético e local**.

## Escopo executado

O percurso de **alterar a própria conta** (E02/E14): perfil da própria conta, nome de exibição (sessão persiste), senha atual → nova senha (revoga todas as sessões e links pendentes) e troca de e-mail com confirmação no endereço NOVO (o atual continua válido até lá; o antigo recebe aviso sem link). Ações sensíveis reutilizam a confirmação do módulo de acesso (sessão + CSRF; Gestor mantém MFA) com limite próprio de tentativas. Corpo fora dos campos declarados → `INVALID_REQUEST` sem alterar estado. 15C (encerramento/desvinculação) permanece aberta.

## Entregas

| Artefato | Conteúdo |
|---|---|
| `apps/api/src/main/resources/db/migration/V8__account_email_change.sql` | Tabela `account_email_change_tokens` e colunas de reexpedição em `local_accounts`. Migração nova; V1–V7 não foram reescritas. |
| `AccountSelfController` (novo) | `GET/POST /api/v1/account(…)`; id da autorização do servidor; CSRF obrigatório nos POSTs. |
| `AccountService` | `profile`, `changeDisplayName`, `changePassword`, `requestEmailChange`, `confirmEmailChange`, `confirmSensitive`; `revokePendingLinks` inclui a tabela nova. |
| `AccountController` / `AccountExceptionHandler` | Rota pública `/accounts/email-changes/confirmations`; tratamento estendido ao controlador próprio. |
| `LocalMailbox` | `EMAIL_CHANGE_CONFIRMATION` (link `#trocar-email=` para o NOVO endereço) e `EMAIL_CHANGE_NOTICE` (sem link, para o antigo). |
| `self-account.ts/.html/.scss` | Painel `Minha conta`: perfil, pendência com expiração, resultados com foco gerenciado, campos de senha limpos a cada tentativa, encerramento de sessão sinalizado. |
| `apps/web/e2e/account-self-service.spec.ts` | Três cenários de navegador (perfil/teclado/390px; troca de e-mail com senha errada e confirmação real; senha errada e troca encerrando sessão). |
| `docs/architecture/account-self-service-local-v1.md`; `apps/api/README.md` | Contrato da fatia e seção no README. |

## Verificações e resultados

| Comando | Resultado |
|---|---|
| `bash scripts/verify.sh api` | 14 unitários + **49 integrações** (`SelfServiceHttpIT` 6/6; era 43 antes da 15B); verde |
| `bash scripts/verify.sh web` | lint, **117 testes** e build OK; verde |
| `npx playwright test e2e/account-self-service.spec.ts` | **6/6** Chromium/Firefox |
| `npx playwright test e2e/account-self-service/account-recovery/account-registration.spec.ts` | **26/26** Chromium/Firefox (8 do 15B, com o cenário de indisponibilidade; 10 de recuperação; 8 de regressão do cadastro) |
| `bash scripts/verify.sh planning` | 363 links locais; verde |
| Banco sintético | `flyway_schema_history` v8 (`account email change`); banco do aceite recriado após o desenvolvimento por divergência de checksum da V7 reescrita na 15A — migrações aplicadas não devem ser editadas |

O ensaio de navegador prova, no servidor, o que a tela não pode provar sozinha: a resposta 400 com senha errada não altera nada (e-mail novo não recebe mensagem, pendência não aparece), a troca só vale após a confirmação no endereço novo, o endereço antigo deixa de entrar e o novo entra com a mesma senha, e a troca de senha encerra a sessão na interface.

Correções feitas durante o aceite (TDD):

- Estouro horizontal (10px) em 390px na tela `Minha conta`: `.topbar-actions` era `flex: 0 0 auto` e, com a sessão ativa ("Minha conta"/"Sair"), mantinha a largura max-content além da janela. Corrigido em `styles/layout.scss` (breakpoint ≤1100px: `flex: 0 1 auto`, `min-width: 0`, `flex-wrap: wrap`); verificado por medição de `scrollWidth` no Chromium.
- O primeiro E2E da troca de senha esquecia de redigitar a nova senha depois de a interface limpá-la (comportamento de segurança intencional); o teste foi ajustado, não a interface.

Auditoria verificada nos ITs: `DISPLAY_NAME`, `PASSWORD_CHANGE`, `EMAIL_CHANGE_REQUEST` (SENT/SUPPRESSED/INVALID/REJECTED/LIMITED) e `EMAIL_CHANGE` nos desfechos; nenhuma mensagem/log retém senha, token em claro ou credenciais (asserção varre auditoria, cadastro e log). Nenhum caminho age sobre conta alheia: id da sessão no servidor.

## Limitações e ressalvas da 15B

- Aviso ao endereço antigo é sintético; sem transporte real de e-mail, dados reais ou TLS/HTTPS.
- Expiração da pendência exercitada nos ITs com relógio controlado; o navegador usa os prazos padrão.
- E19 exposto ao usuário (encerrar todas as sessões) segue com 15C.

## Revisões Standards + Spec (baseline `dda23e4`)

Duas revisões independentes sobre o delta da fatia. Findings corrigidos antes do aceite:

| Finding | Origem | Correção |
|---|---|---|
| Contrato declarava `400/403 MFA inválido` e colapsava os desfechos da confirmação; a API real devolve 401 `INVALID_MFA` e distingue 409 `USED`/`EMAIL_TAKEN` e 410 `REPLACED`/`EXPIRED` | Standards (judgement) e Spec (low) | Tabela do contrato reescrita com os códigos reais e a nota de distinção entre `INVALID_MFA` e `SESSION_REQUIRED` (ambos 401). |
| Rótulo `Gestor` exposto na interface contra o glossário (evitar `Gestor`) | Standards e Spec (info) | `roleLabel` passa a `Administrador`; README e contrato normalizados. Nenhuma técnica muda: MFA continua exclusivo do papel ADMIN. |
| Validação TOTP duplicada entre `verify` e `requireConfirmation` | Standards (smell) | Extraída `acceptTotp(account, code)`; `verify` e `requireConfirmation` reutilizam. `SessionHttpIT` e `SelfServiceHttpIT` revalidam os dois percursos. |
| `AbortController` criado e nunca abortado (padrão `OnDestroy` do irmão ignorado) | Standards (smell) | `SelfAccount` passa a `implements OnDestroy` e aborta requisições em voo. |
| Dead store de `email` em `changePassword`; re-leitura de `now` sem intenção | Standards (observation) | Primeira leitura removida (consulta só de `password_hash`); a re-leitura do relógio ganhou comentário (instante pós-verificação cara de propósito). |
| Pendência de troca de e-mail exibida sem a expiração real | Spec (low) | `pendingEmailExpiresAt` renderizado em America/Sao_Paulo com asserção no E2E. |
| Falta asserção da queda da troca de e-mail PENDENTE na troca de senha | Spec (low) | IT novo: pendência criada, senha trocada, confirmação posterior responde 410 `REPLACED_EMAIL_CHANGE`, `revoked_at` preenchido e token fora de qualquer gravação. |
| E2E sem cenário de indisponibilidade do painel | Spec (low) | Cenário novo: contêiner pausado → a sessão global responde com alerta de indisponibilidade e nada é concedido; após o despauso, a view volta a carregar o perfil. |
| Nome da migração citado errado nos documentos | Standards + Spec (low/obs) | `V8__account_email_change.sql` citado nos três documentos. |
| Typo `Avviso`; duplicação de estilos entre `self-account.scss` e `account-page.scss` | Standards (observation) | Typo corrigido. Duplicação **não alterada nesta fatia**: unificar estilos de card/form altera a identidade visual e merece incremento próprio; registrado como follow-up. |
| Balde de limite da confirmação de troca de e-mail é global entre contas | Spec (info) | **Não alterado**: reproduz o padrão já aceito (`REGISTRATION`/`RECOVERY`); a revisão para operação real pertence a um incremento de endurecimento. Registrado no registro de pendências. |

Verificações pós-correções (15B, revalidada depois na 15C): `verify.sh api` 14 unitários + 49 integrações (`SelfServiceHttpIT` 6/6), `verify.sh web` lint + 117 testes + build e os specs de conta em Chromium/Firefox. Nenhum finding ficou aberto sem resposta ou registro.

---

# Fatia 15C — encerramento da própria conta e autor histórico

Data: 17/10/2026. Baseline Git: `78b7e97` (checkpoint da 15B). Contrato: `docs/architecture/account-closure-local-v1.md`. Aceite **sintético e local**.

## Escopo executado

O percurso de **encerrar a conta** (E07/E09–E11/CA24) e o **controle autônomo de sessões** (E19). O encerramento exige senha atual (código novo do autenticador para Administrador) e a confirmação digitada `ENCERRAR`; elimina o cadastro ativo, remove tokens/sessões/limites/uso individual e substitui a autoria por referência residual nova em auditoria, versões e configurações de fonte, sem cascata sobre ocorrências, fontes ou versões. O ADR 0001 deixa de ser pendência de implementação: a separação entre autoria histórica e cadastro passa a existir por migração (V9).

## Entregas

| Artefato | Conteúdo |
|---|---|
| `apps/api/src/main/resources/db/migration/V9__account_closure_historical_authorship.sql` | Tabela `historical_actors`; `historical_actor_id` em `auth_audit_events`, `account_audit_events`, `source_audit_events`, `source_access_configurations` e `source_versions`; nulos permitidos em `actor_id`/`created_by`/`author_id`; CHECKs de auditoria de contas ampliados. V1–V8 preservadas. |
| `AccountService` | `closeAccount` (transação única: residual, aviso sem token, eliminação do uso, desligamento dos vínculos, remoção de tokens/sessões/limites, evento de encerramento, exclusão do cadastro) e `revokeSessions` (E19, com limite próprio). |
| `AccountSelfController` | `POST /api/v1/account/closure` e `POST /api/v1/account/sessions/revocations`. |
| `self-account.ts/.html/.scss` | Card `Sessões` com "Encerrar todas as sessões" e card destrutivo `Encerrar conta` com senha, confirmação digitada (signal) e código do autenticador para Administrador. |
| `apps/web/e2e/account-closure.spec.ts` | Três cenários de navegador (encerramento com confirmação e preservação de fatos; sessões autônomas; corpo fora do contrato). |
| `ClosureHttpIT`; `LocalAuthHttpSupport`; `AccountRegistrationHttpIT` | 4 ITs novos e reset dos fixtures incluindo `historical_actors`. |
| `docs/architecture/account-closure-local-v1.md`; `apps/api/README.md` | Contrato da fatia, tabela de endpoints e exemplo de ensaio. |

## Verificações e resultados

| Comando | Resultado |
|---|---|
| `VETOR_API_INTEGRATION_TESTS=ClosureHttpIT bash scripts/verify.sh api` | Vermelho inicial (rotas 404) → **4/4** após a implementação → **6/6** depois das correções da revisão |
| `bash scripts/verify.sh api` | 14 unitários + **55 integrações** (era 49); verde |
| `bash scripts/verify.sh web` | lint, **117 testes** e build OK; verde |
| Playwright (`account-closure` + autoatendimento + recuperação + cadastro) | **32 passaram, 2 pulados** em Chromium/Firefox; os pulados são os dois ensaios do percurso administrativo de E19, que exigem a fixture administrativa local com autenticador novo ausente deste ambiente — o percurso administrativo está provado por HTTP (`ClosureHttpIT`) |
| `bash scripts/verify.sh planning` | 369 links locais; verde |
| Banco sintético | `flyway_schema_history` v9 (`account closure historical authorship`) |

O ensaio HTTP prova, no servidor: senha errada e corpo fora do contrato não alteram nada; o limite de tentativas responde 429 sem revogar sessão nem encerrar conta; o Administrador só revoga sessões com código novo; depois do encerramento não existe linha em `local_accounts`, nenhum vínculo recuperável em auditoria/sessões/tokens/limites (incluindo o balde derivado do e-mail e o `authorId` dentro dos snapshots JSONB), a auditoria sobrevivente pertence a **duas** referências residuais distintas — segurança/conta e autoria de domínio —, o uso individual desaparece, ocorrências e fontes permanecem e o novo cadastro com o mesmo endereço nasce `USER`, sem histórico. O ensaio de navegador prova a confirmação digitada obrigatória, a volta ao acesso com aviso, o encerramento simultâneo das sessões e o comportamento em 390 px.

## Revisões Standards + Spec (baseline `78b7e97`)

Duas revisões independentes sobre o delta da fatia. Findings corrigidos antes do aceite:

| Finding | Origem | Correção |
|---|---|---|
| `limited("SESSION_REVOCATION")` gravava ação fora do CHECK de `account_audit_events`: o 429 documentado virava 503 e nenhuma sessão era revogada | Standards (hard) | `limited("SESSIONS_REVOKED")`; IT novo cobre o 429 e prova que as sessões continuam válidas ao atingir o limite. |
| UUID da conta eliminada sobrevivia em `before_snapshot`/`after_snapshot` de `source_audit_events` (`authorId`), contrariando o contrato e a garantia do IT | Standards (hard) e Spec (high) | O encerramento troca o `authorId` embutido pela referência de domínio (`jsonb_set`) e o IT varre os JSONB, provando zero vínculo. |
| Uma única referência residual fundia segurança/conta com autoria de domínio | Spec (high) | Passam a existir **duas** referências (`historic_actors` ×2): segurança em `auth_audit_events` SECURITY + `account_audit_events`; domínio em ADMIN, fontes, versões e configurações. O IT prova que são distintas. |
| Gestor não conseguia "Encerrar todas as sessões" pela interface (sem campo de código, servidor exige MFA) | Spec (high) | Card Sessões ganha senha atual e código do autenticador para Administrador; IT novo cobre o percurso administrativo (401 sem código, 200 com código novo). |
| E19 entregue sem exigir a senha atual | Spec (médio) | `/account/sessions/revocations` passa a exigir `currentPassword` (400 `INVALID_CURRENT_PASSWORD`); E2E cobre a recusa por senha errada. |
| Balde `login:<sha256(e-mail)>` sobrevivia ao encerramento | Spec (médio) | `AuthService.loginBucket(email)` centraliza a chave e o encerramento a remove explicitamente. |
| `/account/closure` sem limite próprio de tentativas | Standards (judgement) | Balde `ACCOUNT_CLOSURE` com a mesma política das ações sensíveis; IT novo cobre 429. |
| Contrato de auditoria declarava a integração do 15 como não implementada | Standards (judgement) | Seção de `audit-local-v1.md` atualizada, apontando o contrato da 15C e as duas referências distintas. |
| Autoria histórica não projetada na leitura de logs | Spec (low) | **Não alterado**: pertence ao incremento da leitura de auditoria (ticket 19); registrado como pendência no contrato da 15C. |
| Comentário da V9 sem espaço após os dois-pontos | Standards (observation) | Corrigido. |

## Correções feitas durante a fatia

- `source_versions.author_id` (FK RESTRICT) não estava previsto: o encerramento administrativo falhava com 503 e a migração passou a cobrir a coluna — erro encontrado pelo próprio IT, não por inspeção.
- O botão de encerramento usava `computed` sobre propriedade comum (não reativa, permanecia inativo); passou a `signal` com `ngModelChange` e comparação exata de `ENCERRAR`.

## Limitações e ressalvas da 15C

- Sem canal de solicitação de correção implementado (E12 vale quando existir), sem guarda legal, preservação excepcional (E18), backups/restauração (E17) ou dados reais.
- A separação de autoria é irreversível, mas não é anonimização garantida: contexto, datas e textos podem identificar; avaliação própria pertence à operação real.
- `verify.sh planning` sobre o commit isolado continua falhando por links para documentos de planejamento nunca commitados (pré-existente, igual ao baseline).
