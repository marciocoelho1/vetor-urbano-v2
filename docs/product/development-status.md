# Checklist de desenvolvimento

Atualização: 15/10/2026. Inventário por leitura do código, reconciliado com a [spec v1.1](specification.md). Decisão aprovada não é entrega. A [versão anterior](../../.scratch/consulta-coerente/context-before/development-status.md) e suas evidências foram preservadas; a [entrevista anterior](../history/product-interview-2026-10-14.md) não é a numeração Q1–Q88 da spec.

## O que existe

- [x] Frontend Angular demonstrativo com 75 ocorrências e dois POIs fictícios, mapa/lista e detalhes locais.
- [x] Filtros locais, raio até 25 km, preferências/filtros salvos no navegador e mapas MapLibre/Leaflet.
- [x] Camada territorial atribuída com procedência/autorização registradas; não comprova risco atual/cobertura oficial.
- [x] Informes baseados em estado, Histórico textual, indicadores/comparações e reprodução sequencial experimental.
- [x] Importação manual de CSV agregado/GeoJSON, triagem local de referências e XLSX demonstrativo.
- [x] Formulário que valida campos/coordenadas; não cria, envia ou persiste ocorrência.
- [x] Proposta visual 6, temas claro/escuro e movimento reduzido; testes unitários/Playwright existentes.

Esses itens descrevem o código anterior. Nenhum foi revalidado nesta tarefa de tickets e nenhum implica conformidade com todos os CA da spec.

## Primeiro lote consolidado — consulta demonstrativa coerente

- [ ] 01 — Catálogo D04 e consulta inicial em 24 h/três pilares, com fixtures claramente identificadas.
- [ ] 02 — Ocorrências/acontecimentos, referências, efeitos independentes e painel consistente.
- [ ] 03 — OU/E entre filtros, classificações sem duplicação e remoção/limpeza visível.
- [ ] 04 — Precisão temporal, situações e expiração parametrizada com relógio/validade sintéticos.
- [ ] 05 — Município/bairro, endereço sintético, área visível explícita e itens apenas em lista.
- [ ] 06 — Dois modos, preferência e suspensão/reaplicação de filtros compatíveis.
- [ ] 07 — Agrupamentos e seleção de pins sobrepostos sem deslocar coordenadas.
- [ ] 08 — Informes manuais: recentes/encerradas e vigentes antigas, inicial/máximo 5 km.
- [ ] 09 — Áreas de Risco, fonte/data/limites, temporalidade e versões demonstrativas separadas.
- [ ] 10 — Estados carregamento/erro/vazio e atualização simulada preservando consulta/câmera.
- [ ] 11 — Páginas demonstrativas de fontes e explicação resumida da confiabilidade.

Divisão 01–11 consolidada por autorização do responsável: [um arquivo por ticket](../../.scratch/consulta-coerente/README.md), todos em `ready-for-agent` com execução pendente. 12–36 tiveram revisão integral concluída e permanecem propostas em `needs-triage`, com demonstração/limite e condições de início. A [revisão dos 25](../../.scratch/consulta-coerente/remaining-review.md) registra dependências ajustadas e propostas explícitas, sem implementação iniciada. Provar scraping continua sendo objetivo posterior; dados fictícios não o satisfazem. Este lote tampouco entrega autenticação, moderação real ou cobertura oficial.

## Integrações posteriores do MVP — não iniciadas

- [ ] Leitura persistida com API Java/PostgreSQL/PostGIS, migrações e HTTP no banco real.
- [ ] Cadastro/confirmação, sessão/autorização/MFA administrativo e ciclo de conta — RF05, RNF02/RNF06–RNF08.
- [ ] Fontes administrativas, revisão/publicação, versões/correção/retirada — RF01/RF07, mantendo reconciliações legadas.
- [ ] Logs restritos e retenção configurada, painel de operação e solicitações de correção.
- [ ] Coleta recente e carga retroativa de fontes autorizadas, retomada/idempotência e revisão humana.
- [ ] Avaliação da ocorrência e recomendação mensal de fontes após calibragem/rubrica aprovadas.
- [ ] Proximidade/geolocalização e expiração com parâmetros reais, versões de Áreas de Risco.
- [ ] Histórico avançado, Relatórios independentes, síntese/comparações, calor, XLSX/PDF e avisos integrados.
- [ ] Textos institucionais/metodologia/procedimento de correção; políticas definitivas e liberação operacional ainda pendentes.

MVP não é só consulta local. Tickets futuros têm seus próprios bloqueios de informação na [proposta](../../.scratch/consulta-coerente/README.md). Não assumir coleta/modelo, fórmula, validade, limite oficial ou política definitiva. RF06 continua pendente, e severidade não é sinônimo de confiabilidade.

## Qualidade e pendências preservadas

- [ ] Resolver inicialização E2E e obter matriz de navegador antes de declarar novo aceite; código 127 anterior não é falha reexecutada nesta etapa.
- [ ] Tema local do cadastro vetorial e transbordamento do cadastro em 320 px; refinamento mobile adiado.
- [ ] Bundle inicial: última medição histórica 502,64 kB, aviso de 2,64 kB acima de 500 kB.
- [ ] QA de teclado/foco, leitor de tela, zoom e dispositivo físico; conferência móvel nos fluxos alterados não encerra ensaio físico.
- [ ] RNF01 e RNF05: medir 4G e fluidez móvel em ambiente representativo.
- [ ] Limites oficiais metropolitanos, precisão/cobertura da camada e cartografia/hospedagem antes de uso operacional.
- [ ] Reimportação/versionamento de lotes, mistura de demonstração/importações e links compartilháveis ainda exigem decisão quando esses fluxos forem alterados.

Última manutenção registrou lint/59 unitários/build aprovados, E2E bloqueado em início do servidor. Execução geral anterior teve 89/98 e reexecuções direcionadas, sem aceite geral. [Evidência histórica](../history/repository-maintenance-2026-10-14.md). Não são resultados desta spec.

## Futuro sem compromisso de operação

- [ ] Relatos populacionais, resumo por IA, reprodução temporal avançada, planos/paywall e login externo.
- [ ] RF03/RF04 e RNF03/RNF04: alertas, votos, disponibilidade e escala, sem serviço/ensaio ou encerramento implícito.

Próximo passo: implementar 01 em etapa própria, usando o lote 01–11 consolidado; revisão de 12–36 concluída. Pendências posteriores não bloqueiam catálogo/consulta fictícia. Browser como ponto principal já aprovado. Nenhuma publicação, commit/push ou implementação nesta etapa. O [plano](../../PLAN.md) continua como único roadmap ativo.
