# Implementação integrada da especificação — 15/10/2026

Branch local `integration/functional-spec-v1`, base `897fae5`. Usuário autorizou implementação de todas as 36 tarefas revisadas com a skill implement-spec, após concluir a revisão documental. Trabalho anterior não commitado permanece preservado no root; implementadores usam worktrees isolados, commits por ticket e merges por agente de integração. Spec/tickets internos permanecem na área local ignorada. Não há autorização de publicação ou push.

## Esclarecimentos aprovados durante a execução

- G1 Rio de Janeiro (`https://g1.globo.com/rj/rio-de-janeiro/`) somente placeholder editável; coleta desativada. Novas fontes serão cadastradas manualmente depois. Não usar essa indicação como licença de coleta/redistribuição ou prova de integração real.
- Contas na demonstração local: caixa de e-mail de teste, confirmação/recuperação de uso único, segundo fator administrativo por aplicativo, referência de uma hora de inatividade, revogação em logout/troca de senha e exclusão com confirmação preservando fatos/revisões. Não configurar entrega de e-mail nem contas reais por inferência.
- Avaliações: configuração administrativa versionada e testes com valores sintéticos identificados, cálculo operacional desativado até calibragem. Nenhuma nota real de fonte/fórmula foi presumida.

## Verificação de partida e ambiente

`bash scripts/verify.sh web` no código anterior passou: lint, 59 unitários e build502,64kB, com aviso de2,64kB. Esse resultado não aprova os incrementos novos.

Podman fora do sandbox foi autorizado e permitiu reaproveitar imagem local PostGIS17-3.5. Banco isolado em loopback127.0.0.1:55436, dados/credenciais efêmeros de teste. SQL confirmou PostgreSQL17.5 e PostGIS3.5.2. Ausência de PostGIS nativo não será mascarada por H2. Java25 tem módulo compilador; Maven existente em cache. Preparação do banco não é aceite da API.

## Entregas integradas

### Ticket01 — catálogo e consulta inicial

Commit `5c99513`, merge fast-forward na integração. CatálogoD04 com16tipos/subtipos, padrão24h/três pilares, dados/fontes/notas fictícios e rejeição explícita de filtros salvos incompatíveis. Conjunto total75ocorrências+2POIs preservado; consulta inicial17ocorrências(7/5/5).

TDD RED/GREEN documentado: período1m incorreto, recuperação legada sem aviso e datas inválidas aceitas. Web: lint,60unitários e build504,85kB passaram(aviso4,85kB).18E2E direcionados em Chromium/Firefox passaram; diff-check passou. Erro127 do Playwright diagnosticado como EPERM de socket no sandbox; execução escalonada funcionou sem alterar o executor. Suíte E2E geral e QA físico não declarados aprovados.

### Ticket03 — combinação e resumo de filtros

Commit `10d316c` integrado FF. OR nas alternativas e AND nos filtros, correlação de pilar/tipo dentro de uma classificação, adicional sem duplicação, resumo/remover/limpar com retorno explícito aos padrões e câmera preservada. RED/GREEN de classificação adicional e resumo visível; web61unitários/build508,88kB(aviso8,88kB),12E2E direcionados mais2reexecuções responsivas em Chromium/Firefox passaram. Diff-check passou. Não houve mudança de fixture/datas nesse ticket.

### Ticket02 — ocorrências e acontecimentos

Implementação `f1cc078`, merge de03 `45c6401` integrado FF. Três efeitos/um acontecimento, referências rastreáveis fictícias, campos desconhecidos/não aplicáveis e detalhe compartilhado entre módulos. Relacionados fora dos filtros são contexto sem alterar totais. Conjunto75registros/17iniciais e coordenadas preservados. Web61unitários/build515,13kB(aviso15,13kB),14E2E Chromium/Firefox após merge03 e diff-check passaram;390px inspecionado. RED de ausência das relações e GREEN documentados em evidência local. Relógio setFixedTime congelava animação Leaflet; harness corrigido para setSystemTime, sem alterar domínio para acomodar teste.

