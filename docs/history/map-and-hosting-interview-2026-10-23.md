# Entrevista — mapa e hospedagem — 23/10/2026

Estado: **grill de produto encerrado por confirmação do responsável após Q1–Q38**. Autorizada consolidação local de especificação, critérios e lotes; pendências operacionais adiadas à preparação da hospedagem antes dos convidados. Sem autorização de implementação, publicação de issues, commit, merge, push ou implantação. Complementa a [auditoria](repository-audit-2026-10-23.md). Preserva IDs/critérios existentes; [adendo consolidado](../product/ui-ux-pilot-specification.md) e [tickets/lotes propostos](../product/ui-ux-pilot-plan.md).

## Decisões confirmadas — rodada Q1–Q5

- **Q1:** primeira hospedagem será piloto restrito ao responsável e convidados, não abertura pública de cadastro.
- **Q2:** estabilizar candidato/documentos primeiro; refinar mapa depois; preparar implantação integrada em seguida. Merge exige validação e autorização próprias.
- **Q3:** manter a função de recorte por área visível, mas alterar nome/apresentação para UX/UI mais limpa, direta e concisa. Não desligar Áreas de Risco. Gatilho e atualização foram confirmados em Q7, abaixo; a posição foi revista em Q6.
- **Q4:** centro por local usa ponto representativo dentro do território escolhido, não necessariamente centroide geométrico. Controle de raio em contêiner independente no lado esquerdo, acima do contêiner de filtros, não no meio do mapa.
- **Q5:** gratuidade é preferência para o piloto, sem cobrança automática e sem promessa de disponibilidade contínua ou gratuidade permanente. Provedor ainda não escolhido.

## Direção de layout proposta pelo responsável

A proposta atual mantém os filtros no contêiner dentro do mapa à esquerda e elimina a duplicidade. O bloco de ferramentas acima dos filtros reúne raio personalizado, mapa de calor, «Buscar nesta área» e Áreas de Risco (Q17). Painel externo direito destinado aos resultados e ao resumo ativo (opção 01). No móvel, preservar o mapa e recolher menus atrás de botões com ícones/rótulos, conforme referência Waze de Q15, abrindo um painel inferior por vez segundo Q19.

## Fatos de código consultados

- `apps/web/src/app/app.html`: filtro sobreposto em `map-filter-panel`; raio em `map-top-controls`, com entrada por coordenadas; sidebar independente em `consultation-sidebar`.
- `apps/web/src/app/data/persisted-query.ts`: ativação da consulta persistida restrita ao loopback com `consulta=api`. Hospedagem exige configuração de integração remota, não só publicação estática.

## Rodada Q6–Q10 — decisões e revisão de proposta

- **Q6:** testar viabilidade de mapa de calor e «Buscar nesta área» no mesmo bloco do raio personalizado, acima do painel de filtros; não fixar na lateral direita.
- **Q7:** aprovado «Buscar nesta área», ação explícita, aviso «Área do mapa alterada» após navegação e reaplicação manual; lista identifica resultados da área selecionada. Camada territorial preservada.
- **Q8:** aprovado combinar raio, área selecionada e demais filtros por interseção; vazio explicado, com remoção explícita de restrições, sem apagá-las silenciosamente.
- **Q9:** aprovado ampliar altura útil e deslocar elementos secundários; retirar blocos de filtros acima do mapa e estender mapa para cima. Estados relevantes, atribuições e acesso à informação continuam necessários.
- **Q10:** responsável solicitou cinco alternativas visuais fora dos commits do projeto; escolha concluída em Q11: opção 01, acima da lista de resultados.

## Ideias novas do responsável — adicionadas ao grill, detalhes pendentes

- Modernizar blocos/contêineres: linguagem natural, moderna, direta e profissional, evitando aparência genérica de interface gerada. Exploração usa identidade existente, Manrope, superfícies sóbrias e hierarquia com menos caixas.
- Corrigir sobreposição na topbar durante redimensionamento. Inspeção confirma navegação, ações de conta, modo e tema na mesma barra; causa de CSS e breakpoints ainda não diagnosticados.
- Criar «Configurações» exclusivo do Administrador e mover telas inteiras de Fontes/Logs administrativos (escopo confirmado em Q12). `AdminSourcesPanels` reúne operação, fontes, coleta, revisão, confiabilidade, ocorrências e Áreas de Risco; todos os subpainéis da tela atual de Fontes passam a «Gestão de Fontes», sem desmembramento nesta mudança. Fontes públicas têm view separada e acesso pelo rodapé; a mudança administrativa não elimina essa leitura pública.
- Corrigir responsividade da lista «Resultados visíveis» para acessar todas as ocorrências. Não confundir problema de altura/rolagem com autorização para truncar ou reduzir o recorte; diagnóstico na aplicação ainda pendente.
- Ampliar destaque/tamanho de «Mais informações abaixo». Em Q18 foi aprovado o texto «Ver resumo da consulta», preservando destino `#consultation-overview`, com transição/animação apropriada. A redação exploratória anterior fica superada.

