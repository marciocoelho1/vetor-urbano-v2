# Incremento UX e piloto restrito — especificação consolidada

Versão 1.0 • 23/10/2026 • identificador do incremento: **UXH**.

**Estado:** grill de produto encerrado por confirmação do responsável após Q1–Q38. Autorizada a consolidação local de especificação, critérios de aceite e lotes; **implementação, publicação de issues, commit, merge, push e deploy não autorizados por esse fechamento**. A divisão dos tickets é proposta de execução, não aceite de funcionalidades entregues.

## Problema

O mapa perde área útil para controles duplicados e resumos extensos; a disposição de ferramentas e filtros torna pouco clara a diferença entre navegar, consultar e exibir contexto territorial. A navegação e os resultados precisam funcionar sem sobreposição em telas menores. Informes, Histórico e Relatórios precisam seguir a mesma linguagem visual sem compartilhar critérios implicitamente. A implementação local existente ainda não constitui um piloto hospedado seguro e verificável para convidados.

## Solução e limites da consolidação

Refinar as jornadas existentes em incrementos verificáveis, priorizar a cartografia metropolitana e preparar um piloto não comercial restrito. Preservar backend, banco, autenticação, MFA, moderação, versões territoriais, síntese, comparação e exportações já implementados localmente; adaptar suas integrações, não reconstruí-los a partir de documentos antigos.

Esta especificação é um **adendo** às decisões anteriores, não substitui integralmente a especificação funcional local, as políticas de conta ou os requisitos originais. Q1–Q38 aqui referem-se à entrevista de **23/10/2026**, não às perguntas de entrevistas anteriores. IDs **UXH-CA** não renumeram CA01–CA25, RF01–RF07, RNF01–RNF08, decisões D/E ou os tickets antigos 01–36. Em conflito de comportamento deste incremento, prevalece a decisão posterior explicitamente aprovada; capacidades anteriores não alteradas continuam obrigatórias.

A auditoria de 23/10 registrou integração com backend existente, documentação defasada e simulação de merge sem conflito textual. API/PostGIS e navegador integrado não foram revalidados naquela auditoria. A especificação anterior e os tickets antigos estão em caminhos ignorados pelo Git: não os publicar nem alterar a política de versionamento silenciosamente. A reconciliação de entrada e a reprodução da baseline são trabalho do primeiro ticket.

## Histórias de usuário

