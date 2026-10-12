# Escopo — proposta da Fase 0

Revisão: 11/10/2026. **Há um protótipo frontend demonstrativo, sem backend ou persistência.** Fonte dos requisitos originais: `docs/references/initial-context.md`; nenhum RF/RNF original foi substituído ou renumerado. A direção de produto de 06/10 permanece proposta nos demais pontos, mas a ordem agora aprovada é concluir primeiro a demonstração frontend, sem banco/API/alertas; após a validação do frontend, iniciar a fase de banco e API. A visualização mantém MapLibre e fallback Leaflet. Ajuste autorizado em 11/10/2026: base Bright vetorial personalizada/raster para aproximar a paleta solicitada e o visual da referência, com autenticação dispensada pelo provedor somente em localhost/127.0.0.1; detalhes atuais em `docs/maps/visual-reference.md`; histórico em `docs/maps/compatibility.md`. O responsável autorizou o uso demonstrativo dos polígonos e informou possuir autorização; isso não aprova publicação externa, alertas operacionais, dados reais de ocorrências ou demais pontos de escopo em aberto.

## Alternativa visual 02 autorizada em 11/10/2026

Neste repositório, o responsável autorizou uma atualização de UI/UX inspirada na nova imagem, mantendo as funções demonstrativas. Tema claro, navegação horizontal, Newsreader, Manrope (alternativa gratuita à Mori aprovada após esclarecimento) e GSAP; detalhes em [visual-v2.md](visual-v2.md). Não altera IDs RF/RNF, cobertura operacional ou os gates full-stack. O código será enviado a `marciocoelho1/vetor-urbano-v2` para comparação; a escolha do visual definitivo permanece aberta.

## Direção candidata para a versão 1.0 — proposta de 06/10/2026

| Proposta | Avaliação | Condição / questão em aberto |
|---|---|---|
| Somente Operadores cadastrariam ocorrências; usuário comum apenas consulta | Válida e alinhada à redução de abuso; cadastro comunitário fica fora da 1.0 | Definir se consulta comum exige conta ou será anônima. Cadastro de Operador nunca será uma rota pública de autoinscrição. |
| Criar backend Java e banco PostgreSQL | Essencial para persistência e funcionamento real; PostGIS é recomendado para consultas espaciais | Sequência aprovada em 10/10: concluir e validar primeiro o frontend demonstrativo sem banco/API; depois definir contrato/migrações e iniciar a fase PostgreSQL/PostGIS com teste integrado real. |
| Perfis Admin/dev, Gestor, Operador e Usuário comum | RBAC é válido, com autorização obrigatória no backend | Tratar “dev” como acesso operacional de desenvolvimento, não perfil cotidiano de produção. Separar administrador técnico de Gestor de negócio; acesso privilegiado mínimo, auditado e protegido. MFA para Gestor; decidir se qualquer administrador de produção também exigirá MFA. Definir se o Operador/gestor pode aprovar o próprio cadastro ou se há separação de funções. |
| Gestor cadastra “filtros” | Indefinido | Especificar se cria filtros salvos pessoais, filtros compartilhados, catálogos ou regras globais; quem edita/remove e como afeta usuários. Até decidir, oferecer filtros de consulta locais, sem tela administrativa de filtros. |
| Migrar de MapLibre para Google Maps | Não adotada nesta demonstração; manter MapLibre e aprimorar o estilo cartográfico baseado em OpenStreetMap | Reabrir somente com prova comparativa e aprovação de chave, faturamento/limites e termos; a lista deve continuar disponível sem mapa. |
| Exibir polígonos territoriais | Permitido na demonstração local após autorização informada pelo responsável do projeto | Atribuir à fonte e data-base, sem alegar verificação oficial ou risco atual. Antes de uso operacional/publicação, revisar validade topológica, atualização, cobertura, precisão, comunicação e segurança. |
| Personalizar pins | Válido e de baixo risco quando os dados do mapa estiverem definidos | Desenhar por categoria/severidade com rótulo/ícone além de cor, legenda acessível, densidade e interação testadas; não antecipar design final antes de validar os tipos de dados. |

Esta direção substitui como hipótese de planejamento a suposição anterior de cadastro anônimo/comunitário. Ela ainda não fecha as regras de consulta, filtros de Gestor, moderação ou administração técnica. A ordem de implementação fica em `PLAN.md` para manter um único roadmap.

