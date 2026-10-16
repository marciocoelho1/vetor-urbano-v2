# Ticket 14 — progresso em 15/10/2026

## Escopo e base

Somente ticket 14, base `f93ad96` sobre `067f9c0`, branch `integration/functional-spec-v1`. Lidos PLAN/AGENTS, original `.scratch/consulta-coerente/issues/14-acesso-sessao-mfa.md`, contrato de contas, checkpoint do 13, D03/D11/D13, estrutura/operação. Decisões aprovadas preservadas: aplicativo autenticador, referência de uma hora de inatividade, revogação em logout/troca de senha. Nenhum controlador/subagente/troca de modelo/esforço foi usado.

[Contrato de sessão/MFA](../architecture/session-local-v1.md) documentado antes da implementação. Valores locais reversíveis separados de política operacional. RF06 permanece aberto; ADMIN não equivale automaticamente a Operador/Gestor. Recuperação/troca/exclusão do 15 não implementadas.

## Implementação

- Migrações novas V3 (sessões, papéis USER/ADMIN, versão de segurança, MFA cifrado, limites persistentes e eventos de acesso) e V4 (parâmetros de auditoria da consulta). V1/V2 preservadas. V3 foi aplicada localmente antes de acrescentar parâmetros; evolução registrada em V4.
- Senha conferida pelo PBKDF2 existente; mesma validação reutilizada no bootstrap. Conta pendente nunca ganha sessão. Cadastro público continua estrito e impõe USER.
- Cookie HttpOnly/Strict, identificador aleatório armazenado só em hash. CSRF associado e Origin restrito nos POST; CORS também nas recusas do filtro. Local HTTP com Secure=false explícito, parâmetro para HTTPS futuro.
- Sessão persistida no PostgreSQL; prazos verificados após locks com Clock injetável. Logout, rotação em login/MFA e `revokeAll` revogam no servidor. Gancho transacional do 15 sem criar seu fluxo.
- TOTP SHA1/6 dígitos/30 s, tolerância ±1 passo, consumo de contador sob lock por conta. Enrollment/ativação só ADMIN com senha/sessão parcial. Segredo cifrado AES-GCM, chave em arquivo 0600 fora do repositório; sem rota pública de reset. Ferramenta offline cria ADMIN sintético e reseta MFA/revoga sessões em caso de perda local.
- UI direciona visitantes à autenticação; fontes/explicações/documentos continuam públicos. Consulta simples/avançada para USER. Gestão de fontes/registro demonstrativo exige ADMIN completo. Navegação consulta servidor e a API de ocorrências verifica sessão independentemente dela. Não foram criados painéis futuros nem ações persistidas de tickets posteriores.
- Eventos de acesso e consulta registram ator, UTC, ação/módulo/resultado e filtros validados; omitem texto livre/credenciais. Sem API pública de logs. Ticket 19 deverá impor sua própria permissão.

## Verificação e correções durante o trabalho

Fronteiras autorizadas: HTTP real → Java → PostgreSQL/PostGIS e Chromium/Firefox; skill TDD usada, sem delegação. Primeiro teste TOTP falhou por ausência da implementação e passou com os vetores SHA1 da RFC 6238, reduzidos aos seis dígitos configurados.

Correções comprovadas na rodada:

1. Teste do 12 esperava 503 da consulta; agora a indisponibilidade pode impedir a autorização primeiro. Expectativa atualizada para `ACCESS_UNAVAILABLE`, mantendo 503, ausência de contagens e recuperação; garantias de fuso, intervalo semiaberto, borda espacial e publicação preservadas.
2. Auditoria inicialmente assumiu período obrigatório e quebrou a consulta `situation=ONGOING` sem período (500). Corrigida para preservar os valores opcionais; teste original voltou a 200 sem relaxar sua asserção.
3. Helper E2E podia fechar o painel já aberto por “intervalo personalizado”; passou a aguardar/preencher o campo sem alternar novamente. Não houve mudança de semântica temporal/espacial.
4. Jornadas novas fixam referência temporal da consulta no navegador, como as do 12; os códigos TOTP usam relógio real do servidor nas jornadas e Clock controlado nos testes de prazos.
5. Rodada de navegador durante edição/rebuild foi interrompida e não conta como aceite. Execução final deve usar fontes congeladas e cópia estável do JAR; a mesma rodada revelou um erro de variável do teste de screenshot, corrigido.
6. Seleção inicial de unidade web por padrões separados por vírgula não encontrou testes. Uso correto: glob com chaves. Ausência não foi contada como sucesso.

## Checkpoint de verificação

Concluído localmente com as evidências abaixo. Rodadas falhas/interrompidas foram registradas e repetidas; não contam como aceite.

7. A rodada estável identificou um defeito real no CORS: preencher `Access-Control-Allow-Origin` no filtro para OPTIONS fazia o Spring pular o restante do preflight, omitindo métodos/cabeçalhos. `curl OPTIONS` comprovou a ausência. Corrigido para o Spring produzir o preflight completo; novo HTTP verifica métodos, `x-csrf-token` e credentials. Erros de conexão no navegador também passam a ter texto em português. Essa rodada falha não conta como aceite.