1. Como Usuário, quero mais altura útil do mapa, para consultar o território sem uma faixa superior redundante de filtros.
2. Como Usuário, quero um único formulário de filtros do Mapa, para não procurar o mesmo controle em lugares diferentes.
3. Como Usuário, quero distinguir filtros de ocorrência, camadas e câmera, para compreender o que altera o resultado.
4. Como Usuário, quero raio, calor, busca na área e Áreas de Risco no bloco de ferramentas à esquerda, para liberar a visualização.
5. Como Usuário, quero acionar «Buscar nesta área» explicitamente, para controlar o recorte consultado.
6. Como Usuário, quero aviso quando a câmera divergir da área aplicada, para não confundir o enquadramento com o resultado.
7. Como Usuário, quero combinar área, raio e demais critérios por interseção, para obter o recorte escolhido.
8. Como Usuário, quero manter Áreas de Risco ao buscar ocorrências, para não perder contexto territorial silenciosamente.
9. Como Usuário, quero definir o centro por município, bairro ou Área de Risco, para evitar digitar coordenadas.
10. Como Usuário, quero um ponto interno ao território selecionado, para não centralizar o raio fora dele.
11. Como Usuário, quero cobertura cartográfica e homônimos explícitos, para não escolher uma localidade ambígua ou inexistente no catálogo.
12. Como Usuário, quero resumo dos filtros em duas linhas acima dos resultados, com expansão e remoção, para entender a consulta sem perder espaço.
13. Como Usuário, quero percorrer todos os resultados, para não confundir limitação de rolagem com ausência de registros.
14. Como Usuário em celular, quero Filtros, Ferramentas e Resultados em painéis inferiores exclusivos, para manter o mapa predominante.
15. Como Usuário, quero a navegação recolhida antes de sobrepor ações, mantendo acesso a conta, modo e tema.
16. Como Usuário, quero transições funcionais e alternativa sem movimento, para manter orientação sem atrasar a consulta.
17. Como Administrador, quero Gestão de Fontes e Logs Administrativos em Configurações, preservando os fluxos atuais e MFA.
18. Como Administrador, quero voltar à consulta sem perder estado e confirmar descarte de edição não salva.
19. Como Usuário, quero um único detalhe aberto por vez, com retorno ao mesmo contexto, para evitar expansões concorrentes na lista.
20. Como Usuário de Informes, quero filtrar classificação e situação mantendo centro, raio e regras de vigência independentes do Mapa.
21. Como Usuário de Histórico, quero filtros no topo, tabela desktop e lista móvel, para consultar registros sem Reprodução temporal.
22. Como Usuário de Relatórios, quero iniciar sem filtros preselecionados nem indicadores gerados, para construir minha própria consulta.
23. Como Usuário de Relatórios, quero gerar somente após escolher um período, para evitar consulta irrestrita por engano.
24. Como Usuário, quero preservar minhas escolhas e relatório ao alternar módulos na sessão e limpar por «Novo relatório» conscientemente.
25. Como Usuário, quero gerar a partir do Mapa por comando explícito e confirmar substituição, para não perder uma análise anterior.
26. Como Usuário, quero editar critérios sem mudar o relatório já gerado até nova geração, para comparar configuração e resultado com clareza.
27. Como Usuário, quero que gráficos, PDF e XLSX correspondam ao mesmo resultado gerado, sem nova consulta escondida.
28. Como Usuário, quero séries agregadas de CSV separadas das ocorrências, preservando unidade, origem e análise existente.
29. Como responsável, quero cartografia dos municípios e respectivos bairros da RMRJ e bairros/RAs/APs do Rio, sem substituir polígonos por nomes ou retângulos.
30. Como responsável, quero piloto com ocorrências fictícias, API/banco reais e Áreas de Risco atuais após validação de publicação, sem ligar coleta real.
31. Como convidado, quero conta individual permitida no backend, funcionamento recuperável após hibernação e um formulário simples para feedback.
32. Como responsável, quero custos e segredos controlados, sem cartão, upgrade ou cobrança automática aceitos sem alinhamento.

## Decisões de implementação e contratos a preservar

### Interface, navegação e mapa

- Manrope, verde existente, claro/escuro, contraste, bordas finas, cantos discretos, hierarquia por tipografia/espaçamento e menos caixas. Não importar gradientes decorativos, React ou bibliotecas só por exemplos visuais.
- Navegação horizontal enquanto couber; «Menu» antes de sobrepor. Identificar a tela atual e manter conta/modo/tema acessíveis. Não definir breakpoint por chute: comprovar nas larguras de teste e no redimensionamento intermediário.
- Retirar a faixa de filtros acima do mapa. Um único formulário à esquerda dentro do mapa; ferramentas em bloco independente acima. Lateral direita com resumo ativo e resultados. Atribuições, alertas essenciais e alternativa em lista permanecem acessíveis.
- Ferramentas: raio personalizado, calor, «Buscar nesta área» e Áreas de Risco; respeitar disponibilidade por modo. «Definir centro por local» substitui a entrada principal por coordenadas no controle de raio do Mapa, sem retirar por suposição a escolha manual de Informes.
- Pan/zoom não reaplica consulta. Após mudar câmera, avisar «Área do mapa alterada» quando houver divergência; só a ação explícita aplica novo recorte. Raio, área e critérios combinam por interseção, sem desligar camada territorial ou apagar restrição para evitar resultado vazio.
- Resumo opção 01 acima dos resultados: duas linhas, «Ver todos os filtros»/«Recolher», remoção por etiqueta e limpeza. Lista não pode ser truncada pelo layout: preservar acesso à coleção/paginação e distinguir totais de registros mapeáveis e apenas territoriais.
- Móvel: botões com ícone e rótulo «Filtros», «Ferramentas», «Resultados»; somente um painel inferior aberto. Fechamento explícito, sem exigir gesto. Preservar câmera, critérios e seleção; Resultados pode ocupar quase toda a altura.
- «Ver resumo da consulta» com destaque, seta e transição para a seção existente; movimento funcional também em painéis e mudanças pertinentes, preservando foco, teclado e movimento reduzido. Sem animação contínua ou atraso obrigatório para acessar conteúdo.
- Detalhe único na consulta cotidiana; substituir seleção ao abrir outra ocorrência e restaurar contexto/rolagem/foco no retorno. Não remover comparação analítica ou relacionados fora do recorte identificados como contexto.

