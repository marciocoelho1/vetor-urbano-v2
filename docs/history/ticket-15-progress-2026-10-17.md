# Ticket local 15 — fatia de recuperação de acesso (15A)

Data: 17/10/2026. Baseline Git desta entrega: `8cf04b8` (checkpoint do ticket 34), branch `integration/functional-spec-v1`. Aceite **sintético e local**; não indica prontidão operacional.

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
