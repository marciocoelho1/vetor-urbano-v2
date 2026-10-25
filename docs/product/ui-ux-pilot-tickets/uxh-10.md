# UXH-10 — Operar o mapa móvel com painéis exclusivos

**Estado:** proposto para revisão da divisão; não iniciado, sem aceite ou publicação no GitHub.
**Lote:** C.
**Bloqueado por:** [UXH-09](uxh-09.md)
**Condição adicional:** Autorização de implementação ainda não concedida.

## Entrega verificável

Usar Filtros/Ferramentas/Resultados por botões com ícone e rótulo, mantendo área de mapa e resultados legíveis no celular.

## Critérios de aceite

- [ ] Abrir somente um painel inferior por vez, com fechamento explícito e foco apropriado; não exigir gesto.
- [ ] Preservar câmera, seleção e filtros ao abrir/fechar/trocar; Resultados pode ocupar quase toda a altura.
- [ ] Manter resumo compacto, expansão e acesso a toda lista/paginação sem overflow horizontal ou itens inacessíveis.
- [ ] Conferir toque/teclado, movimento reduzido, claro/escuro, rolagem e alternativa em lista após falha do mapa.
- [ ] Exercitar 390/320 px e larguras intermediárias sem alegar QA físico ou RNF05 por emulação.

## Rastreabilidade e prova

Critérios compartilhados: **UXH-CA07, UXH-CA08**, na [especificação](../ui-ux-pilot-specification.md). Este ticket cobre sua parcela, não declara todo critério compartilhado encerrado isoladamente.

Aplicar verificações pertinentes da especificação; registrar versão, comandos, ambiente e limitações. API/PostGIS real quando houver seleção/persistência; navegador integrado quando houver jornada. Resultados de testes pulados ou de outra árvore não comprovam entrega. Preservar critérios antigos não superados explicitamente e não reduzir aceite para obter verde.

Ao concluir futuramente, preencher evidência real e pendências remanescentes, atualizar plano/checklist e submeter ao responsável. Não marcar este arquivo como entregue nesta consolidação.

[Plano e dependências](../ui-ux-pilot-plan.md). ID local do incremento UXH, sem equivalência com números antigos 01–36 ou issues do GitHub.