## Estudo independente — não incluir no commit do Vetor Urbano

Diretório externo: `/home/marciocoelho/Documentos/VetorUrbano-estudos/`.
Arquivo: `filtros-ativos-v1.html`, com cinco alternativas selecionáveis: resumo na lista de resultados, rodapé do mapa, dentro do painel de filtros, inspetor flutuante à direita e gaveta do painel de resultados. Alternativa 01 escolhida pelo responsável em Q11; as outras ficam como exploração histórica.

Protótipo HTML autônomo com fonte Manrope/licença incorporadas, dados fictícios e mapa explicitamente esquemático. Mesma composição-base e controles em todas as variantes. Não usa geocodificador, serviços externos ou dados reais; navegação/campos de filtro são ilustrativos. Exibe Configurações apenas como hipótese visual de uma sessão Admin, não como autorização implementada.

Verificado em Chromium via Playwright: cinco variantes nas larguras 1440/1024/768/390, sem overflow horizontal, com resumo visível e lista rolável. Remover/restaurar etiquetas, alternar calor, expandir raio, abrir/fechar gaveta por Escape e ação de área preservando a seleção territorial passaram; nenhum erro de JavaScript. Capturas desktop/móvel inspecionadas. O bloco compartilhado cabe na composição explorada; no móvel os painéis ocupam porção expressiva do mapa, exigindo decisão sobre recolhimento. Não comprova viabilidade final no Angular ou ausência de sobreposição na topbar real. Auditoria visual: sem gradientes, blur, grade decorativa ou hierarquia de marketing; preserva superfície de exploração.

## Rodada Q11–Q13 — decisões confirmadas

- **Q11:** escolhida opção 01: filtros ativos no painel direito acima da lista. Limite de altura, expansão e apresentação móvel ainda a definir.
- **Q12:** mover a tela inteira de Fontes e a tela inteira de Logs para Configurações, exclusivo de Administrador. A recomendação anterior de separar os fluxos operacionais não foi escolhida. Configurações terá somente duas entradas de navegação: **Gestão de Fontes** e **Logs Administrativos**. Gestão de Fontes conserva todos os fluxos da tela atual; não criar abas irmãs para cada subpainel.
- **Referência visual de Q12:** imagem anexada inspecionada (`image_c13ec9.png`). Padrão de página dedicada, navegação lateral esquerda, item selecionado destacado e conteúdo da seção à direita, com ação «Voltar ao aplicativo». Adotar esse padrão sem importar Geral, Aparência, Conta ou quaisquer outras abas da referência. Não inferir que a imagem exige tema exclusivamente preto; preservar claro/escuro conforme Q13.
- **Q13:** aprovada direção visual do estudo: Manrope, verde da identidade, bordas finas, cantos discretos, menos caixas, hierarquia por tipografia/espaçamento, sem gradientes ou efeitos decorativos gratuitos; preservar contraste e temas claro/escuro.
- A reorganização de menu não substitui autorização no servidor, sessão ou MFA existentes. Entrada e conteúdo administrativo continuam inacessíveis ao Usuário comum; Fontes públicas permanecem leitura separada.

## Rodada Q14–Q18 — decisões confirmadas

- **Q14:** navegação horizontal enquanto couber; recolher módulos em «Menu» antes de sobreposição, mantendo identificação da tela atual. Conta/modo/tema continuam acessíveis no formato compacto.
- **Q15:** aprovada alternância Mapa/Resultados no móvel, preservando estado, com mapa predominante e menus recolhidos acessíveis por botões de ícones. Responsável acrescentou Waze como referência; imagem `image_4435c8.png` inspecionada: mapa amplo, controles flutuantes e faixa inferior compacta. A imagem estática não demonstra gestos, alturas intermediárias ou animações; esses detalhes não foram presumidos. Não adicionar navegação de rotas, velocidade ou compartilhamento de localização por essa referência.
- **Q16:** resumo de filtros limitado a duas linhas, com «Ver todos os filtros» e «Recolher», remoção por etiqueta e limpeza; lista mantém rolagem e recorte integral.
- **Q17:** Áreas de Risco no bloco de ferramentas, junto de raio/calor/busca por área, fora dos critérios da consulta. Ativação territorial independente preservada.
- **Q18:** aprovado «Ver resumo da consulta», maior e com contraste/seta; responsável pediu transições/animações também em outros pontos viáveis dentro do escopo do Vetor Urbano. Não implica implementar durante a entrevista.

