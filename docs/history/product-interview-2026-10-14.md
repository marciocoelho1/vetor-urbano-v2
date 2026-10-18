# Entrevista de produto — 14/10/2026

Registro incremental da definição de funcionalidades. O [plano](../../PLAN.md) concentra o roadmap; o [checklist](../product/development-status.md) acompanha capacidades. Uma resposta confirmada define direção de produto, sem comprovar implementação ou autorizar coleta real/publicação.

**Estado atual — 15/10/2026:** Q10–Q14 respondidas; Q9 adiada. Decisões consolidadas na [definição das funcionalidades](../product/feature-definition.md). O responsável preparará documento de ideias e pediu novas perguntas apenas se necessárias para continuar as respostas atuais. Nenhuma nova pergunta é indispensável para registrar esta rodada; próximos pontos em aberto foram listados para trabalho futuro. Reprodução temporal/Inteligência de Dados permanece brainstorm.

## Ponto de recuperação — entrevista pausada pelo responsável

**Estado no momento da pausa de 14/10:** rodadas 1 e 2 respondidas; Q9 aguarda material de filtros que o responsável ainda preparará. Pausa solicitada após a rodada 2. A instrução de não iniciar nova rodada durante aquela pausa foi superada pela retomada registrada em 15/10; implementação continua fora desta entrevista.

**Como retomar:** ler este registro e o plano, receber o material de filtros quando estiver disponível e revisar o catálogo a partir dele. Q9 continua aberta; as categorias atuais não foram aprovadas como catálogo final. Se o material ainda não estiver pronto, combinar o ramo a discutir na retomada, sem presumir filtros.

**Objetivo preservado:** demonstração estável, sem prazo, com scraping real de clippings; consulta de ocorrências retroativas e recentes no mapa; distinção por filtros com nomes provisórios; manutenção e revisão de Informes Ativos, Histórico, Relatórios e Fontes. Prioridade de definição das funcionalidades, com mobile adiado e relatos da população futuros.

**Conceitos aceitos:** publicação de referência separada da ocorrência; várias publicações do mesmo fato consolidadas sem multiplicar a contagem; credibilidade da informação separada da confiabilidade da fonte e da confiança de extração da IA; revisão humana antes de publicação na primeira integração real; distinção entre fato recente e situação ativa.

**Adição do responsável:** lista recorrente de fontes confiáveis, organizada em níveis de 1 a 5, com nomes e links em cada nível. Nenhuma fonte ou nota individual foi escolhida.

**Abertos para depois:** material de filtros/Q9; revisão dos quatro módulos; critérios das duas escalas de 1 a 5 e responsáveis pela avaliação; regras de deduplicação, correção e conflito; definição/latência de “Tempo Real”; precisão de data/local e encerramento; visibilidade dos itens aguardando revisão; fontes, IA, volume e custo; cobertura geográfica e demais funcionalidades. A revisão humana aceita em Q7 precisa ser conciliada com o pedido de mostrar todas as ocorrências inseridas em Q4, sem publicar pendências por suposição.

**Estado técnico:** nenhum scraping, modelo, conta, coleta real, alteração de código ou publicação foi iniciado nesta entrevista. As mudanças desta sessão são documentais e estão locais na branch `feat/ui-ux-gallery`, sem commit ou push desta tarefa.

### Conferência do ponto de recuperação — 15/10/2026

- [x] Perguntas e respostas de Q1–Q9 preservadas neste documento, incluindo o texto das respostas do responsável.
- [x] Decisões confirmadas separadas de critérios e funcionalidades ainda em aberto.
- [x] Plano, checklist, escopo e glossário atualizados com as decisões recebidas.
- [x] Q9 identificada como pendente do material de filtros; nenhum catálogo presumido.
- [x] Próximo passo de retomada registrado, com mobile adiado e relatos da população futuros.

**Tarefa de documentação do ponto de recuperação concluída.** A entrevista de definição do produto permanece aberta; sua continuação não é necessária para considerar este registro salvo e completo. A conferência de 15/10 não acrescentou decisões de produto.

**Verificação em 15/10:** `bash scripts/verify.sh planning` passou, com 166 links locais conferidos, presença dos documentos e sintaxe Bash válidas; `git diff --check` passou. Âncoras e URLs externas não foram verificadas pelo script. Testes da aplicação não foram reexecutados nesta tarefa documental.

