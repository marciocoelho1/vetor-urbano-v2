# UXH-14 — Consultar Histórico com filtros no topo e sem reprodução

**Estado:** proposto para revisão da divisão; não iniciado, sem aceite ou publicação no GitHub.
**Lote:** D.
**Bloqueado por:** [UXH-12](uxh-12.md)
**Condição adicional:** Autorização de implementação ainda não concedida.

## Entrega verificável

Entregar Histórico com consulta explícita, tabela desktop e lista móvel, retirando totalmente a Reprodução temporal.

## Critérios de aceite

- [ ] Destacar busca/período/município/bairro/pilar e recolher complementos mantendo filtros completos e botão Aplicar filtros.
- [ ] Preservar paginação/ordenação/snapshot da consulta, publicadas vigentes/encerradas e indicação de precisão temporal.
- [ ] Remover interface, timers, sinais, eventos e estilos exclusivos da Reprodução temporal; rastrear usos antes de excluir.
- [ ] Preservar filtros de datas, versões e comparação, assim como registros históricos de entregas antigas.
- [ ] Provar ausência do reprodutor e regressões de consulta, erro/vazio, foco e responsividade em navegador/API real.

## Rastreabilidade e prova

Critérios compartilhados: **UXH-CA16**, na [especificação](../ui-ux-pilot-specification.md). Este ticket cobre sua parcela, não declara todo critério compartilhado encerrado isoladamente.

Aplicar verificações pertinentes da especificação; registrar versão, comandos, ambiente e limitações. API/PostGIS real quando houver seleção/persistência; navegador integrado quando houver jornada. Resultados de testes pulados ou de outra árvore não comprovam entrega. Preservar critérios antigos não superados explicitamente e não reduzir aceite para obter verde.

Ao concluir futuramente, preencher evidência real e pendências remanescentes, atualizar plano/checklist e submeter ao responsável. Não marcar este arquivo como entregue nesta consolidação.

[Plano e dependências](../ui-ux-pilot-plan.md). ID local do incremento UXH, sem equivalência com números antigos 01–36 ou issues do GitHub.
