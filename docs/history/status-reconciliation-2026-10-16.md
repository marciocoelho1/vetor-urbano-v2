# Reconciliação documental — 16/10/2026

Referência de código: `ba83696`, branch de origem `integration/functional-spec-v1`. Trabalho somente documental, em checkout separado na branch `docs/reconcile-ticket-status-2026-10-16`; nenhum ticket implementado, teste funcional reexecutado, push ou publicação. O checkout original tem alterações preexistentes e é somente leitura nesta sessão; não foi modificado.

## Evidências

Lidos PLAN, registros 05/06/07/10/12/13/14/16, contratos de contas/sessão/fontes e o antigo estado privado. Commits conferidos no Git local: `c528644`, `01a005a`, `8ca44bc`, `067f9c0`, `f93ad96`, `e9bb6e7`, `ba83696`, além de `a836616` para o conteúdo do 36. Resumo: 14 verificados localmente, 2 parciais e 20 pendentes; não representa percentual de implementação ou aceite operacional.

Atualizados resumo/inventário, criado JSON versionado com registros anteriores aninhados para preservar evidências. 07 permanece parcial sem aceite (clique físico MapLibre/Firefox e adaptação dos testes à sessão). 36 permanece parcial documental, dependente do 27 para canal/retorno efetivos. 10 recebeu evidência posterior de 12/12 E2E; 12/13/14/16 têm evidência de integração local, sem operação real. 15 e 17–35 não foram iniciados nesta reconciliação.

## Estado privado e uso

Fonte versionada: `docs/product/implementation-state.json`. O espelho `.scratch/consulta-coerente/implementation-state.json` foi reconciliado somente neste checkout e continua ignorado; o antigo estado do checkout original permanece intocado. Após incorporar o commit, copiar o JSON versionado para esse espelho se um consumidor legado precisar dele. Preservar antes uma cópia do estado local; não inferir autorização para reiniciar o controlador. O estado separado de execução do controlador também precisa de revisão antes de reutilização.

A spec privada e os tickets originais não foram alterados nem adicionados ao Git. Documentos privados ausentes no clone foram copiados apenas para validar links locais; ficam fora do commit. PLAN e CHANGELOG recebem apenas a nota desta reconciliação sobre HEAD, sem incorporar seus diffs preexistentes.

## Contas sintéticas

Os ensaios criaram contas sintéticas e Administrador por bootstrap offline. Não há senha padrão documentada; senhas persistem derivadas e não são recuperáveis. O histórico do 16 referencia `/tmp/vu16-browser-creds.json`, mas esse arquivo não estava disponível nesta sessão. Não foi consultado o banco para confirmar contas ativas, nem lido, exibido ou commitado segredo. Para acesso, cadastrar/confirmar uma nova identidade `.test` na caixa local, ou usar o procedimento offline `scripts/local-account-admin.py` descrito no contrato de sessão para Administrador; não presumir senha dos testes.

## Validação

`bash scripts/verify.sh planning` passou no checkout com referências privadas materializadas apenas para QA; `git diff --check` passou. Auditoria confirmou 36 IDs únicos, 14 verificados/2 parciais/20 pendentes, commits/evidências existentes e igualdade do espelho privado com o JSON versionado. Esses checks são documentais; resultados funcionais citados pertencem aos históricos de origem. A primeira execução de planning apontou referências privadas ausentes e varreu cópias históricas por falta das exclusões locais; as referências necessárias foram materializadas e as cópias históricas excluídas somente do inventário local, sem alterar o executor ou o checkout original.
