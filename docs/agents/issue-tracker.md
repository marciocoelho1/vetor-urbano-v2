# Issues no GitHub

Issues e especificações ficam no GitHub. Use `gh` no clone; o remoto `origin` identifica o repositório.

| Operação | Comando |
|---|---|
| Ler | `gh issue view <numero> --json number,title,body,labels,comments` |
| Listar | `gh issue list --state open` |
| Criar | `gh issue create --title "Titulo" --body-file /tmp/issue.md` |
| Comentar | `gh issue comment <numero> --body-file /tmp/comment.md` |
| Rotular | `gh issue edit <numero> --add-label "rotulo"` |
| Encerrar | `gh issue close <numero>` |

Escreva textos longos em arquivo e preserve as quebras de linha. Quando uma skill pedir publicação no issue tracker, crie uma issue; quando pedir o ticket, leia a issue correspondente. Um número pode identificar issue ou PR; resolva pelo tipo antes de agir.

**PRs as a request surface: no.** Pull requests servem à revisão de código; a triagem de solicitações usa issues.

Ao usar uma skill de planejamento com mapa e tarefas, crie a issue-mapa com `wayfinder:map`, vincule tarefas como sub-issues e registre dependências nativas do GitHub. Onde não houver suporte, use links `Part of #<numero>` e `Blocked by: #<numero>`. Dependências nativas recebem o ID de banco da issue, distinto de seu número público.

Escolha a primeira tarefa sem bloqueio ou responsável, assuma com `gh issue edit <numero> --add-assignee @me` e registre o resultado antes de encerrá-la. Atualize decisões no mapa. Use os [rótulos de triagem](triage-labels.md).