### Ticket04 — precisão temporal e situação

Commit `95fffc1` integrado, incluindo02/03. Datas exatas/dia/intervalo/mês, inclusão certa/possível e fim exclusivo; situação produto independente do estado legado; confirmação expira para Desconhecida, com transição e dados de verificação. Importações de dia/mês preservam precisão. Valores de4h/12h somente sintéticos. RED/GREEN e diagnóstico de overflow: resumo temporal estava estreitando métricas; corrigido grid sem mudar identidade visual. Web66 unitários/build521,37kB(aviso21,37kB),16E2E finais e22 workspace anteriores passaram; diff-check passou.

### Ticket11 — fontes e explicação pública

Commit `2c34dd9` integrado FF. Fontes no rodapé e explicação da confiabilidade no detalhe, retorno/foco preservados inclusive navegação aninhada. G1 único veículo real, placeholder não avaliado com coleta desligada; dois exemplos sintéticos separados. Importação/triagem e atribuições preservadas. Lint,66 unitários,build525,77kB(aviso25,77kB),22E2E Chromium/Firefox e diff-check passaram; duas páginas móveis390px inspecionadas. Nenhuma consulta ao G1. Gestão permanece16; documentos institucionais36 iniciado.

### Ticket05 — território, mapa e lista

Commit `9dc9b6a` integrado em `a7a1d52`. Filtro por município/bairro e busca por referências fictícias com ação explícita de "Usar área visível". Registros somente territoriais exibidos na lista com indicação de precisão espacial, excluídos de pinos, mancha térmica e raio. Retorno ao recorte demonstrativo preservado. MapLibre GL real e Leaflet validados com suíte direcionada; 67 unitários, 4 E2E (Chromium/Firefox) e build passaram.

### Ticket09 — áreas de risco demonstrativas

Commit `cab91b8` integrado em `a7a1d52`. Camada de Áreas de Risco alternável com nomes no hover e detalhamento acessível via clique e teclado. Fixtures GeoJSON independentes de contagens e calor, com classificação neutra e referências temporais. Lint, 69 unitários e 4 E2E direcionados passaram.

### Ticket36 — documentos institucionais

Commit `84bfa04` integrado na branch `integration/functional-spec-v1`. Consulta sem autenticação aos quatro documentos pelo rodapé: Termos de uso, Política de privacidade, Metodologia dos dados e Procedimento de correções. Marcação explícita de rascunho de revisão local e versão demonstrativa v1.1. Metodologia distingue clipping, ocorrência e acontecimento, precisão espacial e cobertura regional, sem fórmulas ou rubricas internas. Correções separa pedido de retificação de novo fato. Foco inicial no título de cada documento e retorno preservado à consulta de origem com restauração de foco e scroll. 69 testes unitários, build (555,75 kB) e 8 E2E direcionados em Chromium e Firefox passaram; viewport móvel 390 px inspecionado.

### Ticket06 — dois modos de consulta

Implementação completa dos dois modos na branch `integration/functional-spec-v1`. Alternância entre Modo simples e Análise e Inteligência no topo com botão `data-mode-toggle` e aviso observável (`role="status"`). No Modo simples, período personalizado e filtros avançados (subtipos, busca textual, fontes, faixa de nota fictícia e situação) são suspensos com aviso explícito ("Filtros avançados suspensos no Modo simples.") e mancha térmica é desativada. Ao retornar para Análise e Inteligência, filtros comuns alterados no modo simples são preservados; escolhas explícitas de período feitas no modo simples (ex.: jornada `personalizado → simples → semana → 24h → avançado`) são mantidas e não restauram silenciosamente períodos personalizados suspensos. Subtipos compatíveis são reaplicados com aviso ("Filtros avançados reaplicados.") e subtipos incompatíveis com tipos desmarcados são descartados com aviso ("Subtipo incompatível com o tipo selecionado foi removido."). Preferência de modo é persistida localmente no navegador (`vetor-consultation-mode`) sem restaurar a consulta inteira. Validação de nota fictícia (1 a 5) com erro observável quando min > max, zerando os resultados com segurança. 82 testes unitários (Vitest), build de produção (597,98 kB) e 10 testes E2E direcionados em Chromium e Firefox passaram (`two-modes.spec.ts`, 14.4s); viewport móvel 390 px inspecionado; `git diff --check` passou sem divergências de whitespace.

