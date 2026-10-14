# Incremento autorizado — outubro de 2026

**Situação em 06/10/2026:** o pedido anterior autorizou esta direção de produto e seu contrato como incremento; a implementação entregue foi somente o protótipo de interface descrito no fim do documento. A nova proposta de versão 1.0 precisa ser reconciliada com este contrato em `PLAN.md` antes de implementar apps/api/RBAC. Não interpretar campos/endpoints ainda propostos como comportamento existente.

## Autorizações e referências

Pedido recebido em 01/10/2026: iniciar Angular/Java/PostgreSQL, aproveitar `docs/references/ui-prototype/`, preservar a identidade e a Proposta B; implementar categorias, formulário progressivo, três módulos, filtros acumuláveis, POIs, camadas territoriais e mancha térmica. GeoAnalytics é referência funcional, não fonte de código/dados. RF01–RF07/RNF01–RNF08 originais permanecem; este incremento não promete concluí-los integralmente.

Decisões explícitas de produto nesta rodada:
- **Operador autenticado cadastra; publicação somente após aprovação.** Prevalece sobre o selo público/sem conta e a publicação imediata do wireframe.
- Autoriza primeira versão de campos específicos, com análise documental e hipóteses registradas.
- Categoria primeiro: **Classifique a categoria**, seleção única de Trânsito, Segurança ou Contingência; todo o restante do formulário oculto antes da escolha.
- Um módulo expandido por vez; fechar módulo não desativa suas camadas. Categorias e tipos são conceitos distintos.

O nó Figma `88w5OG76xOKBqVIaEcwuWG / 3:109` foi consultado pelo MCP: chama-se Proposta B, mas mostra localização antes de detalhes. A imagem anexada mostra classificação antes de localização. A instrução textual explícita sobre categoria primeiro prevalece em ambos. Mapa/radios esquemáticos viram mapa real/controles nativos acessíveis, não imagens estáticas copiadas.

## Limites desta entrega

Aplicação **local e demonstrativa**, com dados sintéticos identificados. Sem publicação externa, contratação, ingestão de ocorrências reais, dados pessoais, geolocalização de informante, push, votos, BI ou promessa de cobertura da Baixada. Municípios continuam pendentes. Não criar perfil Gestor sem MFA: nesta entrega há somente Operador e consulta pública. Gestão de contas/MFA de Gestor continuam em incremento próprio.

POIs exclusivos são restritos por cliente no backend, nunca apenas escondidos na interface. Sua demonstração usa clientes e pontos fictícios. Fontes reais de POIs não foram fornecidas.

Territórios reais só entram com proveniência, geometria verificável e permissão de reutilização. Se houver impedimento, a camada exibe indisponibilidade explícita; não desenhar territórios fictícios de facções sobre bairros reais nem chamar ausência de dados de “Área Neutra”. A pesquisa separada está em `docs/maps/territorial-sources.md`.

## Hipóteses de produto reversíveis adotadas

### Campos do cadastro

Comuns, depois da categoria:
- `nome`: título do fato, obrigatório, 3–120 caracteres, sem nomes pessoais.
- `descricao`: contexto opcional, até 2.000 caracteres; advertência contra dados pessoais. Texto puro, nunca HTML.
- `local`: referência pública do lugar da ocorrência, obrigatória, 3–200 caracteres; não residência/localização do informante.
- `ocorridoEm`: data e hora do **fato**, obrigatória, com offset, não futura. Exibição/entrada em America/Sao_Paulo; API UTC.
- `severidade`: BAIXA, MODERADA, ALTA, CRITICA. É avaliação informada, não verificação independente.
- `longitude`/`latitude`: finitas e nos limites globais; GeoJSON `[longitude, latitude]`, SRID 4326. Confirmação explícita do ponto, por mapa ou campos digitáveis, invalidada ao mudar coordenadas.
- `grupo`: classificação analítica entre os grupos abaixo, validada contra categoria. Não inferir calamidade oficial ou classificação criminal da mera descrição.

