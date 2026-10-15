# Ticket 10 — verificação complementar em 15/10/2026

Ticket original: [consulta, atualização e estados](../../.scratch/consulta-coerente/issues/10-consulta-atualizacao-estados.md). Implementação existente desde `6c9e96b`; nesta retomada não alterei o comportamento de produção. Ampliei o E2E para provar a preservação da câmera e os estados de carregamento que faltavam na evidência anterior.

## Critérios e evidência atual

- Aviso de atualização continua simulado, exige ação explícita, atualiza referência exibida de 12:00 para 12:45 (BRT), conserva filtro ativo e centro/zoom do mapa. O centro é comparado abaixo de um pixel de raster no zoom testado para tolerar a projeção subpixel do Leaflet.
- Consulta vazia mostra a mensagem aprovada, oferece expansão de período/território e limpeza; limpar recupera a lista.
- Falha de consulta aparece como erro, não como zero ou sinal de segurança; tentar novamente recupera o resultado.
- Carregamento de consulta tem estado acessível `role=status` e retorna aos 17 registros; falha de mapa mantém os 17 itens na lista, acessíveis por foco e Enter, e retry do provedor recupera o mapa/lista.
- Enquanto os tiles estão retidos, o carregamento do mapa é visível e a lista permanece consultável; liberando as respostas, o estado termina. O cenário também confere largura móvel de 390 px. A falha/retry exercita movimento reduzido.
- Atualização permanece uma simulação local; integração de novas publicações pertence ao Ticket 35. Nenhuma afirmação de push ou coleta instantânea.

## Verificação e revisão própria

- `npx playwright test e2e/query-updates-and-states.spec.ts --project=chromium --project=firefox --workers=1`: **12/12 passaram**, seis cenários por engine, 17,9 s.
- `bash scripts/verify.sh web`: lint, 85 testes unitários e build passaram. Bundle inicial 600,60 kB, aviso 100,60 kB acima do orçamento configurado de 500 kB.
- `bash scripts/verify.sh planning`: passou com 193 links locais. `git diff --check`: passou.
- Revisão própria do diff: somente `apps/web/e2e/query-updates-and-states.spec.ts` foi alterado neste ticket; sem mudança de produção nem parâmetro de produto. Teste limitado a Chromium/Firefox headless; sem QA físico.

## Próximo estado

Critérios demonstráveis do Ticket 10 foram verificados localmente nesta retomada. O ambiente continua sendo a demonstração com fixtures e estado em memória; RNF03 operacional não foi avaliado. Sem publicação ou integração real.
