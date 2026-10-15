# API Java — Ticket 12

Esta fatia implementa uma API local de leitura para ocorrências sintéticas. Ela usa Java 21, Spring Boot 4, PostgreSQL 17/PostGIS 3.5 e Flyway. O serviço se vincula a `127.0.0.1:8080` por padrão e oferece apenas `GET /api/v1/occurrences`; não recebe ocorrências, não coleta fontes, não autentica e não autoriza operações reais.

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