Específicos, obrigatórios conforme categoria (campos de outras categorias são rejeitados no backend):
- TRANSITO: `tipoTransito` = COLISAO, CONGESTIONAMENTO, INTERDICAO, PANE, OUTRO; `impactoVia` = LIVRE, PARCIAL, TOTAL, NAO_INFORMADO. Grupo ALERTA ou OUTROS_REGISTROS.
- SEGURANCA: `tipoCrime` obrigatório **somente** quando grupo CRIMES, com os dez códigos abaixo. Demais grupos: ASSUNTOS_SEGURANCA, ATIVIDADE_POLICIAL, ORDEM_PUBLICA, ALERTA, OUTROS_REGISTROS. Não coletar nomes de envolvidos, autoria presumida, documentos ou dados de vítimas.
- CONTINGENCIA: `tipoContingencia` = ALAGAMENTO, DESLIZAMENTO, INCENDIO, FALHA_INFRAESTRUTURA, OUTRO; `areaAfetada` = PONTO, VIA, ENTORNO, NAO_INFORMADA. Grupo CALAMIDADE_PUBLICA, ALERTA ou OUTROS_REGISTROS. “Calamidade Pública” é rótulo do catálogo solicitado, não declaração oficial.

`inseridoEm`, id, origem e estado são sempre do servidor. Não aceitar esses campos controlados pelo servidor no POST. Todas as inserções nesta versão permanecem SINTETICA.

Troca de categoria limpa campos específicos e grupo, preservando campos comuns; mensagem avisa sobre limpeza. Sem anexos, vítimas, estimativa populacional ou precisão artificial de área neste incremento.

### Módulos e camadas

- Estado de expansão separado do estado dos filtros; native buttons com aria-expanded e checkboxes/switches rotulados.
- Análise e Inteligência: período em lista de seleção única (1 semana, 1/3/6 meses, 1 ano), Tipos de Ocorrências, Opções Avançadas (crimes) e Análise de Alertas (três categorias amplas).
- Informações: seis tipos coletivos, mais pontos exclusivos do cliente autenticado.
- Domínio Territorial: sete grupos solicitados, representados por Polygon/MultiPolygon, nunca pins.
- Filtros de camadas acumulam por **união**, sem duplicar IDs; período se aplica às ocorrências dessa união, não à inserção e não a POIs/polígonos. Tipos de crime refinam a camada CRIMES quando houver seleção avançada; categoria ampla ativada inclui todos os fatos da categoria, mesmo fora desse refinamento. A interface explica esse comportamento para não simular um estreitamento inexistente.
- Nenhuma camada selecionada = nenhuma ocorrência; estado vazio orienta ativar filtro. Default reversível: período 1 mês e camada Trânsito ativa.
- Período: `[inicio, fim)`, calculado sobre uma referência de consulta; semana = sete dias civis; meses/ano = calendário em America/Sao_Paulo, ajustando fim de mês, não 30/365 dias fixos.
- Mancha térmica troca **pontos visíveis** (ocorrências e POIs selecionados) por densidade por tipo, sem ponderar gravidade, sem duplicar registro que coincida com filtros. Polígonos permanecem polígonos. Legenda não deve chamar densidade de “risco comprovado”; POIs representam pontos cadastrados, não ocorrências.
- Cada tipo de ponto tem símbolo/código e nome de legenda próprios; nunca apenas cor. Popup/lista incluem nome, descrição, local, data do fato quando aplicável, data de inserção, tipo, gravidade quando aplicável e demonstração.

## Contrato canônico desta implementação

Este contrato substitui o exemplo preliminar P1.1 da arquitetura apenas para o novo incremento. Prefixo `/api/v1`; erros JSON `{codigo,mensagem}` sem SQL/stack/segredos. Campos/queries desconhecidos: 400. Nenhuma resposta restrita recebe cache público; cache no-store em autenticação/dados privados.

### Catálogos fixos (códigos compartilhados)

Categorias: TRANSITO, SEGURANCA, CONTINGENCIA.

Grupos: CRIMES, CALAMIDADE_PUBLICA, ASSUNTOS_SEGURANCA, ATIVIDADE_POLICIAL, ORDEM_PUBLICA, ALERTA, OUTROS_REGISTROS.

Crimes: FURTO, ROUBO_TRANSEUNTE, ESTELIONATO, AMEACA, LESAO_CORPORAL_DOLOSA, ROUBO_VEICULO, FURTO_VEICULO, ROUBO_COLETIVO, ROUBO_CARGA, HOMICIDIO_DOLOSO.