8. Após a correção do preflight, Chromium/Firefox comprovaram a negativa durante a pausa real do banco. O último assert do teste ainda esperava formulário de login após a recuperação, embora a sessão persistida continuasse válida. Expectativa corrigida pelo contrato: recarga após recuperação restaura consulta/contagem e botão Sair. O 503 não revoga uma sessão válida nem concede acesso durante a falha. Não foi mudado código para satisfazer esse oráculo.

9. Revisão própria detectou alias de caminho codificado (`/ap%69/v1`): o filtro inicial comparava URI bruta, permitindo chegar ao controlador sem ator e terminar em 500. Corrigido para usar caminho do servlet já decodificado/normalizado; teste exige 401 também em barras duplicadas, `accounts/../occurrences` e parâmetro de caminho. Nenhum desses aliases pode executar consulta protegida. API repetida após a correção: 11 unitários + 23 integrações, zero falhas/ausências.

## Critérios e evidências conclusivas

| Critério | Evidência local sintética |
| --- | --- |
| Visitante público; módulos protegidos; dois modos para USER | Playwright real em ambos os motores: fontes anônimas, direcionamento, login por teclado, alternância, recarga e logout; HTTP 401/403 independentes da UI |
| Senha correta/incorreta e conta pendente | `SessionHttpIT`, cadastro/confirmação HTTP reais antes do login; mesmo verificador de senha do 13 |
| Administração e MFA obrigatório | Bootstrap offline real; sessão parcial recebe 403 inclusive em GET direto; USER recebe 403 no enrollment e na navegação administrativa; ADMIN completo recebe 200 |
| Cadastro/ativação do autenticador | TOTP real no navegador e servidor; primeiro código ativa/rotaciona cookie, códigos inválidos/expirados/reutilizados rejeitados, enrollment ativo 409 |
| Uso único e limites duráveis | Duas requisições HTTP concorrentes: exatamente um 200 e um 401; replay em novo login e após reinício negado; limites de login/MFA persistem e retornam 429, nova janela controlada permite retentar |
| Prazos, logout e revogação | Clock controlado verifica fronteiras exatas (1 h inativo, absoluto configurado e 5 min parcial), logout/repetição, versão de segurança e `revokeAll` sem implementar troca de senha |
| Persistência e proteção | Reinício de contextos HTTP mantém sessão completa/MFA, sessão parcial e limites; banco contém hash de sessão e segredo cifrado; auditoria sem e-mail/credenciais. Arquivo AES exige 0600 |
| Reinício completo da JVM | Cliente Python mantém cookie/credenciais somente em memória; encerra/inicia outro processo Java, `/auth/session`=200, payload/IDs/contagens iguais; logout=200 e consulta com cookie revogado=401 |
| Perda local do segundo fator | Ferramenta offline real cria ADMIN, autenticação/ativação HTTP, `reset-mfa` real revoga sessão (401); login seguinte é parcial e exige novo enrollment. Sem endpoint público de reset |
| Indisponibilidade | Pausa real do PostGIS: acesso/sessão/login 503 sem grant; navegador mostra carregamento e erro, sem contagem válida; ao recuperar, sessão ainda válida é restaurada. API offline/retry do 12 preservados |
| Consulta do 12 preservada | 5 HTTP + 6 jornadas de navegador repetidos com sessão: publicadas, relações/referências, precisão incerta/territorial, filtros, horários/fuso, início incluído/fim excluído, raio 999/1000 m no PostGIS e 900/1000 na UI |
| Teclado/foco e móvel | Login/logout e erro com foco; MFA por teclado, erro focado e formulário a 390 px; sem overflow horizontal; screenshot de sessão móvel inspecionado, inputs mascarados |

### Comandos e resultados

Dependências presentes: JDK 21 em `/tmp/vu-jdk-21`, Maven Wrapper, Podman com socket `/tmp/vu-podman-ticket13.sock`, imagem `postgis/postgis:17-3.5`, dependências Angular/Playwright e motores Chromium/Firefox. Sem instalação/contratação de serviço externo. O comando API inicial sem PATH do JDK foi bloqueado por `javac` ausente e não contou como sucesso.

```bash
PATH=/tmp/vu-jdk-21/bin:$PATH JAVA_HOME=/tmp/vu-jdk-21 \
DOCKER_HOST=unix:///tmp/vu-podman-ticket13.sock TESTCONTAINERS_RYUK_DISABLED=true \
VETOR_API_UNIT_TESTS='TotpTest,AccountPasswordTest,OccurrenceQueryParserTest,OccurrenceRecordTest' \
VETOR_API_INTEGRATION_TESTS='SessionHttpIT,OccurrenceQueryHttpIT,AccountRegistrationHttpIT,DatabaseMigrationIT' \
bash scripts/verify.sh api

VETOR_WEB_UNIT_TESTS='src/app/{app.spec.ts,auth/*.spec.ts,accounts/*.spec.ts}' \
bash scripts/verify.sh web

cd apps/web
VETOR_SESSION_E2E=1 VETOR_PERSISTED_E2E=1 \
VETOR_E2E_DATABASE_CONTAINER=vetor-api-ticket12-db \
npx playwright test e2e/session-access.spec.ts e2e/persisted-query.spec.ts --workers=1
```