## 1. Problema, restrições e recorte recomendado

O Vetor Urbano pretende permitir explorar ocorrências por localização, categoria e tempo. A inspiração GeoAnalytics descreve combinação de fontes, filtros geográficos/temporais, exportação e BI; isso não equivale a um serviço comunitário de alertas.[1] RF03 e RF04 acrescentam outro problema: detectar movimento, avisar pessoas e tratar contribuições conflitantes. **Recomendação: validar primeiro consulta e análise, sem promessa de proteção, emergência ou informação em tempo real.**

**Requisitos originais:** Angular + SCSS, Java, PostgreSQL; identidade visual dos anexos; cidade do Rio de Janeiro e Baixada Fluminense; demonstração com dados fictícios; MFA obrigatório quando existir acesso Gestor. A lista exata dos municípios não foi fornecida. Em 11/10/2026, foi autorizada a distribuição de fixtures na Região Metropolitana: a demo usa nove municípios, incluindo Niterói/São Gonçalo, sem redefinir cobertura operacional nem os requisitos originais. Recorte/proveniência em `docs/maps/performance-google.md`.

**Proposto, não aprovado:** MVP = marco P1, consulta anônima em demonstração local; um serviço Spring Boot com PostGIS; escrita apenas por carga sintética controlada, fora da API. Não publicar na internet nesta etapa. “Público” descreve a ausência de login e os campos permitidos, não uma autorização de hospedagem.

### Dentro do MVP P1

- P1.1: ocorrência sintética persistida → API de leitura → marcador e lista acessível; aviso permanente **“Demonstração — dados fictícios, não usar para decisões de segurança”**.
- P1.2: filtros combinados por categoria e período sobre o mesmo conjunto no mapa/lista.
- P1.3: centro escolhido no mapa ou digitado, raio em metros e testes espaciais reais.
- Estados de carregamento, vazio, erro e indisponibilidade do mapa; lista permanece utilizável quando apenas o mapa-base falhar.
- Privacidade na modelagem, resposta pública mínima, limites de consulta e evidências de teste.

### Fora do MVP, sem descarte dos requisitos

Contas, cadastro, moderação e gestão de operadores (P2); heatmap semântico avançado (P3); votos/relevância, alertas/push/geofencing, fluxos contínuos, alta disponibilidade e escala (pesquisa P4). Dados reais de ocorrências, exportação Excel, BI e publicação externa não estão autorizados. Os polígonos territoriais foram autorizados para a demonstração local com atribuição à fonte; não são dados operacionais verificados nem base para alertas. Exportação/BI são inspiração de produto, ainda não requisitos próprios aprovados.

**Território:** P1.1 pode usar pontos sintéticos de demonstração no Rio, sem alegar cobertura da Baixada ou representar ocorrências reais. Não inferir pertencimento municipal por retângulo visual. Antes de validar cobertura: aprovar lista de municípios, identificadores e fonte/licença/data dos limites. A ausência dessa lista não impede a demonstração técnica, mas impede declarar cobertura territorial completa.

## 2. Perfis e responsabilidades propostas

| Perfil | P1 | Evolução proposta P2 |
|---|---|---|
| Visitante anônimo | Consultar apenas dados demonstrativos aprovados | Consulta pública, se aprovada |
| Usuário autenticado (RF05) | Sem conta ou fluxo próprio | Consulta; cadastro comunitário/votos dependem de decisão posterior |
| Operador | Sem acesso implementado | Cadastrar e moderar; sem administrar permissões |
| Gestor | Sem acesso implementado | Moderar e gerir operadores; MFA obrigatório desde a introdução do perfil |

A consulta anônima é hipótese adicional ao RF05, não uma permissão presumida do texto original. Inicialmente, recomenda-se restringir cadastro a Operador/Gestor; abrir cadastro comunitário altera risco de abuso, privacidade e escopo. Controles visuais não substituem autorização no backend. A fila é exclusiva de Operador/Gestor, conforme RF07.

## 3. Rastreabilidade integral

“Primeira versão” significa compromisso proposto para P1, não capacidade entregue. Requisitos parciais permanecem abertos até completar todas as suas partes.