POIs: HOSPITAL_PUBLICO, HOSPITAL_PARTICULAR, UPA, AEROPORTO, EMBAIXADA_CONSULADO, ESTADIO. POI exclusivo tem o mesmo tipo e `exclusivo: true`.

Territórios: CV, TCP, ADA, MILICIA, LIGA_JUSTICA, MILICIA_NOVA_IGUACU, AREA_NEUTRA.

### Ocorrências

`GET /ocorrencias?inicio=<offset>&fim=<offset>&categorias=TRANSITO,SEGURANCA&grupos=CRIMES&crimes=FURTO`

Todos parâmetros opcionais, inicio/fim devem vir juntos. Limites finitos e ordenados; máximo de consulta 366 dias. Sem filtros de categoria/grupo: vazio (não “todas”). `crimes` refina CRIMES; não é filtro solto e exige grupo CRIMES. O backend aplica APROVADA + SINTETICA sempre. Ordem ocorridoEm desc, id asc. Teto 500 com busca de mais um para detectar truncamento.

GeoJSON FeatureCollection `{type:'FeatureCollection',features:[...],metadata:{demonstracao:true,limite:500,retornados:N,truncado:false}}`.

Feature: `{type:'Feature',id:<uuid>,geometry:{type:'Point',coordinates:[lon,lat]},properties:{nome,descricao,local,categoria,grupo,tipoCrime:null|codigo,tipoTransito:null|codigo,impactoVia:null|codigo,tipoContingencia:null|codigo,areaAfetada:null|codigo,severidade,ocorridoEm:<UTC>,inseridoEm:<UTC>,demonstracao:true,status:'APROVADA'}}`.

`POST /ocorrencias` protegido Operador; body plano com campos comuns/específicos descritos (coordenadas em campos longitude/latitude, `pontoConfirmado:true`). Resposta 201 `{id,status:'PENDENTE',inseridoEm}`. Não publica imediatamente. Campos específicos ausentes não são vazios artificialmente preenchidos; envie somente os aplicáveis.

`GET /moderacao`: protegido Operador, FeatureCollection dos pendentes (teto/truncamento). `POST /ocorrencias/{id}/moderacao` body `{acao:'APROVAR'|'REJEITAR'|'RETIRAR',motivo?:string}`. PENDENTE→APROVADA/REJEITADA; APROVADA→RETIRADA. Motivo obrigatório para rejeição/retirada, restrito. Resposta `{id,status}`; transição inválida 409, inexistente 404. Auditoria de moderação restrita, sem autor da ocorrência.

### Identidade mínima

`POST /auth/login` body `{usuario,senha}` → `{token,usuario,perfil:'OPERADOR',clienteId:<codigo|null>}`; 401 genérico para credenciais inválidas/conta inativa. Token opaco aleatório, armazenado hash no banco, transportado Authorization Bearer, **somente na memória do frontend**, nunca localStorage/URL/log. Limite de 1h de inatividade no servidor, revogação em logout; verificar conta ativa e perfil a cada acesso protegido. Sem cookie de autenticação (logo sem autenticação ambiente por cookie); CORS não aberto. Reiniciar frontend exige login de novo: trade-off inicial documentado.

`GET /auth/me` → `{usuario,perfil,clienteId}`, sem token. `POST /auth/logout` → 204 e revogação. Consultas automáticas a /auth/me não renovam atividade. Ações protegidas explícitas renovam atividade. Persistência da sessão permite testar revogação e inatividade. Login deve ter limitação de tentativas local e não imprimir usuário/senha/token.

Bootstrap de Operador **local**, fora da API, por stdin/variáveis controladas; sem credencial universal/versionada, sem auto-criação de Gestor. Testes podem criar contas exclusivamente sintéticas em banco isolado. Clientes são códigos sintéticos não nomes pessoais.

### POIs e territórios

`GET /pois?tipos=UPA,HOSPITAL_PUBLICO&exclusivos=false` → FeatureCollection Point. Properties `{nome,descricao,local,tipo,exclusivo,inseridoEm,demonstracao:true}`. `exclusivos=true` exige autenticação/cliente e retorna **só** daquele cliente. Não aceitar clienteId na query. Frontend consulta coletivo e exclusivo separadamente e combina IDs.

