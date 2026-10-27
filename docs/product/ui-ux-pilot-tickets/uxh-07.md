# UXH-07 — Tornar navegação e linguagem visual responsivas

**Estado:** **implementado localmente em `7bd0a1b`** (26/10/2026), com régua em `e2e/responsive-navigation.spec.ts` — `8/8` (execução do @qa) e `verify.sh web` `EXIT=0` (gate do @executor). Sem aceite do responsável e sem publicação no GitHub.
**Lote:** C.
**Bloqueado por:** [UXH-01](uxh-01.md) — entregue.
**Condição adicional:** autorização de implementação concedida pelo responsável em 26/10/2026 (lotes pendentes).

## Entrega verificável

Manter todas as ações acessíveis sem sobreposição e aplicar a direção visual aprovada às superfícies alteradas.

## Critérios de aceite

- [x] Recolher módulos em Menu antes da sobreposição, identificando módulo atual e preservando conta/modo/tema. — cinco destinos na barra (≤768) e `primary-nav` (≥1024); `aria-current="page"` no ativo; **conta, modo e tema na folha móvel** (a conta era o furo).
- [x] Preservar Manrope, verde, contraste e temas, com menos caixas e hierarquia tipográfica; não acrescentar biblioteca sem necessidade concreta. — nenhuma dependência nova (o commit tem 3 arquivos); escala e pesos por token desde `51fe617`, contraste de controle desde `cedcfa9`/`9d710eb`.
- [x] Conferir redimensionamento intermediário e 1440/1024/768/390/320 px, sem overflow horizontal. — cinco viewports: 5 destinos e 4 ações de sessão comum alcançáveis em todos, `scrollWidth − clientWidth = 0`.
- [ ] **Sem perda de ações** — **não cumprido para ADMIN.** A régua mediu quatro ações de sessão comum (`Minha conta`, `Modo`, `Modo escuro`, `Registrar ocorrência`); a campanha de 27/10 mostrou que a 390 px um ADMIN não alcança **«Logs administrativos»** por caminho nenhum: `.primary-nav` sai de cena abaixo de 768 (shell do UX-6) e a folha móvel oferece cinco destinos, nenhum de administração. `audit_log.spec.ts` está certo ao falhar. Critério pendente de ruling: destino de admin na folha (escopo novo) ou dívida datada.
- [x] Testar teclado/foco e movimento reduzido; transições funcionais não condicionam acesso a conteúdo. — primeiro Tab no skip link («Ir para o conteúdo») nos cinco viewports, com a causa corrigida (o boot não foca mais o título); `reduce` sem movimento provado no UX-4 (`0ms × 144`) e não reexecutado aqui.
- [ ] Manter orçamento de bundle aprovado e controles de autorização; preferência de modo não vira privilégio. — **não remedido após o UXH-07**: último valor em ata **871,81 kB** contra teto **900 kB** (folga 28,19 kB). O gate `verify.sh web` passa, mas não publica a soma aqui.

## Prova desta entrega (26/10/2026)

```
npx playwright test e2e/responsive-navigation.spec.ts --workers=1   → 8 passed (18,2 s)
  aria-current="page" em: ["Ocorrências","Ocorrências"]      (barra + primary-nav oculto no móvel)
  primeiro foco: "Ir para o conteúdo"
  ações (320/390/768/1024/1440): ["Minha conta","Modo","Modo escuro","Registrar ocorrência"]
  overflow 0 px · destinos 5/5 nos cinco viewports · negativo: esconder destino por CSS → 5 → 4
bash scripts/verify.sh web                                          → EXIT=0 (auditor 0/3/0 + selftest 8/8, lint, test:ci 226/226, build)
```

**Ordem entre réguas, para quem escrever a próxima:** o caso de `aria-current` **recolhe a folha antes do clique**, porque o UX-6 assere de propósito que a folha expandida cobre a barra (hit-test: expandida acerta a folha e não item). Medir o atributo por baixo da folha mediria o estado errado — não é contorno, é ordem explícita entre dois instrumentos corretos.

**Achado de escopo, não corrigido aqui:** este arquivo estava com "não iniciado" até 26/10, e o mesmo ocorre em `uxh-03.md` (entregue em `c0b70ac`/`b8c6027`) e nos demais — o `Estado` dos tickets não acompanhou as entregas; o registro vive em `ux-lotes.md` e no `PLAN.md`. Corrigir os 23 arquivos é tarefa de documentação com ruling, não deste commit.

## Rastreabilidade e prova

Critérios compartilhados: **UXH-CA01, UXH-CA02**, na [especificação](../ui-ux-pilot-specification.md). Este ticket cobre sua parcela, não declara todo critério compartilhado encerrado isoladamente.

Aplicar verificações pertinentes da especificação; registrar versão, comandos, ambiente e limitações. API/PostGIS real quando houver seleção/persistência; navegador integrado quando houver jornada. Resultados de testes pulados ou de outra árvore não comprovam entrega. Preservar critérios antigos não superados explicitamente e não reduzir aceite para obter verde.

Ao concluir futuramente, preencher evidência real e pendências remanescentes, atualizar plano/checklist e submeter ao responsável. Não marcar este arquivo como entregue nesta consolidação.

[Plano e dependências](../ui-ux-pilot-plan.md). ID local do incremento UXH, sem equivalência com números antigos 01–36 ou issues do GitHub.