### Ticket07 — agrupamentos e sobreposições

Commit `b505ac6` integrado na branch `integration/functional-spec-v1`. Agrupamento de ocorrências próximas ao afastar o mapa (`currentZoom <= 12.5` no Leaflet / `clusterMaxZoom: 11` no MapLibre) com badge de contagem (`.occurrence-cluster`, `data-testid="occurrence-cluster"`) e ação de clique para zoom e desagregação (`getClusterExpansionZoom` / `zoom + 2`). Exclusão estrita de POIs e polígonos territoriais dos agrupamentos. Pins perfeitamente coincidentes no zoom aproximado exibem marcador destacado com badge (`.occurrence-pin.is-coincident`, `data-testid="coincident-marker"`) que, ao ser acionado via clique ou teclado, abre popup acessível (`createCoincidentPointsPopup`) listando os registros sobrepostos para seleção individual, sem deslocar coordenadas no modelo (sem "spiderfy" que adultere os dados). Seleção individual sincroniza com a lista lateral (`selectAndFocusRecordDetail`) e detalha o registro escolhido. Massa de teste sintética com par coincidente autorizado em Glória (`demo-contingencia-004` e `demo-002`). Lint, 70 testes unitários, build (571,15 kB) e 12 E2E direcionados em Chromium e Firefox passaram (`clustering-and-overlap.spec.ts` e regressão `related-occurrences.spec.ts`); viewport móvel 390 px inspecionado.

### Ticket08 — informes ativos por ponto manual

Commit `04be65e` integrado na branch `integration/functional-spec-v1`. Consulta de Informes Ativos por proximidade com centro de referência manual explícito (WGS84) e raio configurável com teto estrito de 5.000 m (5 km), sem herdar o limite demonstrativo antigo de até 25 km do mapa. Conjunto une ocorrências recentes das últimas 24 horas (inclusive encerradas) e vigentes antigas iniciadas antes da janela, sem duplicar registros. Destaque semântico e visual para situações em andamento (`.ongoing-badge`, `.is-ongoing`) e identificação explícita de incertezas temporais (`.uncertain-badge` para horário/data aproximada) e de situação (`.uncertain-badge` e `.unknown-status` para situações desconhecidas ou confirmações expiradas). Exclusão estrita de registros puramente territoriais sem coordenadas precisas (`locationPrecision === 'TERRITORY'`) e de ocorrências fora do raio de busca. Ação "Escolher local no mapa" com prompt observável (`.map-pick-prompt`) permite alternar para o mapa e definir o centro manual por clique, com retorno automático ao painel de Informes e estado vazio acessível quando nenhum informe ativo estiver no perímetro. Sem solicitação de geolocalização real do navegador (adiada para integração posterior no Ticket 25). Lint, 75 testes unitários, build de produção (579,98 kB) e 8 testes E2E direcionados em Chromium e Firefox passaram (`active-reports.spec.ts`); viewport móvel 390 px inspecionado.

### Ticket10 — avisos de atualização e estados explícitos de consulta