## Rodada 1 — respostas confirmadas

| Pergunta | Resposta do responsável | Efeito no planejamento |
|---|---|---|
| Q1 — próximo objetivo | Demonstração estável, sem prazo. | Não há data de entrega assumida. O aceite da demonstração ainda precisa ser definido. |
| Q2 — prioridade de público e alimentação | Pessoas que consultam ocorrências e os demais recursos. Alimentação desejada por clippings com web scraping, tanto retroativos quanto “em tempo real”. Credibilidade de 1 a 5 para a informação recente. | Definir fluxo de coleta, interpretação, histórico, relatórios e credibilidade antes de escolher fontes/modelos. Nenhum deles foi escolhido. |
| Q2 — relatos da população | Somente futuramente, quando o produto estiver sólido. | Fora do recorte atual de definição do fluxo principal; critério de “sólido” ainda em aberto. |
| Q3 — ordem do trabalho | Definir todas as funcionalidades e seus comportamentos antes de trabalhar em mobile. | Refinamento mobile adiado; falhas conhecidas e requisitos preservados. Não iniciar correções ou implementação nesta entrevista. |

### Q1 — pergunta e resposta original

Pergunta: podemos adotar uma demonstração estável para apresentar como próximo marco, ou você já precisa de um piloto com usuários e dados persistidos? Existe prazo?

Resposta do responsável:

> Demonstração estável e não existe prazo.

### Q2 — pergunta e resposta original

Pergunta: a prioridade deve ser quem consulta ocorrências, com Operador/Gestor responsáveis pelo registro, ou você imagina participação direta da população cadastrando relatos?

Resposta do responsável:

> A principal prioridade devem ser os usuários que consultam as ocorrências e todas as outras features.
> No momento penso em alimentar a base de dados com clippings usando web scrapping para ocorrências retroativas que irão auxiliar a criação de relatórios e visão macro das regiões cobertas pelo Vetor Urbano, com filtros que possam mostrar ocorrências anteriores. E web scrapping para ocorrências "em tempo real", usando uma pontuação de 1 a 5 para a credibilidade daquela informação.
> E apenas futuramente, quando o Vetor Urbano estiver realmente sólido, começar a pensar em relatos da população.
> Ainda preciso definir quais serão as fontes de web scrapping para ocorrências em tempo real e retroativas, e também definir qual IA/modelo com melhor custo beneficio para esta função

### Q3 — pergunta e resposta original

Pergunta: podemos começar por consulta no celular, cadastro e clareza dos filtros/relatórios? Qual tela ou comportamento mais incomoda você hoje?

Resposta do responsável:

> Não acho que devemos trabalhar na função mobile por agora, e sim terminar de definir todas as features e seus funcionamentos.

## Termos

Clipping e relato da população foram registrados no [glossário](../../GLOSSARY.md) como origens distintas de informação na rodada 1. A rodada 2 resolveu a separação entre clipping e ocorrência e entre os três conceitos de avaliação; os critérios das notas e a definição de atualização “em tempo real” continuam abertos.

## Rodada 2 — perguntas e respostas registradas

### Q4 — alcance da demonstração

Pergunta: podemos demonstrar coleta, avaliação e consulta usando clippings fictícios, deixando a coleta automatizada real para uma validação técnica posterior?

Resposta do responsável:

> A demonstração deve comprovar:
>
> - o web scrapping por clippings relacionados aos filtros que o Vetor Urbano possui atualmente *os filtros ainda serão revisados
> - o mapa demonstrando todas as ocorrências inseridas (retroativas e tempo real)
> - o mapa deve possuir um filtro "Tempo Real" e ocorrências retroativas (nome não é o final)
> - além de continuar mostrando os módulos Informes Ativos, Histórico, Relatórios e Fontes *estes módulos precisam de revisão

Resultado: a demonstração exige comprovação de scraping; simulação com dados fictícios não satisfaz sozinha esse objetivo. Filtros e módulos precisam ser revisados. Os nomes das opções temporais são provisórios, sem implementação ou contrato final definidos.

### Q5 — uma ocorrência, várias publicações

