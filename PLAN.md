# Plano de trabalho

Atualização: 16/10/2026. Único roadmap ativo; entregas anteriores no [diário de outubro](docs/history/work-log-2026-10.md).

## Estado e foco atual

**Ticket 16 — aceito localmente em 16/10:** contrato definido; V5 preserva V1–V4 e clippings; API/HTTP aplica projeção pública de nome/URL, ADMIN+MFA/CSRF, versões, conflito e auditoria sem credenciais. `api`: 2 unitários + 3 integrações PostGIS; `web`: lint, 2 unitários e build 653,67 kB (aviso +153,67 kB); Playwright 4/4 Chromium/Firefox, incluindo MFA, estados, teclado/foco, 390 px, persistência e histórico. Sem coleta/conexão a fontes. [Contrato](docs/architecture/source-management-local-v1.md) e [checkpoint](docs/history/ticket-16-progress-2026-10-15.md).

**Ticket 14 — aceito localmente em 15/10:** login/logout, sessão persistida, autorização no servidor, MFA por autenticador e bootstrap/reset administrativo offline entregues. Consulta do 12 agora exige sessão; contas pendentes e ADMIN parcial não recebem acesso protegido. API: 11 unitários + 23 integrações reais; web: lint, 58 unitários afetados e build; navegador: 12/12 Chromium/Firefox, com teclado/foco, móvel e falha/recuperação. Reinício completo da JVM preservou sessão/consulta; logout e reset MFA revogaram no servidor. [Contrato](docs/architecture/session-local-v1.md) e [critérios/comandos/checkpoint](docs/history/ticket-14-progress-2026-10-15.md).

**Continuidade:** dependências técnicas diretas do Luna liberadas: **16, 19, 25, 26, 28, 29, 32 e 33**, respeitando parâmetros e outras dependências. O **17** agora está tecnicamente desbloqueado por 16 e pode ser iniciado em etapa separada; não foi iniciado aqui. O **15** também pode começar. Ticket 07 preservado e sem novo aceite. Sem prontidão operacional, publicação, coleta real ou resolução de RF06.

## Registros anteriores ao ticket 14

**Ticket 13 — aceito localmente em 15/10:** cadastro e confirmação/reenvio sintéticos sobre a API/banco do `067f9c0`, migração V2 e caixa local em memória. Nome/e-mail/senha, papel USER imposto no servidor, PBKDF2 com salt e tokens aleatórios armazenados só como hash; expiração, uso único concorrente, substituição no reenvio, limites persistentes e auditoria sem credenciais comprovados. Configurações reversíveis de desenvolvimento documentadas, sem aprovar política operacional. `api` selecionado: 2 unitários + 9 HTTP/PostGIS; `web` selecionado: lint, 3 unitários e build 616,35 kB (aviso +116,35 kB); navegador 8/8 Chromium/Firefox, incluindo teclado/foco, estados e 390 px. Reinício real preservou contas/credenciais derivadas/estados/limites; token usado segue 409. [Contrato](docs/architecture/accounts-local-v1.md) e [evidências/checkpoint](docs/history/ticket-13-progress-2026-10-15.md). Sem sessão/MFA do 14 ou recuperação/exclusão do 15.

**Ticket 12 — aceito localmente em 15/10:** fundação do Luna preservada e completada. Consulta explícita em `http://127.0.0.1:4201/?consulta=api` → Java → PostgreSQL/PostGIS real, somente publicadas, relações/referências sem duplicação, precisão e filtros no servidor; erro 400/503 distinto de vazio. Divergência temporal corrigida no oráculo: `05:00–10:00 -03` inclui 09:00Z; `08:00–10:00 -03` o exclui e agora também tem asserção. `api`: 8 unitários + 2 migrações + 5 HTTP; `web`: lint, 88 unitários e build 606,17 kB (aviso +106,17 kB); Playwright real 6/6 Chromium/Firefox, regressão afetada 26/26. Reinício do processo Java preservou payload/IDs/relações; SQL real confirmou 1000 m incluído e 999 m excluído. [Critérios, comandos, revisão e checkpoint](docs/history/ticket-12-progress-2026-10-15.md#conclusão-local-após-retomada--15102026). Sem aceite operacional, autenticação, dados reais ou publicação.

Frontend Angular demonstrativo, leitura persistida, cadastro/confirmação e sessão/MFA locais pelo Java/PostgreSQL/PostGIS implementados; recuperação/exclusão e coleta automática ainda não implementadas. A [spec interna v1.1](docs/product/specification.md) consolida Q1–Q88 e orienta o comportamento desejado. Catálogo, modos, situações, acesso e cobertura desejada já estão aprovados; não reabrir essas decisões como pendências da entrevista Q1–Q14 anterior.

**Reconciliação documental em 15/10:** branch local `integration/functional-spec-v1`, base `897fae5`. O inventário histórico identifica Ticket 11 em `2c34dd9` (fontes/explicação pública) e Ticket 36 em `84bfa04` (documentos institucionais); `47cba99` não existe no repositório local. Os resultados registrados para tickets 06, 07, 10 e 36 permanecem evidências históricas de implementação/testes, não aceite integral: revisão estática encontrou critérios sem evidência rastreável suficiente em 06/07/10 e inconsistência de canal de correção no documento do 36. Ticket 09 é camada demonstrativa; versionamento persistido pertence ao Ticket 26. Ticket 12 exige API Java e PostgreSQL/PostGIS reais, migrações e validação no servidor. Detalhes e limites em [revisão de continuidade](docs/history/spec-implementation-2026-10-15.md#reconciliação-documental-de-continuidade--15102026). Não houve teste da aplicação nesta revisão. As orientações aprovadas sobre contas, avaliação sintética e G1 placeholder permanecem; publicação, custos e coleta real não autorizados.

**Ticket 36 — revisão do conteúdo em 15/10:** os quatro documentos locais permanecem rascunhos v1.2. Termos e metodologia identificam dados/geometrias sintéticos; privacidade limita afirmações ao protótipo e não define tratamento operacional; correções informa claramente que não recebe pedidos nem oferece formulário, fila, protocolo ou acompanhamento. Web: lint, 82 unitários e build 598,33 kB passaram (aviso de 98,33 kB acima do orçamento de 500 kB); `planning` validou 186 links. E2E direcionado em Chromium/Firefox: 2/2 passaram, incluindo teclado/foco e 390 px. Estados de carregamento/erro/vazio não se aplicam a estas páginas estáticas. Critérios de conteúdo/transparência atendidos localmente; envio/acompanhamento do critério 3 continua pendente do canal do Ticket 27. Primeiro E2E revelou apenas capitalização incorreta na asserção; corrigida e repetição passou. Detalhes no [histórico](docs/history/spec-implementation-2026-10-15.md#ticket-36--revisão-de-documentos-15-10-2026).

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

**Próxima ação:** ticket 14 encerrado no recorte local sintético; iniciar somente o próximo ticket explicitamente autorizado. 15 tecnicamente liberado, assim como os tickets do Luna listados no checkpoint acima. Cada módulo futuro deverá verificar sua própria ação/permissão no servidor e demonstrá-la; parâmetros operacionais pendentes continuam pendentes. A retomada do 07 precisa preparar sessão sintética antes do mapa e resolver sua falha anterior, sem novo aceite nesta entrega. [Checkpoint do 14](docs/history/ticket-14-progress-2026-10-15.md).
