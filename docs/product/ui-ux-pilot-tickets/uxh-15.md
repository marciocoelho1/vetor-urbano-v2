# UXH-15 — Gerar Relatórios por formulário e ciclo de vida independentes

**Estado:** proposto para revisão da divisão; não iniciado, sem aceite ou publicação no GitHub.
**Lote:** D.
**Bloqueado por:** [UXH-07](uxh-07.md)
**Condição adicional:** Autorização de implementação ainda não concedida.

## Entrega verificável

Configurar Relatórios no topo a partir de estado vazio, separar rascunho de resultado e preservar escolhas explícitas durante a sessão.

## Critérios de aceite

- [ ] Iniciar sem consulta/filtros preselecionados/gráficos/indicadores; exigir período escolhido, validar demais critérios e tratar opcional intocado como sem restrição.
- [ ] Oferecer busca/localidade/classificação/situação/fonte/confiabilidade conforme modo sem fallback ao Mapa.
- [ ] Gerar/Atualizar explicitamente; editar rascunho não muda snapshot e falha não vira vazio ou resultado de outro recorte.
- [ ] Preservar estado ao alternar módulos na sessão; Novo relatório confirma descarte e limpa; não adicionar persistência de geografia entre sessões.
- [ ] Provar requisições/IDs/contagens e síntese/comparação preservadas em API/navegador, incluindo não gerado, gerado vazio e erro.

## Rastreabilidade e prova

Critérios compartilhados: **UXH-CA17, UXH-CA18, UXH-CA22**, na [especificação](../ui-ux-pilot-specification.md). Este ticket cobre sua parcela, não declara todo critério compartilhado encerrado isoladamente.

Aplicar verificações pertinentes da especificação; registrar versão, comandos, ambiente e limitações. API/PostGIS real quando houver seleção/persistência; navegador integrado quando houver jornada. Resultados de testes pulados ou de outra árvore não comprovam entrega. Preservar critérios antigos não superados explicitamente e não reduzir aceite para obter verde.

Ao concluir futuramente, preencher evidência real e pendências remanescentes, atualizar plano/checklist e submeter ao responsável. Não marcar este arquivo como entregue nesta consolidação.

[Plano e dependências](../ui-ux-pilot-plan.md). ID local do incremento UXH, sem equivalência com números antigos 01–36 ou issues do GitHub.