### Configurações

Página dedicada exclusiva de Administrador com navegação lateral, conteúdo à direita e «Voltar ao aplicativo». Somente duas entradas: **Gestão de Fontes** e **Logs Administrativos**. Gestão de Fontes recebe a tela inteira atual, incluindo seus subpainéis operacionais, sem criar abas irmãs não pedidas. Fontes públicas continuam leitura separada. Menu oculto não substitui autorização no backend, sessão ou MFA. Confirmar descarte ao sair/trocar de seção com edição não salva; não adicionar salvamento automático implícito.

### Cartografia — prioridade extrema

Catálogo próprio e versionado, sem geocodificador externo presumido. Polígonos municipais e bairros de toda a RMRJ; no Rio, bairros e Regiões Administrativas com Áreas de Planejamento distintas. Usar fontes adequadas com origem, licença/autorização, datas e limitações. Preservar originais e trilha de transformação, sem publicar extração bruta por padrão.

Identidades estáveis, homônimos desambiguados e pertencimento conferido. Polygon/MultiPolygon válido, não vazio, WGS84/SRID 4326; GeoJSON em `[longitude, latitude]`. Ponto representativo interno vinculado à versão da geometria; bounding box, média de ocorrências e centroide externo não satisfazem o critério. Município, bairro, RA/AP e Área de Risco não são equivalentes.

Inventário deve comparar esperado/disponível/pendente por fonte/data, sem inventar contagens. Fonte ausente ou direito não confirmado bloqueia incorporação respectiva: mostrar cobertura parcial/indisponibilidade. Não considerar a cartografia completa pela entrega parcial, nem reduzir o requisito para concluir ticket. A lacuna não bloqueia correções independentes de UI.

### Informes e Histórico

- Informes mantém a união deduplicada de recentes das últimas 24h, inclusive encerradas/desconhecidas, e antigas com andamento confirmado segundo a política vigente. Centro explícito, escolha manual após negativa de localização e raio máximo de 5 km. Expiração de evidência não equivale a encerramento do fato.
- Informes ganha pilar, tipo, subtipo e situação; fonte e confiabilidade em avançados conforme modo. Consulta independente do Mapa. O contrato de proximidade hoje aceita só centro/raio e rejeita parâmetros desconhecidos: novos critérios exigem contrato HTTP evoluído, validação, seleção no backend e provas de regressão espacial/temporal, não filtro apenas no cliente.
- Histórico: busca/período/município/bairro/pilar acessíveis no topo, complementos recolhíveis e «Aplicar filtros». Preservar filtros completos, paginação, ordenação, precisão temporal e versões. Tabela legível desktop e lista móvel, detalhe único.
- Remover totalmente Reprodução temporal: UI, timers, estado, eventos e estilos exclusivos sem uso. Histórico de versões, filtros por data, comparação e documentação de entregas antigas permanecem.

### Relatórios: ciclo de vida independente

