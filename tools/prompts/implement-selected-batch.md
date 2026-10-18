# Prompt genérico de implementação

Substitua os três campos iniciais; selecione modelo e effort na interface. Um lote executa sequencialmente, com checkpoint por ticket. Ordem atual em [continuidade](../../docs/history/next-tickets-after-29-28-33-2026-10-17.md).

```text
Implemente no Vetor Urbano somente esta seleção:
TICKET OU LOTE: [IDs locais em ordem; exemplo: 30 → 31]
MODELO: [GPT-6.1 Sol ou GPT-6 Luna]
EFFORT: [Medium, High ou XHigh, conforme o modelo escolhido]

Use implement por ticket, mattpocock-skills:tdd e mattpocock-skills:code-review, lendo os SKILL.md reais. Para diagnóstico de falha existente, use diagnosing-bugs. Mantenha o modelo/effort selecionado; a revisão em dois eixos pode usar os subagentes previstos na skill. Execute o lote sequencialmente no checkout compartilhado.

1. Comece por AGENTS.md, PLAN.md e estado do Git. Consulte a documentação de continuidade mais recente indicada no plano, spec, política de conta/registros, GLOSSARY.md, ADRs e contratos pertinentes. Os tickets estão em .scratch/consulta-coerente/issues/: os IDs locais não são números presumidos do GitHub. Operações remotas seguem docs/agents/issue-tracker.md com mapeamento comprovado.

2. Para cada ticket, declare título, critérios e dependências e confira o código/checkpoint atual. Ticket concluído deve ser preservado; retome apenas pendências comprovadas. Decisões aprovadas mais recentes complementam os critérios antigos. Reconcilie essas diferenças preservando IDs e rastreabilidade. Registre requisito novo fora da fatia como lacuna/proposta de complemento.

3. Registre baseline Git e alterações preexistentes antes de editar. Preserve o trabalho alheio e isole a entrega sem operações destrutivas. Se usar worktree, disponibilize também os documentos necessários que só existam no checkout não commitado.

4. Resolva escolhas técnicas rotineiras dentro do escopo. Para decisão real de produto ainda aberta, apresente exemplo e recomendação concreta e aguarde resposta para a parte dependente. Continue no trabalho independente pronto da seleção. Dependência técnica ausente bloqueia o dependente até sua conclusão verificável.

5. Implemente uma fatia de comportamento por vez, em teste vermelho → implementação mínima → teste verde. As fronteiras já aprovadas são navegador Chromium/Firefox e HTTP → Java → PostgreSQL/PostGIS real, incluindo autorização e persistência. Confira arquivos pelo conteúdo efetivo e apresentação. Use dados fictícios, relógio controlado quando pertinente e migrações novas. Verifique carregamento/erro/vazio, teclado/foco, alternativa em lista e móvel quando aplicáveis.

6. Execute scripts/verify.sh nos modos pertinentes e Playwright separado. Revise a entrega própria contra baseline Git resolvido e diff não vazio em Standards + Spec; corrija findings antes do aceite. Teste ausente/falho e resultado histórico não comprovam sucesso desta entrega.

7. Atualize PLAN.md, CHANGELOG.md, estado do ticket e evidências datadas. Comite somente alterações próprias verificadas, preservando trabalho preexistente. Conclua o checkpoint antes do próximo dependente; se houver bloqueio, registre evidências e avance apenas em outro ticket selecionado que esteja pronto.

Limites: sem push, merge remoto, deploy, coleta/dados reais ou contratação sem autorização específica. Não exponha segredos. Separe aceite sintético local de operação real; textos, fontes e fórmulas pendentes exigem suas decisões específicas.

Ao terminar, informe tickets concluídos/parciais/bloqueados, hashes, comandos/resultados, riscos/limitações e a próxima ação. Não amplie a seleção automaticamente.
```