Pergunta: podemos tratar clipping como publicação de referência e ocorrência como o fato descrito, reunindo várias publicações sobre o mesmo acontecimento? Exemplo apresentado: três veículos sobre um alagamento geram uma ocorrência com três referências.

Resposta do responsável:

> Concordo

Resultado: separação conceitual aceita. Critérios para reconhecer o mesmo fato e tratar divergências ainda pendentes.

### Q6 — objeto da credibilidade e lista de fontes

Pergunta: podemos atribuir a nota de 1 a 5 à informação sobre a ocorrência, com justificativa e referências, mantendo separadas a reputação da fonte e a confiança da IA ao extrair os dados?

Resposta do responsável:

> Concordo com seu filtro, mas também criaria uma lista de "fontes confiáveis" e dentro dessa lista teriam as células de 1 a 5, e dentro de cada valor de confiança deixamos os nomes e links das fontes, assim podemos ter um material com confiabilidade recorrente

Resultado: separação aceita, com acréscimo de cadastro/lista recorrente de fontes, organizado por nível 1–5 e com nome/link. A nota da fonte e a nota da informação são conceitos distintos; fórmula, rubrica, revisores, atualização e apresentação ainda em aberto. Não foi decidido aplicar automaticamente a nota da fonte à ocorrência.

### Q7 — liberação para publicação

Pergunta: na primeira integração real, podemos exigir revisão humana antes de uma ocorrência coletada aparecer no mapa e entrar nos relatórios? Recomendação apresentada: IA prepara registros, uma pessoa revisa e eventual automação futura exige definição própria.

Resposta do responsável:

> Concordo

Resultado: revisão humana inicial aceita. Perfil revisor, fila, ações e exceções futuras não definidos.

### Q8 — recente e ainda acontecendo

Pergunta: podemos separar as duas condições, distinguindo quando ocorreu, quando foi publicada, quando foi coletada e qual sua situação atual? Foi explicado que notícia recente pode descrever fato antigo e ocorrência recente pode já ter terminado.

Resposta do responsável:

> Concordo

Resultado: distinção aceita. Janela temporal, frequência de coleta, verificação da situação e expiração ainda pendentes.

### Q9 — catálogo inicial de ocorrências

Pergunta: podemos manter Trânsito, Segurança e Contingência como categorias iniciais para definir o catálogo, com tipos e regras próprios para cada uma?

Resposta do responsável:

> Para responder essa pergunta, preciso lhe fornecer um material com os filtros que desejo, e ainda farei isso

Resultado: decisão pendente do material do responsável. Não assumir aceitação das três categorias como catálogo final e não inventar filtros.

## Encerramento temporário

O responsável solicitou um ponto de recuperação para sair e continuar mais tarde. Próxima interação: retomar deste documento, com prioridade para o material de filtros e a revisão das funcionalidades. Não há nova rodada pendente de resposta além de Q9, nem escopo final fechado para implementação. Os demais ramos ainda serão entrevistados. Nenhum ADR foi criado nesta etapa.

## Retomada — 15/10/2026

Orientação do responsável:

> Vamos voltar a Q9 futuramente, por enquanto use as respostas que forneci

Resultado: Q9 adiada sem bloquear a entrevista. Prosseguir com as decisões Q1–Q8; não inventar filtros nem escolher fontes/modelos. Organizado um fluxo de referência no checklist para distinguir decisões aceitas de detalhes ainda abertos.

### Rodada 3 — propostas originais

- **Q10 — Informes Ativos:** mostrar ocorrências publicadas com situação confirmada em andamento ou em acompanhamento; notícia recente sozinha não determina inclusão. Situação sem verificação suficiente permanece explicitamente incerta.
- **Q11 — Histórico:** reunir todas as ocorrências publicadas, inclusive as ainda ativas, pela data do fato, com referências e atualizações consultáveis; definições de precisão/data desconhecida ainda serão tratadas.
- **Q12 — Relatórios:** separar indicadores calculados das ocorrências de estatísticas agregadas externas, identificando recorte, unidade, período e origem de cada bloco; contagens representam ocorrências consolidadas.
- **Q13 — Fontes:** o módulo deve permitir consultar nome, link, nível 1–5, justificativa e data da última avaliação; a configuração da coleta e a edição das avaliações ficam na gestão por responsáveis, com permissões a definir.
- **Q14 — Revisão humana:** propor fila de trabalho com referências e dados preparados, permitindo corrigir, associar ao fato existente, aprovar ou descartar com motivo. Somente itens aprovados entram nas consultas e análises; mudanças posteriores terão tratamento próprio.