`GET /territorios?grupos=CV,TCP` → FeatureCollection Polygon/MultiPolygon, properties futuras `{nome,descricao,grupo,fonte,dataReferencia,licenca,limitacoes,demonstracao:false}`. Enquanto fonte não aprovada: vazio com metadata adicional `{disponibilidade:'AGUARDANDO_FONTE',mensagem:'Camada indisponível: fonte e licença em validação.'}`. Sem polígonos inventados. Validação de código de grupo é obrigatória mesmo indisponível.

### Segurança e persistência

PostgreSQL/PostGIS real, migrações Flyway; geometrias via ST_SetSRID(ST_MakePoint(longitude,latitude),4326), consultas e valores parametrizados. Texto escapado no DOM, sem setHTML com conteúdo do usuário. Senhas BCrypt com custo explícito. Separar conta/sessão, ocorrência (sem autor_id) e auditoria. Escopo demonstrativo não dispensa autorização, isolamento entre clientes e testes de transições.

## Decisões técnicas registradas antes de gerar aplicações

Inventário real em 01/10/2026: Node 26.7.0, npm 11.19.0, runtime Java 25.0.4.1 (sem javac), Podman rootless 5.8.7, Docker/Maven/psql ausentes. Não instalar pacotes do sistema. Usar contêineres rootless para JDK/Maven e banco, e npm local ao frontend.

- Angular core/compiler 22.2.1; CLI/build 22.2.0; TypeScript 6.0.3; RxJS 7.8.2. Matriz Angular e peerDependencies npm consultados antes do scaffold. Node instalado é compatível.[2]
- MapLibre GL 6.11.2, Bootstrap 5.3.8 (preservar dependência visual existente); SCSS. Sem Tailwind/React.
- Spring Boot 3.5.16, Java 21 de compilação/runtime em contêiner, Maven 3.9.11. Linha 3.5 aceita Java 17–25/Maven ≥3.6.3; escolhemos API estável 3.5 nesta primeira base, não alegamos usar a versão Boot mais nova.[6]
- Imagens candidatas: `docker.io/library/maven:3.9.11-eclipse-temurin-21` e `docker.io/postgis/postgis:17-3.5`; confirmar pull e registrar digest/versão efetiva antes de declarar execução.
- JDBC explícito, Flyway, HTTP JSON, um serviço; sem mensageria/Redis/JPA obrigatórios.
- Integração: banco PostGIS real isolado em contêiner, Surefire e Failsafe; aceitar Podman no harness além de Docker, sem falsificar comando docker nem substituir PostGIS por H2.
- Mapa-base: OSM raster padrão como alternativa sem conta contratada, atribuição visível, solicitações normais do navegador com cache/Referer; sem download em massa ou prefetch. Serviço best-effort sem SLA. Não reaproveitar endpoint Esri da referência sem clareza dos termos.[4] Preservar tema escuro do shell; mapa-base não é dado de ocorrência.

### Direção visual antes da implementação

Preservar cores #09090b (base), #18181b (painéis), #27272a (bordas), #f4f4f5 (texto), #a1a1aa (secundário), #10b981/#6ee7b7 (ação/foco). Geist para texto e Plus Jakarta Sans para títulos/marca; fallback sans-serif se fontes ausentes, preferir fontes locais licenciadas. Sidebar 256 px no desktop; painéis com cantos 13–14 px e conteúdo alinhado à esquerda. Foco é mapa e classificação progressiva, sem painel de métricas decorativo. Controles rotulados, link pular conteúdo, alternativa em lista e confirmação de coordenadas digitáveis. Mobile com módulos acessíveis sem cobrir mapa/formulário. Sem animação automática; respeitar movimento reduzido.

Crítica do plano contra o pedido: escuro/verde e cards são deliberadamente preservados da referência, não redesign genérico. Não copiar o tamanho minúsculo do texto do wireframe; manter legibilidade e áreas clicáveis. Substituir o selo “sem conta” e promessa de publicação imediata pela regra aprovada. Formulário começa pela categoria, mesmo com ordem diferente no nó Figma consultado.

## Verificação exigida

TDD por comportamento: evidência de falha antes da implementação e sucesso depois. Frontend: seleção exclusiva, ocultação progressiva, campos/limpeza de categorias, accordion separado dos filtros, períodos de calendário, uniões sem duplicação, mapa/lista/heatmap consistentes, teclado, carregamento/erro/vazio. Backend: PostGIS real, validação de filtros/coordenadas/campos, hora do fato vs inserção, limites e truncamento, 401/403, isolamento entre clientes, publicação após aprovação, rejeição/retirada, inatividade/revogação. E2E real do cadastro à moderação à consulta. Testes ausentes devem falhar. Verificar 320/360/1280px e zoom 200%; não confundir automação com leitor de tela físico.

