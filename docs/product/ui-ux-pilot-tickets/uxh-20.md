# UXH-20 — Disponibilizar formulário simples de feedback do piloto

**Estado:** proposto para revisão da divisão; não iniciado, sem aceite ou publicação no GitHub.
**Lote:** E.
**Bloqueado por:** [UXH-07](uxh-07.md)
**Condição adicional:** Aguarda autorização de implementação e definição operacional do destino. Teste de envio externo só com escopo/destino autorizado.

## Entrega verificável

Oferecer Enviar feedback com destino operacional definido, campos curtos e imagem opcional, sem criar módulo de atendimento.

## Critérios de aceite

- [ ] Confirmar destino/serviço com responsável antes de integrar, sem contratar solução ou publicar por presunção.
- [ ] Abrir fluxo acessível no desktop/móvel e comprovar envio/recebimento sem screenshots automáticas, localização ou captura de sessão.
- [ ] Tratar imagem como opcional e explicitar limites/privacidade; não acrescentar telemetria ou exportar contexto secreto.
- [ ] Conferir carga/erro/vazio/sucesso e retorno por teclado, usando dados fictícios em testes.
- [ ] Registrar responsável pelo recebimento e textos aplicáveis; revisão/publicação jurídica do ticket antigo 36/D3 permanece condição própria.

## Rastreabilidade e prova

Critérios compartilhados: **UXH-CA27**, na [especificação](../ui-ux-pilot-specification.md). Este ticket cobre sua parcela, não declara todo critério compartilhado encerrado isoladamente.

Aplicar verificações pertinentes da especificação; registrar versão, comandos, ambiente e limitações. API/PostGIS real quando houver seleção/persistência; navegador integrado quando houver jornada. Resultados de testes pulados ou de outra árvore não comprovam entrega. Preservar critérios antigos não superados explicitamente e não reduzir aceite para obter verde.

Ao concluir futuramente, preencher evidência real e pendências remanescentes, atualizar plano/checklist e submeter ao responsável. Não marcar este arquivo como entregue nesta consolidação.

[Plano e dependências](../ui-ux-pilot-plan.md). ID local do incremento UXH, sem equivalência com números antigos 01–36 ou issues do GitHub.