As propostas acima foram apresentadas pelo agente antes das respostas abaixo. Não tratar pontos omitidos ou contrariados pelo responsável como aceitos. A rodada não exige o catálogo de filtros de Q9.

### Respostas da rodada 3

**Q10 — Informes Ativos:**

> Os informes ativos devem conter ocorrências das últimas 24h. Em destaque para as ocorrências "em andamento", mas com espaço para mostrar as ocorrências inativas das últimas 24h.
> Os Informes ativos devem mostrar as ocorrências num raio de até 5km da localização do usuário, e esse módulo deve possuir um botão "escolher local no mapa".
> *Implementação de localização do usuário será implementada durante a implementação do backend

Resultado: janela de 24 h com ativas/inativas, destaque de andamento e raio até 5 km confirmados; não limitar o módulo somente aos estados ativos como sugerido originalmente. Instante de referência das 24 h e comportamento de localização indisponível ainda abertos.

**Q11 — Histórico e brainstorm de análise:**

> O histórico deve funcionar como um base de dados para consulta por filtros. Título, local (CEP, rua, bairro, cidade, estado), data, fonte, categoria da ocorrência, filtro da ocorrência.
> A "Reprodução temporal" ainda não me parece algo válido para deixar no Histórico, mas creio que seria legal deixá-lo junto a um mapa, talvez até criando um módulo separado apenas para a Reprodução temporal, ou movê-lo para dentro de Relatórios.
> Também pensei em criar um módulo chamado "Inteligência de Dados" ou algo tipo, e então poderiamos reunir a Reprodução temporal, e algumas outras funções, dentro deste módulo.
> Pense no Q11 mais como um brainstorm.

Resultado: direção de Histórico como consulta filtrável registrada. Destino da reprodução, criação/nome de Inteligência de Dados e outras funções são ideias para lapidar, sem decisão de implementação ou remoção.

**Q12 — Relatórios:**

> OK.
> Além disso, o módulo Relatórios deve contar com uma filtragem independente do mapa. O filtros do mapa só devem ser carregados para dentro de um relatório se o usuário clicar no botão "gerar relatório" no Mapa público. E isso implica em criar esta função no Mapa público.

Resultado: separação de indicadores/estatísticas externas aceita; filtros independentes e transferência explícita pelo mapa adicionados ao comportamento desejado.

**Q13 — gestão e apresentação das fontes:**

> O módulo Fontes deve ser acessível apenas para o Administrador do Vetor Urbano, para inserir novas fontes manualmente e realizar edições se necessárias.
> Já para organizar e mostrar as fontes do Vetor Urbano para o usuário, deve ser criado um botão "Conheça nossas fontes" no rodapé da pagina. Nesta página deve conter o nome e URL das fontes. Mais informações deverão ser inclusas nesta página, mas no momento me encontro sem ideias.

Resultado: gestão exclusiva do Administrador separada de página pública com nome/URL. Exposição pública das notas, justificativas e datas não confirmada. Conteúdo adicional da página fica em aberto. Administrador não foi equiparado automaticamente a Gestor.

**Q14 — fila de revisão:**

> A fila deve ser criada, e apenas o administrador deve possuir acesso.

Resultado: existência e exclusividade de acesso confirmadas. A resposta não fecha individualmente todas as ações de revisão propostas; Q7 continua exigindo revisão humana inicial.

### Orientação para continuidade

O responsável pediu perguntas somente quando realmente necessárias para continuar as respostas recebidas; caso contrário, análise do projeto e indicação das informações faltantes. Ele vai preparar documento reunindo ideias para avaliar e lapidar em conjunto.

Nesta rodada, nenhuma nova pergunta é necessária para consolidar a documentação. Lacunas e evidências do código foram registradas na [definição das funcionalidades](../product/feature-definition.md). Próxima ação: receber as ideias, avaliar valor/encaixe/dependências e distinguir decisões, propostas e itens adiados. Q9 permanece para o futuro. Sem alteração de código, pesquisa/seleção de fonte ou modelo, commit, push ou publicação.
