# Estrutura do repositório

O monorepo separa aplicações, ferramentas, materiais de marca e documentação. Cada pasta tem uma responsabilidade; novos diretórios só entram quando houver uso concreto.

| Caminho | Responsabilidade |
|---|---|
| `apps/web/` | Frontend Angular executável, configuração e testes |
| `apps/web/src/app/` | Componente principal e módulos de domínio, dados, mapas, troca de dados, tema e UI |
| `apps/web/src/styles/` | Tokens, estilos globais, controles e layout |
| `apps/web/public/` | Recursos que a aplicação serve ao navegador |
| `apps/web/prototypes/` | Experimentos isolados da entrada de produção |
| `apps/api/` | Espaço reservado à futura aplicação Java |
| `scripts/` | Verificações reutilizáveis do repositório; `verify*.sh` conferem, `run-local-stack.sh` abre a aplicação local (API + conferência de login) |
| `tools/` | Extração cartográfica e captura visual |
| `assets/brand/` | Materiais e projetos dos vídeos de marca |
| `docs/product/` | Escopo e comportamento atuais |
| `docs/architecture/` | Arquitetura implementada e direção técnica |
| `docs/operations/` | Build, configuração e preparação para hospedagem |
| `docs/development/` e `docs/agents/` | Convenções e orientações de trabalho |
| `docs/history/` | Registro de entregas e decisões anteriores |
| `docs/evidence/` | Resultados e capturas datadas |
| `docs/references/` | Requisitos e referências originais |
| `docs/archive/` | Propostas antigas e artefatos legados, sem execução ativa |

Na raiz ficam os documentos de entrada, o changelog, o plano, as instruções do projeto e as configurações compartilhadas. `.editorconfig` padroniza edição; `.nvmrc` registra o Node.js verificado. Configuração Angular, npm e Prettier fica no módulo web. `.hermes/skills/` mantém as skills locais existentes.

Testes unitários acompanham o código. Playwright fica em `apps/web/e2e/`. Não há pacote compartilhado, infraestrutura ou serviços adicionais sem implementação.

## Mudanças de caminhos

| Caminho anterior | Caminho atual |
|---|---|
| `PATCH_NOTES.md` | `CHANGELOG.md` |
| Diário extenso em `PLAN.md` | `docs/history/work-log-2026-10.md`; estado atual permanece em `PLAN.md` |
| `apps/web/src/app/domain.ts` | `apps/web/src/app/domain/occurrences.ts` |
| Helpers de mapa soltos em `src/app/` | `apps/web/src/app/maps/` |
| Fixtures, importação/exportação, tema e diretivas em `src/app/` | `data/`, `data-exchange/`, `core/theme/` e `ui/` |
| SCSS globais em `src/app/` | `apps/web/src/styles/`; `visual-v2.scss` passa a `layout.scss` |
| `apps/web/src/app/prototypes/` | `apps/web/prototypes/` |
| `e2e/visual-v2.spec.ts` e `visual-v6.spec.ts` | `e2e/workspace.spec.ts` e `layout.spec.ts` |
| Registros de exploração/ajustes em `docs/product/` | `docs/history/design/`; interface atual em `docs/product/interface.md` |
| Proposta extensa de escopo/arquitetura e implementação | `docs/archive/planning/` e `docs/archive/architecture/` |
| `apps/api/src/main/resources/db/migration/V1__Initial_Schema.sql` | `docs/archive/database/initial-schema-v1.sql` |
| `frontend/` e `vetor-urbano-web/` | `apps/web/` |
| `vetor-urbano-api/` | `apps/api/` |
| `mapa-rj-extraction/` | `tools/map-extraction/` |
| `videos/vetor-urbano-motion/` | `assets/brand/video/` |
| `visuais/` e `docs/referencias/` | `docs/references/ui-prototype/` e `docs/references/` |
| `docs/escopo.md`, `arquitetura.md`, `implementacao-2026-10.md` | Escopo/arquitetura atuais e proposta arquivada nos caminhos acima |
| `docs/evidencias/`, `docs/PROJECT-LOG.md` | `docs/evidence/`, `docs/history/project-log.md` |
| `docs/specs/`, pipeline antigo e `planejamento/` | `docs/archive/` |
| `harness.sh` como executor | `scripts/verify.sh`; wrapper antigo preservado |

## Arquivos removidos e preservados

Foram removidos os três arquivos gerados de VS Code em `apps/web/.vscode/`, com porta antiga e depuração Karma sem uso, e `docs/evidence/ui-ux-gallery/review-failure.png`, cópia idêntica da captura válida `proposal-5-320-map.png`.

Fontes e suas licenças, referências originais, mapas, vídeos e evidências de entregas foram preservados. Capturas semelhantes em épocas distintas registram versões diferentes. Os arquivos de instrução dos projetos de vídeo atendem a ferramentas distintas e permanecem junto dos fontes.

Dependências, builds, caches, downloads brutos e resultados temporários ficam fora do Git. A organização não altera regras do produto nem versões de dependências. Resultado da auditoria: [registro de manutenção](../history/repository-maintenance-2026-10-14.md).
