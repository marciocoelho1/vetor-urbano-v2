# Extensão do grill — Informes, Histórico e Relatórios — 23/10/2026

Estado: Q31–Q38 aprovadas e **grill de produto encerrado por confirmação do responsável**, com autorização de consolidação local de especificação, critérios de aceite e lotes. Complementa a [entrevista principal](map-and-hosting-interview-2026-10-23.md) e alimenta o [adendo UXH](../product/ui-ux-pilot-specification.md). Sem autorização de implementação, publicação de issues, commit, merge, push ou deploy. Nenhum ID de requisito anterior removido/renumerado.

## Pedidos explícitos do responsável

### Informes Ativos

- Adaptar UI/UX à direção visual e responsiva acordada.
- Inserir escolha de filtros.
- Trata-se da jornada de proximidade da view `active`, hoje intitulada «Ocorrências» na navegação; não presumir mudança de nome ou equivalência com os filtros administrativos.

### Histórico

- Adaptar UI/UX e escolha de filtros.
- **Remover completamente Reprodução temporal.** No incremento futuro, retirar interface, controles e caminhos executáveis exclusivos, sinais/timers e estilos sem uso; ajustar testes para comprovar ausência sem reduzir outros critérios. Não confundir com remoção de datas, ordenação, histórico de versões ou filtros de período.
- Registros históricos que descrevem entregas antigas permanecem como história, não são apagados. Documentação corrente deve deixar explícita a retirada quando implementada.

### Relatórios

- Adaptar UI/UX.
- Colocar os filtros **no topo**, não no fim da página.
- Filtros permanecem vazios até escolha explícita do usuário; não preselecionar automaticamente com base no Mapa.
- Importação dos filtros do Mapa **somente** quando o usuário acionar «gerar relatório» **no Mapa**. Abrir Relatórios pelo menu não equivale a esse comando.
- Ciclo de vida definido em Q33/Q34: início vazio em nova sessão/«Novo relatório», preservando escolhas explícitas e resultado ao alternar módulos na mesma sessão. Geração explícita exige período escolhido; campos opcionais sem seleção não impõem restrição. Substituição por novo recorte do Mapa definida em Q36, com confirmação quando houver escolhas/relatório diferente. «Formulário vazio» não significa consultar toda a base nem exibir indicadores zerados.

## Fatos conferidos no código e contratos

- `apps/web/src/app/app.html:1744–2023`: Informes já oferece centro/raio, escolha manual e lista/detalhe; no modo integrado distingue carga, falha, ausência de consulta e vazio. O módulo inclui painel administrativo condicionado ao papel; não expor esse painel ao Usuário por reorganização visual.
- `apps/web/src/app/data/active-report-query.ts:67–92`: consulta integrada envia apenas longitude/latitude/raio ao endpoint de proximidade. O [contrato vigente](../architecture/active-reports-local-v1.md) rejeita parâmetros desconhecidos e não aceita os filtros de Histórico/Relatórios. Adicionar critérios pode exigir evolução do backend e testes, não apenas novos campos visuais.
- Regra atual de Informes: últimas 24h inclusive encerradas/desconhecidas, mais antigas confirmadas ainda em andamento; raio até 5 km. O pedido de filtros não autoriza modificar essa regra sem decisão própria.
- `apps/web/src/app/app.html:2031–2275`: Histórico já possui busca, período, município/bairro, tipo/subtipo, fonte, confiabilidade, situação e pilares. «Inserir escolha de filtros» deve resultar em organização e descoberta melhores, preservando capacidade existente, não duplicação do formulário.
- Reprodução temporal atual está em `app.html:2058–2102` e possui estado/métodos no `app.ts`; sua retirada deve ser rastreada por usos antes de editar.
- Investigação de Relatórios concluída e conferida no código pelo agente principal (somente leitura):
  - `app.html:2412,2474–2483`: o único comando `generateReportFromMap` está hoje **dentro de Relatórios**, não no Mapa. É necessário colocar a entrada no Mapa e eliminar importações alternativas, não apenas renomear o botão.
  - `app.ts:3524–3558`: transferência clona filtros; se diferirem do relatório existente, pede escolha de substituição; atualização usa filtros salvos. Não há vínculo reativo do snapshot com o Mapa.
  - `app.html:2424–2438`, `app.ts:3759–3812`: XLSX está disponível antes de gerar e pode usar `reportQueryFilters ?? queryFilters()`, refazendo consulta e atualizando snapshot. Isso abre um caminho de importação implícita do Mapa incompatível com o pedido. PDF depende do snapshot. Q35 define o contrato futuro comum de ambos.
  - `app.html:2776–2805`: «nenhum relatório gerado» é distinto de resultado vazio; existem também painéis demonstrativos inferiores ligados ao Mapa/importações, fora do snapshot, inclusive com defaults próprios. Não manter dependência do Mapa escondida atrás da reorganização visual; destino desses painéis foi definido em Q37 para o incremento futuro.
  - Relatórios não possui hoje formulário independente completo de critérios de consulta. Não confundir controles de comparação/séries demonstrativas nem `reportFields` do Cadastro de ocorrências com filtros de Relatórios.
  - O rastreamento delegado identificou exigência atual de período na consulta analítica, com exceção restrita de situação em andamento; nenhuma consulta totalmente irrestrita deve ser presumida apenas porque a UI está vazia. Q33 define período escolhido obrigatório para a geração futura.
  - Testes existentes cobrem transferência, substituição, atualização, vazio e exportação, mas não foram reexecutados nesta inspeção. Mudança de semântica precisa de critérios e testes específicos sem transformar ausência de seleção em resultado zero por acidente.