Fontes externas são registradas mecanicamente em ledger no scratch; bloco de referências será gerado após o registro completo. Evidências finais ficam no PLAN e documentos de verificação; este documento é o contrato, não uma segunda lista de progresso.

## Estado observado do protótipo inicial — 01/10/2026

Em 01/10/2026 foi implementado o primeiro protótipo Angular, restrito à interface: navegação entre mapa e cadastro, escolha única de categoria antes de revelar o formulário, campos específicos, módulos mutuamente exclusivos com filtros que permanecem ativos, período, camadas de ocorrência/POI, heatmap, lista alternativa e estados demonstrativos. Dados são sintéticos e só vivem no frontend. O worker do MapLibre e o módulo compartilhado são publicados como assets Angular no mesmo diretório; `setWorkerUrl` resolve a URL usando a base atual do documento.

Ainda não foram implementados API, login de Operador, autorização no backend, persistência PostgreSQL/PostGIS, aprovação/moderação nem envio de ocorrência. O botão explicita essa ausência e não transmite dados. O mapa territorial informa indisponibilidade, pois os polígonos/licença não foram validados; a análise está em `docs/maps/territorial-sources.md`.

O build e o teste de ordem da configuração do worker passam; ambos os assets foram confirmados no build e no servidor de desenvolvimento. A execução real do worker/mapa em navegador ainda precisa de smoke test visual/funcional.

O protótipo, portanto, não satisfaz o aceite full-stack P1.1 acima. A continuação precisa conectar API e banco com os gates de autenticação e moderação descritos neste contrato antes de habilitar qualquer escrita.

## Adendo de execução F0 frontend-only — 10/10/2026

O incremento demonstrativo aprovado depois desta etapa acrescentou visões locais de histórico, informes ativos, dashboard e fontes; comparação de séries, reprodução temporal, filtros salvos, triagem manual e exportação XLSX. Os dados continuam fictícios ou importados manualmente em memória nesta aba. Estatísticas agregadas não são convertidas em pontos, clippings guardam apenas referências e nenhum endpoint/API ou credencial externa foi criado.

O painel redundante “Data, horário e raio personalizados” foi removido: datas personalizadas e faixa de horário foram mantidas sob o filtro por período. O raio foi movido para dentro do mapa, com centro selecionável no mapa ou editável por coordenadas, início em 100 m, passos de 100 m e limite de 5.000 m. A visualização usa polígono local `#C4B5FD` com preenchimento transparente; a distância ainda é aproximada no cliente e precisa ser validada no PostGIS futuro.

Importação manual: CSV agregado com território/período/indicador/valor/unidade ou GeoJSON FeatureCollection de pontos. A interface exige URL de referência, licença/autorização, data de referência e limitações; valida coordenadas e separa tipos de dado. ISP-RJ, Fogo Cruzado, OTT360, COR-Rio e imprensa aparecem como fontes candidatas, sem conexão automática. “Inform RJO” continua sem identidade/URL confirmada.

Limites: sem backend Java, API, login, persistência no servidor, autorização/moderação real ou atualização de fontes. Saúde de fonte e triagem de clippings são apenas protótipos manuais. Os testes unitários continuam usando mock para configuração de camadas; a matriz E2E separada valida MapLibre/WebGL2 e tiles em navegadores reais. Leitor de tela, aparelhos físicos e desempenho não foram avaliados. Ver resultado atualizado e relação de aderência em `PLAN.md`.

## Revisão final do frontend e evidências de navegador — 10/10/2026

