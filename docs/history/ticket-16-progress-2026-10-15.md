# Ticket 16 — progresso em 15/10/2026

## Escopo e estado inicial

Somente Ticket 16, sobre as dependências localmente aceitas 12 (`067f9c0`), 13 (`f93ad96`) e 14 (`e9bb6e7`). Sem controlador, subagentes, troca de modelo, push, publicação, credenciais de fontes ou coleta real. Trabalho preexistente não relacionado permanece na árvore e fora do commit do ticket.

## Contrato antes das migrações

Registrado em [source-management-local-v1.md](../architecture/source-management-local-v1.md): projeção pública somente com nome/URL opcional; ID estável compatível com `clippings.source_id` e canal ficam internos. Também define campos administrativos, versões, autoria, referências de configuração, erros HTTP e segregação de permissões. Nota e justificativa ficam internas. Cada edição exige versão esperada. Auditoria guarda before/after e UUIDs de configuração, nunca credenciais. G1 permanece placeholder não avaliado com coleta desativada; não há conectores.

## Infraestrutura verificada

- O host tinha Java 25 sem `javac`; usei o JDK 21 da imagem Maven já local, copiado para `/tmp/vu16-jdk21`. Compilação Java 21 concluída.
- Podman local manteve `vetor-api-ticket12-db`, com PostGIS em `127.0.0.1:55432`. O contêiner só tinha o banco padrão `postgres`; foi criado `vetor_urbano` vazio para este teste sintético. A API aplicou V1–V5 e confirmou PostgreSQL 17.5/PostGIS.
- A sandbox bloqueava o socket Podman e loopback HTTP; com acesso local autorizado, o socket temporário de testes ficou em `/tmp/vu16-podman.sock`. Nenhuma imagem/dependência precisou ser baixada.

## Implementação

- Migração nova V5 mantém V1–V4: versões sintéticas iniciais, ID/base `sources` preservados, metadados descritivos de acesso e auditoria before/after. Sem armazenamento de credenciais.
- Java expõe projeção pública exata e endpoints administrativos com CSRF, ADMIN+MFA no filtro, conflito otimista por versão, históricos e resposta `no-store`. USER/visitante não alcançam DTOs internos. URLs com usuário/senha, query ou fragmento são rejeitadas. O preflight CORS do método PUT foi incluído para permitir edição pelo navegador local.
- Web integra gestão somente no modo local `?consulta=api`, inclui criação/edição/histórico e estados de carregamento/erro/vazio. A lista pública mantém G1 separado e mostra dados cadastrais sem avaliação/configuração. O modo demonstrativo preexistente continua no fluxo padrão.
- A jornada real no navegador criou fonte sem URL, editou para versão 2, conferiu histórico/ID e leu somente nome/URL na lista pública. O HTTP/PostGIS comprovou projeção exata sem ID/canal/nota, referências de clippings preservadas, auditoria before/after, negação a visitante/USER/ADMIN parcial, CSRF e persistência após reinício da API.

## Resultado final (16/10/2026) e checkpoint

- `JAVA_HOME=/tmp/vu16-jdk21 PATH=/tmp/vu16-jdk21/bin:$PATH DOCKER_HOST=unix:///tmp/vu16-podman.sock VETOR_API_UNIT_TESTS=SourceValidatorTest VETOR_API_INTEGRATION_TESTS=SourceManagementHttpIT,DatabaseMigrationIT bash scripts/verify.sh api`: passou, 2 testes unitários e 3 de integração em PostGIS, sem falhas. Inclui preflight PUT, lista admin vazia e 503 sanitizado.
- `VETOR_WEB_UNIT_TESTS='src/app/data/source-api.spec.ts' bash scripts/verify.sh web`: passou lint, 2 testes unitários e build. O bundle inicial ficou em 653,67 kB, 153,67 kB acima do limite configurado de 500 kB.
- `VETOR_SOURCE_E2E=1 VETOR_SOURCE_E2E_CREDENTIALS=/tmp/vu16-browser-creds.json npx playwright test e2e/source-management.spec.ts --project=chromium --project=firefox --workers=1`: 4/4 passaram. Cobertura inclui sessões/MFA, loading/erro/vazio público e administrativo, criação/edição/histórico real, negação HTTP, teclado/foco e viewport móvel de 390 px.
- `bash scripts/verify.sh planning`: 228 links locais e estrutura/documentos passaram; âncoras e URLs externas não são verificadas pelo script. `git diff --check`: passou. Não foram executadas as suítes inalteradas das dependências.

Critérios locais do Ticket 16 atendidos com dados sintéticos; G1 continua placeholder com coleta desativada. A base local permanece em desenvolvimento; nenhuma fonte foi conectada, coletada ou redistribuída. Próximo checkpoint: revisão/início isolado do Ticket 17, já tecnicamente desbloqueado por 16, sem implementação automática nesta execução.