## Direção de UX aprovada em Q31–Q35

- Superfície de consulta, não dashboard decorativo: título compacto, filtros agrupados no topo, resumo aplicado próximo dos resultados e detalhe consistente com o painel único aprovado.
- Informes: prioridade visual a local/raio e resultado próximo; classificação e situação como refinamento, explicações técnicas em divulgação progressiva sem esconder limitações.
- Histórico: busca/período/localidade em primeiro nível e campos menos frequentes em seção avançada; lista paginada e contexto temporal claros, sem reprodutor.
- Relatórios: sequência «Escolher filtros → Gerar → Ler/exportar», com estado inicial de orientação, não relatório fictício pré-gerado. Distinguir filtros em edição do recorte efetivamente usado pelo documento.
- Móvel: filtros recolhíveis e resumo compacto, rótulos acessíveis, resultados/detalhes legíveis, rolagem/foco preservados. A reorganização não altera permissões ou os dois modos de consulta por suposição.

## Rodada Q31–Q35 — aprovada integralmente pelo responsável

- **Q31:** Informes com local/raio em destaque e refinamentos de pilar/tipo/subtipo/situação; fonte/confiabilidade em avançados conforme modo. Preservar janela recente/antigas vigentes e teto de 5 km, sem herança automática do Mapa. Evoluir endpoint e testes para novos critérios.
- **Q32:** Histórico com filtros compactos no topo: busca/período/município/bairro/pilar em primeiro nível, campos complementares recolhíveis e botão «Aplicar filtros». Tabela legível no desktop e lista no móvel, com paginação e detalhe único; sem Reprodução temporal.
- **Q33:** Relatórios sem consulta, gráficos ou indicadores até geração explícita; exigir período escolhido e deixar demais critérios opcionais sem preseleção. Campos sem seleção não restringem; editar prepara rascunho e não altera snapshot até gerar. Estados não gerado/vazio/erro distintos.
- **Q34:** começar vazio em nova sessão/«Novo relatório». Ao alternar módulos na mesma sessão, preservar escolhas explícitas e snapshot, sem importar o Mapa. «Novo relatório» limpa configuração/resultado, com confirmação se houver trabalho a descartar. Não prometer persistência entre sessões ou guardar geografia no navegador por essa decisão.
- **Q35:** PDF e XLSX exportam o mesmo resultado já gerado, sem consulta de seleção nova, fallback ao Mapa ou exportação anterior à geração. Atualização é explícita; autorização/retiradas continuam verificadas e podem exigir regeneração, nunca substituição silenciosa.

## Rodada Q36–Q38 — aprovada integralmente pelo responsável

- **Q36:** «Gerar relatório» no Mapa copia uma vez os filtros aplicados, abre Relatórios e gera. Se houver escolhas/relatório diferente, confirmar com «Substituir e gerar» ou «Manter relatório atual». Alterações posteriores no Mapa não modificam o relatório.
- **Q37:** retirar de Relatórios os painéis demonstrativos dependentes do Mapa; gráficos úteis passam a representar o resultado efetivamente gerado. Salvar/aplicar filtros do Mapa fica no próprio Mapa. Preservar importação e análise de séries agregadas de CSV, separadas das ocorrências, sem soma nem inclusão automática no relatório. Nada de gráficos automaticamente preenchidos antes de gerar. Esta decisão não autoriza apagar dados/fontes nem criar outro módulo por suposição.
- **Q38:** filtros próprios no topo: período, busca textual, município, bairro, pilar, tipo/subtipo, situação, fonte e confiabilidade, respeitando modos simples/avançado. Raio/área importados do Mapa aparecem identificados no resumo e podem ser removidos para gerar novamente, sem alterar o Mapa. Não acrescentar editor de polígonos em Relatórios.

## Fronteira de fechamento

- Nenhuma nova pergunta de produto necessária para esta extensão. Q31–Q38 resolvem os pontos abertos; demais sugestões não selecionadas permanecem fora do incremento.
- Confirmação final recebida: encerrar o grill de produto e consolidar especificação, critérios de aceite e lotes conferíveis. [Plano/tickets propostos](../product/ui-ux-pilot-plan.md). Sem autorização de implementação ou operação Git/publicação.
- E-mail, backup/restauração, destino do feedback e provisionamento seguro de segredos ficam na preparação da hospedagem antes dos convidados, conforme adiamento explicitamente aprovado; não tratados como resolvidos.
- Na consolidação, preservar cobertura de carga/erro/vazio, teclado/foco/móvel/permissões, remoção completa da reprodução e exportações consistentes. Testes antigos precisam reconciliar requisitos aprovados sem reduzir critérios de aceite.

Pendências de hospedagem continuam separadas. Nenhuma conta, teste funcional, código ou dado alterado por este registro.
