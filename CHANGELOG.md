# Histórico de mudanças

## Seleção local 30 → 31 — 17/10/2026

- Ticket 31: comparação explícita de snapshots A/B, distribuições, variação, duração e médias somente com precisão suficiente. Cobertura desconhecida e base zero identificadas. Verificado localmente com dados sintéticos, incluindo base zero, precisão temporal e duração curta.

- Ticket 30: síntese determinística do snapshot de Relatórios, com distribuições, certeza temporal e limites de cobertura/precisão. Verificado localmente com dados sintéticos e revisão Standards + Spec.

## 2026-10-17 — Ticket local 33: XLSX completo do recorte

- Adicionada exportação autenticada do recorte avançado completo, com as abas e colunas aprovadas, filtros/período/geração/totais/limitações e referências. Datas aproximadas, valores desconhecidos e coordenadas indisponíveis permanecem distintos de valores exatos/zero; textos são serializados como texto, sem fórmula executável.
- O servidor registra `REPORT_EXPORT` com projeção minimizada E08. Não há teto arbitrário de registros; abas dividem acima de 1.048.575 linhas de dados. Limites de célula/XML/ZIP32 ou de formato falham antes do download. Revisão Standards sem findings contra `1179973`; Spec registrada no [checkpoint](docs/history/ticket-33-progress-2026-10-17.md).
- Web: lint, 111 testes e build passaram (bundle inicial de 695,25 kB, aviso de +195,25 kB); API: 14 unitários + 29 integrações HTTP/PostgreSQL/PostGIS; Playwright separado 8/8 Chromium/Firefox; XLSX dos dois navegadores aberto no LibreOffice. `planning` e `git diff --check` passaram após a atualização do checkpoint. Revisões Standards + Spec sem findings contra `1179973`; asserções TDD reproduziram e corrigiram ambos os apontamentos Spec. Commits: `9bac3e4`, `6391a6c`. Uso sintético local não indica prontidão operacional.

## 2026-10-17 — Ticket local 28: Histórico avançado paginado

- Adicionada consulta autenticada do Histórico publicado com filtros combinados, precisão temporal/geográfica, relações e total global. Ordenação de datas exatas pelo instante; intervalos pelo limite final conhecido exclusivo; empate por ID decrescente; 25 registros por página e snapshot até atualização.
- A API consulta o recorte completo em transação `REPEATABLE_READ`; a interface divide o snapshot em páginas, diferencia carregamento/erro/vazio, preserva detalhes e referências, e mantém teclado/foco e layout móvel. IDs preservados: D05, D08, CA13 e RF02. Playback existente, exportação e cálculo de risco ficaram fora da fatia.
- Web: lint, 104 testes e build passaram; API: 14 unitários + 28 integrações com HTTP e PostgreSQL/PostGIS reais; Playwright separado: 2/2 Chromium/Firefox. Bundle inicial de 681,47 kB excedeu o orçamento de 500 kB em 181,47 kB. Revisões finais Standards + Spec contra `fdd9ba9` sem findings; fixes em `3eafb9b`. [Critérios, comandos e limites](docs/history/ticket-28-progress-2026-10-17.md). Evidências sintéticas não indicam prontidão operacional.

## 2026-10-17 — Ticket local 29: recorte de relatório independente

- Entregues geração explícita do relatório, preservação do recorte/resultados, escolha Substituir/Manter, atualização explícita e lista acessível, com endpoint autenticado e auditoria minimizada conforme E04/E08. Mantidos D08, CA14 e RF02; retenção E16 e propostas pendentes não foram alteradas.
- Web passou (98 testes e build, com aviso de orçamento de +164,67 kB); API completa passou (14 unitários + 27 HTTP/PostGIS); Playwright separado passou 14/14 em Chromium/Firefox; `planning` passou (335 links). Revisão Standards + Spec contra `2e439143` sem desvios. Commits: `39b919e`, `1055ab0`, `8ec904b`; [checkpoint e comandos](docs/history/ticket-29-progress-2026-10-17.md). Evidências são sintéticas e não indicam prontidão operacional.

## 2026-10-16 — Acessos de teste no README da branch de integração

- Incluídas as credenciais sintéticas de ADMIN e USER, condições do ambiente local e exigência de MFA administrativo.
- Envio limitado a `integration/functional-spec-v1`; trabalho local preexistente preservado e `main` intacta.

## 2026-10-16 — Ticket 16 aceito localmente em desenvolvimento

