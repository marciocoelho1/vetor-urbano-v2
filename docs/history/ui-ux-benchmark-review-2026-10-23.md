# Análise do benchmark externo de UI/UX — 23/10/2026

## Fonte e validade

Relatório fornecido pelo responsável: `/home/marciocoelho/Downloads/deep-research-report.md`, «Benchmark global de UI/UX para o Vetor Urbano», lido integralmente. Original preservado fora do repositório; esta análise não importa automaticamente seu roadmap ou requisitos.

O relatório tem valor como repertório, mas o diagnóstico do Vetor Urbano está defasado: cita README/documentos/capturas da `main` e afirma ausência de API, contas e banco (linhas 9, 35–43 e 678). A branch de integração já contém backend, autenticação/MFA, PostGIS, moderação, coleta e versões implementadas localmente; operação hospedada não está validada. Também usa nomes antigos de módulos/perfis e descreve edição de geometrias como inteiramente futura, embora já exista desenho de Áreas de Risco. Não usar isso como fundamento para reimplementar essas capacidades.

As citações internas `turn...` do relatório não têm resolução independente neste arquivo. Links oficiais foram conferidos seletivamente para os padrões centrais, não houve auditoria prática de todas as plataformas, acessibilidade ou desempenho de terceiros.

## Curadoria: o que aproveitar e em que condição

| Padrão no relatório | Aplicação no Vetor Urbano | Estado/decisão |
|---|---|---|
| Mapa predominante e complexidade progressiva (Felt/ArcGIS) | Menos blocos permanentes; filtros, ferramentas e resultados com funções distintas; menus recolhidos no móvel | Alinhado às decisões Q6–Q19; não exige novo framework |
| Resumo em etiquetas acima dos resultados | Duas linhas, remoção/limpeza e expansão explícita | Já escolhido em Q11/Q16; não reabrir localização |
| Estado único mapa/lista/detalhe (CARTO) | Seleção consistente, teclado/toque equivalentes, sem perda de câmera/consulta | Preservar e testar o estado existente, não declarar que ele inexiste |
| Inspetor único de detalhe | Um painel detalhado por ocorrência, mantendo lista compacta; fechamento devolve foco/posição | **Proposta nova**, pois hoje até cinco detalhes inline podem ficar abertos (`app.ts`/`app.html`). Exige decisão; não remover capacidade silenciosamente |
| Procedência visível | Fonte, data-base, precisão, limitações e diferença entre ocorrências fictícias e Áreas de Risco reais | Boa melhoria incremental; não inventar atualização, licença, cobertura ou garantia de segurança. Não expor nota interna da fonte/rubrica de confiabilidade |
| Erros com impacto, recuperação e estado preservado | Distinguir falha de rede/mapa/camada, vazio, carga e último resultado conhecido | Já há estados e fallback; aperfeiçoar consistência/microcopy sem reescrita. Fallback de renderização não deve ser chamado de offline se ainda requer rede |
| Acessibilidade funcional | Lista equivalente, nomes acessíveis, foco devolvido, controles de toque confortáveis, movimento reduzido | Preservar critérios existentes e testar leitor de tela/aparelho físico; não prometer conformidade WCAG por associação com fornecedor |
| Ajuda contextual curta | Dicas dispensáveis para raio, recorte aplicado e filtros, sem tour bloqueante | Proposta útil para teste com convidados; texto precisa corresponder ao comportamento implementado |
| Modos de edição explícitos (iD/geojson.io) | Separar navegação/desenho; cancelamento, estado não salvo, validação de geometria e revisão | Aprimorar fluxo Admin existente; não liberar cadastro para Usuário nem introduzir linhas/pontos/polígonos novos sem escopo |
| Legenda e informações das camadas | Identificar classificação da fonte, data-base e limites em divulgação progressiva | Compatível com ferramentas aprovadas; não criar gerenciador GIS com dezenas de controles por padrão |
| URLs compartilháveis | Guardar recorte/visualização de forma reproduzível | **Proposta posterior**, depende de privacidade/autorização. Centro do raio pode revelar localização pessoal; acesso por link não concede permissão nem garante snapshot idêntico |
| Métricas de UX/performance | Medir primeira consulta, falhas, fluidez e tarefa em aparelho real | Relevante; instrumentação preferencialmente local/minimizada, sem contratar analytics ou capturar buscas/localização por padrão |

## O que adaptar, não adotar literalmente

