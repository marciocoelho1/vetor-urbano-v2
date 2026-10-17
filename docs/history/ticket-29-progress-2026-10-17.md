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

`bash scripts/verify.sh web` passou: lint/Prettier, 98 testes unitários em 11 arquivos e build. O build avisou que o bundle inicial (664,67 kB) excede o orçamento de 500 kB em 164,67 kB.

`JAVA_HOME=/tmp/vu-jdk-21 PATH=/tmp/vu-jdk-21/bin:$PATH DOCKER_HOST=unix:///tmp/vu-podman.sock bash scripts/verify.sh api` passou: 14 testes unitários e 27 integrações HTTP contra PostgreSQL/PostGIS real via Testcontainers. Cobriu também as suítes de contas, sessões e fontes; no recorte deste ticket, sessão obrigatória, consulta autorizada, auditoria minimizada persistida e atualização explícita após inserção sintética, inclusive reinício da aplicação.

`VETOR_PERSISTED_E2E=1 VETOR_E2E_DATABASE_CONTAINER=vu-ticket29-e2e-db npm run test:e2e -- --project=chromium --project=firefox --workers=1 e2e/persisted-query.spec.ts` passou separadamente: 14/14 jornadas (7 por navegador), com API Java e PostGIS real local, dados sintéticos persistidos, estados de carregamento/erro/vazio, teclado/foco, alternativa em lista e viewport móvel. A suíte inclui a seleção vazia de pilares e a descrição coerente do resultado vazio.

O `bash scripts/verify.sh api` completo passou após corrigir o fixture de reset para incluir também as tabelas referenciadoras `source_audit_events`, `source_versions` e `source_access_configurations`; a suíte inteira obteve 14/14 testes unitários e 27/27 integrações. A correção de fixture não altera comportamento de produção. Evidência usa exclusivamente dados sintéticos; não prova operação, coleta real ou prontidão operacional.

`bash scripts/verify.sh planning` passou (335 links locais); `git diff --check` passou. Revisão Standards + Spec contra o baseline fixo `2e439143d1ba845e99f0f1f884d5f636cd2c8b2f` não encontrou desvios de escopo ou violações de padrão na entrega. As notas de baixo risco sobre a representação tri-state das categorias e inventários paralelos de filtros foram mantidas como observações, sem ampliação deste ticket. Divergências antigas de evidência foram corrigidas e os modos pertinentes executados novamente.

Commits funcionais deste checkpoint: `39b919e` (fluxo), `1055ab0` (filtro NONE, auditoria e fixture), `8ec904b` (descrição correta do resultado vazio). O checkpoint documental registra os resultados finais.

**Estado do checkpoint:** critérios locais do ticket 29 concluídos e validados nos limites acima. Não declarar prontidão operacional.

## Próxima ação

Checkpoint 29 encerrado em 17/10 após revisão Standards + Spec e novas execuções. Próximo: ticket local 28, com 25 itens por página, intervalos pela extremidade final conhecida exclusiva, datas pontuais pelo instante, desempate por ID decrescente e snapshot estável até atualização explícita.