| ID original | Exigência preservada (resumo) | Classificação / destino | Motivo e evidência futura |
|---|---|---|---|
| RF01 | Cadastro com coordenadas, data/hora, categoria e severidade | Evolução posterior — P2 | Exige identidade, autorização e moderação; carga sintética de P1 **não atende cadastro**. Testar validação e escrita protegida. |
| RF02 | Mapa, marcadores, heatmap, raio, faixa de horário e tipo | Primeira versão **parcial** — P1; heatmap P3 | P1 cobre leitura/filtros/raio; heatmap precisa de semântica. Testar igualdade dos conjuntos mapa/lista e fronteiras dos filtros. |
| RF03 | Push em tempo real ao entrar em perímetro ativo de risco | Pesquisa necessária — P4 | Plataforma, permissões, atraso, bateria e definição de perímetro ainda abertos; não prometer funcionamento web em segundo plano. |
| RF04 | Votos “Ainda acontecendo”, “Via liberada”, “Informação incorreta”; recalcular relevância | Evolução posterior — P4 | Definir elegibilidade, votos repetidos, abuso, expiração e conflito com moderação antes de codificar. |
| RF05 | Autenticar e carregar interface/permissões de Gestor, Operador, Usuário | Evolução posterior — P2 | Acompanhar abertura de escrita; testar matriz no backend, inclusive acesso direto à API. |
| RF06 | Gestor cria, ativa, inativa e redefine permissões de Operadores | Evolução posterior — P2 | Revogar sessões ao inativar/reduzir permissões; testes de acesso após a mudança. |
| RF07 | Fila exclusiva para Operador/Gestor | Evolução posterior — P2 | Estados propostos desde P0; testar transições e impedimento de leitura/escrita por demais perfis. |
| RNF01 | Marcadores iniciais e consultas até 5 km em até **1,5 s em 4G** | Pesquisa necessária — medir em P1 | Rede, volume, dispositivo e percentil não definidos. Separar API, tiles e tempo até resultado visível; ver seção 6. |
| RNF02 | Não expor identidade, telefone, residência exata; denúncias criminais desacopladas de identificadores pessoais | Primeira versão — salvaguardas P1; aprofundar P2 | DTO público sem autoria; apenas dados sintéticos. Rever vínculo, logs, retenção e risco de reidentificação antes de dados reais. Não declarar anonimização/conformidade por esconder nomes. |
| RNF03 | Alertas críticos com **99,9%** de disponibilidade e tolerância a falhas em picos | Pesquisa necessária — P4 | Não há serviço de alertas ou ambiente operacional. Definir janela, SLI, indisponibilidade e falhas antes de prometer SLA. |
| RNF04 | WebSockets/SSE para **20.000 conexões ativas**, sem degradação de entrega | Pesquisa necessária — P4 | Definir frequência/tamanho das mensagens, duração, fan-out, percentis e falhas. O título “mensageria” não justifica implantar broker agora. |
| RNF05 | Pelo menos **30 fps** estáveis em pan/zoom móvel | Pesquisa necessária — medir em P1 | Depende de aparelho, GPU, navegador, pontos e estilo. Emulação de tela não demonstra desempenho em aparelho real. |
| RNF06 | Senhas com salt e derivação adequada, como Argon2id/Bcrypt | Evolução posterior — P2 | Obrigatório antes de armazenar credenciais; escolher parâmetros medidos. Nenhuma senha real em fixtures ou logs. |
| RNF07 | Tokens; no máximo **1 hora de inatividade**; revogação imediata de Gestor/Operador | Evolução posterior — P2 | Comparação de token opaco e JWT em `arquitetura.md`; testar limite de inatividade e próxima requisição após revogação. |
| RNF08 | MFA obrigatório para Gestor, app autenticador ou SMS | Evolução posterior — P2 | Não introduzir painel Gestor com exceção temporária. Proposta: app autenticador e recuperação; custos de SMS não assumidos. |

**Funcionalidades sem ID original:** “Mancha Térmica” integra a parte de heatmap do RF02 (P3). A camada de áreas territoriais está agora disponível na demonstração local com data-base e atribuição à fonte; não constitui um requisito aprovado de risco atual ou alerta.

