# UXH-13 — Refinar Informes por filtros próprios no servidor

**Estado:** proposto para revisão da divisão; não iniciado, sem aceite ou publicação no GitHub.
**Lote:** D.
**Bloqueado por:** [UXH-12](uxh-12.md)
**Condição adicional:** Autorização de implementação ainda não concedida.

## Entrega verificável

Consultar Informes com pilar/tipo/subtipo/situação e avançados de fonte/confiabilidade, preservando proximidade e vigência.

## Critérios de aceite

- [ ] Destacar local/raio no topo e critérios aplicados junto aos resultados, sem herdar o Mapa.
- [ ] Evoluir contrato HTTP estrito para novos parâmetros com validação/seleção no backend e regressão para chamadas antigas válidas.
- [ ] Preservar união recente/vigente, deduplicação, raio máximo de 5 km e situação efetiva baseada em evidência humana.
- [ ] Provar bordas de distância/24h/expiração, filtros combinados, erro/sem consulta/vazio e alternativa manual após negativa de localização.
- [ ] Manter edição de vigência/painéis restritos aos autorizados; prova de navegador com API/PostGIS real, não filtro exclusivo no cliente.

## Rastreabilidade e prova

Critérios compartilhados: **UXH-CA15**, na [especificação](../ui-ux-pilot-specification.md). Este ticket cobre sua parcela, não declara todo critério compartilhado encerrado isoladamente.

Aplicar verificações pertinentes da especificação; registrar versão, comandos, ambiente e limitações. API/PostGIS real quando houver seleção/persistência; navegador integrado quando houver jornada. Resultados de testes pulados ou de outra árvore não comprovam entrega. Preservar critérios antigos não superados explicitamente e não reduzir aceite para obter verde.

Ao concluir futuramente, preencher evidência real e pendências remanescentes, atualizar plano/checklist e submeter ao responsável. Não marcar este arquivo como entregue nesta consolidação.

[Plano e dependências](../ui-ux-pilot-plan.md). ID local do incremento UXH, sem equivalência com números antigos 01–36 ou issues do GitHub.
