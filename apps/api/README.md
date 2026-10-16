# API Java — desenvolvimento local

A API usa Java 21, Spring Boot 4, PostgreSQL 17/PostGIS 3.5 e Flyway. Vincula-se a `127.0.0.1:8080` e oferece a leitura de ocorrências sintéticas do Ticket 12. O cadastro/confirmação do Ticket 13 exige ativação local explícita, descrita abaixo. Não recebe ocorrências, não coleta fontes e não implementa sessão ou autorização operacional.

O banco configurado em `VETOR_DATABASE_URL` deve ser exclusivo para desenvolvimento local. Na inicialização, Flyway aplica as migrações de `src/main/resources/db/migration`, que criam o modelo e carregam registros inteiramente sintéticos. Não use uma base operacional.

Com Java/JDK 21, PostgreSQL/PostGIS de desenvolvimento acessível e as variáveis locais configuradas, inicie a API com:

```bash
cd apps/api
export VETOR_DATABASE_URL='jdbc:postgresql://127.0.0.1:55432/vetor_urbano'
export VETOR_DATABASE_USERNAME='postgres'
export VETOR_DATABASE_PASSWORD=''
./mvnw spring-boot:run
```

As variáveis podem apontar para outro banco local sintético; senhas reais não devem ser salvas neste repositório. Para executar testes unitários e de integração com PostgreSQL/PostGIS real em contêiner, use `bash scripts/verify.sh api` a partir da raiz, com Docker ou Podman e JDK instalado.

O contrato do endpoint e dos erros está em [api-query-v1.md](../../docs/architecture/api-query-v1.md). Para conectar o navegador, inicie o frontend em loopback na porta 4201 e abra `http://127.0.0.1:4201/?consulta=api`. Sem esse parâmetro, permanece a demonstração anterior. A integração local usa somente dados sintéticos, sem fallback silencioso para fixtures. Acompanhe as evidências no [checkpoint](../../docs/history/ticket-12-progress-2026-10-15.md).


Teste de navegador com o banco sintético local já iniciado (não usa mock de ocorrências):

```bash
cd apps/web
VETOR_PERSISTED_E2E=1 VETOR_E2E_DATABASE_CONTAINER=vetor-api-ticket12-db \
  npx playwright test e2e/persisted-query.spec.ts --workers=1
```

O teste exige a API configurada para esse mesmo contêiner, quatro publicadas da migração V1 e Podman. Ele pausa/despausa o banco sintético para verificar 503; não execute contra bancos reais ou compartilhados. Sem a variável de ativação, a suíte é pulada explicitamente e não comprova integração. Os testes HTTP/Maven criam seu próprio PostGIS via Testcontainers, conferem 999/1000 m e reiniciam a aplicação conservando o banco.

## Cadastro e confirmação sintéticos — Ticket 13

Reutiliza a mesma API e banco. Contas ficam desabilitadas por padrão; para ativar somente em loopback:

```bash
./mvnw spring-boot:run -Dspring-boot.run.arguments='--vetor.accounts.enabled=true'
```

Com o Angular na porta 4201, abra `http://127.0.0.1:4201/?conta=local`. A caixa do operador fica em `http://127.0.0.1:8025/`: não envia e-mail real e aceita somente endereços `.test`. Use o link da mensagem ou cole o token no formulário; a confirmação exige POST explícito. Mensagens ficam somente em memória e desaparecem no restart; contas, hashes, uso/revogação dos tokens e limites persistem no banco. O operador pode solicitar novo envio respeitando os limites existentes.

O [contrato local de contas](../../docs/architecture/accounts-local-v1.md) registra endpoints, credenciais protegidas, estados, repetição, expiração e todas as configurações reversíveis de desenvolvimento. Ele não aprova política operacional. Sem login, sessão, MFA, recuperação ou exclusão.

Para os cenários rápidos de navegador deste ticket, inicie a API com:

```bash
./mvnw spring-boot:run -Dspring-boot.run.arguments='--vetor.accounts.enabled=true --vetor.accounts.token-ttl=5s --vetor.accounts.resend-cooldown=1s --vetor.accounts.resends-per-hour=2'
```

Com a API apontando ao contêiner sintético `vetor-api-ticket12-db`, rode em `apps/web`:

```bash
VETOR_ACCOUNTS_E2E=1 VETOR_E2E_DATABASE_CONTAINER=vetor-api-ticket12-db \
  npx playwright test e2e/account-registration.spec.ts --workers=1
```

O ensaio pausa/despausa apenas esse banco sintético para demonstrar indisponibilidade. Traces e screenshots automáticos ficam desativados para não guardar credenciais; capturas explícitas mascaram campos sensíveis. O teste usa mensagens locais reais e dados únicos `.test`, sem mock de operações de contas. Na raiz, o executor pode selecionar apenas as suítes novas sem repetir o 12:

```bash
VETOR_API_UNIT_TESTS=AccountPasswordTest \
VETOR_API_INTEGRATION_TESTS=AccountRegistrationHttpIT bash scripts/verify.sh api
VETOR_WEB_UNIT_TESTS='src/app/accounts/*.spec.ts' bash scripts/verify.sh web
```

Informe JDK e Docker/Podman conforme o ambiente. Sem seleção, o executor mantém o comportamento de executar todas as suítes. Resultados e limitações estão no [histórico do 13](../../docs/history/ticket-13-progress-2026-10-15.md).