Atualização autorizada em 11/10/2026: pins verde/carro, vermelho/pistola e amarelo/exclamação; intervalo responsivo; coordenadas de Segurança preservadas e Trânsito/Contingência dispersos em recortes urbanos em terra. São fixtures locais; não redefine municípios/limites operacionais. Proveniência e critérios em `docs/maps/visual-reference.md`.

## 4. Regras propostas — todas com status “a validar”

| ID próprio | Regra proposta | Status |
|---|---|---|
| RN-P01 | P1 permite somente leitura anônima e dados sintéticos; nenhuma rota pública de escrita. A carga de demonstração é local e separada das migrações de estrutura. | a validar |
| RN-P02 | No primeiro cadastro P2, apenas Operador/Gestor enviam ocorrências; submissão inicia como PENDENTE. Usuário comum não cadastra até decisão específica. | a validar |
| RN-P03 | Estados de moderação: PENDENTE → APROVADA ou REJEITADA; APROVADA → RETIRADA. Somente Operador/Gestor moderam. Rejeitar/retirar exige motivo restrito; correção gera nova submissão pendente. REJEITADA/RETIRADA não retornam automaticamente ao mapa. | a validar |
| RN-P04 | A API pública seleciona apenas APROVADA e projeta somente campos públicos. P1 exige ainda origem SINTETICA. O seed aprovado é curadoria técnica da demonstração, não atalho para publicação de denúncias. | a validar |
| RN-P05 | Categoria = tipo (FURTO, TIROTEIO, COLISAO_VIARIA, ALAGAMENTO); severidade = intensidade (BAIXA, MODERADA, ALTA, CRITICA), com rubrica ainda a definir; status = decisão de moderação. APROVADA não significa “ainda acontecendo” nem certifica veracidade. | a validar |
| RN-P06 | Público: ID da ocorrência, categoria, severidade, instante, posição pública e marca de demonstração. Restrito: motivos/auditoria, eventual posição sensível e quaisquer dados de conta. Nenhum nome, telefone, residência, ID de autor ou texto livre no retorno de P1. | a validar |
| RN-P07 | Localização da ocorrência não é localização de quem informa. Não coletar localização de denunciante em P1. Para denúncias criminais futuras, não gravar FK de autoria na ocorrência; avaliar também correlação por logs e horários. Vínculo pseudônimo separado ainda não equivale a anonimização. | a validar |
| RN-P08 | Coordenadas públicas em GeoJSON `[longitude, latitude]`, SRID 4326; longitude entre -180 e 180, latitude entre -90 e 90, ambas finitas. Filtro por raio usa a posição pública, não uma posição restrita oculta. | a validar |
| RN-P09 | P1.3: centro explícito por clique ou coordenadas; não assumir localização atual nem centro móvel da câmera. Demonstração frontend autorizada em 11/10/2026: início em 1.000 m, faixa 100–25.000 m em passos de 100 m e centro inicial na Central do Brasil; clique esquerdo redefine o centro somente com o filtro ligado, arraste move apenas a câmera. Para o futuro contrato P1.3, propor o mesmo teto de 25.000 m; distância geodésica, limite inclusivo (distância ≤ raio), não distância por ruas. Mover/arrastar mapa não muda o centro da busca; clique com raio ligado aplica imediatamente na demonstração. | a validar |
| RN-P10 | P1.2: período de ocorrência `[inicio, fim)`, início inclusivo/fim exclusivo e início anterior ao fim. API recebe instantes com offset e responde em UTC; exibição/entrada civil usa America/Sao_Paulo. Dia escolhido vira início desse dia até início do seguinte no fuso, sem fim artificial 23:59:59. | a validar |
| RN-P11 | “Faixa de horário” será inicialmente intervalo contínuo de instantes. Recorrência diária, como 18h–22h em vários dias, exige confirmação e não será silenciosamente declarada atendida. Combinar categoria, período e raio por AND. | a validar |
| RN-P12 | Mapa e lista usam exatamente o mesmo resultado; informar truncamento. P3 propõe heatmap por contagem, não ponderado por severidade; isso exige aprovação e legenda, sem chamar densidade de “risco comprovado”. | a validar |
| RN-P13 | Contas inativas e permissões revogadas perdem acesso na próxima requisição protegida. Gestor exige MFA; expiração de inatividade é verificada pelo servidor e não fica mantida por polling automático. | a validar |
| RN-P14 | Nova fonte externa só entra após origem, licença, data de extração/atualização, finalidade, precisão e limitações documentadas. Polígonos exigem também revisão de rótulos e contestação; não inferir controle criminal ou risco atual. | a validar |

