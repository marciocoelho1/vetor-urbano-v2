# UXH-04 — Consultar bairros, RAs e APs da cidade do Rio

**Estado:** proposto para revisão da divisão; não iniciado, sem aceite ou publicação no GitHub.
**Lote:** B.
**Bloqueado por:** [UXH-03](uxh-03.md)
**Condição adicional:** Autorização de implementação ainda não concedida.

## Entrega verificável

Usar os polígonos e relações oficiais adequados de bairros/RAs/APs do Rio na consulta territorial integrada.

## Critérios de aceite

- [ ] Conferir fonte/data/direitos e alterações posteriores às bases candidatas; não fixar número de bairros a partir de metadado antigo.
- [ ] Preservar IDs e versões e a relação bairro–RA–AP documentada sem equivalência com zonas informais ou Áreas de Risco.
- [ ] Validar topologia, pontos internos, pertencimento e divergências de fronteira/escala; não inventar tolerância para esconder problema.
- [ ] Buscar/selecionar localidades no navegador com catálogo persistido e erros/vazio/cobertura parcial explícitos.
- [ ] Provar relações e geometria em PostGIS real e comparação programática de esperado/disponível/pendente.

## Rastreabilidade e prova

Critérios compartilhados: **UXH-CA09, UXH-CA11**, na [especificação](../ui-ux-pilot-specification.md). Este ticket cobre sua parcela, não declara todo critério compartilhado encerrado isoladamente.

Aplicar verificações pertinentes da especificação; registrar versão, comandos, ambiente e limitações. API/PostGIS real quando houver seleção/persistência; navegador integrado quando houver jornada. Resultados de testes pulados ou de outra árvore não comprovam entrega. Preservar critérios antigos não superados explicitamente e não reduzir aceite para obter verde.

Ao concluir futuramente, preencher evidência real e pendências remanescentes, atualizar plano/checklist e submeter ao responsável. Não marcar este arquivo como entregue nesta consolidação.

[Plano e dependências](../ui-ux-pilot-plan.md). ID local do incremento UXH, sem equivalência com números antigos 01–36 ou issues do GitHub.
