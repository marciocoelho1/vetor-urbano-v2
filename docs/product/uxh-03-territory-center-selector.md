# UXH-03 — Especificação de interface: seletor «Definir centro por local»

Versão 1 • 24/10/2026 • autor: @ux • ticket: [uxh-03](ui-ux-pilot-tickets/uxh-03.md) • critérios: UXH-CA09, UXH-CA10

Especificação de tela para o @executor implementar. Não altera contrato de API nem arquitetura: o módulo e o esquema são decisão do @arquiteto (`catalog_*`, `/api/v1/territories`). Aqui estão estados, hierarquia, teclado, semântica, microcopy e o que a tela precisa receber para não inventar dado.

## 1. Onde a tela entra

No bloco de raio do mapa, dentro dos controles já existentes em `apps/web/src/app/app.html` (`button.map-radius-disclosure` → `#map-radius-options`). Hoje esse bloco tem, nesta ordem: slider, dica, `Centro: lon, lat`, botão «Escolher centro no mapa» e `details` «Definir centro por coordenadas».

Ordem nova (substitui a entrada principal por coordenadas, conforme decisão de 23/10):

1. slider de distância (inalterado)
2. dica de uso (inalterada)
3. **«Definir centro por local»** — novo bloco de seleção, imediatamente acima do centro exibido
4. linha de centro atual (inalterada em forma, enriquecida quando a origem é catálogo)
5. «Escolher centro no mapa» (inalterado)
6. `details` «Definir centro por coordenadas» (inalterado, mantido como alternativa secundária)

Não duplicar o seletor no módulo Informes: lá a escolha manual de centro continua como está (a especificação proíbe retirá-la por suposição). Quando o raio estiver desativado, o seletor também não aparece — o centro só tem efeito com raio ativo, e exibir o controle sem efeito seria promessa falsa.

## 2. Anatomia do bloco

```
[ ▸ Raio personalizado · 1.000 m ]            ← disclosure existente
   ├── slider
   ├── «Definir centro por local»  [ aria-expanded ]
   │     ├── label «Buscar município»
   │     ├── input (combobox)
   │     ├── listbox de opções
   │     ├── linha de cobertura
   │     └── linha de atribuição
   ├── «Centro: …»
   ├── «Escolher centro no mapa»
   └── details «Definir centro por coordenadas»
```

- O bloco abre como disclosure próprio, fechado por padrão, com estado preservado enquanto a página estiver aberta.
- Largura: ocupa a coluna do bloco de raio; nunca cria rolagem horizontal.
- Opção = linha inteira clicável, altura mínima **44 px** no toque e **40 px** no desktop; nada de botão dentro de opção.
- Cada opção tem duas linhas: **nome** (peso maior) e **linha de contexto** (código IBGE + UF). Nome quebrado em até 2 linhas; sem `text-overflow` que esconda o nome.
- Cobertura por opção: marcador textual, não só cor — `Geometria validada` ou `Sem geometria validada`.
- Opção «Sem geometria validada» aparece na lista, é lida por leitor de tela, mas **não é selecionável** (`aria-disabled="true"`, pulada pelas setas). Nunca selecionar sem geometria: não existe centro inventado, centroide de bounding box nem média de ocorrências.

## 3. Dados que a tela exige

A tela não calcula cobertura, não normaliza geometria e não decide qual município existe. Precisa receber, por território:

| Campo | Uso na tela |
|---|---|
| `id` estável + `officialCode` (IBGE 7 dígitos) | chave da seleção e do estado; exibido como `IBGE 3304557` |
| `level` | hoje só `MUNICIPALITY` é renderizado; outros níveis ficam ocultos, não omitidos por falha |
| `name` | linha principal |
| `version` | exibido após selecionar (`versão N`) |
| `internalPoint` `[longitude, latitude]` | centro do raio e centro da câmera **exclusivamente** daqui |
| cobertura (`validated`/`pending`) | marcador por opção + contagem |
| `dataset`: fonte, licença/atribuição, `referenceDate`, `obtainedAt`, `limitations` | linha de atribuição do bloco |