Commit `6c9e96b` integrado na branch `integration/functional-spec-v1`. Distinção clara e acessível entre carregamento, falha, consulta vazia e atualização disponível na sessão aberta:
- **Aviso de atualização simulada:** Exibe faixa observável (`[data-testid="query-update-notice"]`, `role="status"`) quando há novas publicações/atualizações disponíveis na sessão aberta, oferecendo ação explícita de "Atualizar consulta" (`[data-testid="apply-query-update-btn"]`). A atualização preserva integralmente os filtros ativos, centro manual e câmera do mapa, atualizando a data/hora de referência da consulta (`queryReferenceDate`) e seu timestamp observável (`[data-testid="query-timestamp"]`). A simulação é identificada como demonstrativa e não é apresentada como push ou coleta instantânea.
- **Consulta vazia padronizada:** Quando nenhum registro coincide com o recorte, informa exatamente *"Não encontramos ocorrências publicadas para estes filtros"* (`[data-testid="consultation-empty"]`) e oferece três ações explícitas de recuperação: "Ampliar período" (`[data-testid="empty-expand-period-btn"]`), "Ampliar território" (`[data-testid="empty-expand-territory-btn"]`) e "Remover filtros" (`[data-testid="empty-clear-filters-btn"]`).
- **Tratamento de falha sem zero válido nem falsa segurança:** Em caso de erro na consulta de dados (`queryError`), a barra de resultado e a coluna lateral indicam "Consulta indisponível" (`[data-testid="query-error-state"]`, `[data-testid="query-error-banner"]`) com nota explícita de que a falha não confirma ausência de ocorrências nem segurança do local, e permite tentar novamente (`[data-testid="retry-query-btn"]`), sem exibir `0` como dado válido.
- **Resiliência do mapa e alternativa em lista:** Em caso de falha de carregamento do provedor de tiles (`mapError`), a camada de fallback do mapa (`.map-fallback`) informa que os dados continuam disponíveis na lista lateral e que a falha não comprova ausência de ocorrências nem segurança, com botão de retry acessível (`[data-testid="retry-map"]`). A lista de ocorrências permanece totalmente funcional e navegável por teclado, preservando a contagem real das ocorrências e navegação acessível.
- **Verificação:** Lint Prettier, 78 testes unitários Vitest, build de produção Angular (589,66 kB) e 8 testes E2E Playwright direcionados em Chromium e Firefox passaram (`query-updates-and-states.spec.ts`, 10.2s); `git diff --check` passou sem divergências de whitespace.

## Continuidade

**Primeiro lote concluído com sucesso:** Todos os 12 tickets do primeiro lote (01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11 e 36) foram implementados, testados em Chromium e Firefox, verificados com a suíte de harness e integrados na branch local `integration/functional-spec-v1`.
**Próximo lote desbloqueado:** Ticket 12 (`12-consulta-persistida.md`, persistência local da consulta) desbloqueado por 05. [Estado local atualizado](../../.scratch/consulta-coerente/implementation-state.json).




## Reconciliação documental de continuidade — 15/10/2026

Auditoria dos tickets originais e dos objetos Git locais confirmou: Ticket 11 é fontes/explicação pública (`2c34dd9`); Ticket 36 é documentos institucionais (`84bfa04`); o objeto `47cba99` não foi encontrado. A descrição anterior de Ticket 12 como persistência local estava incorreta: o ticket requer consulta do navegador atravessando API Java e PostgreSQL/PostGIS real, com migrações e validação espacial no servidor. Ticket 09 entrega camada demonstrativa e revisões sintéticas; versionamento territorial persistido é do Ticket 26.

Revisão estática, sem executar testes da aplicação, mantém resultados anteriores como históricos e qualifica aceites: 06 e 07 têm critérios originais sem checklist/evidência completa nos registros; 10 tem verificações históricas direcionadas, mas não rastreia todos os critérios de estado/acessibilidade; 36 tem páginas ainda marcadas como rascunho e texto que afirma envio para fila interna embora formulário/protocolo sejam futuros no Ticket 27. São pendências documentais/de implementação a revisar, não falhas reproduzidas. O estado local registra essas qualificações.

Nenhuma decisão aprovada ou ID foi alterado, nenhuma funcionalidade foi implementada e nenhum teste da aplicação foi executado. Próxima ação: fechar evidências/ajustes de 06, 07, 10 e 36 antes de iniciar outro incremento.

### Ticket 36 — revisão de documentos (15/10/2026)