**Privacidade pendente antes de dados reais:** finalidade/base de tratamento, retenção e descarte de cada classe, acesso/auditoria, necessidade de precisão, pedidos dos titulares e avaliação competente. Esta Fase 0 é desenho técnico, não parecer jurídico nem comprovação de LGPD. P1 evita dados pessoais em vez de alegar que os anonimizou.

## 5. Aceites propostos por entrega

- **CA01 / P1.1:** banco PostgreSQL/PostGIS real semeado; API retorna a ocorrência aprovada e a interface a mostra no mapa e em lista. Reiniciar API preserva o registro. Nenhum array fixo no frontend substitui persistência.
- **CA02 / P1.1:** aviso de demonstração permanente; retorno sem autoria; cenários de teste com PENDENTE/REJEITADA/RETIRADA não vazam. Não existe endpoint de submissão.
- **CA03 / P1.1:** testar carregamento, sucesso, vazio, erro HTTP e falha do mapa-base separadamente; lista funciona sem WebGL/tiles; botão de nova tentativa e mensagens compreensíveis.
- **CA04 / P1.1:** percurso por teclado, foco visível, acesso direto à lista, rótulos textuais além das cores; verificar 320, 360 e 1280 px, zoom do navegador de 200% e ausência de sobreposição da atribuição. Isso é aceite inicial, não certificação completa de acessibilidade.
- **CA05 / P1.2:** filtros categoria/período combinados, início incluído/fim excluído, offset tratado corretamente, entrada inválida rejeitada e truncamento exposto.
- **CA06 / P1.3:** inclusão exatamente no raio, exclusão fora, centro explícito, limites de coordenadas e raio; testes no PostGIS, inclusive construção geodésica da fronteira, sem confundir graus com metros.
- **CA07 / P1:** lint, testes sem watch e build reais; testes esperados ausentes devem falhar; relatórios unitários e de integração. `scripts/verify.sh all` não substitui o roteiro manual/E2E CA01–CA06.
- **CA08 / P1.3:** registrar ensaios de desempenho segundo seção 6, sem declarar metas originais satisfeitas por medição local diferente.

## 6. Metas originais e primeiro protocolo de medição

Nenhuma medição de aplicação foi realizada em P0. Os números abaixo são **cenários/limiares propostos**, não resultados e não alterações já aprovadas dos RNF.

| Meta preservada | Primeiro cenário proposto | Critério/evidência |
|---|---|---|
| RNF01: ≤1,5 s em 4G, raio ≤5 km | P1.3: 10.000 pontos sintéticos no banco, até 200 exibidos; perfil explícito de laboratório 10 Mbps download, 2 Mbps upload, RTT 80 ms; dispositivo/navegador a registrar; 30 repetições frias e aquecidas separadas | Medir navegação → marcadores/lista utilizáveis e confirmação do filtro → resultado atualizado. Proposta de p95 ≤1,5 s precisa de aprovação: o texto original não define percentil e um p95 não demonstra um máximo absoluto. Tiles entram no tempo inicial e são reportados separadamente. Não rotular simulação como “toda rede 4G”. |
| Diagnóstico local adicional, não substitui RNF01 | Mesmos dados; API local, 20 clientes concorrentes por 5 minutos após aquecimento; hardware registrado | Orçamento proposto p95 ≤500 ms para consulta, sem erros inesperados. Guardar distribuição, volume retornado e plano de consulta; não alegar suporte a 20.000 conexões. |
| RNF05: ≥30 fps estáveis | P1.3: aparelho móvel físico identificado; estilo e até 200 marcadores fixos; 3 percursos reproduzíveis de pan/zoom de 30 segundos | Registrar FPS por janela de 1 segundo e quadros lentos, após carregamento. Qualquer janela abaixo de 30 fps reprova este ensaio; média isolada não basta. Sem aparelho, manter a meta não verificada. |
| RNF03: 99,9% de disponibilidade | Futuro serviço de alertas: propor janela mensal, sondas externas e definição de sucesso ponta a ponta | Definir denominador, intervalos sem amostra e manutenção; observar falhas e recuperação. Build local ou serviço único não demonstra disponibilidade operacional. |
| RNF04: 20.000 conexões sem degradação | Futuro ensaio dedicado: conexões autenticadas, frequência/tamanho e destinatários de mensagens definidos, carga sustentada e reconexão | Comparar p95/p99 de entrega, perda/duplicação e recursos com baseline aprovado. “Sem degradação” ainda não possui margem mensurável; não comprar infraestrutura antes desse desenho. |