- Filtros no topo: período, busca textual, município, bairro, pilar, tipo/subtipo, situação, fonte, confiabilidade, respeitando modo. Início sem preseleção, consulta, gráficos ou indicadores; orientação em vez de zeros fictícios.
- Período escolhido pelo usuário é obrigatório para gerar. Demais critérios não escolhidos não restringem a consulta; seleção vazia não pode ser traduzida automaticamente como «zero registros» nem como marcações feitas pelo sistema. Validar os demais campos preenchidos.
- Rascunho editável separado dos filtros aplicados/snapshot. Gerar/Atualizar são ações explícitas; mudança nos campos não refaz consulta sozinha. Falha não deve ser apresentada como sucesso ou substituir silenciosamente resultado anterior por outro recorte.
- Ao alternar módulos na mesma sessão, preservar escolhas explícitas e resultado. Nova sessão/«Novo relatório» começa vazio; confirmar descarte quando houver trabalho. Não acrescentar persistência entre sessões ou armazenamento da geografia por essa decisão.
- «Gerar relatório» **no Mapa** copia critérios aplicados uma vez, abre Relatórios e gera. Se houver escolhas/relatório diferente: «Substituir e gerar»/«Manter relatório atual». Abrir pelo menu ou exportar não importa filtros. Raio/área copiados são identificados no resumo e removíveis antes de nova geração, sem alterar o Mapa. Não criar editor de polígonos nessa tela.
- Retirar painéis demonstrativos reativos ao Mapa da tela de Relatórios. Gráficos úteis seguem o relatório gerado, sem preenchimento automático inicial. Salvar/aplicar filtros do Mapa fica no próprio Mapa. Preservar importação/análise de CSV agregado separada por unidade/origem e sem inclusão automática no relatório; não criar novo módulo ou apagar fontes/dados por suposição.
- PDF e XLSX exportam o mesmo snapshot do resultado gerado, completo e não só a página visível. Sem geração: indisponíveis. Não refazer seleção, importar Mapa ou atualizar snapshot ao exportar. Verificar autorização/retiradas; se conteúdo indisponível exigir regeneração, avisar sem substituição silenciosa. Preservar proteção de fórmulas/textos, referências, créditos, precisão, distinção ocorrência/acontecimento, relacionados externos e limites analíticos.
- Evolução dos contratos deve documentar a identidade do resultado e sua validação. Esta especificação não inventa endpoint, esquema ou mecanismo de armazenamento ainda não escolhido; isso será projetado na implementação, preservando o comportamento observável aprovado.

### Piloto e condições operacionais

Candidata aprovada: **Vercel Hobby → frontend; Render Free → API; Neon Free → PostgreSQL/PostGIS**. A ordem de provisionamento é **Neon → Render → Vercel**. Não representa produção validada nem promessa de gratuidade permanente. Conferir planos/limites no momento da execução. Se houver cartão, upgrade ou cobrança, parar e alinhar.

Ambiente separado: ocorrências fictícias claramente identificadas, API/banco reais, coleta real desligada; Áreas de Risco locais atuais destinadas ao piloto, mas somente após conferência de origem, autorização/licença, data-base, topologia, atribuição e limitações. Aprovação desse destino não comprova licença independente, segurança atual ou completude territorial. Não copiar a base de ocorrências reais.

Acesso de convidados por contas individuais e allowlist de e-mails **no backend**; sem cadastro irrestrito, senha compartilhada ou conta Vercel para cada convidado. Preparar configuração remota explícita sem fallback silencioso para demo, HTTPS, sessão/cookies/CSRF/proxy, MFA com chave privada estável fora do disco efêmero, mapa-base autorizado e dependências de confirmação/recuperação.

O responsável confirmou que **e-mail, rotina/responsável e prova de backup/restauração, destino do feedback e provisionamento seguro de segredos serão resolvidos na preparação da hospedagem**, obrigatoriamente antes dos convidados. Manter também revisão/publicação dos textos aplicáveis do antigo ticket 36/D3 como pendência; o fechamento não é aceite jurídico. Hibernação é tolerada com feedback, recuperação e distinção de falha/vazio; não relaxa RNFs de produção.

Feedback por formulário simples acessível por «Enviar feedback», campos curtos e imagem opcional, sem captura automática de tela, localização ou sessão. Serviço/destino não foi escolhido; implementação deve aguardar a definição operacional correspondente.

## Critérios de aceite verificáveis

