# Checkpoint local — ticket 29 (2026-10-17)

## Escopo e rastreabilidade

Trabalho local no ticket 29, “Gerar relatório com recorte independente”. Os critérios antigos continuam identificados por `D08`, `CA14` e `RF02`; o incremento cobre somente filtros independentes, transferência explícita do mapa, decisão Substituir/Manter, instante de geração e atualização explícita. Dependências 06 e 14 constam como atendidas localmente na alocação; isso não equivale a prontidão operacional.

`E04` classifica consulta/geração como uso. `E08` substitui, para eventos novos, os campos espaciais/textuais detalhados por indicadores; eventos históricos não são reescritos. `E16` continua regendo retenção/expurgo, que este ticket não implementa. Não foi adicionada retenção de relatórios nem requisito pendente foi tratado como aprovado.

## Implementação deste checkpoint

- A ação Gerar copia filtros e território já aplicados; câmera não é consultada. Um recorte diferente oferece Substituir ou Manter. O relatório gerado conserva seu recorte e resultados até nova geração/Atualizar.
- O resultado exibe instante de referência, totais, filtros, lista de ocorrências e precisão temporal, inclusive registros só territoriais. Estados inicial, carregamento, erro e vazio são distintos.
- O caminho persistido chama `GET /api/v1/reports/occurrences`, exige sessão completa via fronteira HTTP existente, consulta PostgreSQL/PostGIS na leitura repetível já usada pela consulta e não persiste fotografia de relatório. A auditoria registra `REPORT_GENERATION` conforme E04 e minimiza texto/geométrica conforme E08.
- O modo sem API permanece explicitamente fictício e em memória; não comprova persistência, autorização ou operação.

## Evidência disponível e limite

`bash scripts/verify.sh web` passou: lint/Prettier, 97 testes unitários e build. O build avisou que o bundle inicial (664,74 kB) excede o orçamento de 500 kB em 164,74 kB.

`JAVA_HOME=/tmp/vu-jdk-21 PATH=/tmp/vu-jdk-21/bin:$PATH DOCKER_HOST=unix:///tmp/vu-podman.sock VETOR_API_INTEGRATION_TESTS=OccurrenceQueryHttpIT bash scripts/verify.sh api` passou: 13 testes unitários e 7 integrações HTTP contra PostgreSQL/PostGIS real via Testcontainers. Cobriu sessão obrigatória, consulta autorizada, auditoria minimizada persistida e atualização explícita após inserção sintética, inclusive reinício da aplicação.

`VETOR_PERSISTED_E2E=1 VETOR_E2E_DATABASE_CONTAINER=vu-ticket29-e2e-db npm run test:e2e -- --project=chromium --project=firefox --workers=1 e2e/persisted-query.spec.ts` passou separadamente: 12/12 jornadas (6 por navegador), com API Java e PostGIS real local, dados sintéticos persistidos, estados de carregamento/erro/vazio, teclado/foco, alternativa em lista e viewport móvel.

`bash scripts/verify.sh api` completo permanece bloqueado por 15 erros em testes preexistentes de contas/sessões: os resets truncam `local_accounts` sem incluir a tabela referenciadora `source_access_configurations`. O relatório confirma 7/7 integrações `OccurrenceQueryHttpIT` aprovadas; os 13 testes unitários também passaram. Isso não foi corrigido neste ticket. Evidência usa exclusivamente dados sintéticos; não prova operação, coleta real ou prontidão operacional.

**Estado do checkpoint:** critérios locais do ticket 29 concluídos e validados nos limites acima; a falha da suíte API completa permanece uma limitação alheia ao escopo. Não declarar prontidão operacional.

## Próxima ação

Fechar revisão Standards + Spec do ticket 29 contra o baseline Git `2e439143d1ba845e99f0f1f884d5f636cd2c8b2f`, comitar somente seus hunks verificados e então iniciar o ticket local 28 com a ordenação/paginação aprovada em 17/10.