- API final: **11/11 unitários e 23/23 integrações** (7 sessão/MFA, 9 contas, 5 consulta, 2 migrações), zero skipped. `clean verify` completo para as classes selecionadas, após correção dos aliases. V1/V2 byte a byte preservadas.
- Web: lint, **58/58 unitários afetados** e build passaram. Os testes de UI demonstrativa recebem sessão sintética apenas na unidade; não substituem HTTP/browser reais de autorização. Build **627,27 kB**, aviso conhecido de orçamento (+127,27 kB sobre 500 kB), sem falha de build. Não executada auditoria geral nem suítes não afetadas do 12.
- Browser final: **12/12 passaram em 44,5 s**, zero skipped, contra cópia estável do JAR final, incluindo MFA móvel e foco/teclado em ambos os motores. Traces e screenshots automáticos desativados; screenshot explícito de sessão móvel mascara inputs e foi inspecionado.
- Preflight real conferido também com `curl OPTIONS`: origem restrita, credentials=true, métodos GET/POST/OPTIONS e cabeçalhos content-type/x-csrf-token; origem externa rejeitada. Verificações de proteção ficam no servidor.
- Prova manual JVM: `{"session_after_jvm_restart":200,"query_same":true,"logout":200,"revoked":401}`. Prova offline de perda: `offline_create=true`, `mfa_activated=true`, `offline_reset=true`, `old_session=401`, `new_login_requires_enrollment=true`. Entradas/segredos só em memória/stdin, sem exportá-los para evidências.

### Revisão própria e isolamento

Comparação com `f93ad96` e snapshot inicial em `/tmp/vu-ticket14-before`. Revisão de contrato/implementação, limites de transação/locks, credenciais/CSRF/cookies, aliases de URL, MFA parcial, rotação/replay, indisponibilidade e migrações. Corrigidos os defeitos efetivamente encontrados acima. Diff do HTML é maior devido à indentação automática do bloco de autorização; revisão sem whitespace confirmou conteúdo institucional preservado, além do aviso da consulta atualizado para autenticada.

Alterações anteriores do 07 em App/mapas, testes de sobreposição e estilos foram preservadas. Somente o patch do 14 sobre o snapshot de `app.ts`/`app.spec.ts` entra no índice. PLAN/CHANGELOG serão preparados sobre HEAD com apenas o checkpoint do 14. Ferramentas/controlador, documentos/ODT, glossário e reconciliações preexistentes ficam fora do commit. Não houve descarte ou push.

Interferência delimitada: E2E antigo do 07 abre `/` sem sessão; sua retomada deverá preparar conta/sessão sintética para alcançar o mapa agora protegido. Não foi modificado nem reexecutado esse E2E; a pendência anterior do clique sobreposto em Firefox permanece sem novo aceite. Nenhum outro ticket foi implementado.

### Limitações e próxima ação

Aceite restrito a host loopback, contas e dados sintéticos. Não equivale a prontidão operacional: HTTPS/gestão de chaves/backup/rotação, recuperação administrativa operacional, antiabuso distribuído, retenção/eliminação e política definitiva ainda exigem trabalho específico. Não há envio real, coleta, publicação, contratação ou declaração de segurança/cobertura operacional. RF06 e perfis legados permanecem em reconciliação.

Dependências técnicas diretas do Luna liberadas pelo 14, considerando 06/08/09 existentes: **16, 19, 25, 26, 28, 29, 32 e 33**. Cada incremento deve demonstrar sua própria autorização e observar parâmetros pendentes; cadeias posteriores não ficam automaticamente aceitas. Ticket **15** também fica tecnicamente liberado, sem implementação nesta entrega. Encerrar após o 14.


## Encerramento e checkpoint

**Ticket 14 aceito no recorte local sintético.** Contrato e critérios acima comprovados; sem aceite operacional. Revisão própria e commit isolado preparados sobre `f93ad96`; identificação do commit disponível no Git pelo assunto `feat: protect local sessions and admin MFA (ticket 14)`. PLAN/CHANGELOG atualizados somente com o 14 no índice; mudanças anteriores continuam na árvore de trabalho. `bash scripts/verify.sh planning` passou com **223 links locais**; `git diff --check` e `git diff --cached --check` passaram. As verificações ocorreram na árvore compartilhada com o trabalho anterior preservado; não constituem aceite do 07. Sem push.

Serviços iniciados para esta rodada encerrados ao concluir; contêiner sintético e socket Podman preexistentes preservados, banco recuperado e sem descarte de dados/alterações. Logs resumidos e screenshots mascarados ficam em `.scratch/consulta-coerente/evidence/ticket-14-2026-10-15/`; testes/contratos reproduzíveis entram no commit. Não exportados cookies, tokens, códigos, segredos ou entradas privadas de bootstrap.
