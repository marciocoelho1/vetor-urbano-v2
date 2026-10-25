# Verificação do repositório e próxima etapa — 23/10/2026

## Escopo e Git

Verificação e limpeza autorizadas; nenhuma autorização de push, merge efetivo ou implantação.
Baseline: `integration/functional-spec-v1`, HEAD `fc35eba`.

- `git fetch --prune origin` executado com sucesso.
- `origin/integration/functional-spec-v1...HEAD`: 0/0; nenhum commit retornado por `git log --branches --not --remotes --oneline`.
- `origin/main...HEAD`: 1 commit exclusivo da main e 132 da integração. O exclusivo da main é `b69b958`, merge do PR #1.
- `git merge-tree --write-tree origin/main HEAD` saiu 0, árvore simulada `f8d93b682a0bbc23a96a6062b983d895277810b3`: sem conflitos textuais. Não alterou branches ou worktree.
- Diff contra a base comum: 456 arquivos, 62.245 inserções e 2.462 remoções. Isso exige validação integrada antes de recomendar o merge como candidato aprovado; ausência de conflito não comprova funcionamento.

## Limpeza executada

Removidos somente `.angular/`, `apps/web/.angular/`, `apps/web/test-results/`, `tools/__pycache__/` e `tools/tests/__pycache__/`: 6.907.084 bytes (6,91 MB decimais). Antes da remoção, conferida a ausência de arquivos versionados nesses caminhos; depois, conferida a ausência dos diretórios.

Preservados: node_modules, build web recém-verificado, target da API e seus relatórios, `.scratch`, caches do agente, worktrees, referências, fontes/licenças, cartografia, vídeos, documentos e todos os bancos. Nenhuma exclusão global com `git clean -fdX`.

A simulação de limpeza mostrou materiais ignorados que não são lixo: `docs/product/specification.md`, checklist HTML e gerador. A especificação é citada como normativa, mas `git ls-files docs/product/specification.md` não retorna arquivo: um clone novo não recebe essa fonte. Não adicionar ou publicar sem esclarecer o caráter local aprovado anteriormente.

## Verificações reais

- `bash scripts/verify.sh planning`: 517 links locais; passou antes deste registro. Não valida âncoras nem URLs externas.
- `bash scripts/verify.sh web`: lint aprovado; 205 testes em 28 arquivos aprovados; build inicial 852,03 kB. Avisos CommonJS de Leaflet e pako.
- `python3 -m unittest discover -s tools/tests`: 43 testes aprovados. As mensagens de falha/commits no stdout são cenários em repositórios temporários das fixtures, não operações nesta branch.
- `git diff --check`: passou.
- `bash scripts/verify-api-container.sh`: bloqueado por socket REST Podman ausente. Alternativa padrão `/run/user/1000/podman/podman.sock` também ausente; host sem javac. API não revalidada nesta rodada.
- Playwright não executado nesta rodada; não contar suítes condicionais puladas como comprovação.

## Achados e viabilidade

Merge tecnicamente viável, mas aprovação funcional ainda condicionada à API/PostGIS e navegador integrados. Documentação de entrada está defasada: `docs/product/scope.md`, `docs/development/repository-layout.md`, `docs/architecture/overview.md` e o início de `apps/api/README.md` ainda descrevem etapas antigas. O código atual contém backend, autenticação, coleta e 22 migrações; não confundir ausência de operação hospedada com ausência de implementação. Reconciliação documental e tratamento da spec local são recomendados antes da consolidação na main.

## Próxima entrevista — propostas, não decisões

O responsável propôs: mais altura útil do mapa; filtros unificados à direita; área visível aplicada às ocorrências sem desligar Áreas de Risco; controle de raio no canto superior esquerdo; centro por local em vez de coordenadas; resumo mais claro dos filtros; integração operacional e hospedagem, inicialmente Vercel para frontend e opção gratuita para API/banco.

A investigação confirma que a consulta persistida só é ativada em loopback por `isLocalPersistedQuery()` (`apps/web/src/app/data/persisted-query.ts`). Publicar o build isoladamente não habilita a integração remota. Nenhum provedor escolhido, custo aprovado ou mudança de comportamento implementada nesta rodada.

Próxima ação: entrevista com decisões explícitas sobre prioridade, geometria dos recortes/centro e objetivo operacional; depois pesquisa atual de provedores e definição dos incrementos. Preservar critérios de aceite existentes.
