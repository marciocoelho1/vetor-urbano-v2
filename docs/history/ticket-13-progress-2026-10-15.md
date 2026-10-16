# Ticket 13 — cadastro, confirmação e reenvio locais

Data: 15/10/2026. Base `067f9c0`, branch `integration/functional-spec-v1`. Fonte: `.scratch/consulta-coerente/issues/13-cadastro-confirmacao.md`; RF05, RNF02/RNF06, D11/D13, CA24 preservados. **Aceito no recorte local sintético**, com os cinco critérios demonstrados. Contrato e fontes primárias em [accounts-local-v1](../architecture/accounts-local-v1.md).

## Escopo, aprovações e configurações

Reutilizados Java 21, Spring Boot 4.1.1, Maven Wrapper, PostgreSQL 17.5/PostGIS 3.5, Flyway e ambiente do Ticket 12. V1 intacta; nova V2 cria contas, hashes de confirmação, contadores e eventos. Não há novo backend independente, fornecedor de e-mail, sessão/MFA (14), recuperação/exclusão (15), coleta ou publicação.

Confirmados nos registros: nome de exibição/e-mail/senha, ausência de endereço residencial, perfis Usuário/Administrador, proibição de autoatribuição administrativa e de segredos em auditoria. Caixa local e uso único já estavam aprovados e não foram reabertos. A instrução desta retomada autoriza escolher configurações técnicas reversíveis para teste sem fechar política operacional. O texto antigo do ticket sobre integração posterior não revoga esta autorização específica.

Desenvolvimento: senha 15–128 caracteres Unicode sem composição obrigatória/truncamento/trim, pequena blocklist local explícita, PBKDF2-HMAC-SHA256 com 600.000 iterações e salt de 128 bits; token aleatório de 256 bits, persistido só como SHA-256. NIST/OWASP consultados em 15/10 e citados no contrato sustentam os mecanismos, não os números de prazo/limite escolhidos localmente.

Padrões locais: validade 15m, cooldown 60s, até 3 reenvios efetivos/hora por conta, 30 tentativas/minuto por ação nesta aplicação local. Propriedades explícitas e validadas; contas desabilitadas por padrão e restritas ao perfil local/loopback. Ensaios de navegador: validade 5s, cooldown 1s, 2 reenvios/hora, mesma derivação de 600.000 iterações. HTTP: relógio UTC controlado, sem dormir para expiração; casos específicos usam limites de 1/2 para provar persistência e reset. Estes valores não são política operacional aprovada.

## Critérios originais e demonstração

| Critério | Evidência desta revisão |
|---|---|
| 1. Navegador demonstra cadastro, confirmação válida/inválida e reenvio sem endereço | Página local `/?conta=local` com três formulários. Chromium/Firefox usam API e caixa reais, seguem o link da mensagem, confirmam explicitamente, verificam inválido, expirado, usado, substituído e reenvios suprimidos/efetivos. Não existe campo residencial. |
| 2. Senha protegida, persistência e proibição de privilégio administrativo | HTTP direto rejeita `role`, `roles`, `profile`, `admin`, `status`; banco impõe USER. Testes conferem PBKDF2/salt/hash e verificação correta, senha incorreta rejeitada, Unicode/espaços preservados e nenhuma senha/token reutilizável em claro no banco. Repetir cadastro não troca credenciais/nome nem cria outro token. |
| 3. Identidades/caixa sintéticas e eventos sem segredos | `.test` obrigatório, sem SMTP. Caixa do operador em loopback, memória limitada, no-store e sem CORS para terceiros. Eventos de cadastro/reenvio, supressão/rejeição, confirmação válida/inválida/expirada/usada/substituída e limitação conferidos no PostgreSQL. Auditoria não contém e-mail, senha, hash de senha ou token; logs capturados não contêm credenciais. |
| 4. Estados pendentes/indisponíveis, uso único, expiração e fronteira | 202 genérico igual para e-mail desconhecido, pendente não elegível ou confirmado. Sem consulta pública por e-mail nem devolução de identidade. Token revela somente seu estado, sem conta. Transação/bloqueio garante um único vencedor em duas confirmações concorrentes; repetição retorna 409. Expiração na borda, substituição e limites persistentes comprovados. |
| 5. Chromium/Firefox, estados/teclado/móvel, HTTP/PostGIS e verificações | 8/8 jornadas de navegador, 390 px sem overflow, foco/teclado, carregamento, erro e recuperação após pausa real do banco e perda de conexão. API selecionada: 2 unitários e 9 HTTP/PostGIS; web selecionada: lint, 3 unitários e build. Planning/diff-check conforme fechamento abaixo. |

## Contrato observável e proteção

