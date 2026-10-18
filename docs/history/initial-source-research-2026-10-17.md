# Primeira fonte — pesquisa para decisão em 17/10/2026

Estado: **pesquisa e recomendação, nenhuma fonte aprovada ou conectada**. Não houve coleta em lote, extração de ocorrências, mensagens externas, cadastro no produto, contratação ou manipulação de dados reais. Foram consultadas páginas públicas de condições, canais e disponibilidade, conforme autorização de pesquisa da entrevista. Complementa D12 da [spec](../product/specification.md) e a [entrevista progressiva](decision-interview-2026-10-17.md).

## Candidata recomendada para priorizar validação

**Agência Brasil — canal RSS Últimas Notícias**, com futura seleção territorial/temática para a RMRJ. Não se confunde com Radioagência Nacional, parceiros internacionais ou toda a EBC como se fossem uma só fonte/canal. Não atribuir nota de confiabilidade a partir desta pesquisa.

| Aspecto | Evidência primária | Conclusão e limite |
|---|---|---|
| Canal concreto | [Página oficial de feeds](https://agenciabrasil.ebc.com.br/feed/) oferece Últimas Notícias e editorias | RSS específico listado: `https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml`. A existência do link foi confirmada; não houve ensaio do conector ou parse de itens |
| Acesso/reprodução | [Serviço gov.br](https://www.gov.br/pt-br/servicos/acessar-noticias-em-tempo-real-gratuitamente), atualizado em 03/07/2026 | Descreve acesso gratuito, reprodução com crédito e aproveitamento por captura automática em portais jornalísticos. Exclui parceiros internacionais. “Ilimitado” no serviço não é quota técnica de requisições |
| Finalidade e conteúdo próprio | [Sobre a Agência Brasil](https://agenciabrasil.ebc.com.br/sobre), [FAQ da EBC](https://acessoainformacao.ebc.com.br/perguntas-frequentes) e [Sala de Imprensa](https://www.ebc.com.br/sobre/sala-de-imprensa) | Política específica distingue fins jornalísticos/comerciais e remete licenciamento comercial à EBC; avisos de terceiros prevalecem para materiais não próprios. Não presumir licença Creative Commons genérica/irrestrita ou que o Vetor Urbano já se enquadre como veículo jornalístico |
| Histórico | [Nota EBC de 23/07/2026](https://www.ebc.com.br/imprensa/2026/ebc-cumpre-legislacao-eleitoral-no-periodo-do-defeso) | Relata indisponibilização temporária de conteúdos de 01/01/2023 a 03/07/2026, arquivamento amplo e retorno gradual; informa restrições até 25/10/2026. Em 17/10, não presumir acervo completo nem antecipar que o retorno anunciado já ocorreu |
| Adequação ao território | Canal é nacional; não foi localizado RSS oficial exclusivo da RMRJ nas páginas consultadas | Cobertura pertinente não prova frequência suficiente, abrangência de todos os municípios ou atendimento contínuo aos três pilares |
| Quotas, frequência e API | Não localizada documentação primária de quota, intervalo mínimo, API pública ou paginação histórica nas páginas consultadas | Nenhum número de frequência, profundidade histórica ou SLA pode ser atribuído ao fornecedor nesta pesquisa |

Limitação da leitura: página Sobre foi consultada na investigação delegada; novas tentativas do agente principal retornaram timeout/erro. Página de feeds e serviço gov.br foram conferidos diretamente; isso não comprova disponibilidade contínua do RSS. Erros pontuais de ferramentas em feeds não comprovam indisponibilidade geral do fornecedor. Termos gerais antigos da EBC ou menções históricas a Creative Commons não substituem condições atuais e avisos individuais.

## Alternativas e trade-off

- **COR-Rio:** conteúdo e missão diretamente ligados à operação da cidade do Rio, portanto recorte municipal mais estreito que a RMRJ. [Termos atuais consultados](https://cor.rio/politica-de-privacidade/) não forneceram, nesta leitura, contrato inequívoco de coleta automatizada/reutilização adequado ao produto. Não presumir autorização por ser órgão público. É alternativa para investigação adicional de canal/permissão, sem afirmar API ou RSS aprovados.
- **Outro veículo local:** pode melhorar densidade territorial, mas exige pesquisa equivalente de canal/direitos/limites. O placeholder de G1 já existente no [contrato local](../architecture/source-management-local-v1.md) está explicitamente não avaliado e com coleta desativada; sua presença não é escolha aprovada nem autorização.

Preferir a Agência Brasil como **candidata prioritária** decorre da existência de RSS oficial e documentação explícita de distribuição. Não promete melhor cobertura local, suficiência para Informes ou licença pronta para qualquer finalidade do Vetor Urbano.

## E20 — Proposta aguardando resposta

Priorizar Agência Brasil/Últimas Notícias como primeira candidata, condicionando a escolha operacional à confirmação de compatibilidade do uso pretendido, direitos de guardar/extrair/exibir, tratamento de parceiros e condições de automação. A confirmação da candidata não autoriza contato externo, conectar fonte, iniciar coleta ou pagar licença. Se as condições forem incompatíveis com finalidade/orçamento a aprovar, reavaliar a candidata em vez de contornar restrições.

Alternativa: priorizar fonte local como COR-Rio e fazer primeiro a apuração de canal e autorização específica. A consequência é mudar o foco da investigação; não há conector operacional já pronto ou autorizado para nenhuma das alternativas.

## Fronteira e dependências

A decisão disponível é **qual candidata priorizar**, não aprovação definitiva de acesso/reutilização. Depois dela, discutir uso pretendido e orçamento; frequência, limites, extração e profundidade histórica dependem dos dados da candidata e das condições aplicáveis. Na falta de quota pública, números poderão ser propostos como limites nossos, claramente distintos de permissão/quota do fornecedor e condicionados à validação externa.

| Pendência externa | Responsável | Falta |
|---|---|---|
| Enquadramento e direitos de uso do produto | Responsável pelo produto; análise jurídica/licenciamento a designar | Definir finalidade e confirmar condições aplicáveis à extração, guarda, apresentação de fatos/referências e eventual uso comercial |
| Condições concretas da candidata | Área de licenciamento/técnica da EBC, somente após contato especificamente autorizado pelo responsável | Clarificar automação, intervalo/limites, conteúdos próprios/parceiros, custos e acesso histórico; não houve contato nesta pesquisa |
| Cobertura/disponibilidade | Responsável técnico, em etapa futura autorizada | Medir janela RSS, estabilidade, frequência útil territorial, lacunas históricas e capacidade de detectar atualizações, sem prometer completude |

Sem tickets revisados ou alterados. Sem nova decisão funcional de coleta ou contratação.