Revisados os quatro textos institucionais locais. Termos deixaram de apresentar registros como compilação de fontes reais e agora identificam os dados fictícios e a ausência de comprovação de coleta. Privacidade limita as afirmações ao protótipo e deixa explícito que práticas para uma operação publicada precisam ser definidas; a separação entre local da ocorrência e informante aparece como diretriz, não prova de tratamento de dados reais. Metodologia descreve polígonos sintéticos e cobertura desejada sem sugerir fonte pública ou cobertura operacional. Os quatro textos permanecem rascunhos v1.2, sem publicação.

O procedimento distingue correção de novo fato e descreve a revisão como fluxo ainda indisponível. Informa que não há recebimento de pedidos, formulário, fila, protocolo ou acompanhamento na demonstração e que a orientação de referência não envia solicitação. Não foi implementada fila. Isso atende à transparência dos critérios 1, 2 e 4 no escopo local; o envio/acompanhamento do critério 3 permanece pendente até a implementação do canal no Ticket 27.

Verificação nova: `bash scripts/verify.sh web` (lint, 82 testes unitários e build passaram; bundle 598,33 kB, 98,33 kB acima do orçamento de 500 kB); `bash scripts/verify.sh planning` (186 links locais); Playwright filtrado pelo cenário de documentos, 2/2 Chromium/Firefox após corrigir a caixa da asserção. A jornada verificou acesso sem login, versão/data dos quatro textos, foco no título por teclado, retorno com foco restaurado e largura móvel de 390 px. Erro/carga/vazio não se aplicam a páginas estáticas. `git diff --check` passou. Sem API ou integração real exigida para esta fatia, sem coleta, publicação ou canal de correção.

### Checkpoint de continuidade — 15/10/2026

- **Git:** branch `integration/functional-spec-v1`; HEAD `a836616` (`docs: clarify institutional service availability (ticket 36)`). O commit contém exatamente `CHANGELOG.md`, `PLAN.md`, `apps/web/src/app/app.html`, `apps/web/e2e/public-information.spec.ts` e este histórico. Sem push.
- **Etapa:** Ticket 36, revisão dos quatro documentos institucionais concluída na demonstração local. Critérios 1 (acesso/versão/limites), 2 (metodologia) e 4 (canal disponível descrito sem promessa) atendidos localmente. Critério 3 parcialmente atendido: distingue correção de novo fato e deixa explícita a indisponibilidade; envio e acompanhamento reais permanecem pendentes do Ticket 27.
- **Árvore anterior preservada:** modificados `.gitignore`, `GLOSSARY.md`, `docs/README.md`, `docs/architecture/overview.md`, `docs/product/interface.md` e `docs/product/scope.md`; não rastreados `docs/Definicoes-VetorUrbano.odt`, `docs/.~lock.Definicoes-VetorUrbano.odt#`, `docs/history/product-before-spec-2026-10-15/`, `docs/history/product-interview-2026-10-14.md`, `docs/history/spec-to-tickets-2026-10-15.md`, `docs/product/development-status.md`, `docs/product/feature-definition.md` e `docs/product/tickets-status.md`. Já estavam presentes antes da revisão do Ticket 36 e pertencem à reconciliação de produto/documentos de 14–15/10; não foram staged nem commitados com `a836616`.
- **Comandos e resultados:** `bash scripts/verify.sh web` — lint, 82 unitários e build passaram; bundle 598,33 kB, aviso de 98,33 kB acima do limite de 500 kB. `bash scripts/verify.sh planning` — 186 links locais passaram; âncoras e URLs externas não verificadas. `npm run test:e2e -- --grep 'rodapé permite consultar termos, privacidade, metodologia e correções sem login com foco e retorno preservados'` em `apps/web/` — 2/2 Chromium/Firefox passaram; teclado/foco, retorno e 390 px cobertos. `git diff --check` passou.
- **Falhas transitórias:** primeira execução E2E falhou nos dois navegadores por diferença de maiúsculas/minúsculas em uma asserção; ajustada e repetida com sucesso. Uma tentativa posterior de E2E na raiz retornou ENOENT por não haver `package.json` ali; executada no diretório correto e passou. A inicialização automática do Playwright teve saída 127 uma vez; servidor local iniciado e E2E repetido com sucesso. `git add` inicialmente foi bloqueado pelo índice `.git` somente leitura; permissão técnica foi concedida, e apenas os cinco arquivos acima foram commitados. Sem falha funcional remanescente reproduzida.
- **Decisões aprovadas preservadas:** documentos continuam rascunhos locais, sem publicação; dados fictícios não comprovam coleta, cobertura ou tratamento reais; não inventar fila/canal de correção nem parâmetros; coleta real e publicação continuam não autorizadas. Não há segredos neste checkpoint.
- **Árvore após registrar este checkpoint:** além das alterações preexistentes listadas acima, as edições de continuidade em `PLAN.md`, `CHANGELOG.md` e neste arquivo estão não commitadas e pertencem a este registro. `bash scripts/verify.sh planning` após a edição encontrou 187 links locais; `git diff --check` passou. A execução `web` e o E2E foram os resultados imediatamente anteriores, não reexecutados por esta atualização apenas documental.
- **Próxima ação exata:** abrir `.scratch/consulta-coerente/issues/07-agrupamentos-sobreposicoes.md` e fechar as evidências de aceite do Ticket 07; depois revisar Ticket 10. Não iniciar outro ticket antes disso. Manter o aceite integral do 36 pendente até existir o canal do Ticket 27.