Bloco agregado: `expected`, `available`, `pending` por nível, calculados no servidor. A tela nunca conta itens da lista para dizer «22 de 22».

Nomes de campo/endpoint: @arquiteto/@executor confirmam; a tela só exige que existam e sejam estáveis.

## 4. Fluxo

1. Pessoa abre «Raio personalizado» e aciona «Definir centro por local».
2. Lista carrega (primeira abertura de cada sessão; cache em memória da sessão, sem `localStorage`).
3. Digita parte do nome → filtro local, sem nova requisição por tecla (o catálogo municipal tem 22 itens; buscar no servidor a cada tecla é custo sem ganho).
4. Escolhe com clique ou Enter.
5. Centro passa a ser o `internalPoint` da versão; a câmera centraliza nesse ponto e enquadra o círculo de raio. **Nenhuma consulta é disparada pela seleção** — a consulta continua explícita, e o aviso «Área do mapa alterada» segue a regra já existente.
6. Linha de centro passa a mostrar nome + código + versão, e não só coordenadas.
7. «Escolher centro no mapa» ou editar coordenadas desfaz o vínculo com o território: a linha volta a exibir coordenadas e o nome do município desaparece. Estado honesto — não manter nome de município com centro que já não é o dele.

Também é preciso guardar o último centro manual, para que remover a escolha de território (pelo resumo de filtros, quando ele existir) volte ao centro anterior e não a um valor arbitrário.

### Desambiguação

- Homônimos: a linha de contexto diferencia por UF e código IBGE; o nome acessível da opção é `Nome, IBGE 3304557`.
- Busca sem acento e sem caixa: normalizar NFD, remover diacríticos, comparar em minúsculas. «sao goncalo» encontra «São Gonçalo».
- Sem ordenação por relevância inventada: ordem alfabética por nome normalizado, com os disponíveis antes dos pendentes dentro de cada letra (evita lista morta no topo).

## 5. Os seis estados obrigatórios

| Estado | Comportamento | Texto exato |
|---|---|---|
| Carregando | lista vazia com altura reservada, sem spinner infinito; `role="status"` | «Carregando catálogo territorial…» |
| Erro | painel aberto, foco onde estava, `role="alert"`, botão de nova tentativa que refaz a requisição | «Não foi possível carregar o catálogo territorial.» / botão «Tentar novamente» |
| Vazio (busca) | lista sem opções, termo entre aspas, ação de limpar | «Nenhum município corresponde a “{termo}”.» / «Limpar busca» |
| Vazio (catálogo) | catálogo publicado sem território disponível; aponta o caminho que ainda funciona | «Catálogo territorial ainda não publicado.» / «Use “Escolher centro no mapa” ou as coordenadas.» |
| Teclado | fluxo completo sem mouse (§6) | — |
| Alternativa em lista | mapa quebrado/sem tiles: seletor e coordenadas continuam operáveis; «Escolher centro no mapa» fica desabilitado com motivo, não some | «O mapa não está disponível. Escolha o centro pelo catálogo ou pelas coordenadas.» |
| Móvel 390 px (e 320 px) | mesma estrutura em coluna única, opções com 44 px, lista com altura máxima de 50vh e rolagem interna; sem painel inferior novo, pois Filtros/Ferramentas/Resultados são do Lote C — o componente depois migra para «Ferramentas» sem mudar contrato | — |

Linha de cobertura, sempre visível quando há catálogo:

- completo: «22 municípios no catálogo, todos com geometria validada.»
- parcial: «Cobertura parcial: 18 de 22 municípios com geometria validada.»
- nenhum: «Nenhum município com geometria validada.»

Contagem anunciada em região viva (polite), só quando muda: «{n} municípios encontrados», no singular «1 município encontrado», em zero «Nenhum município encontrado».

Linha de atribuição (obrigatória, discreta, uma linha que pode quebrar): fonte, data-base e licença vindas do `dataset`, ex. «Fonte: IBGE — Malha Municipal, data-base 2022 · Licença e limitações em Fontes». Nunca hardcodar literal de licença no template.

## 6. Teclado