- Contrato define lista pública somente com nome e URL opcional; ID estável, canal, avaliação, cobertura, acesso, autoria e histórico ficam internos. V5 adiciona versões imutáveis e auditoria por snapshots/referências sem credenciais; Java protege escrita/leitura interna por ADMIN+MFA e CSRF.
- UI local ligada à API inclui criação/edição/histórico e placeholder G1 com coleta desativada. API selecionada: 2 unitários + 3 integrações PostgreSQL/PostGIS; web: lint, 2 unitários e build 653,67 kB (aviso de +153,67 kB); Playwright: 4/4 em Chromium/Firefox, com sessão/MFA, estados de carregamento/erro/vazio, teclado/foco e viewport 390 px. Projeção HTTP pública contém somente nome/URL; edição preserva identidade interna e histórico. Sem conectores/coleta. [Contrato](docs/architecture/source-management-local-v1.md) e [checkpoint](docs/history/ticket-16-progress-2026-10-15.md).

## 2026-10-15 — Ticket 14: sessão, autorização e MFA locais

- Login/logout com senha existente, sessão opaca persistida, expiração por inatividade/absoluta, revogação e CSRF no servidor. Contas pendentes, visitantes e ADMIN sem segundo fator não acessam consulta protegida; Usuário usa ambos os modos. V1/V2 preservadas, migrações V3/V4.
- TOTP por aplicativo, segredo cifrado, replay concorrente impedido e limites persistentes; bootstrap/reset MFA administrativo offline restrito. Nenhum cadastro público de ADMIN, fluxo do 15 ou painel futuro.
- Verificação local real: API 11 unitários + 23 integrações, web lint + 58 unitários afetados + build (627,27 kB, aviso +127,27 kB), Playwright 12/12 Chromium/Firefox incluindo móvel/MFA/teclado/foco/503. Sessão e consulta preservadas após reinício completo da JVM; logout/reset revogaram. [Contrato](docs/architecture/session-local-v1.md) e [histórico](docs/history/ticket-14-progress-2026-10-15.md).
- Aceite somente sintético local; RF06 e política operacional pendentes. 15 e dependências diretas 16/19/25/26/28/29/32/33 tecnicamente liberados. Trabalho anterior e pendência do 07 preservados; sem push/publicação/coleta real.

## 2026-10-15 — Ticket 13: cadastro e confirmação locais

- Cadastro sintético com nome, e-mail `.test` e senha derivada com salt; USER imposto pelo servidor. Migração V2 preserva V1 e persiste contas, hashes de tokens e eventos sem credenciais. Caixa local em memória, sem envio externo.
- Confirmação explícita de uso único, estados inválido/expirado/usado/substituído, reenvio com revogação do anterior somente quando efetivo, limites configuráveis persistentes e respostas sem enumeração por conteúdo. Sem sessão/MFA ou recuperação/exclusão.
- Configurações de desenvolvimento separadas da política operacional em [contrato](docs/architecture/accounts-local-v1.md). Verificação selecionada: API 2 unitários + 9 HTTP/PostGIS; web lint + 3 unitários + build 616,35 kB (aviso +116,35 kB); navegador real 8/8 Chromium/Firefox, teclado/foco/móvel e indisponibilidade. Reinício real verificado. [Histórico](docs/history/ticket-13-progress-2026-10-15.md).
- Dependência técnica do 14 liberada. Trabalho preexistente e ticket 07 preservados, sem ampliar escopo ou publicar.

## 2026-10-15 — Ticket 12 concluído em desenvolvimento local