### Retificação da reconciliação documental — 15/10/2026

Conferência dos tickets originais locais e dos commits da branch corrige a leitura da seção de reconciliação acima. Os tickets 06 e 10 têm seus critérios marcados como concluídos nos arquivos originais (`.scratch/consulta-coerente/issues/06-dois-modos.md` e `10-consulta-atualizacao-estados.md`); os commits correspondentes incluem `01a005a` (complemento de 06; `59a09c5` iniciou a alternância) e `6c9e96b` (10). Os resultados de lint/testes/build e navegadores descritos nos tickets são históricos e não foram repetidos nesta etapa. O checklist marcado e os registros históricos não encerram a revisão de evidências: permanece pendente confirmar explicitamente todas as obrigações de atualização, inclusive centro/câmera, carregamento/erro/recuperação, teclado/foco, movimento reduzido e apresentação móvel. Isso não é novo aceite funcional.

O checklist de 07 continua desmarcado no ticket original local, embora `b505ac6` e resultados direcionados históricos estejam presentes; permanece como próxima revisão de rastreabilidade, sem declarar falha ou aceite nesta etapa. Ticket 09 é a entrega demonstrativa de camada territorial, detalhes e referência temporal com exemplos sintéticos separados; versionamento territorial persistido é do Ticket 26. Ticket 12 é proposta de integração navegador → API Java → PostgreSQL/PostGIS reais, com migrações e validação espacial no servidor; não é persistência local.

Rastreabilidade confirmada: Ticket 11 (“Conhecer fontes e avaliação pela consulta”) → `2c34dd9`; Ticket 36 (“Consultar documentos de uso, privacidade e metodologia”) → `84bfa04`. O commit `a836616` registra ajuste posterior do procedimento: a demonstração informa que não recebe pedidos e não oferece formulário, fila, protocolo ou acompanhamento. Os textos permanecem rascunhos locais, e o envio/acompanhamento efetivos seguem dependentes do Ticket 27. `47cba99` não está presente no Git local. A consulta à API do GitHub falhou por indisponibilidade de rede; esta retificação usa os tickets originais preservados localmente e objetos Git locais.

Esta retificação foi apenas documental: nenhuma aplicação ou teste foi executado, nenhum critério funcional foi novamente aceito e nenhuma decisão aprovada foi reaberta. Próxima ação: revisar a rastreabilidade do checklist ainda desmarcado de 07; manter o critério de recebimento/acompanhamento de correções do 36 condicionado ao Ticket 27.