| Contexto | Tecla | Ação |
|---|---|---|
| «Definir centro por local» | Enter / Space | abre ou fecha o bloco; ao abrir, foco vai para o campo de busca |
| Campo | caractere | filtra; nunca bloquear digitação |
| Campo | ArrowDown / ArrowUp | percorre opções selecionáveis (pula `aria-disabled`); abre a lista se fechada |
| Campo | Home / End | primeira / última opção selecionável |
| Campo | Enter | seleciona a opção ativa, fecha a lista, foco volta ao botão do bloco |
| Campo | Escape | fecha a lista; segundo Escape fecha o bloco e devolve foco ao disclosure «Raio personalizado» |
| Qualquer | Tab | sai do bloco para «Escolher centro no mapa»; **não** prender foco |

- Opção ativa rolada para dentro da lista (`scrollIntoView({ block: 'nearest' })`).
- Foco visível obrigatório em: botão do bloco, campo, opção ativa, links da atribuição. `:focus-visible` com o indicador do projeto; nunca `outline: none` sem substituto.
- Opção ativa não pode ser indicada só por cor de fundo: somar barra de 2 px e peso tipográfico.

## 7. Semântica e ARIA

- Campo: `<input type="search" role="combobox" aria-expanded aria-controls="map-locality-listbox" aria-autocomplete="list" aria-activedescendant="…" aria-describedby="map-locality-hint map-locality-count" autocomplete="off">`. Label visível `<label for>` «Buscar município» — placeholder não é label.
- Lista: `role="listbox"` com `aria-label="Municípios"`, opções `role="option"` + `aria-selected`; opções indisponíveis com `aria-disabled="true"`.
- Foco permanece no campo; a opção ativa é apontada por `aria-activedescendant`. Não mover foco do DOM para a opção.
- `role="status"` para carregamento e contagem; `role="alert"` só para a falha de carregamento.
- Região viva de contagem existe vazia no DOM desde a abertura do bloco (anunciar inserção tardia é instável).
- Estado selecionado também em texto na linha de centro: leitor de tela não depende de cor nem de `title`.

## 8. Movimento, zoom e contraste

- Movimento da câmera até o ponto interno: animação apenas em `@media (prefers-reduced-motion: no-preference)`; com movimento reduzido, salto instantâneo. Nenhuma animação contínua.
- 200% de zoom e 320 px: sem rolagem horizontal, sem corte de nome de município, contagem e atribuição quebrando linha.
- Contraste do marcador de cobertura e da linha de contexto em claro e escuro; estado indisponível precisa permanecer legível (não usar opacidade abaixo de ~0,7 no texto).

## 9. Fora desta tela

Bairros, RAs e APs (UXH-04/05, bloqueados por autorização de fonte) não aparecem como opção nem como «em breve». Camada de polígono municipal no mapa, painéis inferiores móveis, resumo de filtros e botão «Buscar nesta área» pertencem a outros tickets; esta tela não antecipa nenhum deles. A tela também não afirma que a consulta está limitada ao município escolhido: só o centro vem dele.

## 10. Como o @ux vai verificar

1. Navegador real (Chromium e Firefox) em 1440, 1024, 768, 390 e 320 px, claro e escuro: captura de cada estado.
2. Só teclado: abrir bloco, digitar com e sem acento, selecionar, Escape em dois níveis, Tab de saída; registrar ordem de tabulação observada.
3. Árvore de acessibilidade por CDP (`Accessibility.getFullAXTree`): nome, papel e estado de combobox, listbox, opções e opção indisponível.
4. Carregamento e erro por interceptação de rede no navegador, com o método registrado; vazio por termo sem correspondência; catálogo vazio só se houver como forçar no ambiente sintético — senão declaro «não verificado», não presumido.
5. Seleção confrontada com o banco sintético: `internalPoint` devolvido pela API igual ao `ST_PointOnSurface` persistido, e dentro do polígono (`ST_Contains`).
6. Movimento reduzido emulado; verificar que a câmera não anima.

Sem essas provas a tela não passa, mesmo com `verify.sh web` verde.