- Completada a fundação Java/Flyway/PostGIS do Luna com navegador local explícito (`?consulta=api`), filtros no servidor, relações públicas fora do recorte, referências sem duplicação, precisão preservada e estados de carregamento/vazio/erro com retry. Leitura somente de publicadas; sem fallback para fixtures.
- Corrigida a expectativa temporal por conversão de fuso, preservando início incluído/fim excluído; ambas as janelas têm asserções. Borda geodésica real (1000/999 m), 400/503 e persistência após reinício comprovados. Falhas ao abrir transação também retornam 503; relacionados mantêm inclusão temporal correta.
- Verificações: API 8 unitários + 2 migrações + 5 HTTP; web lint + 88 unitários + build 606,17 kB (aviso +106,17 kB); Playwright da integração 6/6 Chromium/Firefox e regressão afetada 26/26. Planejamento e revisão do diff registrados no [histórico do 12](docs/history/ticket-12-progress-2026-10-15.md#conclusão-local-após-retomada--15102026).
- Aceite restrito a leitura local com dados sintéticos. Dependência técnica do 13 liberada; parâmetros de cadastro/confirmação continuam a fechar no próprio incremento. Ticket 07 e trabalho preexistente preservados, sem novo aceite.

## 2026-10-15 — Ticket 36: transparência dos documentos institucionais

- Atualizados os quatro rascunhos para v1.2. Termos, privacidade e metodologia distinguem dados sintéticos, cobertura desejada e operação real; não afirmam coleta, cobertura ou tratamento operacional inexistentes.
- Procedimento de correções agora informa que a demonstração não recebe pedidos nem dispõe de formulário, fila, protocolo ou acompanhamento. Não foi criada fila; envio/acompanhamento permanece pendente do Ticket 27.
- `bash scripts/verify.sh web`: lint, 82 testes unitários e build passaram; bundle 598,33 kB, acima do orçamento em 98,33 kB. `bash scripts/verify.sh planning`: 186 links locais passaram. Playwright direcionado: 2/2 em Chromium/Firefox, incluindo teclado/foco e 390 px. Primeiro E2E falhou apenas por caixa da asserção; após ajuste, passou. `git diff --check` passou.

## 2026-10-15 — Ticket 06: dois modos de consulta e preservação de escolhas explícitas

- Alternância entre Modo simples e Análise e Inteligência no topo com `data-mode-toggle` e aviso observável (`role="status"`).
- Modo avançado acrescenta filtros completos: subtipos de ocorrência com opção "Não informado", busca textual normalizada (título, descrição, endereço) com botão de limpeza, seleção de fontes de dados, faixa de nota fictícia (1 a 5) com erro observável ("A nota mínima não pode ser superior à nota máxima.") e situação (`ONGOING`, `CLOSED`, `UNKNOWN`), além de período personalizado.
- Modo simples suspende filtros avançados com aviso, preservando pilares, tipos, município/bairro, períodos recentes e Áreas de Risco.
- Ao retornar para Análise e Inteligência, mantém escolhas explícitas feitas em filtros comuns no modo simples (jornada `personalizado → simples → semana → 24h → avançado`), sem restaurar indevidamente períodos personalizados antigos. Reaplica subtipos e filtros compatíveis e descarta incompatíveis com aviso explicativo.
- Verificação: `bash scripts/verify.sh web` (lint 0 erros, 82 testes unitários em Vitest, build 597,98 kB), 10 testes Playwright direcionados em Chromium e Firefox (`two-modes.spec.ts`, 14.4s) cobrindo teclado/foco e viewport móvel de 390 px, `git diff --check` sem erros e `bash scripts/verify.sh planning` com 185 links validados.

## 2026-10-15 — Ticket 11: fontes e explicação pública

- Páginas de fontes e confiabilidade com retorno/foco; G1 somente placeholder não avaliado/off e exemplos sintéticos separados, preservando importação e atribuições.
- `2c34dd9` integrado; lint,66 unitários,build525,77kB(aviso25,77kB),22E2E Chromium/Firefox e diff-check passaram. Documentos institucionais locais iniciados no36.

## 2026-10-15 — Ticket 04: tempo e situação com precisão

- Datas exatas/dia/intervalo/mês sem hora inventada, inclusão certa/possível, distinção das datas editoriais e confirmação sintética expirada para Desconhecida com histórico.
- Commit `95fffc1` integrado. TDD,lint,66 unitários,build521,37kB(aviso21,37kB),16 E2E finais e22 workspace anteriores passaram. Corrigido overflow do novo resumo temporal; sem parâmetros operacionais de vigência presumidos.

## 2026-10-15 — Ticket 02: relações e detalhes compartilhados

- Três efeitos de um acontecimento, referências sem duplicação e painel de detalhes compartilhado entre consulta/Histórico/Informes, com contexto relacionado fora do recorte.
- Commits `f1cc078`/`45c6401` integrados; TDD,lint,61unitários,build515,13kB(aviso15,13kB),14E2E Chromium/Firefox e diff-check passaram. Conjunto75registros/17iniciais e coordenadas preservados.

## 2026-10-15 — Ticket 03: filtros combinados e resumo

- Filtros combinam alternativas por OU e critérios por E, sem duplicação ou cruzamento incoerente de classificações; resumo permite remover/limpar preservando câmera.
- Commit `10d316c` integrado. TDD, lint,61unitários,build508,88kB(aviso8,88kB),12E2E direcionados+2responsivos em Chromium/Firefox e diff-check passaram.

## 2026-10-15 — Ticket 01: catálogo e consulta inicial

- Catálogo D04 de 16 tipos/subtipos, consulta inicial com três pilares/24 horas, avisos de dados/fontes/notas fictícios e rejeição explícita de consultas legadas incompatíveis.
- Preservados 75 registros e 2 POIs; nova janela inicial contém 17 ocorrências (7 Trânsito, 5 Segurança, 5 Contingência). Commit local `5c99513` integrado.
- TDD e verificação: lint, 60 unitários, build 504,85 kB (aviso 4,85 kB), 18 E2E direcionados em Chromium/Firefox e diff-check passaram. Sem aceite da matriz E2E geral ou QA físico.

## 2026-10-15 — Início da implementação integrada

- Autorizada execução dos 36 tickets em branch local `integration/functional-spec-v1`, preservando documentação/trabalho anterior e publicação pendente. Ticket 01 iniciado por TDD em worktree isolado; nenhum aceite declarado antecipadamente.
- G1 Rio de Janeiro indicado pelo responsável como placeholder editável, sem ativação de coleta real. Investigação de Java/PostGIS em paralelo.

## 2026-10-15 — Revisão integral dos 25 tickets restantes

- Revisados os tickets 12–36, preservando os IDs, o total de 36 e o lote 01–11 consolidado. Acrescentados demonstração de conclusão, limite de cada fatia, critérios observáveis e ação preparatória.
- Ajustadas dependências em 13/14/17/20/22/24/27/33: reutilização de API, remoção de arestas redundantes e independência da exportação em relação ao Histórico paginado; pedidos de correção não exigem alteração imediata do registro.
- Preparadas propostas explícitas para 14 incrementos com parâmetros pendentes. Não adotados valores de fórmula, vigência, conta ou retenção por suposição. Revisão distingue 8 comportamentos delimitados e 3 dependentes de condições externas operacionais.
- Próximo passo recomendado: implementar 01 em etapa própria. Sem implementação, publicação, coleta real, contratação, commit ou push nesta revisão; verificações: `bash scripts/verify.sh planning` (184 links) e `git diff --check` passaram; auditoria confirmou revisão dos 25, integridade dos 11/spec e dependências/índice coerentes sem ciclos. Âncoras, URLs externas e testes da aplicação não executados.

## 2026-10-15 — Consolidação local das primeiras 11 tarefas

- Consolidado o lote 01–11 por autorização do responsável, com status `ready-for-agent`, critérios, demonstração de conclusão e limite de cada fatia; execução permanece pendente. Preservados IDs e dependências.
- Avaliada individualmente a viabilidade dos tickets 12–36: 7 com comportamento suficiente para detalhar, 15 que exigem propostas/parâmetros e 3 dependentes de material externo para integração real. O restante permanece `needs-triage`, sem alteração de seus arquivos.
- Plano/inventário atualizados; recomendada revisão seguinte de 12–19. Sem implementação, publicação, coleta, contratação, commit ou push. Spec e cópias anteriores preservadas.
- Verificação: `bash scripts/verify.sh planning` (180 links locais) e `git diff --check` passaram. Auditoria confirmou 11 consolidados/25 propostos, dependências preservadas sem ciclos e integridade da spec/cópias/restante. Âncoras/URLs externas e testes da aplicação não foram verificados nesta etapa documental.

## 2026-10-15 — Reconciliação da spec e tickets locais em revisão

- Reconciliados escopo, definição, inventário, glossário e plano com decisões da spec v1.1: catálogo, ocorrência/acontecimento, modos, situações, acesso e cobertura desejada, separando parâmetros pendentes e futuro.
- Preparados 36 rascunhos locais individuais com critérios/dependências e rastreabilidade dos 25 aceites da spec; primeiro lote proposto 01–11. Divisão aguarda revisão, sem implementação ou publicação.
- Preservados byte a byte spec e cinco documentos anteriores com trabalho não commitado; entrevista, ODT, requisitos e referências originais mantidos. RF/RNF e divergências legadas não foram renumerados nem declarados encerrados.
- Spec e tickets ignorados pelo Git nesta etapa local. Validação principal por navegador já aprovada; não reexecutada em tarefa apenas documental. Verificação: `bash scripts/verify.sh planning` e `git diff --check` passaram; auditoria local confirmou 36 tickets, dependências sem ciclos, cobertura documental CA01–CA25 e SHA-256 da spec/cópias. Links externos/âncoras não verificados.

## 2026-10-15 — Consolidação de Q10–Q14

- Registrados Informes Ativos com janela de 24 h/raio até 5 km, Histórico consultável, filtros independentes de Relatórios e transferência por ação no mapa.
- Fontes e fila reservadas ao Administrador, com página pública de fontes por link no rodapé. Relação com Operador/Gestor permanece pendente; IDs RF/RNF preservados.
- Brainstorm de reprodução temporal/Inteligência de Dados separado de decisões. Criado documento de definição com diferenças para o código e informações faltantes para avaliar o futuro documento de ideias.
- Sem novas perguntas obrigatórias nesta rodada ou mudanças na aplicação; Q9 continua adiada.
- Verificação: `bash scripts/verify.sh planning` e `git diff --check` passaram; 179 links locais conferidos, sem verificar âncoras/URLs externas ou reexecutar testes da aplicação.

## 2026-10-15 — Retomada da definição dos módulos

- Q9 adiada expressamente pelo responsável, sem bloquear a continuação da entrevista; catálogo final de filtros permanece aberto.
- Plano, escopo e checklist atualizados com a retomada e fluxo de referência baseado nas decisões Q1–Q8, separando detalhes ainda pendentes.
- Registradas propostas da rodada 3 sobre Informes Ativos, Histórico, Relatórios, Fontes e revisão humana. Nenhuma implementação ou escolha de fonte/modelo nesta etapa.

## 2026-10-15 — Conferência do ponto de recuperação

- Concluída a conferência do registro de Q1–Q9, acrescentando o texto das respostas iniciais e checklist de integridade da retomada. Q9 permanece aguardando o material de filtros.
- Índice documental aponta diretamente para o ponto de recuperação. Plano distingue o frontend local existente do aceite ampliado da demonstração, que ainda exige scraping e filtro temporal.
- Nenhuma nova decisão de produto ou alteração na aplicação. Verificação documental: `bash scripts/verify.sh planning` e `git diff --check`; resultados registrados no ponto de recuperação.

## 2026-10-14 — Checklist e entrevista de produto

- Criado inventário com checklists por funcionalidade, separando implementação demonstrativa, refinamentos e integração operacional pendente; RF/RNF preservados.
- Plano permanece como roadmap único, agora com checkmarks dos marcos e ligação para o inventário. Esclarecido que o formulário não cria, salva ou envia ocorrências.
- Registrada a primeira rodada de perguntas sobre objetivo, público prioritário e refinamentos percebidos; recomendações aguardam respostas, sem mudança de escopo aprovada.
- Após as respostas, confirmado objetivo de demonstração estável sem prazo, foco na definição das funcionalidades de consulta e refinamento mobile adiado. Registrada direção desejada de clippings retroativos/recentes e credibilidade de 1 a 5; fontes, IA e regras permanecem abertas. Relatos da população adiados.
- Criado registro incremental da entrevista e acrescentados clipping/relato da população ao glossário; segunda rodada proposta, sem implementação de coleta ou alteração do frontend.
- Registradas respostas Q4–Q9 e ponto de recuperação solicitado: scraping no aceite desejado, filtro temporal provisório, módulos preservados para revisão, consolidação por ocorrência, avaliações distintas, lista de fontes 1–5 e revisão humana inicial. Q9 aguarda material de filtros; entrevista pausada pelo responsável.
- Verificação: `bash scripts/verify.sh planning` e `git diff --check` passaram; testes da aplicação não reexecutados nesta tarefa documental.

## 2026-10-14 — Organização e documentação

- Código web agrupado por responsabilidade, estilos globais separados e galeria com entrada/tsconfig exclusivos.
- README apresenta o produto, os recursos disponíveis e a evolução prevista; guias atuais de arquitetura, contribuição e operação.
- Plano resumido, histórico preservado, `CHANGELOG.md` como registro de mudanças e SQL não aplicado fora da pasta de migrações.
- Removidos arquivos obsoletos de VS Code e uma captura duplicada. Dependências, regras, referências, licenças e materiais de marca preservados.
- Alterações anteriores de interface preservadas em commit separado antes da organização.
- Validação: lint, 59 testes unitários, builds principal/galeria e links locais passaram; E2E bloqueado na inicialização do servidor (127). Aviso de bundle e pendências anteriores registrados no plano.


## 2026-10-11 — Organização do monorepo e fluxo de desenvolvimento

- Aplicação Angular movida de `frontend/` para `apps/web/`; rascunho Java/SQL de `vetor-urbano-api/` para `apps/api/`. Pacote npm passa a `@vetor-urbano/web`, projeto Angular a `web`; dependências/versões mantidas.
- Executor único em `scripts/verify.sh`, com modos `web`/`api` e aliases `frontend`/`backend`; `harness.sh` preservado como wrapper. Caminhos de testes/build e verificações documentais atualizados.
- Extração em `tools/map-extraction/`; vídeo em `assets/brand/video/`; documentação agrupada em `docs/product`, `architecture`, `development`, `maps`, `brand`, `evidence`, `history`, `references` e `archive`. Referências e conteúdo crítico preservados.
- README/AGENTS/PLAN, links e ignores atualizados. Criados `CONTRIBUTING.md`, modelo de pull request e guia de estrutura/mapeamento dos caminhos. Fluxo: branch curta → verificações → pull request → revisão → merge em `main`.
- A ferramenta passa a usar `verification.json` e a escrever relatório em `extraction-report.md`, preservando o README estático; produtos locais continuam ignorados. Smoke isolado com HTML já disponível passou, sem rede.
- Verificações nos novos caminhos: lint, **56 testes unitários**, build 449,26 kB sem avisos e **44 E2E/zero ignorados** em Firefox/Chromium passaram. Wrapper/aliases funcionam fora da raiz; links e ignores conferidos. Evidências desta organização em `docs/evidence/repository-layout-2026-10-11.json`. API continua não implementada; fontes finais do vídeo continuam ausentes. Nenhuma funcionalidade, provedor ou contrato de produto alterado.

## 2026-10-11 — Consolidação de main/master e documentação

- Unificada a aplicação mais recente em `apps/web/`, incluindo as melhorias locais de paleta Bright, pins, raio de 25 km, fixtures e recuperação 2D. Merge publicado em `main` preserva os históricos; `vetor-urbano-web/` substituído. `master` remota/local excluídas após conferência dos ancestrais e da sincronização.
- Preservados requisitos, pipeline, histórico e rascunho SQL exclusivos da antiga `main`; documentos sinalizados como legado para reconciliar em R0, sem renumerar IDs ou habilitar escrita pública.
- Atualizados README principal/frontend, PLAN, arquitetura, escopo e histórico. O wrapper `scripts/verify.sh` usa o executor atual `scripts/verify.sh`. Proteções de `.gitignore` consolidadas; caches/worktrees/downloads brutos locais excluídos.
- Preservados script/evidências de extração e MP4 de marca. Corrigida a documentação: os fontes finais editáveis do vídeo estão ausentes; o template disponível não reproduz o filme.
- Verificação da árvore consolidada: lint, 56 testes e build 449,26 kB passaram; `npm ci` reportou zero vulnerabilidades. 44 E2E passaram/zero ignorados em Firefox/Chromium. Referências, código atual, SQL histórico e MP4 conferidos; evidências/publicação no [relatório](docs/history/branch-consolidation-2026-10.md). Backend permanece bloqueado; nenhum teste de banco/API executado.


## 2026-10-11 — Referência de fluidez, paleta clara e pins por categoria

- Referência inspecionada: Leaflet 1.9.4/CARTO Voyager. MapLibre/Leaflet mantidos; base Bright vetorial local com água azul, áreas verdes, vias claras e 32 camadas. Fallback Bright raster semelhante, sem declarar igualdade de paleta.
- Pins verde/carro, vermelho/pistola e amarelo/exclamação, borda preta/círculo branco; SVG/sprites locais com ícones Material Design Icons Apache 2.0. Popups vetoriais identificam registro por propriedade explícita.
- GPU por software identificada passa diretamente ao Leaflet, conforme comparação de arraste com a referência. Leaflet reaproveita pins/círculo entre mudanças do raio; estilo vetorial é carregado uma vez por sessão. Raio inicial 1 km, passos de 100 m e teto de 25 km.
- Segurança conserva todas as coordenadas; Trânsito/Contingência dispersos por ID em recortes urbanos em terra, a pelo menos 900 m dos demais eventos. Intervalo em uma coluna responsiva.
- `harness frontend`: lint, 56 testes, build 449,26 kB; E2E: 44 passados/zero ignorados em Firefox/Chromium. Fontes, licenças, limites e medições em `docs/maps/visual-reference.md`.

## 2026-10-11 — Desempenho, raio de 25 km e massa metropolitana

- Raio até 25.000 m: clique esquerdo muda o centro continuamente apenas com o filtro ligado; arraste move a câmera. Centro inicial na Central do Brasil.
- Mantém mapa público/câmera/tiles na navegação, acompanha redimensionamento e consolida alterações por quadro; elimina submissões GeoJSON duplicadas.
- 25 ocorrências fictícias por categoria (75 no total), coordenadas distintas e agrupamentos em nove municípios da RMRJ; dois POIs separados. Não declara cobertura operacional nem ocorrência real.
- `harness frontend`: lint, 54 testes, build 444,20 kB inicial; E2E: 38 passados/zero ignorados. Análise de Google Maps, fontes e limitações em `docs/maps/performance-google.md`; nenhuma troca, conta ou serviço contratado.

## 2026-10-11 — Mapa-base suave e escala equivalente

- Análise do commit `9574a63`: troca de OSM raster/opacidade 0,82 por OpenFreeMap Bright vetorial + OSM raster no fallback causou diferenças visuais entre os motores.
- Alidade Smooth vetorial/raster nos mapas público e de cadastro aproxima o visual da referência; shell, controles, camadas e recuperação Firefox/Chromium preservados. CARTO Voyager exato exige chave própria; nenhuma credencial da referência foi reutilizada.
- Corrige conversão de zoom/limites entre MapLibre e Leaflet, centralização de ocorrências e enquadramento territorial; elimina créditos vetoriais duplicados. Sem novas dependências.
- `harness frontend`: lint, 49 testes, build, 440,38 kB inicial; E2E: 34 passados/zero ignorados, incluindo tiles reais e comparação da câmera nos dois motores. Firefox Playwright com janela/fallback 2D: 22 tiles HTTP 200, zero erros, cadastro nas três categorias.
- Uso sem autenticação limitado pelo Stadia Maps a localhost/127.0.0.1. Outros hosts exigem domínio autorizado/chave própria; nenhuma conta/assinatura ou publicação foi criada. Fontes, evidências e limites em `docs/maps/compatibility.md`.

## 2026-10-11 — Recuperação de mapas Firefox/Chromium

- MapLibre mantém prioridade quando WebGL2 funciona. Falha de inicialização, erro antes de pronto, perda de contexto GPU e espera vetorial acima de oito segundos acionam Leaflet automaticamente nos dois mapas.
- Reutiliza raster na mesma instância após falha; conserva filtros/raio e câmera dos dois mapas, cancela watchdog ao sair e não cobre o mapa pronto por erro isolado de tile. Regressão verifica o ponto de cadastro desenhado após perda de contexto.
- Raster só anuncia prontidão após tile realmente recebido; indisponibilidade dos dois provedores mantém erro, lista e coordenadas manuais.
- `harness frontend`: lint, 49 testes e build passaram; bundle inicial 441,15 kB/limite 500 kB, engines e CSS continuam lazy. E2E: 32 passados, zero ignorados; inclui recuperação, cadastro isolado e 390/320 px nos dois renderizadores.
- Firefox instalado 157.0.1 com janela/perfil temporário validou tiles reais, marcadores e cadastro nas três categorias, sem alterar perfil pessoal/GPU. A falha original desse perfil não foi reproduzida; falhas concretas de recuperação foram reproduzidas antes da correção. Detalhes em `docs/maps/compatibility.md`.
- Backend, banco, publicação e ingestão de dados continuam fora deste incremento.

## 2026-10-10 — Compatibilidade, relatório e detalhes inline

### Adicionado e corrigido
- Detalhes de ocorrência expandem dentro do próprio resultado, alternam entre abrir/fechar pelo mesmo botão e limitam a cinco registros simultâneos; detalhes de registros filtrados são removidos.
- Mapa inline na etapa “Indique o local” para as três categorias, com coordenadas editáveis e marcador sincronizado; centro inicial na Central do Brasil.
- Relatório XLSX em pt-BR com datas de Brasília, alinhamento, larguras, cabeçalhos fixos, autofiltro e impressão em paisagem.
- MapLibre/OpenFreeMap permanece como caminho principal; sem WebGL2, Leaflet 1.9.4 e CSS são carregados sob demanda. O fallback mantém pontos, popups, camadas de calor separadas, raio, polígonos filtrados e mapa de cadastro.
- O provedor raster/zoom/atribuição ficam no asset estático `apps/web/public/maps/raster-provider.json`; padrão OSM, atribuição visível e link “Corrigir mapa”. Nenhuma credencial foi adicionada.
- Corrigida a pilha do mapa para controles de raio receberem clique também com Leaflet; o grupo do raio recebeu título acessível sem a legenda clipping. Espaçamento dos presets passou a 6 px e o botão “Detalhes” alinha com o ícone do registro.
- JavaScript/CSS de MapLibre e Leaflet permanecem lazy; não houve aumento do limite de bundle.

### Verificação
- `bash scripts/verify.sh frontend`: lint, 47 testes e build passaram; bundle inicial 439,56 kB (limite 500 kB), sem avisos.
- `npm run test:e2e -- --workers=1`: 15 passados, 1 ignorado. Fallback Gecko roda no projeto Firefox; testes cobrem mapas, worker/CSS, tiles de teste, raio/territórios, cadastro, detalhe até cinco, teclado, XLSX, mobile e alinhamento visual.
- Smoke test separado em Firefox 157 headless com WebGL2 desativado usou OSM real: 9 tiles no mapa público e 15 no cadastro retornaram HTTP 200; Referer/User-Agent padrão, atribuição e clique que preencheu coordenadas foram confirmados. Captura mostrou tiles contínuos.
- Build lazy: MapLibre 1,07 MB + CSS 83,13 kB; Leaflet 149,42 kB + CSS 11,07 kB; nenhum desses estilos/engines pesa no bundle inicial até a seleção do renderer.

### Limites mantidos
- Frontend demonstrativo; sem API, backend, banco, autenticação real, persistência de cadastro ou ingestão de fontes.
- A suíte E2E intercepta tiles para estabilidade; o smoke test real comprova somente a sessão atual, não disponibilidade futura/SLA. QA ainda não incluiu leitor de tela, hardware móvel real ou desempenho.

> A seção abaixo preserva o histórico anterior (estado revisado em 05/10/2026); para o estado atual, use esta atualização e `PLAN.md`.

## 2026-10-05 — Integração seletiva na `main` (registro histórico)

### Integrado
- Incorporada a demonstração Angular à aplicação existente em `vetor-urbano-web/`, preservando o esquema SQL, os requisitos, a documentação arquitetural e a estrutura planejada para a API já presentes na `main`.
- Atualizados os READMEs para descrever o mapa, filtros, lista alternativa e formulário como demonstração com dados sintéticos, sem consulta, envio ou persistência.
- Ajustado `scripts/verify.sh` para executar lint, checagem de tipos, testes e build no frontend existente; a ausência de aplicação Spring Boot é informada como estado, não tratada como teste aprovado.
- Registrados o escopo da integração, a auditoria territorial e os limites de verificação na documentação do projeto.

### Verificação
- `bash -n scripts/verify.sh` e `bash scripts/verify.sh`: passaram; lint, typecheck, 6 testes, build de produção e verificações estruturais/segurança concluídos. O harness informa que a API ainda não está scaffoldada.
- `npm audit --audit-level=low`: zero vulnerabilidades.
- Worker e módulo compartilhado do MapLibre retornaram HTTP 200 no servidor local. Uma requisição de tile OSM também retornou HTTP 200; isso não comprova a renderização do mapa no navegador.
- Capturas headless em 375, 390, 768 e 1200 px não mostraram overflow horizontal óbvio no estado inicial. O formulário foi inspecionado no preview em desktop.

### Limite conhecido
- Na captura desktop, os controles e a atribuição do MapLibre apareceram, mas tiles e marcadores não ficaram visíveis. A renderização do mapa/worker em navegador com WebGL funcional e a validação responsiva do formulário continuam pendentes; não declarar essa fase concluída.
- O placeholder `#777780` sobre o campo `#111115` mede 4,25:1, abaixo do mínimo WCAG AA de 4,5:1 para texto. O ajuste de cor permanece pendente.

## 2026-10-01 — Protótipo interativo do Vetor Urbano

Revisado em 05/10/2026 para refletir os testes e a configuração final do worker; a renderização do mapa em navegador segue pendente de smoke test.

### Adicionado
- Frontend demonstrativo em Angular com navegação entre mapa público e cadastro progressivo de ocorrências.
- Mapa MapLibre com carregamento sob demanda, tiles OpenStreetMap atribuídos, marcadores fictícios, popups, zoom e alternância para visualização de densidade.
- Lista acessível que acompanha os registros exibidos no mapa, filtros acumuláveis por período/categoria/tipo e pontos de interesse sintéticos.
- Formulário por categoria, campos de localização com validação de coordenadas e explicação explícita de que a API de envio ainda não existe.
- Testes de componente e scripts de lint, teste CI e build do frontend.
- Auditoria inicial das fontes cartográficas/territoriais em `docs/maps/territorial-sources.md`.
- Worker MapLibre servido pelo próprio app, com o worker e seu módulo compartilhado publicados juntos sob `assets/maplibre/`; a URL é resolvida relativamente a `document.baseURI`.

### Documentação e manutenção
- README e documentos de requisitos descrevem o estado e as decisões úteis ao projeto, sem biografia ou contexto pessoal.
- Removido o prompt inicial de planejamento, já obsoleto após a Fase 0; o modo `docs` do harness verifica os arquivos atuais.

### Salvaguardas e limites
- Dados de ocorrências e pontos de interesse são fictícios e locais ao frontend; não há integração com API nem persistência.
- Nenhum polígono de território foi incorporado. Fontes, conceitos, licença e comparabilidade ainda precisam de validação.
- O formulário valida coordenadas não vazias dentro dos limites geográficos, mas não envia nem publica relatos. Autenticação, autorização no backend e moderação continuam requisitos antes de habilitar escrita.
- O mapa-base OSM serve à demonstração de baixo volume; uma publicação exige escolha de provedor apropriado e revisão dos termos.

### Verificação
- `bash scripts/verify.sh frontend`: lint, testes e build concluídos com sucesso.
- Vitest: 6 testes passaram, incluindo coordenadas vazias, o estado explícito de não envio e a ordem de definição da URL própria do worker antes da criação do mapa.
- Worker e arquivo compartilhado retornaram HTTP 200 no servidor Angular; ambos também foram incluídos no build de produção. A exclusão do prebundle não resolveu o erro e foi revertida.
- Build Angular concluído; MapLibre está em chunk lazy-loaded.
- A execução real do worker e a renderização do mapa não foram verificadas em navegador. A auditoria completa com leitor de tela também não foi feita.

### Pendências conhecidas
- Implementar a fatia vertical segura com API Java, PostgreSQL/PostGIS, autenticação/autorização e moderação.
- Definir os municípios da Baixada Fluminense e validar fontes/licenças antes de declarar cobertura ou exibir polígonos.
- Avaliar visualmente em telas móveis, zoom 200% e com leitor de tela; a captura de screenshot do navegador ficou indisponível por configuração do perfil local.

## 2026-10-15 — Reconciliação documental da continuidade

- Corrigido o vínculo de tickets/commits: 11 → `2c34dd9` (fontes/explicação); 36 → `84bfa04` (documentos institucionais); `47cba99` não localizado no Git.
- Qualificados os registros de aceite dos Tickets 06, 07, 10 e 36 como implementação/evidência histórica com pendências de revisão estática; nenhuma falha foi declarada reproduzida.
- Esclarecido que o Ticket 12 requer API Java e PostgreSQL/PostGIS reais e que o versionamento territorial persistido pertence ao Ticket 26, além da demonstração do Ticket 09.
- Atualizados estado local, status dos tickets, plano e histórico. Sem alterações de aplicação ou testes executados.
