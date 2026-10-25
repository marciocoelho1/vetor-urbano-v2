# UXH-11 — Reunir telas administrativas em Configurações

**Estado:** proposto para revisão da divisão; não iniciado, sem aceite ou publicação no GitHub.
**Lote:** C.
**Bloqueado por:** [UXH-07](uxh-07.md)
**Condição adicional:** Autorização de implementação ainda não concedida.

## Entrega verificável

Mover telas inteiras atuais de Fontes e Logs para página de Configurações acessível somente ao Administrador.

## Critérios de aceite

- [ ] Exibir exatamente Gestão de Fontes e Logs Administrativos na navegação lateral com conteúdo à direita e Voltar ao aplicativo.
- [ ] Preservar todos os subfluxos operacionais da tela atual de Fontes, sem novas abas irmãs nem perda de edição/revisão/coleta.
- [ ] Manter Fontes públicas separadas; USER não acessa administração por URL/HTTP e ADMIN continua sujeito a MFA.
- [ ] Retornar ao estado anterior da aplicação e confirmar descarte em saída/troca de seção com edição não salva.
- [ ] Provar rotas, autorização, carga/erro/vazio, foco/teclado e versão móvel sem salvamento automático implícito.

## Rastreabilidade e prova

Critérios compartilhados: **UXH-CA13**, na [especificação](../ui-ux-pilot-specification.md). Este ticket cobre sua parcela, não declara todo critério compartilhado encerrado isoladamente.

Aplicar verificações pertinentes da especificação; registrar versão, comandos, ambiente e limitações. API/PostGIS real quando houver seleção/persistência; navegador integrado quando houver jornada. Resultados de testes pulados ou de outra árvore não comprovam entrega. Preservar critérios antigos não superados explicitamente e não reduzir aceite para obter verde.

Ao concluir futuramente, preencher evidência real e pendências remanescentes, atualizar plano/checklist e submeter ao responsável. Não marcar este arquivo como entregue nesta consolidação.

[Plano e dependências](../ui-ux-pilot-plan.md). ID local do incremento UXH, sem equivalência com números antigos 01–36 ou issues do GitHub.