Os critérios abaixo são metas futuras. Nenhum está marcado como executado nesta consolidação.

| ID | Comportamento e prova necessária |
|---|---|
| UXH-CA01 | Topbar não sobrepõe ações ao redimensionar; Menu identifica módulo atual e mantém conta/modo/tema operáveis. Conferir desktop/móvel e claro/escuro sem alterar permissões. |
| UXH-CA02 | Manrope/identidade e contraste preservados; transições não impedem teclado/foco e desaparecem ou têm alternativa com movimento reduzido; não há novo framework/dependência sem uso justificado. |
| UXH-CA03 | Mapa ganha altura útil sem faixa superior redundante; há somente um editor de filtros à esquerda e resultados à direita, mantendo atribuições e estados relevantes. |
| UXH-CA04 | Raio, calor, Buscar nesta área e Áreas de Risco ficam no bloco de ferramentas acima dos filtros; expandir controles não torna a consulta inacessível. Calor respeita modo. |
| UXH-CA05 | Pan/zoom não refaz consulta; aviso identifica divergência; clique aplica área. Com raio e filtros, resultado é a interseção, comprovada por IDs/bordas no PostGIS e navegador. Vazio explica restrições sem apagá-las. |
| UXH-CA06 | Buscar na área e filtrar ocorrências não desligam Áreas de Risco; camada mantém fonte/data/limites e não entra em contagens/calor como ocorrência. |
| UXH-CA07 | Resumo acima dos resultados ocupa duas linhas recolhido; expandir/recolher/remover/limpar são acessíveis. Todos os resultados permanecem alcançáveis por rolagem/paginação, com totais consistentes. |
| UXH-CA08 | No móvel, Filtros/Ferramentas/Resultados têm ícones e rótulos e abrem um painel por vez; fechamento devolve foco/contexto. Lista segue alternativa se mapa falhar. |
| UXH-CA09 | Definir centro por local desambigua município/bairro/Área de Risco, usa ponto interno de geometria válida versionada e informa indisponibilidade; sem ponto inventado nem geocodificador presumido. |
| UXH-CA10 | Municípios da RMRJ têm inventário esperado/disponível/pendente com fontes e geometrias validadas; catálogo/busca/consulta usam IDs e versões estáveis. Lista de nomes não encerra o critério espacial. |
| UXH-CA11 | Bairros/RAs/APs do Rio têm relação documentada e geometrias adequadas segundo fonte/data, sem equiparação a Área de Risco/zonas informais; discrepâncias e cobertura visíveis. |
| UXH-CA12 | Respectivos bairros dos demais municípios da RMRJ têm inventário e polígonos verificáveis; lacunas não são preenchidas artificialmente ou aceitas como cobertura completa. |
| UXH-CA13 | Configurações contém somente Gestão de Fontes/Logs Administrativos, recebe telas completas e preserva acesso público separado; backend nega USER, ADMIN exige MFA; retorno restaura estado e confirma descarte. |
| UXH-CA14 | Pin/lista/Informes/Histórico abrem um detalhe cotidiano por vez; fechar retorna seleção/rolagem/foco. Relacionados não alteram contagens nem eliminam comparação analítica. |
| UXH-CA15 | Novos filtros de Informes restringem no servidor o conjunto recente/vigente, independente do Mapa. Provar raio de borda, 24h, vigência expirada, fonte/confiabilidade, negativa de localização e carga/erro/vazio. Máximo 5 km preservado. |
| UXH-CA16 | Histórico aplica filtros explicitamente, mantém publicadas/paginação/precisão e tabela/lista responsivas. Reprodução temporal inexiste nos caminhos executáveis; datas, histórico de versões e ordenação permanecem. |
| UXH-CA17 | Abrir novo Relatório não consulta nem preenche indicadores/filtros; sem período não gera. Escolher critério opcional restringe; não escolher não impõe restrição nem marca opções automaticamente. |
| UXH-CA18 | Campos em edição não alteram snapshot; geração/atualização são explícitas. Alternar módulos preserva escolhas na sessão; Novo relatório confirma descarte e limpa. Nenhuma importação por menu ou atualização do Mapa. |
| UXH-CA19 | Gerar no Mapa copia filtros aplicados e navega/gera; diferenças pedem substituir/manter. Cancelar preserva trabalho. Raio/área importados são removíveis no relatório sem alterar o Mapa. |
| UXH-CA20 | Sem painéis demonstrativos reativos ao Mapa em Relatórios; gráficos refletem snapshot. Filtros salvos operam no Mapa; importação/análise de CSV permanece separada, com unidades/origens e sem soma automática. |
| UXH-CA21 | PDF/XLSX leem o mesmo resultado gerado completo, sem nova seleção, fallback ou geração implícita; comparar IDs, filtros, momento, totais e créditos. Sem geração não exportam; retirada/perda de acesso é bloqueada/explicada, sem troca silenciosa. |
| UXH-CA22 | Síntese/comparações preservam precisão, período/cobertura, unidades e limites; relacionados externos não inflacionam totais. Conteúdo dos downloads é legível/seguro, inclusive casos vazio, acentos, fórmulas e múltiplas páginas. |
| UXH-CA23 | Piloto identifica ocorrências fictícias, isola banco/segredos e mantém coleta real desligada. Pacote de Áreas de Risco atuais só é enviado após prova de direitos, atribuição/data/limitações e validação espacial. |
| UXH-CA24 | Conta individual permitida confirma acesso; e-mail não permitido não contorna restrição por HTTP. Administração exige MFA; logout/revogação/reinício e acesso anônimo mantêm limites, sem senha compartilhada. |
| UXH-CA25 | Ambiente remoto consulta API real sem fallback silencioso; HTTPS/cookies/CSRF/proxy e persistência da chave MFA sobrevivem a redeploy. Mapa-base autorizado e hibernação/falha/vazio têm prova observável. |
| UXH-CA26 | Serviço de e-mail e fluxo real de confirmação/recuperação definidos e testados; backup/restauração testado em destino isolado, com responsável e retenção compatível com política. Segredos ficam fora de Git/chat/bundle/logs. |
| UXH-CA27 | Enviar feedback abre destino definido e testado, imagem opcional e sem captura automática. Textos e canal explicam teste/limites; publicar peças pendentes exige decisão própria do responsável. |
| UXH-CA28 | Planos/custos vigentes são conferidos antes de provisionar; cartão/upgrade/cobrança interrompem execução. Sem promessa de SLA de produção ou gratuidade permanente. |
| UXH-CA29 | Candidato e ambiente hospedado têm versão identificada e provas navegador → API → PostGIS, sem skips de cenários obrigatórios. Convidados só entram após condições operacionais e aprovação específica; resultado parcial não vira aceite de cartografia completa ou produção. |