POST `/api/v1/accounts/registrations`, `/confirmations` e `/confirmation-requests`, com listas estritas de campos. `CONFIRMATION_PENDING` não revela se já existe conta; só confirmação com posse do token válido chega a `ACCOUNT_CONFIRMED`. Não emite cookie, sessão, papel ou dados de outra pessoa. Cadastro repetido deriva a senha recebida para evitar um caminho barato de consulta de existência, mas não modifica a conta já existente.

Reenvio efetivo revoga o token anterior ativo; repetição dentro do cooldown ou após limite por conta retorna o mesmo 202 e preserva o token atual. Confirmado/desconhecido não recebe mensagem. Limites globais persistentes de tentativas retornam 429/Retry-After, inclusive para tokens desconhecidos, sem depender da existência de e-mail. A janela reseta no relógio do servidor. Ausência de banco gera 503 específico de contas sem registrar corpos/SQL de credenciais em logs; não afirma sucesso.

A caixa é uma superfície separada, exclusiva do operador local de teste, não um endpoint de mensagens da API pública. Host/Origin são verificados; conteúdo é escapado e framing bloqueado. Link usa fragmento removido pelo cliente e confirmação só por POST. Horário da caixa é apresentado em America/Sao_Paulo; JSON/instantes persistidos em UTC. Credenciais e tokens só são transportados em corpos para a operação e na mensagem efêmera autorizada. Não são gravados em localStorage, query string ou auditoria.

Auditoria está restrita ao banco local, sem endpoint de leitura. Retenção definitiva, envio real, mitigação distribuída, lista operacional de senhas comprometidas, acesso autenticado e segurança de produção não são entregues por este incremento. Respostas de cadastro/reenvio têm conteúdo indistinguível para contas existentes/desconhecidas; não se declara prova formal de tempo constante em toda a pilha HTTP.

## Ciclos e comandos/resultados

Usada a skill TDD nas fronteiras previamente autorizadas de HTTP/PostGIS e navegador. Banco real, sem H2. O primeiro ensaio não alcançou o teste porque o socket Podman do 12 havia expirado; isso foi falha de infraestrutura, não red funcional. Iniciado `podman system service --time=0 unix:///tmp/vu-podman-ticket13.sock`, mantendo o banco preexistente. Depois houve ciclos funcionais 404→202 (cadastro), 404→200/409 (confirmação), 404→202 (reenvio), tela ausente→presente e ampliação incremental dos testes de proteção/limites/concorrência.

```bash
JAVA_HOME=/tmp/vu-jdk-21 PATH=/tmp/vu-jdk-21/bin:$PATH \
DOCKER_HOST=unix:///tmp/vu-podman-ticket13.sock TESTCONTAINERS_RYUK_DISABLED=true \
VETOR_API_UNIT_TESTS=AccountPasswordTest \
VETOR_API_INTEGRATION_TESTS=AccountRegistrationHttpIT bash scripts/verify.sh api
# Final: status 0; 2 unitários + 9 HTTP com PostgreSQL/PostGIS real, zero falhas/pulados.

VETOR_WEB_UNIT_TESTS='src/app/accounts/*.spec.ts' bash scripts/verify.sh web
# Status 0: lint, 3 unitários e build 616,35 kB; aviso +116,35 kB além de 500 kB.

cd apps/web
VETOR_ACCOUNTS_E2E=1 VETOR_E2E_DATABASE_CONTAINER=vetor-api-ticket12-db \
  npx playwright test e2e/account-registration.spec.ts --workers=1 --output=test-results/account-final
# Final: 8/8, Chromium/Firefox, sem mock das operações ou da caixa.
cd ../..
bash scripts/verify.sh planning
# Status 0; 218 links locais válidos.
git diff --check
git diff --cached --check
```

O executor ganhou seleções explícitas, impressas no log, para honrar a instrução de não repetir suítes inalteradas do 12. Sem as variáveis, mantém execução completa por padrão. As verificações do 12 em `067f9c0` foram reaproveitadas, não contadas como testes novos do 13. Alteração compartilhada de CORS para POST e migração V2 tiveram preflight/HTTP real e um smoke da consulta existente no novo processo, sem repetir a suíte 12.

Primeiro E2E ampliado: 7/8, com falha no teste Chromium de reenvio por tentativa de acionar confirmação enquanto o reenvio ainda estava ocupado. Ajustada somente a espera: cada ação aguarda sua resposta POST e botão habilitado, mantendo os oráculos de token/estado. Reexecução afetada 2/2 e execução final 8/8. Dois unitários de formulário inicialmente presumiam atualização síncrona de ngModel; passaram a aguardar renderização ainda com fetch pendente, preservando a exigência de limpar senha antes da resposta. Falhas não foram contadas como sucesso.

