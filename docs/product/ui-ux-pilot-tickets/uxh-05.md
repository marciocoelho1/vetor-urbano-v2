# UXH-05 — Consultar respectivos bairros dos demais municípios da RMRJ

**Estado:** proposto para revisão da divisão; não iniciado, sem aceite ou publicação no GitHub.
**Lote:** B.
**Bloqueado por:** [UXH-03](uxh-03.md)
**Condição adicional:** Autorização de implementação ainda não concedida.

## Entrega verificável

Entregar polígonos e relações município–bairro para os demais municípios da RMRJ sem reduzir o escopo a uma lista de nomes.

## Critérios de aceite

- [ ] Ingerir por conjuntos/fontes verificáveis com licença/autorização, temporalidade, IDs/versionamento e rastreabilidade.
- [ ] Validar geometrias e relações, identificar homônimos e demonstrar ponto interno para cada localidade utilizável.
- [ ] Permitir busca/seleção integrada somente onde houver geometria adequada, explicando lacunas sem inventar limites.
- [ ] Conferir totais por município e nível; entregar matriz completa de cobertura e testes HTTP/PostGIS/navegador.
- [ ] Não encerrar o ticket como cobertura completa com municípios ou bairros ausentes: registrar bloqueio por fonte e entregas parciais separadamente.

## Rastreabilidade e prova

Critérios compartilhados: **UXH-CA09, UXH-CA12**, na [especificação](../ui-ux-pilot-specification.md). Este ticket cobre sua parcela, não declara todo critério compartilhado encerrado isoladamente.

Aplicar verificações pertinentes da especificação; registrar versão, comandos, ambiente e limitações. API/PostGIS real quando houver seleção/persistência; navegador integrado quando houver jornada. Resultados de testes pulados ou de outra árvore não comprovam entrega. Preservar critérios antigos não superados explicitamente e não reduzir aceite para obter verde.

Ao concluir futuramente, preencher evidência real e pendências remanescentes, atualizar plano/checklist e submeter ao responsável. Não marcar este arquivo como entregue nesta consolidação.

[Plano e dependências](../ui-ux-pilot-plan.md). ID local do incremento UXH, sem equivalência com números antigos 01–36 ou issues do GitHub.
