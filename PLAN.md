# Plano de trabalho

Atualização: 15/10/2026. Único roadmap ativo; entregas anteriores no [diário de outubro](docs/history/work-log-2026-10.md).

## Estado e foco atual

Frontend Angular demonstrativo existente; API Java, PostgreSQL/PostGIS, contas e coleta automática não implementados. A [spec interna v1.1](docs/product/specification.md) consolida Q1–Q88 e orienta o comportamento desejado. Catálogo, modos, situações, acesso e cobertura desejada já estão aprovados; não reabrir essas decisões como pendências da entrevista Q1–Q14 anterior.

**Reconciliação documental em 15/10:** branch local `integration/functional-spec-v1`, base `897fae5`. O inventário histórico identifica Ticket 11 em `2c34dd9` (fontes/explicação pública) e Ticket 36 em `84bfa04` (documentos institucionais); `47cba99` não existe no repositório local. Os resultados registrados para tickets 06, 07, 10 e 36 permanecem evidências históricas de implementação/testes, não aceite integral: revisão estática encontrou critérios sem evidência rastreável suficiente em 06/07/10 e inconsistência de canal de correção no documento do 36. Ticket 09 é camada demonstrativa; versionamento persistido pertence ao Ticket 26. Ticket 12 exige API Java e PostgreSQL/PostGIS reais, migrações e validação no servidor. Detalhes e limites em [revisão de continuidade](docs/history/spec-implementation-2026-10-15.md#reconciliação-documental-de-continuidade--15102026). Não houve teste da aplicação nesta revisão. As orientações aprovadas sobre contas, avaliação sintética e G1 placeholder permanecem; publicação, custos e coleta real não autorizados.

Divisões 01–11 e 12–36 autorizadas para implementação; parâmetros pendentes continuam delimitados. Validação principal pelo navegador permanece aprovada, com TDD e HTTP/PostGIS real para backend. A atualização do estado será feita somente com evidências de cada entrega.

Primeiro lote consolidado 01–11: catálogo/consulta inicial → relações e filtros → precisão temporal/espacial → dois modos, mapa/lista, Informes manuais, Áreas de Risco, estados/atualização e páginas explicativas, com dados fictícios explícitos. Essa demonstração não comprova scraping, autenticação, moderação ou cobertura operacional.

## Ordem proposta após revisão

- [x] Consolidar divisão 01–11, com critérios, dependências e demonstração por tarefa; avaliar viabilidade de revisão dos próximos 25.
- [x] Criar branch de integração e iniciar execução autorizada do grafo; ticket 01 em andamento, sem aceite declarado.
- [x] Revisar todos os 25 tickets restantes (12–36): critérios/demonstrações, escopo, dependências e propostas de parâmetros registrados.
- [ ] Concluir consulta demonstrativa coerente com critérios por ticket e navegador Chromium/Firefox.
- [ ] Integrar leitura persistida, contas/autorização e revisão/versões com HTTP e PostGIS real.
- [ ] Integrar fontes/coleta recente e retroativa autorizadas, calibragem/avaliação e acompanhamento operacional.
- [ ] Integrar Histórico, Relatórios, síntese/comparações, calor, arquivos e solicitações; análises podem usar dados sintéticos persistidos antes da coleta real.
- [ ] Validar cobertura/cartografia, desempenho, privacidade, recuperação e candidato integrado antes de operação.

Esses agrupamentos reconciliam os marcos antigos F0/R0–R7, preservados no [plano anterior](.scratch/consulta-coerente/context-before/PLAN.md); não são renumeração de requisitos ou percentuais de conclusão. Scraping real continua objetivo posterior da demonstração ampliada, sem autorizar conectores/custos agora.

## Pendências delimitadas

Parâmetros de nota/rubrica/amostra, vigência por tipo, correspondência de publicações, limites oficiais/interseção espacial, conta/sessão/MFA/desvinculação, fontes/autorização/custo/extração, composição de relatórios/arquivos e retenção/textos definitivos. Bloqueiam somente incrementos correspondentes. RF06 e relações dos perfis legados permanecem em reconciliação; RF/RNF originais preservados.

Relatos populacionais, resumo por IA, reprodução temporal avançada, planos, alertas, votos e escala são futuros. Landing page tem definição adiada. Refinamento mobile continua adiado, com apresentação/acessibilidade conferidas nos fluxos alterados e sem declarar QA físico aprovado.

## Evidências e limitações

Reconciliação, inventário do código, dependências e rastreabilidade estão no [registro de 15/10](docs/history/spec-to-tickets-2026-10-15.md). Versões anteriores dos documentos e alterações não commitadas foram preservadas em cópias integrais. Spec mantida byte a byte. `bash scripts/verify.sh planning` e `git diff --check` passaram; auditoria local confirmou 36 tickets, dependências sem ciclos, cobertura documental CA01–CA25 e integridade da spec/cópias. Na consolidação subsequente, planning (180 links) e diff-check passaram; auditoria confirmou 11 consolidados/25 propostas inalteradas, dependências preservadas e integridade da spec/cópias. Na revisão dos 25, planning (184 links), diff-check e auditoria passaram; 25 arquivos revisados, 11 consolidados intactos e índice/arestas coerentes sem ciclos. Testes da aplicação não reexecutados; não há aceite funcional novo.

Última manutenção, sem relação com os novos aceites: lint/59 unitários/build passaram; bundle 502,64 kB com aviso de 2,64 kB; E2E bloqueado no servidor (127). Execução geral anterior 89/98 com verificações direcionadas posteriores, sem aceite geral. [Evidência histórica](docs/history/repository-maintenance-2026-10-14.md).

Preservar: tema local no cadastro vetorial, cadastro em 320 px, leitor de tela/zoom/aparelho físico, limites/cobertura e cartografia para hospedagem. Nenhuma falha histórica foi declarada reproduzida agora.

**Próxima ação:** com o Ticket 06 implementado e verificado integralmente com evidências reais no navegador (Chromium/Firefox) e 82 testes unitários, prosseguir na revisão/fechamento das pendências apontadas para 07, 10 e 36 antes de avançar para novos lotes. Ticket 12 continua proposta de integração e exige API Java/PostgreSQL/PostGIS real, não apenas persistência no navegador. G1 permanece placeholder; coleta real não foi autorizada. [Estado local da execução](.scratch/consulta-coerente/implementation-state.json).