Traces e screenshots automáticos dos testes de contas estão desativados; capturas explícitas mascaram campos de senha/token. Um erro de asserção inicial incluiu o valor de token já expirado/substituído no artefato do runner; ele foi redigido nos logs/artefatos locais, e a asserção de campo limpo passou a relatar apenas booleano. Nenhuma credencial reutilizável foi publicada ou exportada para o histórico. Capturas finais móveis/confirmado/indisponível e logs sanitizados ficam em `.scratch/consulta-coerente/evidence/ticket-13-2026-10-15/`.

## Persistência após reinício

O HTTP automatizado fecha/reabre o contexto Java no mesmo PostGIS e comprova conta/token consumido, token pendente, contador de reenvio e limite global persistidos. A caixa reiniciada fica vazia, conforme seu contrato de memória. Duas confirmações concorrentes têm exatamente os resultados 200 e 409, sem Set-Cookie.

Além disso, um ensaio local encerrou o processo JAR e iniciou outro com o mesmo banco e a revisão final. Criou/confirmou identidade `.test`, comparou registros completos de contas (incluindo hashes e contadores) somente em memória, sem exportá-los, e verificou 409 para o token consumido antes/depois. Resultado: dados idênticos, token ainda inutilizável, caixa vazia. Flyway validou V1/V2 sem reaplicação. Uma primeira sonda desse ensaio esperou só a caixa, que inicia antes do servidor principal, e falhou por conexão recusada; a sonda final aguardou ambos e concluiu. A execução final 8/8 de navegador usou o processo reiniciado.

## Revisão própria e limites reais

Na revisão foi encontrada e corrigida uma falha real de borda: token que expirava enquanto a confirmação aguardava bloqueio da conta era aceito com o horário antigo do início do pedido. O teste segura a linha no PostgreSQL, observa a espera em `pg_stat_activity`, avança o relógio até a expiração e libera o bloqueio: antes devolvia 200, depois passou a devolver 410. O serviço agora lê o relógio novamente após o bloqueio e ao emitir/reemitir tokens. Esse teste é o nono HTTP; o relógio de teste é volatile para a observação entre threads. A API e os cenários de navegador foram repetidos na revisão corrigida.

Revisados contratos, transações e bloqueios, ordem de conta/token em confirmação/reenvio, enumeração por conteúdo, hashes, payloads de privilégio, auditoria e falhas de banco. Handler de contas tem prioridade explícita para preservar seu erro 503 e evitar o logger SQL do endpoint de consulta. V1 permaneceu intacta; V2 é nova e não foi reescrita depois de aplicada. Nenhuma dependência nova: PBKDF2/SecureRandom/HttpServer nativos do JDK. Interface separada no bootstrap; `app.ts` e `app.html` estão byte a byte iguais ao início desta tarefa, incluindo trabalho preexistente do 07.

Limites: caixa em memória não é transporte durável; crash após commit e antes da entrega pode exigir reenvio. Banco indisponível pode impedir também evento persistido; 503 não finge auditoria entregue e não foi criada fila. A página usa porta 4201 e o link padrão da caixa 8025; o ensaio HTTP usa porta efêmera própria. Sem publicação, contas reais, segurança operacional, sessão/MFA, administrador inicial ou recuperação/exclusão. QA móvel em viewport e inspeção visual, sem alegar aparelho físico/leitor de tela. Aviso de orçamento de bundle permanece.

## Checkpoint e próxima ação

Entrega identificada pelo commit de assunto `feat: add local account confirmation (ticket 13)`, baseado em `067f9c0`. Índice isolado para o 13; pré-existentes de 07, documentos, ODT e ferramentas/controlador preservados fora dele. PLAN e CHANGELOG recebem apenas trechos deste ticket no commit. Não houve controlador, subagentes, push, contratação ou envio real.

**Ticket 14:** dependência técnica 13 liberada; pode iniciar seu próprio contrato/implementação autorizada. Sessão/inatividade/revogação, segundo fator/recuperação e criação inicial de Administrador pertencem ao 14 e ainda precisam de definição, preservando a referência legada de uma hora e RF06/Gestor. Nada do 14/15 foi implementado aqui. O aceite do 13 é exclusivamente local/sintético; a política operacional definitiva continua pendente.

**Processos ao encerrar:** API Java, caixa efêmera e servidor Angular desta rodada encerrados. Contêiner sintético preexistente e dados foram preservados; socket Podman desta rodada disponível em `/tmp/vu-podman-ticket13.sock`. Para retomar contas, ativar explicitamente a API conforme README e iniciar Angular em loopback; não reutilizar os prazos curtos do ensaio como configuração operacional.