## Referências de movimento e diretrizes de aplicação

Referências indicadas pelo responsável: [bencho.dev](https://bencho.dev/), [60fps.design](https://60fps.design/), [supahero.io](https://supahero.io/) e [navbar.gallery](https://www.navbar.gallery/). Usar como inspiração, não autorização automática para copiar código, importar bibliotecas, acrescentar custos ou alterar a identidade.

O material fornecido reúne microinterações, navegação e heróis de páginas. Para a superfície cartográfica priorizar continuidade e orientação, não composição publicitária. Os textos de [collapsing-sidebar](https://bencho.dev/blocks/collapsing-sidebar) e [faq-accordion](https://bencho.dev/blocks/faq-accordion) foram consultados: recolhimento para ícones e expansão de conteúdo são referências pertinentes. Vídeos/demonstrações animadas dessas galerias não foram avaliados nesta rodada.

Diretrizes técnicas propostas para a implementação futura:

- Reutilizar CSS e infraestrutura existente: `apps/web/src/app/ui/view-motion.ts` já carrega GSAP opcionalmente, respeita `prefers-reduced-motion` e não bloqueia conteúdo em falha de carregamento; tema também tem View Transitions. Não adicionar React para usar exemplos da galeria.
- Aplicar movimento curto e funcional em abertura/recolhimento de painéis, troca de seções, expansão do resumo e feedback de botões. Na chamada inferior, rolagem orientada ao destino e destaque breve da seção, com gestão de foco adequada.
- Não usar saltos contínuos, confetes, parallax no mapa, letras surgindo em cascata, cursores magnéticos ou atrasos que prejudiquem leitura/consulta. Evitar animação de cada ocorrência ao atualizar a lista ou durante pan/zoom.
- Preferir transform/opacidade, preservar teclado/foco, estados de erro/carga/vazio, acesso por toque e alternativa estática com movimento reduzido. Gestos, caso adotados, terão botões equivalentes.

## Rodada Q19–Q21 — decisões confirmadas

- **Q19:** móvel com três acessos compactos **Filtros**, **Ferramentas** e **Resultados**, ícones e rótulos curtos. Cada um abre painel inferior, apenas um por vez. Resultados pode ocupar quase toda a altura; ao fechar, preservar câmera, critérios e seleção. Botão explícito para fechar; gesto não obrigatório.
- **Q20:** «Voltar ao aplicativo» restaura a tela anterior e o estado da consulta. Ao sair de edição não salva, inclusive trocando entre Gestão de Fontes e Logs Administrativos, confirmar descarte. Sem salvamento automático implícito ou mudança nas confirmações administrativas existentes.
- **Q21:** primeira hospedagem com ocorrências fictícias claramente identificadas sobre API/banco reais. Autenticação, escrita e consulta serão integradas; coleta real permanece desligada nesse ambiente até ativação especificamente autorizada. Não copiar bases reais para o piloto nem confundir conta de teste com autorização para tratar dados pessoais.

## Rodada Q22–Q26 — decisões confirmadas

- **Q22:** catálogo territorial próprio/versionado aprovado, com origem, autorização/licença, data e geometria adequada. Não pressupor geocodificador externo. Cobertura parcial explícita e requisito completo somente com os níveis solicitados.
- **Pendência extrema adicional:** mapeamento de polígonos de municípios e respectivos bairros da RMRJ, e bairros/regiões da cidade do Rio. [Escopo e critérios](../product/territorial-mapping-priority.md). Unidade «região» definida posteriormente em Q28 como Região Administrativa, mantendo Áreas de Planejamento distintas; não reduzir a nomes/retângulos.
- **Q23:** responsável determinou uso das Áreas de Risco locais atuais no piloto hospedado. Substitui a proposta de polígonos inteiramente fictícios. Autorização do responsável para esse destino registrada; não afirmar, por isso, licença independente da fonte, precisão/atualidade ou cobertura validadas. Preservar atribuição, data-base e limitações e executar os gates cartográficos/documentais antes do envio efetivo.
- **Q24:** finalidade exclusivamente de teste, não comercial.
- **Q25:** hibernação/espera aceita no piloto, com mensagem e recuperação, sem confundir demora com resultado vazio ou prometer acesso imediato. RNF produtivos preservados.
- **Q26:** lista de e-mails permitidos no backend e contas individuais com confirmação; sem senha compartilhada ou exigência de conta Vercel aos convidados. Cadastro público futuro não é redefinido.

## Relatório externo e recomendação de homologação

Relatório anexado foi lido integralmente e criticado na [análise do benchmark](ui-ux-benchmark-review-2026-10-23.md). Seu diagnóstico de ausência de backend/autenticação/banco se baseia em baseline antiga da main e não descreve a integração atual. Aproveitar padrões de mapa predominante, estado compartilhado, procedência, ajuda contextual e acessibilidade; não importar todo o roadmap, vocabulário antigo, novo menu ou mudanças de recorte/relatórios.

Recomendação ao responsável para teste com pessoas próximas: **Vercel Hobby + Render Free + Neon Free** como ambiente de homologação separado da produção, condicionado à prova da API Java, sessão em mesma origem/proxy, MFA estável, mapa-base autorizado e restrição no servidor. Ocorrências fictícias com Áreas de Risco reais identificadas separadamente, coleta real desligada. Banco/segredos separados e roteiro de feedback curto; canal ainda a decidir. Nenhum provedor escolhido automaticamente nem recurso criado.

## Rodada Q27–Q30 — decisões confirmadas

- **Q27:** Vercel Hobby + Render Free + Neon Free aprovados como primeira candidata para validar tecnicamente a homologação. Responsável pediu divisão das ações manuais/automação e tratamento de credenciais; [guia de preparação](../operations/pilot-account-preparation.md) distingue propriedade/autenticação, configurações e segredos. Não implica criar contas/deploy neste momento ou devolver senhas no chat.
- **Q28:** no Rio, usar Regiões Administrativas e manter relação com Áreas de Planejamento como unidades distintas. Atualizar catálogo e cartografia segundo essa hierarquia, sem equiparar zonas informais.
- **Q29:** aprovado painel único de detalhe na consulta cotidiana, substituindo expansão simultânea de até cinco detalhes inline; ao retornar, preservar consulta, seleção e rolagem. Comparação simultânea continua questão separada.
- **Q30:** feedback inicial por formulário simples acessível por «Enviar feedback», sem módulo de atendimento. Campos curtos e imagem opcional, sem captura automática de tela, localização ou sessão. Serviço/formulário de destino ainda a definir.

## Pendências operacionais e propostas fora do incremento

- Serviço de e-mail, rotina/responsável de backup/restauração, destino do formulário e segredos serão resolvidos na preparação da hospedagem, obrigatoriamente antes dos convidados. Adiamento confirmado pelo responsável no fechamento; não são capacidades prontas.
- Sugestões não selecionadas do benchmark, como ajuda contextual e compartilhamento seguro por URL, ficam fora do incremento, sem nova rodada de perguntas por padrão.
- Escopo de produto consolidado não autoriza execução, publicação ou integração de provedores.

## Fechamento confirmado — consolidação local

A primeira proposta de encerramento foi suspensa quando o responsável ampliou a entrevista para Informes Ativos/Histórico/Relatórios. Essa extensão foi resolvida com aprovação de Q31–Q38, preservando Q1–Q30. Em seguida, o responsável confirmou o encerramento do grill de produto e autorizou consolidar especificação, critérios de aceite e lotes, sem iniciar implementação. Confirmou também as condições operacionais na preparação da hospedagem antes de convidados.

Entregas: [especificação UXH v1.0](../product/ui-ux-pilot-specification.md) e [23 tickets propostos em sete lotes](../product/ui-ux-pilot-plan.md), com critérios próprios e preservação dos IDs anteriores. A granularidade/dependências é proposta para revisão, não ticket iniciado nem aceite de implementação.

Sequência: consolidação documental → estabilização/verificação do candidato e decisão de merge separada → cartografia prioritária em paralelo a incrementos independentes de UX → preparação segura de hospedagem → autorização/contas/recursos Neon, Render e Vercel → prova hospedada → aceite para convidados. Cobertura parcial não vira cobertura completa; conta externa não é requisito da etapa documental.

Nenhum novo ADR necessário nesta consolidação. Nenhuma issue publicada, aplicação alterada, conta/recurso criado, banco acessado, commit/merge/push ou deploy realizado por este fechamento.