## 7. Pesquisa de alertas e polígonos

- **Atualização da página:** GET manual é suficiente em P1; polling, SSE e WebSocket seriam atualizações de uma sessão conectada, não detecção de entrada em perímetro.
- **Push:** entrega pode ativar um service worker, mas requer inscrição/permissão; não fornece por si só posição ou prova de cruzamento de fronteira.[8] No iOS/iPadOS, a documentação do WebKit descreve Web Push para web apps adicionados à tela inicial, com permissão solicitada após ação direta do usuário.[9]
- **Geolocalização web:** a especificação expõe Geolocation em Window/contexto seguro; solicitações dependem de permissão, documento ativo e visível. Portanto, inferimos que uma PWA não oferece a garantia de vigilância contínua em segundo plano exigida por RF03.[2]
- **Geofencing nativo:** Android possui API própria, mas exige permissões, tem limite de geofences e pode entregar eventos com atraso de minutos em segundo plano.[3] Isso já impede assumir “tempo real” estrito; iOS nativo ainda precisa de pesquisa própria. Não há decisão de criar aplicativo nativo ou híbrido.
- **Próxima pesquisa RF03:** matriz navegador/OS versus app nativo, permissões/revogação, bateria, precisão, atraso e teste físico de entrada/saída. Definir quem configura perímetro, duração de atividade, consentimento e o que acontece sem localização/rede. Push, atualização de tela e detecção são três capacidades separadas.
- **Polígonos:** o suposto arquivo “XML” não foi entregue; URL, formato espacial, licença, data, autoria e confiabilidade são desconhecidos. Não presumir que XML significa KML ou que acesso público permite reutilização. Sem fonte verificável, não ingerir nem exibir territórios atribuídos a grupos. A visualização futura deverá atribuir alegações à fonte, com data/limitações, não legitimá-las como fato atual.

## 8. Dúvidas e gate de revisão

**D1 — Recorte e permissões:** proposta de aprovar P1 local, anônimo e somente sintético, deixando cadastro Operador/Gestor e segurança para P2. Consequência: comprova leitura/análise, não colaboração nem operação real. Cadastro comunitário continua aberto.

**D2 — Território:** falta a lista dos municípios da Baixada e seus limites. Proposta reversível: P1.1 demonstra apenas pontos no Rio e mantém cobertura da Baixada pendente. Consequência: avança o aprendizado sem afirmar cobertura não validada.

**Demais pendências, sem bloquear estes documentos:** interpretação da faixa de horário; rubrica de severidade; aprovação dos estados/campos públicos; mapa-base/atribuição/licença; versões; política de retenção; provedor MFA; ensaios físicos; fontes territoriais e plataforma dos alertas. Contrato e estados são propostas, ainda não aprovadas. Ver `PLAN.md` para o único detalhamento do próximo incremento.

## Sources

[1] https://portalumais.com.br/geoanalytics
[2] https://www.w3.org/TR/geolocation
[3] https://developer.android.com/develop/sensors-and-location/location/geofencing
[8] https://www.w3.org/TR/push-api
[9] https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados
## Reconciliação do legado — 11/10/2026

A consolidação preserva `docs/archive/specifications/requirements-v1.md` e seus IDs próprios como histórico da antiga `main`. Seus RF/RNF não são a numeração dos requisitos originais em `docs/references/initial-context.md`; não renumerar nem juntar os dois conjuntos silenciosamente. Cadastro sem conta/publicação de `REPORTED` e seis categorias do legado divergem da direção frontend-only e dos contratos ainda em revisão. Essa reconciliação permanece no gate R0, sem alterar comportamento ou liberar escrita nesta entrega. Ver [relatório](../history/branch-consolidation-2026-10.md).