- **Mapa e cadastro:** MapLibre/WebGL2/worker segue primário; sem WebGL2, Leaflet/OSM raster é carregado sob demanda via `apps/web/public/maps/raster-provider.json`. Playwright verificou ambos os caminhos. Smoke test separado no Firefox 157 headless, com WebGL2 desativado, carregou 9 tiles OSM no mapa público e 15 no cadastro, todos HTTP 200; atribuição e `Referer` foram verificados. O clique no mapa de cadastro preencheu `longitude=-43.191547`, `latitude=-22.903350`. O teste da suíte intercepta tiles para repetibilidade.
- **Resultados visíveis:** cada detalhe fica dentro do `<li>` correspondente; o botão alterna abrir/fechar, `aria-expanded` acompanha o estado e há teto de cinco painéis. O botão “Detalhes” está alinhado com o ícone do registro.
- **Raio/período:** raio 100–5.000 m, centro editável, UI clicável no fallback Leaflet; título acessível do grupo. Os cinco presets têm 6 px de espaçamento. E2E cobre slider, teclado, roda, limites e território.
- **Responsividade:** Playwright em Firefox/Chromium cobriu larguras 390 e 320 px, foco/skip-link, teclado e ausência de overflow horizontal. Inspeção visual confirmou o mapa Leaflet raster real preenchido, pontos, controles de zoom e atribuição. Sem leitor de tela/aparelho físico.
- **XLSX:** exportação pt-BR e horário de Brasília; largura/alinhamento, autofiltro, cabeçalho fixo e impressão paisagem. Download passou nos dois navegadores; ZIP/XML validado e planilha conferida no LibreOffice (registro da rodada anterior).
- **Execução:** `bash scripts/verify.sh frontend` passou com lint, 47 testes e build; bundle inicial 439,56 kB (limite 500 kB, sem warnings). MapLibre 1,07 MB/CSS 83,13 kB e Leaflet 149,42 kB/CSS 11,07 kB são chunks sob demanda. `npm run test:e2e -- --workers=1`: 15 passados, 1 ignorado (fallback sem WebGL2 só executa no projeto Firefox). `bash scripts/verify.sh planning`, `bash scripts/verify.sh docs` e `git diff --check` retornaram 0/sem erros.
- **Escopo preservado:** nenhuma API, credencial, backend, banco ou dado real de ocorrência foi acrescentado. O mapa usa provedores públicos sem SLA; revisão de termos, contato e capacidade fica pendente antes da publicação. QA não substitui leitor de tela, hardware móvel ou validação operacional.


## Ajuste cartográfico — 11/10/2026

A base anterior descrita acima foi substituída por Alidade Smooth vetorial/raster para aproximar o visual da referência e conservar estilo/escala entre MapLibre e Leaflet. Recuperação de GPU/estilo permanece ativa. O provedor dispensa autenticação somente em localhost/127.0.0.1; outros hosts exigem domínio autorizado/chave própria. Nenhum serviço foi contratado. CARTO Voyager exato depende de chave própria; nenhuma credencial da referência foi copiada. Diagnóstico e fontes em `docs/maps/compatibility.md`; estado e evidências atuais em `../PLAN.md`.

## Desempenho, raio e massa metropolitana — 11/10/2026

Atualiza o raio demonstrativo para 100–25.000 m, com clique esquerdo redefinindo o centro enquanto o filtro está ligado e arraste alterando só a câmera. 75 ocorrências fictícias (25 por categoria) em nove municípios metropolitanos, com dois POIs separados. Mapa público reaproveitado entre telas, ResizeObserver e atualização por quadro sem envio duplicado. `harness frontend`: lint, 54 testes e build 444,20 kB; matriz E2E completa: 38 passados, zero ignorados. Detalhes, proveniência, limites do desempenho e análise de Google Maps em [mapas-desempenho-google.md](../../maps/performance-google.md). Nenhuma fase de backend/banco ou migração de provedor foi iniciada.

## Atualização frontend — referência visual, pins e dispersão (11/10/2026)

Início do raio passa a 1.000 m; mínimo 100 m, máximo 25.000 m e passos de 100 m mantidos. Intervalo em uma coluna responsiva. Segurança conserva todas as 25 posições, enquanto Trânsito/Contingência são dispersos deterministicamente em recortes urbanos em terra, com separação mínima de 900 m. MapLibre usa estilo Bright local personalizado, Leaflet usa Bright raster e reaproveita pins/círculo. Pins verde/carro, vermelho/pistola, amarelo/exclamação, borda preta e círculo branco nas duas engines. Fontes, licenças, trade-offs, medições e evidências atuais em [mapas-referencia-visual.md](../../maps/visual-reference.md) e [PLAN.md](../../../PLAN.md). Nenhuma API, persistência ou publicação foi iniciada.
