# Refinamentos da interface — 14/10/2026

Status: cinco decisões confirmadas pelo responsável com “Sim, sim, sim, sim, sim”; implementação aplicada, com revisão de navegador pendente. Este documento complementa a direção de [visual-v6.md](visual-v6.md); o roadmap continua em [PLAN.md](../../../PLAN.md).

Atualização posterior, autorizada pelo pedido de encaixe na primeira tela: as alturas fixas/ampliadas dos itens 2 e 3 abaixo foram substituídas pelo [ajuste de primeira tela](public-map-first-screen-2026-10-14.md). A verificação de navegador posterior e seus limites estão nesse registro.

## Requisitos fornecidos

1. Dar mais presença e legibilidade às fontes de corpo, atualmente percebidas como magras.
2. Aumentar a altura do mapa público e alinhar os blocos ao lado à sua altura.
3. Fazer o mapa acompanhar o tema claro/escuro da página, mantendo seu botão para uma mudança visual somente no mapa.
4. Retirar do contêiner do mapa a frase “Cor e ícone identificam a categoria; pin ampliado indica seleção”, recuperando espaço para a área cartográfica.

## Estado observado

A interface principal usa Manrope. Há textos auxiliares e controles de 10–12 px. Mapa público e coluna de busca/filtros/resultados compartilham altura total de `clamp(680px, 79dvh, 900px)` no desktop; resumo e legenda ocupam parte da coluna do mapa. No celular, a área cartográfica tem 570 px, reduzidos para 520 px até 560 px de largura.

Os mapas público e de cadastro começam claros e possuem alternância independente do tema da página. O pedido de acompanhamento do tema altera esse comportamento documentado anteriormente; ainda falta definir o ciclo de vida da escolha local.

Inspeção de código e captura existente `docs/evidence/visual-v6/chromium/light-map-1440.png`; nenhuma nova revisão de navegador nesta entrevista.

## Decisões aprovadas e aplicação

1. Reforçar os textos em todas as telas, mantendo Manrope. Corpo com peso 500 e tamanho base de 14 px (`0.875rem`); parágrafos de leitura/formulários reforçados. Textos auxiliares e controles anteriormente abaixo de 12 px passam a pelo menos 12 px (`0.75rem`); códigos cartográficos dos marcadores mantêm sua geometria. Cores auxiliares mais contrastantes nos dois temas, preservando fundos, cores principais e identidade. A busca no celular usa 16 px. Categorias podem quebrar em duas linhas de botões em telas estreitas, mantendo os rótulos completos.
2. Ampliar o conjunto do mapa no desktop para `clamp(800px, 90dvh, 1020px)`. A coluna lateral compartilha essa altura e as bordas externas; busca/filtros ficam no topo e resultados ocupam o restante, com rolagem interna. A área cartográfica recebe o espaço disponível após resumo e legenda. Trade-off aprovado: maior rolagem vertical da página.
3. Manter a área cartográfica no celular em 520–570 px, conforme o breakpoint existente. Mapa / Lista e consulta compartilhada preservados.
4. Mapas iniciam com o tema atual da página. Cada botão local troca somente seu mapa e não persiste essa escolha nem altera a preferência da página. Qualquer mudança efetiva posterior no tema da página, inclusive por sistema ou sincronização entre abas, substitui ambas as escolhas locais. Recarregar restaura o acompanhamento. Mudar de vista conserva a escolha local durante a instância da aplicação.
5. Aplicar o comportamento aos mapas público e de cadastro, também no mapa público ampliado e nos renderizadores MapLibre/Leaflet. A paleta vetorial muda nas instâncias existentes; o fallback continua filtrando somente os tiles.

A frase explicativa indicada foi removida. Categorias, ícones e avisos condicionais de território, raio e densidade permanecem na legenda.

As decisões de interface são reversíveis e ficam neste documento de produto; não exigiram ADR. Os dois conceitos cartográficos estão definidos em [GLOSSARY.md](../../../GLOSSARY.md), sem detalhes de implementação.

## Verificação e limites

Cobertura unitária acrescentada para início no tema escuro, mapa de cadastro aberto após uma escolha local, independência dos botões, sincronização posterior e atualização da paleta nas instâncias vetoriais existentes. E2E ampliados para MapLibre/Leaflet, recarga, sistema/sincronização entre abas, altura desktop/mobile, alinhamento e tipografia.

`bash scripts/verify.sh web` passou na versão final: formatação, **59 testes unitários e build de 499,79 kB sem avisos**, sem ampliar o orçamento de 500 kB. A primeira versão excedeu o orçamento; a sincronização foi simplificada e declarações tipográficas redundantes foram reduzidas. O teste novo de atualização vetorial inicialmente falhou na limpeza porque o mock não oferecia `remove`; o mock foi completado e a suíte inteira passou, sem ignorar cenários. `bash scripts/verify.sh planning` e `git diff --check` passaram; a verificação de planejamento confere estrutura documental.

`npm run test:e2e -- --list` reconheceu 96 cenários em cinco arquivos, distribuídos entre Chromium e Firefox; isto comprova descoberta, não execução. A tentativa direcionada de execução foi bloqueada antes de iniciar os testes: acesso a `127.0.0.1:4201` retornou `EPERM` e o processo de servidor do Playwright encerrou com 127. A política de aprovação rejeitou execução fora do sandbox. Nenhuma nova captura ou resultado de navegador é atribuído a este incremento; as evidências anteriores da proposta 6 foram preservadas. As novas capturas, quando executadas, irão para `docs/evidence/interface-refinements-2026-10-14/`.

Próxima ação: executar os E2E e revisar a interface em navegador com acesso ao servidor local, incluindo 320/390 px e ambos os temas. Nenhuma dependência nova, alteração de backend ou publicação.
