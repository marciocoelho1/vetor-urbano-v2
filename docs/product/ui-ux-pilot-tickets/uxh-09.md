# UXH-09 — Aplicar área visível explicitamente sem ocultar contexto

**Estado:** proposto para revisão da divisão; não iniciado, sem aceite ou publicação no GitHub.
**Lote:** C.
**Bloqueado por:** [UXH-08](uxh-08.md)
**Condição adicional:** Autorização de implementação ainda não concedida.

## Entrega verificável

Buscar ocorrências na área escolhida por ação explícita, combinando raio e demais filtros sem desligar Áreas de Risco.

## Critérios de aceite

- [ ] Pan/zoom não refaz seleção; aviso Área do mapa alterada distingue câmera atual da área aplicada.
- [ ] Buscar nesta área aplica recorte e sincroniza lista/mapa/resumo; filtros combinam por interseção e vazio explica as restrições.
- [ ] Manter camadas ativas e atribuição/datas; Áreas de Risco não viram ocorrências, contagens ou intensidade.
- [ ] Provar por IDs/requisições/contagens e bordas espaciais em HTTP/PostGIS, além de jornadas em ambos os renderizadores suportados quando aplicável.
- [ ] Não remover filtros ou ampliar raio silenciosamente para evitar vazio; manter registros apenas territoriais sem pins artificiais.

## Rastreabilidade e prova

Critérios compartilhados: **UXH-CA05, UXH-CA06**, na [especificação](../ui-ux-pilot-specification.md). Este ticket cobre sua parcela, não declara todo critério compartilhado encerrado isoladamente.

Aplicar verificações pertinentes da especificação; registrar versão, comandos, ambiente e limitações. API/PostGIS real quando houver seleção/persistência; navegador integrado quando houver jornada. Resultados de testes pulados ou de outra árvore não comprovam entrega. Preservar critérios antigos não superados explicitamente e não reduzir aceite para obter verde.

Ao concluir futuramente, preencher evidência real e pendências remanescentes, atualizar plano/checklist e submeter ao responsável. Não marcar este arquivo como entregue nesta consolidação.

[Plano e dependências](../ui-ux-pilot-plan.md). ID local do incremento UXH, sem equivalência com números antigos 01–36 ou issues do GitHub.
