# Manutenção do repositório — 14/10/2026

O repositório já tinha separação entre aplicações, ferramentas e materiais de marca. A manutenção organiza os fontes web e reduz a documentação de entrada, preservando requisitos e evidências anteriores.

## Mudanças

- Domínio, fixtures, mapas, importação/exportação, tema e diretivas ganharam pastas próprias. Testes acompanham o código; imports estáticos e dinâmicos foram ajustados.
- SCSS globais foram para `apps/web/src/styles/`; o layout usa nome estável em vez de número de proposta visual.
- A galeria foi para `apps/web/prototypes/`, com `tsconfig` próprio e build separado. Os testes E2E receberam nomes por responsabilidade.
- `.editorconfig` foi centralizado e `.nvmrc` registra o Node.js usado na validação. Lint passou a cobrir os fontes do módulo por glob, evitando uma lista manual de arquivos.
- README, escopo, arquitetura, contribuição e guias de operação descrevem o produto atual e a evolução prevista. Um índice orienta a leitura.
- O diário extenso foi preservado em `work-log-2026-10.md`. Propostas completas foram arquivadas com os IDs de RF/RNF, RN-P e CA; decisões visuais foram para `history/design/`.
- O SQL não aplicado saiu da pasta de migrações. Seu conteúdo foi preservado em `archive/database/initial-schema-v1.sql`.
- `PATCH_NOTES.md` passou a `CHANGELOG.md`. Referências Markdown foram atualizadas; caminhos em relatos históricos continuam como registro da época.
- `scripts/verify.sh docs/planning` agora verifica destinos de links locais com Python, sem dependência adicional.
- Novas capturas dos E2E usam o diretório de saída do Playwright. Ferramentas de revisão geram arquivos ignorados em `test-results/`, com destino configurável por `VU_CAPTURE_DIR`; os registros antigos permanecem intactos.

## Limpeza

Removidos `apps/web/.vscode/{extensions,launch,tasks}.json`, gerados pelo scaffold, ignorados nas configurações atuais e com depuração antiga de porta 4200/Karma. Também removido `docs/evidence/ui-ux-gallery/review-failure.png`: o SHA-256 era idêntico ao de `proposal-5-320-map.png`, que permanece preservado.

Referências originais, assets cartográficos, fontes/licenças, vídeo e evidências válidas permanecem. A galeria e os arquivos de instrução dos projetos de vídeo têm uso identificável e foram mantidos. Caches e dependências locais não foram apagados ou incluídos no Git.

## Validação

Lint, **59 testes unitários em quatro arquivos** e build da aplicação passaram após a movimentação. O build inicial manteve **502,64 kB** e o aviso de 2,64 kB acima do orçamento; o CSS global manteve o mesmo hash de conteúdo. Lint e build separados da galeria passaram. Sintaxe dos três scripts de captura conferida com `node --check`; Playwright reconheceu **98 testes em cinco arquivos**.

A tentativa E2E direcionada terminou antes dos cenários: `config.webServer` não iniciou, com código 127. Não há resultado de navegador atribuído a esta manutenção.

A comparação das árvores sintáticas dos **25 arquivos TypeScript**, normalizando apenas caminhos de imports, confirmou equivalência. SHA-256 confirmou **390 arquivos protegidos**, incluindo referências, assets, vídeos, licenças e evidências, além do SQL legado e lockfile. `planning`, links locais e `git diff --check` passaram.

Resultados e limites: [evidência estruturada](../evidence/repository-maintenance-2026-10-14.json).

O aviso de bundle, os dois problemas de navegador já registrados e o QA em aparelho físico/leitor de tela permanecem em `PLAN.md`. Esta manutenção não altera regras de domínio, versões de dependências ou infraestrutura.

## Versionamento

O trabalho anterior de UI/UX foi preservado separadamente no commit `4449457`. A organização fica em commit próprio na branch `feat/ui-ux-gallery`; o responsável autorizou seu push. Não houve merge em `main` ou deploy.