## Decisões de teste

A principal costura é a jornada observável no navegador usando API HTTP e PostgreSQL/PostGIS reais em ambiente sintético identificado; complementar com HTTP de autorização/validação e unidade de regras. Reutilizar costuras existentes, não criar um serviço apenas para testabilidade. Nenhuma nova aprovação de produto é necessária para manter essas provas já usadas no projeto.

- Web: lint, unidade e build via `bash scripts/verify.sh web`; planejamento via `bash scripts/verify.sh planning`; `git diff --check`. Orçamento inicial vigente de **900 kB** preservado, não aumentar para acomodar mudanças sem aprovação.
- API: `bash scripts/verify.sh api` quando JDK/runtime disponíveis ou runner documentado `bash scripts/verify-api-container.sh`. PostgreSQL/PostGIS real para filtros espaciais, versões, migrações e sessões; não substituir por banco em memória. Migrações aplicadas só evoluem por novas migrações.
- Playwright separado, Chromium e Firefox; conferir autenticação/harness/flags antes. Suítes condicionais com `VETOR_PERSISTED_E2E`, `VETOR_ACCOUNTS_E2E` e `VETOR_SESSION_E2E` só comprovam integração quando realmente executadas. Ausência de ambiente/skips é bloqueio, não sucesso. Não executar helpers destrutivos do harness local contra hospedagem ou dados reais.
- Provas de layout em 1440, 1024, 768 e 390 px, acrescentando 320 px e larguras intermediárias para regressão da topbar/lista; são viewport de teste, não breakpoints obrigatórios. Temas, teclado, foco, movimento reduzido e alternativa em lista; QA físico/leitor de tela quando não executado permanece limitação explícita, sem alegar RNF05 concluído por emulação.
- Precedentes existentes: `layout`, `workspace`, `map-controls`, `filters`, `territory-query`, `two-modes`, `active-reports-api`, `active-report-renewal`, `history-pagination`, `persisted-query`, `report-summary`, `report-comparison`, `report-export`, `report-pdf`, `session-access`, `source-management`, `audit-log` e `risk-area-versions`. Reconciliar contratos/testes aos novos comportamentos sem apagar cenários para fazer a suíte passar.
- Nos downloads, conferir conteúdo efetivo, não só nome/extensão ou evento de download. Nos filtros, comparar IDs/totais e requisições; screenshot isolada não prova seleção no servidor. No catálogo, conferir completude com totais calculados e geometria, não contagem mental ou catálogo textual.
- Registrar comandos, saídas, versão, ambiente sanitizado e falhas/limitações. Evidência histórica não vira reexecução atual. O primeiro ticket precisa resolver o bloqueio de socket Podman/JDK diagnosticado, sem presumir que ainda existe ou que foi corrigido.

