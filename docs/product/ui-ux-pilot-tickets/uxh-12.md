# UXH-12 — Abrir detalhe único e retornar ao contexto de consulta

**Estado:** proposto para revisão da divisão; não iniciado, sem aceite ou publicação no GitHub.
**Lote:** C.
**Bloqueado por:** [UXH-07](uxh-07.md)
**Condição adicional:** Autorização de implementação ainda não concedida.

## Entrega verificável

Consultar uma ocorrência por vez pelo pin ou lista em Mapa, Informes e Histórico sem acumular expansões concorrentes.

## Critérios de aceite

- [ ] Usar detalhe consistente em todos os acessos cotidianos e substituir seleção ao abrir outra ocorrência.
- [ ] Fechar retorna contexto, seleção, rolagem e foco ao acionador válido.
- [ ] Preservar referências, precisão, situação/validade e navegação a relacionados identificados fora do recorte.
- [ ] Não alterar contagens/filtros ao abrir detalhe nem eliminar comparação analítica.
- [ ] Provar teclado/móvel e falha de carregamento/detalhe indisponível sem travar lista.

## Rastreabilidade e prova

Critérios compartilhados: **UXH-CA14**, na [especificação](../ui-ux-pilot-specification.md). Este ticket cobre sua parcela, não declara todo critério compartilhado encerrado isoladamente.

Aplicar verificações pertinentes da especificação; registrar versão, comandos, ambiente e limitações. API/PostGIS real quando houver seleção/persistência; navegador integrado quando houver jornada. Resultados de testes pulados ou de outra árvore não comprovam entrega. Preservar critérios antigos não superados explicitamente e não reduzir aceite para obter verde.

Ao concluir futuramente, preencher evidência real e pendências remanescentes, atualizar plano/checklist e submeter ao responsável. Não marcar este arquivo como entregue nesta consolidação.

[Plano e dependências](../ui-ux-pilot-plan.md). ID local do incremento UXH, sem equivalência com números antigos 01–36 ou issues do GitHub.
