# Mapa Público na primeira tela — 14/10/2026

Pedido do responsável: mostrar barra superior e mapa completo sem rolar a página, retirar a faixa “Demonstração / Dados fictícios — não usar para decisões de segurança” da página inicial e indicar que há informações abaixo.

## Aplicação

A altura mínima desktop de 800 px foi substituída pelo espaço restante da janela após o cabeçalho. O cabeçalho mantém sua altura natural; título, consulta, mapa completo com resumo/legenda e link de continuidade compõem a primeira tela. A coluna lateral acompanha a altura do mapa e permite rolagem dos resultados. Não há limitação de altura na página inteira: métricas, resumo e demais conteúdos continuam abaixo.

A faixa foi retirada somente do Mapa Público. O resumo “ocorrências fictícias”, o selo “Mapa demonstrativo” e a legenda continuam identificando os dados. As demais vistas conservam seus avisos, inclusive quando há arquivos importados localmente.

O link “Mais informações abaixo”, acompanhado de uma seta, aponta para `#consultation-overview`. Funciona por clique e Enter, rola até o resumo e transfere o foco ao destino pela navegação nativa. O link tem área de 44 px e foco visível, sem movimento novo.

No celular, a consulta começa com os filtros rápidos recolhidos na aba Mapa; a aba Lista os abre. O usuário pode expandir/recolher o mesmo controle. Busca, filtros avançados, camadas e alternância Mapa / Lista continuam disponíveis. O título usa 22 px até 560 px; o texto de apoio e a linha regional saem da composição compacta. O rótulo visual da busca é ocultado, mantendo a associação acessível ao campo.

Estas decisões substituem os itens 2 e 3 de [interface-refinements-2026-10-14.md](interface-refinements-2026-10-14.md): mapa desktop de 800–1.020 px e área cartográfica móvel fixa de 520–570 px. O restante do refinamento anterior permanece válido. A composição tem altura mínima de 560 px e a área cartográfica de 180 px para conservar os controles. Janelas muito baixas, zoom elevado ou filtros móveis expandidos podem exigir rolagem para manter o conteúdo acessível.

## Evidências

O cenário Playwright de encaixe passou em Chromium e Firefox: sete janelas em cada tema (1920 × 1080, 1440 × 900, 1366 × 768, 1024 × 768, 768 × 1024, 390 × 844 e 320 × 740), sem rolagem inicial ou transbordamento horizontal, com mapa e link inteiros. Verifica também navegação por teclado ao resumo e aviso nas demais vistas. As 28 capturas em `docs/evidence/public-map-first-screen-2026-10-14/` usam tiles simulados para medir geometria; não são evidência do mapa-base real. Capturas desktop e móveis nos dois temas foram inspecionadas.

`bash scripts/verify.sh web` passou: lint, 59 testes unitários e build de 502,64 kB. O build emitiu aviso por ultrapassar o orçamento de 500 kB em 2,64 kB; o limite não foi ampliado. `git diff --check` passou. A primeira execução geral encontrou 89 passados e 9 falhas. O cenário antigo exigia 480 px de mapa e foi atualizado para o novo mínimo de 180 px, mantendo as verificações de encaixe de controles. A sobreposição do rodapé e o fluxo da Lista foram corrigidos. Uma comparação de 220 px falhava no Firefox ao retornar 220,00003 px; agora usa tolerância de 0,005 px. A matriz final direcionada validou **12 cenários nos dois navegadores**: encaixe, todas as vistas/temas com mapa-base real, lista/seleção/filtros, ampliação com teclado/câmera e painel redimensionável. A execução final teve 11 passados e essa única falha de precisão; o cenário corrigido passou nos dois motores na reexecução.

A suíte geral ainda possui dois problemas anteriores, cada um reproduzido em Chromium e Firefox em cópia de `/tmp` com `app.html`, `app.ts` e `public-map.scss` anteriores a este incremento: alternância local do tema do mapa de cadastro MapLibre após mudança do tema da página (`browser-smoke.spec.ts:219`) e transbordamento horizontal do cadastro a 320 px (`browser-smoke.spec.ts:818`). Não foram alterados por esta tarefa. A suíte geral não foi declarada aprovada. Evidência resumida em [verification.md](../../evidence/public-map-first-screen-2026-10-14/verification.md).

Sem dependências novas, backend, publicação, commit ou push. Trabalho local anterior preservado. Próxima ação: revisar o incremento no navegador habitual.
