# UXH-16 — Gerar pelo Mapa e separar painéis e filtros salvos

**Estado:** proposto para revisão da divisão; não iniciado, sem aceite ou publicação no GitHub.
**Lote:** D.
**Bloqueado por:** [UXH-09](uxh-09.md), [UXH-15](uxh-15.md)
**Condição adicional:** Autorização de implementação ainda não concedida.

## Entrega verificável

Copiar filtros aplicados pelo comando no Mapa e apresentar somente análise do relatório gerado, preservando CSV agregado separado.

## Critérios de aceite

- [ ] Gerar relatório no Mapa copia uma vez, navega e gera; se houver escolhas/relatório diferente, oferecer Substituir e gerar ou Manter relatório atual.
- [ ] Menu, pan/zoom, filtros posteriores e exportações não importam critérios; raio/área copiados são visíveis e removíveis sem alterar o Mapa.
- [ ] Retirar painéis demonstrativos reativos ao Mapa de Relatórios; gráficos úteis seguem snapshot sem preenchimento automático inicial.
- [ ] Mover salvar/aplicar filtros do Mapa para o Mapa; preservar importação/análise CSV separada por origem/unidade, sem soma/inclusão automática ou criação de módulo por presunção.
- [ ] Provar cancelamento/substituição, filtros espaciais, mudanças posteriores no Mapa e isolamento de métricas/relacionados no navegador integrado.

## Rastreabilidade e prova

Critérios compartilhados: **UXH-CA19, UXH-CA20, UXH-CA22**, na [especificação](../ui-ux-pilot-specification.md). Este ticket cobre sua parcela, não declara todo critério compartilhado encerrado isoladamente.

Aplicar verificações pertinentes da especificação; registrar versão, comandos, ambiente e limitações. API/PostGIS real quando houver seleção/persistência; navegador integrado quando houver jornada. Resultados de testes pulados ou de outra árvore não comprovam entrega. Preservar critérios antigos não superados explicitamente e não reduzir aceite para obter verde.

Ao concluir futuramente, preencher evidência real e pendências remanescentes, atualizar plano/checklist e submeter ao responsável. Não marcar este arquivo como entregue nesta consolidação.

[Plano e dependências](../ui-ux-pilot-plan.md). ID local do incremento UXH, sem equivalência com números antigos 01–36 ou issues do GitHub.
