# Ticket 36 — transparência documental — 22/10/2026

## Escopo desta fase

Atualização documental local, sem aceitar o ticket inteiro. O canal autenticado de correções pertence
ao Ticket 27; este checkpoint não declara atendimento operacional, publicação jurídica ou revisão
final pelo responsável. Nenhum dado real foi integrado nesta fase.

## Alteração

- Os quatro textos institucionais foram versionados em conjunto como rascunhos locais v1.4, de
  22/10/2026.
- A metodologia deixou de afirmar que a avaliação operacional está desativada. Agora descreve a
  regra versionada dos Tickets 23/24, o bloqueio de publicação quando falta ou conflita informação
  essencial, a revisão humana e os limites da nota pública, sem expor a rubrica/cálculo interno.
- A jornada E2E documental passou a conferir versão/data e a nova descrição resumida.
- Termos, privacidade e correções seguem identificados como rascunhos locais; o fluxo de correção é
  descrito como integrado local, sem prazo de atendimento nem comunicação externa garantida.

## Verificações desta fase

Verificações desta árvore:

- `bash scripts/verify.sh web`: **passou** — lint limpo, 188 testes em 25 arquivos e build inicial
  847,96 kB. Aviso existente de CommonJS para `pako` no chunk PDF lazy.
- `npm run test:e2e -- --project=chromium --project=firefox e2e/public-information.spec.ts`
  (em `apps/web`): **8/8 passaram**, incluindo acesso aos quatro documentos, teclado/foco/retorno,
  conteúdo e viewport móvel de 390 px.
- `bash scripts/verify.sh planning`: **passou**, 514 links locais; âncoras e URLs externas não são
  verificadas por este modo.
- `git diff --check`: **passou**.

O modo `api` não foi repetido: esta fase não alterou API nem persistência. O canal e sua integração
HTTP/PostGIS pertencem ao Ticket 27 e suas evidências anteriores estão no [checkpoint de 17/10](ticket-36-progress-2026-10-17.md)
e no [lote 27 → 36 → 17 → 18](batch-27-36-17-18-2026-10-17.md); esta atualização não declara
aceite do fluxo ou prontidão operacional.

## Limites e próxima ação

Sem aprovação jurídica, publicação externa, validação de operação, atendimento efetivo garantido ou
aceite integral do Ticket 36. Próxima ação: revisão independente deste delta e decisão posterior do
responsável sobre conteúdo final e destino de publicação.
