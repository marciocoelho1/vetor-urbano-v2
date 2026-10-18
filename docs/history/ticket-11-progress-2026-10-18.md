# Ticket 11 — jornadas públicas da consulta demonstrativa (18/10/2026)

## Baseline e preservação

- Baseline deste incremento: branch `integration/functional-spec-v1`, HEAD `4ba550e01fc40a3ada4ba30beb09ebd722ef995c` (commit do ticket 19).
- A árvore rastreada estava limpa antes da edição. O arquivo não rastreado preexistente `docs/product/tickets-checklist.html` permaneceu intacto e fora do trabalho.
- Issue local: `.scratch/consulta-coerente/issues/11-paginas-publicas-demo.md`. Decisões preservadas: módulos exigem sessão; páginas institucionais permanecem públicas; não foi reaberta nenhuma decisão de produto.

## Causa e implementação

A adaptação confirmou que duas jornadas começavam sem sessão e aguardavam uma consulta de módulo; a terceira mirava `sources-heading`, da tela administrativa, em vez de `public-sources-heading`, da página pública aberta pelo rodapé. Os módulos de teste agora recebem sessão sintética USER e uma resposta sintética de autorização de navegação, sem API nem dados reais. A visita inicial à página pública de fontes e o teste institucional continuam sem login. O seletor do Histórico acompanha seu rótulo acessível atual.

**Causa-raiz adicional, confirmada na reprodução mínima:** depois do retorno com sessão autenticada, o efeito global que move o foco para o título do módulo executava outro `requestAnimationFrame` e sobrescrevia o foco restaurado pelo retorno público. Antes da correção, a sonda mostrou `focusId=public-sources-link` na pilha e, após o retorno, `activeView=map` com o título do mapa ativo. `app.ts` agora suprime o foco automático do título somente para a view de origem restaurada; a autorização explícita da próxima navegação limpa essa supressão. A regressão permanece coberta pela asserção E2E de foco.

## Cobertura e lacuna registrada

Permaneceram as verificações de G1 como placeholder, exemplos sintéticos com e sem URL, ausência de fontes reais, explicação pública sem fatores internos, retorno/foco, viewport de 390 px e contagens das listas. Os quatro testes do arquivo incluem o percurso institucional anônimo.

**LACUNA — não fechada nesta rodada:** as antigas asserções `Receber arquivo local de fonte aberta` e `Triagem de publicações` estavam associadas a `sources-heading`, na área administrativa, e não pertencem à página pública do ticket 11. Foram retiradas deste E2E sem serem tratadas como comportamento verificado ou removidas do produto. A cobertura desses dois fluxos administrativos não é afirmada aqui; não foi criado ticket/ID novo nem ampliado o escopo.

## RED → GREEN e verificações

- A reprodução informada na issue/solicitação (`npx playwright test public-information.spec.ts --project=chromium`) apresentava 3 falhas e 1 aprovação; foi reexecutada antes das alterações e terminou com status 1.
- A reprodução mínima da perda de foco em Chromium falhou em `toBeFocused()`: o elemento de origem esperado era `public-sources-link`, mas o título do mapa tomou o foco. Depois do ajuste, a jornada do retorno passou.
- `npx playwright test public-information.spec.ts --project=chromium --project=firefox`: **8 testes aprovados** (4 por navegador).
- `bash scripts/verify.sh web`: passou; Prettier, **16 arquivos de teste / 124 testes unitários**, build concluído. Avisos não bloqueantes: bundle inicial **797,63 kB**, acima do orçamento de 500 kB em **297,63 kB**, e dependência CommonJS `pako` via `@pdf-lib/fontkit`.
- `bash scripts/verify.sh planning`: passou com **425 links locais**; âncoras e URLs externas não são verificadas. `git diff --check`: passou.
- `bash scripts/verify.sh api` não foi reexecutado: esta fatia é web-only e não alterou a API. Não foi executada a suíte Playwright de outros tickets.

## Revisão Standards + Spec

- **Standards:** revisão final independente sem violações documentadas ou smells heurísticos relevantes.
- **Spec:** revisão final aprovada; sem requisito público ausente, comportamento fora do escopo ou implementação incorreta. O primeiro parecer identificou que a supressão poderia permanecer ativa; a correção final captura a view antes do `requestAnimationFrame`, consome a supressão para essa view e ignora o callback se a navegação já mudou. Assim, o estado não vaza para `beginMapPick`/`acceptMapPick`; `authorizeView` também limpa a supressão.
- Não foi acrescentado um E2E específico para a sequência de map-pick: o ticket 11 não a exige; a conclusão sobre não persistência desse estado foi feita por inspeção do fluxo, enquanto o retorno público autenticado e seu foco são exercitados nos quatro testes do arquivo.

Aceite local com sessão sintética e dados demonstrativos; não representa prontidão operacional, coleta ou uso real. Sem dependências novas, acesso a dados reais, push, merge remoto ou deploy. Próximo item autorizado: ticket 07; não reexecutar a regressão cruzada 16/16 já comprovada.
