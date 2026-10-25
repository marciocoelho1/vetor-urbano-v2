# UXH-03 — Consultar municípios por catálogo territorial versionado

**Estado:** proposto para revisão da divisão; não iniciado, sem aceite ou publicação no GitHub.
**Lote:** B.
**Bloqueado por:** [UXH-01](uxh-01.md), [UXH-02](uxh-02.md)
**Condição adicional:** Autorização de implementação ainda não concedida.

## Entrega verificável

Consultar e selecionar municípios metropolitanos com geometria e identidade próprias na API/banco e interface, preservando a indicação de cobertura.

## Critérios de aceite

- [ ] Incorporar somente conjuntos com origem/direitos conferidos, com identificação estável, versões, referência temporal e trilha de transformação.
- [ ] Validar Polygon/MultiPolygon não vazio, SRID 4326, pertencimento e ponto representativo interno; preservar originais e migrações aplicadas.
- [ ] Expor catálogo utilizável pela seleção/busca, com nomes desambiguados e indicação de cobertura parcial/indisponível.
- [ ] Provar ingestão/versionamento e seleção por HTTP/PostGIS real e navegador; não usar bounding box ou média de ocorrências como território.
- [ ] Conferir todos os municípios esperados antes de declarar cobertura municipal completa; fonte faltante mantém a parte respectiva pendente.

## Rastreabilidade e prova

Critérios compartilhados: **UXH-CA09, UXH-CA10**, na [especificação](../ui-ux-pilot-specification.md). Este ticket cobre sua parcela, não declara todo critério compartilhado encerrado isoladamente.

Aplicar verificações pertinentes da especificação; registrar versão, comandos, ambiente e limitações. API/PostGIS real quando houver seleção/persistência; navegador integrado quando houver jornada. Resultados de testes pulados ou de outra árvore não comprovam entrega. Preservar critérios antigos não superados explicitamente e não reduzir aceite para obter verde.

Ao concluir futuramente, preencher evidência real e pendências remanescentes, atualizar plano/checklist e submeter ao responsável. Não marcar este arquivo como entregue nesta consolidação.

[Plano e dependências](../ui-ux-pilot-plan.md). ID local do incremento UXH, sem equivalência com números antigos 01–36 ou issues do GitHub.
