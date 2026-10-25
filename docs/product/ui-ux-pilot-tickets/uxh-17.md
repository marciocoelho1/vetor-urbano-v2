# UXH-17 — Exportar PDF e XLSX do mesmo resultado gerado

**Estado:** proposto para revisão da divisão; não iniciado, sem aceite ou publicação no GitHub.
**Lote:** D.
**Bloqueado por:** [UXH-15](uxh-15.md)
**Condição adicional:** Autorização de implementação ainda não concedida.

## Entrega verificável

Exportar arquivos que correspondam ao relatório gerado completo, sem nova seleção ou importação implícita do Mapa.

## Critérios de aceite

- [ ] Bloquear exportação antes de gerar; PDF/XLSX usam mesmos IDs/filtros/momento/totais do snapshot, não somente a página visível.
- [ ] Eliminar fallback ao Mapa e consulta de seleção nova ao exportar; verificações de autorização/retirada não devem modificar silenciosamente o recorte.
- [ ] Informar necessidade de regenerar quando o conteúdo ficar indisponível, preservando segurança e auditoria.
- [ ] Preservar referências/créditos, precisão, distinção ocorrência/acontecimento, fórmulas/textos seguros, acentos, paginação e resultado vazio.
- [ ] Inspecionar conteúdo real dos arquivos e contagens com integração HTTP/PostGIS e navegador; não aceitar apenas nome/extensão/download.

## Rastreabilidade e prova

Critérios compartilhados: **UXH-CA21, UXH-CA22**, na [especificação](../ui-ux-pilot-specification.md). Este ticket cobre sua parcela, não declara todo critério compartilhado encerrado isoladamente.

Aplicar verificações pertinentes da especificação; registrar versão, comandos, ambiente e limitações. API/PostGIS real quando houver seleção/persistência; navegador integrado quando houver jornada. Resultados de testes pulados ou de outra árvore não comprovam entrega. Preservar critérios antigos não superados explicitamente e não reduzir aceite para obter verde.

Ao concluir futuramente, preencher evidência real e pendências remanescentes, atualizar plano/checklist e submeter ao responsável. Não marcar este arquivo como entregue nesta consolidação.

[Plano e dependências](../ui-ux-pilot-plan.md). ID local do incremento UXH, sem equivalência com números antigos 01–36 ou issues do GitHub.
