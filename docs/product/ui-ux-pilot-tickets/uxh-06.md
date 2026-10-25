# UXH-06 — Definir centro do raio por local com geometria validada

**Estado:** proposto para revisão da divisão; não iniciado, sem aceite ou publicação no GitHub.
**Lote:** B.
**Bloqueado por:** [UXH-03](uxh-03.md)
**Condição adicional:** Autorização de implementação ainda não concedida.

## Entrega verificável

Trocar a entrada principal por coordenadas no raio do Mapa por seleção de município, bairro ou Área de Risco e um centro interno verificável.

## Critérios de aceite

- [ ] Usar catálogo de localidades disponíveis; bairros dependem das parcelas prontas de UXH-04/05 e Áreas de Risco da versão validada correspondente.
- [ ] Desambiguar resultados e mostrar contexto/tipo territorial; selecionar local não inventa precisão de ocorrências sem ponto.
- [ ] Derivar centro interno da geometria validada e registrar identidade/versão; geometria ausente ou inválida impede essa seleção com mensagem clara.
- [ ] Preservar raio em metros, interseção espacial e consulta explícita; ausência de um conjunto não bloqueia uso de outro já validado nem vira promessa de cobertura completa.
- [ ] Provar geometria côncava/MultiPolygon, homônimo, erro/vazio e seleção por teclado/móvel; não adicionar geocodificador externo nem remover escolha manual de Informes.

## Rastreabilidade e prova

Critérios compartilhados: **UXH-CA04, UXH-CA09**, na [especificação](../ui-ux-pilot-specification.md). Este ticket cobre sua parcela, não declara todo critério compartilhado encerrado isoladamente.

Aplicar verificações pertinentes da especificação; registrar versão, comandos, ambiente e limitações. API/PostGIS real quando houver seleção/persistência; navegador integrado quando houver jornada. Resultados de testes pulados ou de outra árvore não comprovam entrega. Preservar critérios antigos não superados explicitamente e não reduzir aceite para obter verde.

Ao concluir futuramente, preencher evidência real e pendências remanescentes, atualizar plano/checklist e submeter ao responsável. Não marcar este arquivo como entregue nesta consolidação.

[Plano e dependências](../ui-ux-pilot-plan.md). ID local do incremento UXH, sem equivalência com números antigos 01–36 ou issues do GitHub.
