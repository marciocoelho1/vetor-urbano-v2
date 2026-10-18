# Definição das funcionalidades

Atualização: 15/10/2026. Referência vigente: [spec v1.1](specification.md), decisões Q1–Q88. A [entrevista Q1–Q14](../history/product-interview-2026-10-14.md) permanece histórica, com numeração distinta. A versão anterior deste documento foi [preservada integralmente](../../.scratch/consulta-coerente/context-before/feature-definition.md). Este documento descreve intenção aprovada e lacunas do código, sem afirmar entrega.

## Decisões aprovadas e diferença para o código

| Área | Comportamento aprovado | Código atual / incremento necessário |
|---|---|---|
| Catálogo e classificação | D04, três pilares, tipos/subtipos; Não informado explícito; classificação adicional não duplica ocorrência. | Catálogo antigo de grupos/crimes/tipos contém classificações incompatíveis; reconciliar sem reinterpretar silenciosamente. |
| Ocorrência e acontecimento | Clippings referenciam efeitos; três efeitos podem representar um acontecimento; situações independentes. | Registro demonstrativo tem uma fonte simples e não modela relações de acontecimentos. |
| Modos | Simples + Análise e Inteligência, preferência preservada, filtros ocultos suspensos com aviso e reconciliação ao retornar. | Não há dois modos de produto; controles e telas existentes não implementam a matriz D03. |
| Inicialização | Nova consulta com 24 h/três pilares. | Inicia um mês e somente Trânsito. |
| Combinação de filtros | OU dentro do filtro e E entre filtros, remoção individual/limpeza. | Categoria/grupo podem admitir registro por caminhos alternativos; testes antigos exigem esse comportamento e precisarão mudar. |
| Tempo e situação | Data do fato distinta de publicação/coleta; precisão explícita; confirmação expira para Desconhecida. | Datas pontuais, quatro estados antigos e coordenadas obrigatórias; sem equivalência automática aprovada. |
| Consulta espacial | Município/bairro filtra; endereço posiciona; área visível depende de ação explícita; só território admite lista sem pin. | Busca local em registros/áreas e raio demonstrativo; faltam filtro territorial estruturado e precisão. |
| Mapa/lista e detalhes | Agrupamento, expansão de coincidências, painel consistente e totais mapeadas/apenas lista. | Mapa/lista e detalhes parciais existentes, sem agrupamento/expansão completos ou registros sem coordenadas. |
| Informes | 24 h inclusive encerradas + vigentes antigas; centro explícito, inicial/máximo 5 km, manual e depois geolocalização. | Seleciona ACTIVE/MONITORING, sem janela/raio próprios; raio do mapa até 25 km não satisfaz Informes. |
| Áreas de Risco | Nova denominação, contexto e referência temporal; versões, disputa sustentada e Não determinado distinto. | GeoJSON existente tem apenas nome/classificação da fonte; preservar atributos, atribuição e limitações. Não inventar evidência ou data individual. |
| Histórico | Todas as publicadas, inclusive vigentes; filtros completos/paginação/data decrescente com precisão. | Consulta textual e ordenação por data exata, sem exclusão por revisão real ou paginação integrada. |
| Relatórios | Filtros independentes; transferência só por Gerar relatório; substituir/manter configuração, momento gerado e atualização explícita. | Métricas/exportação compartilham resultado filtrado do mapa. |
| Síntese, comparação, calor e arquivos | Determinística, totais separados, precisão/cobertura; calor avançado sem peso/POI/polígono; XLSX completo/PDF de relatório. | Indicadores/calor/XLSX demonstrativos parciais; sem síntese/arquivos alinhados à spec e sem PDF. |
| Fontes e avaliação pública | Gestão administrativa; nomes/links disponíveis no rodapé; apenas nota da ocorrência/link resumido. | Tela Fontes acessível sem autorização; não equivale a gestão/avaliação operacional. |
| Revisão/correção | Administrador confere, corrige, associa, aprova, descarta ou mantém pendente com motivo; versões e retirada de erro essencial. | Triagem local de clippings; sem fila de ocorrências, permissão ou persistência. |
| Contas e operação | Usuário/Administrador, módulos autenticados, MFA administrativo, logs e painel de alimentação. | Não há servidor, banco, contas, coleta real ou auditoria. |

Inspeção em 15/10 por leitura do [componente](../../apps/web/src/app/app.ts), [modelo](../../apps/web/src/app/domain/occurrences.ts), [fixtures](../../apps/web/src/app/data/demo-occurrences.ts) e [testes existentes](../../apps/web/e2e/workspace.spec.ts). Não houve execução da aplicação nesta etapa.

## Parâmetros pendentes, sem reabrir as decisões

| Parâmetro | Bloqueia | Não bloqueia |
|---|---|---|
| Fórmula/ajustes/arredondamento e casos calibrados | Nota operacional automática | Nota sintética identificada, catálogo, UI e consulta |
| Rubrica, amostra e janela da fonte | Recomendação numérica mensal | Cadastro/versões e resultado de verificação |
| Validade de confirmação por tipo | Expiração operacional real | Transição parametrizada com valores sintéticos declarados |
| Correspondência/deduplicação ambígua | Associação automática de fatos | Associação explícita após revisão |
| Limites oficiais, trechos e precisão espacial | Cobertura operacional e inclusão espacial completa | Consulta/recortes sintéticos rotulados |
| Confirmação/recuperação, sessão/MFA/desvinculação | Liberação de contas reais | Preparação dos contratos |
| Fontes, autorização, frequência, custo e extração | Coleta real demonstrada | Consulta com fixtures e revisão sintética |
| Desempate/paginação, granularidade/colunas/composição | Aceite final de Histórico/arquivos | Filtros, relações e totais aprovados |
| Retenção e textos institucionais definitivos | Política/publicação definitiva e aceite operacional | Hipótese configurável 60 dias/um ano e planejamento de eventos |

Sem adoção de 40/40/20, notas de veículos reais ou prazos inventados. Escalar somente parâmetro necessário ao ticket em execução. RF06, severidade de RF01 e correspondências dos perfis/requisitos legados precisam de reconciliação explícita.

## Funcionalidades futuras

Relatos da população; interpretação da análise por IA; reprodução temporal integrada ao mapa avançado; paywall/planos e login externo; votos/alertas/geofencing/escala. A definição da landing page e o refinamento específico de mobile estão adiados. Manter a implementação experimental existente não a inclui no aceite do MVP.

## Validação e continuidade

Validação principal pelo navegador já aprovada: jornadas observáveis em Chromium/Firefox, relógio controlado, fixtures com notícias repetidas, efeitos relacionados, posições coincidentes e datas/locais imprecisos. Vitest apoia fronteiras de domínio/exportação; backend futuro exige HTTP com PostGIS real. Não provar permissão por esconder tela.

[Proposta local de tickets](../../.scratch/consulta-coerente/README.md): primeiro lote 01–11 consolidado por autorização do responsável; demais incrementos do MVP revisados integralmente, ainda como propostas. Cada ticket tem comportamento, aceite, bloqueios e parâmetros próprios. A [revisão dos próximos 25](../../.scratch/consulta-coerente/remaining-review.md) e suas [propostas de parâmetros](../../.scratch/consulta-coerente/increment-proposals.md) foram registradas; nenhuma implementação ou publicação autorizada nesta tarefa.