- **Busca universal:** município/bairro/Área de Risco estão aprovados; endereço, CEP, POI e coordenadas num único campo ampliam o escopo. Não definir centro automaticamente por qualquer busca. Oferecer seleção de resultado identificado e intenção explícita de usar como centro.
- **Camadas:** visibilidade, legenda e procedência são úteis; reordenação por arrastar, saturação e estilo livre devem ter caso de uso comprovado. A disposição aprovada das ferramentas prevalece sobre o `LayerManager` sugerido.
- **Design tokens:** reaproveitar os semânticos existentes e consolidar lacunas, sem rebatizar tudo ou impor os raios/medidas propostos como novos requisitos.
- **Relatórios sincronizados:** relatório atual tem recorte próprio, transferência explícita e snapshot. Cross-filter e gráficos não podem atualizar relatório/snapshot implicitamente; separar exploração temporária de atualização explícita.
- **Compartilhamento:** GeoJSON usa longitude/latitude; o exemplo de URL do relatório usa uma convenção diferente. Definir formato explícito, não copiar a ordem por aparência. Não usar e-mail, token, sessão, posição pessoal ou filtros restritos em links.
- **Vocabulário:** manter Administrador/Usuário e Mapa de ocorrências/Ocorrências conforme produto atual; não restaurar Operador/Gestor, severidade ou nota da fonte como sinônimos de confiabilidade pública.

## O que não incluir neste ciclo

3D/digital twins, rotas, offline com sincronização, colaboração simultânea, votos/relatos públicos, editor GIS generalista, cadastro de geometrias novas por Usuário, dashboards livres ou novo esquema de navegação Explorar/Analisar/Contribuir. São expansões de produto, não pré-requisitos de limpeza visual. Configurações mantém apenas Gestão de Fontes e Logs Administrativos, como decidido.

## Minha recomendação para o piloto de feedback

Propor um ambiente de homologação separado da produção:

- Angular no **Vercel Hobby**, API Java 21 em contêiner no **Render Free**, PostgreSQL/PostGIS no **Neon Free**, inicialmente como candidata técnica, não como contratação aprovada.
- Responsável confirmou teste não comercial, espera de hibernação e lista de e-mails permitidos no backend. Login individual; não depender de conta Vercel do convidado nem senha compartilhada.
- Sessão via mesma origem/proxy a provar, HTTPS, CSRF, respostas privadas sem cache, perfil hospedado seguro, chave MFA estável, banco separado e coleta real desligada. Medir memória/startup da API e testar proxy durante cold start; se não couber no plano, registrar bloqueio antes de qualquer upgrade.
- Ocorrências fictícias rotuladas e Áreas de Risco atuais reais conforme Q23; avisos distintos para não chamar toda a cartografia de fictícia. Fonte, referência temporal e limitações da camada preservadas; revisão de publicação/topologia continua necessária.
- Não misturar produção com homologação: bancos, segredos, contas e configurações separados; sem publicação automática de mudanças não verificadas.
- Primeiro verificar ponta a ponta com o responsável; depois abrir a pessoas próximas, com roteiro curto (localizar → filtrar → selecionar → detalhes → resumo), versão do build e canal de feedback simples. Feedback registra tarefa, esperado/observado e dispositivo; imagem opcional, sem coleta automática de localização, tela, senha ou sessão. Canal ainda a escolher, sem criar novo módulo por suposição.
- Hibernação pode contaminar opinião sobre desempenho: avisar que é limitação do ambiente de teste e registrar separadamente falha de produto, espera do host e opinião visual. Não tratar teste hospedado gratuito como aceite dos RNF de produção.

## Fontes oficiais conferidas nesta análise

- [ArcGIS Map Viewer](https://doc.arcgis.com/en/arcgis-online/get-started/get-started-with-mv.htm): distinção entre conteúdo/configuração, painéis recolhíveis, camadas/legenda e ferramentas contextuais.
- [CARTO Maps](https://docs.carto.com/carto-user-manual/maps): exploração, filtros e seleção espacial como capacidades do Builder; detalhes de cada proposta continuam sujeitos ao desenho local.
- [Felt](https://felt.com/): referência de integração de trabalho cartográfico e controle de acesso; página de produto não prova benchmarks de performance/acessibilidade.
- [Maptionnaire](https://www.maptionnaire.com/product): referência de mapa e gráficos relacionados e rastreabilidade; não adotar participação pública automaticamente.
- [Pesquisa de hospedagem e suas fontes](pilot-territory-hosting-research-2026-10-23.md): Vercel, Render, Neon, Supabase e mapa-base; condições gratuitas são temporais e devem ser reconferidas antes da criação.

## Próxima decisão

Confirmar candidata de homologação e selecionar novas propostas do benchmark, especialmente detalhe único, procedência e feedback, sem reabrir o layout já escolhido. A [cartografia municipal/de bairros/regiões](../product/territorial-mapping-priority.md) recebeu prioridade extrema e tem entrega própria, não pode ser substituída por um recurso visual de busca.