## Fora do escopo

Implementar nesta consolidação; publicar issues, merge/push/deploy automáticos; produção pública; cadastro aberto; coleta real no piloto; copiar bases reais de ocorrências; custos ou planos pagos sem aprovação; novos módulos/bibliotecas vindos de referências; 3D, rotas, colaboração, votação, geofencing, notificações e resumo por IA; compartilhamento por URL, ajuda contextual e demais sugestões não escolhidas. Reprodução temporal é retirada, não transferida para outro módulo.

## Rastreabilidade e documentos de execução

| Decisões de 23/10 | Critérios deste adendo |
|---|---|
| Q1–Q2 | UXH-CA24, UXH-CA29; verificação/merge separados |
| Q3, Q7–Q9 | UXH-CA03, UXH-CA05–UXH-CA06 |
| Q4, Q22, Q28 e prioridade extrema | UXH-CA09–UXH-CA12 |
| Q5, Q24–Q27 | UXH-CA24–UXH-CA26, UXH-CA28–UXH-CA29 |
| Q6, Q17 | UXH-CA04–UXH-CA06 |
| Q10–Q11, Q16 | UXH-CA07 |
| Q12, Q20 | UXH-CA13 |
| Q13–Q14, Q18 | UXH-CA01–UXH-CA02 |
| Q15, Q19 | UXH-CA08 |
| Q21, Q23 | UXH-CA23 |
| Q29 | UXH-CA14 |
| Q30 | UXH-CA27 |
| Q31 | UXH-CA15 |
| Q32 | UXH-CA16 |
| Q33–Q34 | UXH-CA17–UXH-CA18 |
| Q35 | UXH-CA21–UXH-CA22 |
| Q36 | UXH-CA19 |
| Q37 | UXH-CA20, UXH-CA22 |
| Q38 | UXH-CA17, UXH-CA19 |

Fontes: [entrevista do mapa](../history/map-and-hosting-interview-2026-10-23.md), [entrevista dos módulos](../history/modules-filtering-interview-2026-10-23.md), [auditoria](../history/repository-audit-2026-10-23.md), [cartografia prioritária](territorial-mapping-priority.md), [política de contas](account-and-records-policy.md), [preparação de contas](../operations/pilot-account-preparation.md), [requisitos originais](../references/initial-context.md) e [especificação anterior local](specification.md).

A divisão de trabalho, dependências e condições de liberação está no [plano do incremento](ui-ux-pilot-plan.md). Nenhuma publicação externa foi feita por este documento.
