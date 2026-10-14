# Protótipo — galeria de UI/UX

Pergunta: qual alternativa de consulta facilita encontrar ocorrências e usar filtros, com mapa e lista lado a lado no desktop e Mapa / Lista no celular? Há cinco composições iniciais e uma sexta alternativa com a composição da 5 e a paleta original da v2.

```bash
npm run prototype:ui --prefix apps/web
```

Abra <http://127.0.0.1:4210/?variant=1>. A barra inferior permite trocar as seis propostas; “Comparar” resume estrutura e trade-offs. As URLs `?variant=1` a `?variant=6` mantêm a proposta na recarga. A consulta, a seleção e a câmera são compartilhadas durante as trocas e não são persistidas.

| Variante | Direção |
|---|---|
| 1 | Verde institucional — navegação superior, filtros em barra e cartões à direita |
| 2 | Azul cívico — navegação lateral, filtros/resultados à esquerda e mapa à direita |
| 3 | Grafite e areia — consulta compacta, resultados em linhas e mapa à esquerda |
| 4 | Terracota urbana — formulário em três blocos, fichas narrativas à esquerda e mapa à direita |
| 5 | Verde-azulado contemporâneo — mapa amplo e consulta integrada à coluna de resultados |
| 6 | Vetor Urbano v2 — layout e tipografia da 5 com a paleta clara original da aplicação |

## Escopo e estado

Escolha em 14/10: proposta 1 como base, mapa nas dimensões da 5 e categorias sempre visíveis. A variante 1 já apresenta essa combinação; mantém a consulta acima do mapa e amplia sua altura no desktop. A galeria contém a consulta básica; filtros avançados e acesso aos demais fluxos existentes ficam para a integração do visual escolhido, sem decisão de removê-los.

O responsável confirmou as decisões das três rodadas da entrevista: consulta por lugar/período, resultados/filtros mais claros, liberdade de identidade/navegação, disposição lateral, direção cívica/serena, galeria interativa, Mapa / Lista e sugestões fictícias nesta comparação.

É um protótipo descartável de **consulta**, com seis alternativas em uma única rota. Usa Angular/SCSS, fontes locais Manrope/Newsreader e Leaflet já instalado. A configuração `ui-ux-prototype` fornece uma entrada e uma folha global próprias; o build padrão mantém `src/main.ts` e não inclui a galeria. Essa separação permite explorar a navegação/identidade inteira sem alterar as seis visões existentes. Nenhuma dependência nova.

Alternativa adicional solicitada em 14/10: <http://127.0.0.1:4210/?variant=6>. Compartilha o template e os estilos de composição da 5, inclusive filtros recolhíveis e tipografia Manrope; as cores vêm dos tokens claros existentes em `theme.scss` (fundo `#f7f8fa`, superfícies brancas, grafite `#252c36` e verde `#24765b`). A opção 1 ajustada permanece disponível.

Os dados reaproveitam os **71 registros do gerador suplementar** existente, sem os quatro registros iniciais definidos no componente principal. O relógio é fixado em `2026-10-13T18:00:00Z` (15h em America/Sao_Paulo) para comparação justa. Datas são instantes UTC; a interface apresenta São Paulo. Coordenadas usam `[longitude, latitude]`, WGS 84; raio em metros, limites 100–25.000 m. `filterRecords` e `distanceMeters` são os mesmos da aplicação. Mapa e lista recebem o mesmo array filtrado e ordenado.

Sugestões de lugar/endereço são autoria fictícia local, associadas a âncoras demonstrativas; não há geocodificador. Busca real por endereço será objeto de escolha de fonte/serviço após a seleção visual. Nenhuma localização do dispositivo é solicitada. A base raster reutiliza integralmente `public/maps/raster-provider.json`, inclusive créditos e limites de uso local. Fontes/licenças existentes não foram alteradas. Não são dados operacionais.

## Experimentar

- Digite Tijuca, Caxias, Nova Iguaçu ou Rua Exemplo e escolha uma sugestão com clique ou teclado.
- Combine categorias, período e raio. Desmarcar todas as categorias exibe o estado vazio; limpar filtros mostra todos os exemplos.
- Abra um resultado para ver seu contexto e destaque no mapa; clicar no marcador abre o resultado na lista.
- “Escolher no mapa” ativa seleção explícita do centro. Arrastar o mapa muda só a câmera.
- No celular, Mapa / Lista alterna a apresentação com filtros e seleção preservados.
- As setas da barra ou ←/→ fora dos controles/mapa trocam a proposta. “Consulta preservada” mostra o estado compartilhado.
- “Sobre os dados”, “Como consultar” e “Comparar” usam diálogos nativos; Escape fecha e restaura o foco.

## Verificação e continuidade

`npm run lint:prototype --prefix apps/web` confere os fontes do protótipo. `bash scripts/verify.sh web` continua sendo a verificação da aplicação existente, não uma suíte de aceites do protótipo. As capturas e verificações de navegador da galeria ficam em `docs/evidence/ui-ux-gallery/`.

A galeria apresenta propostas claras para escolha; não migra os demais fluxos nem resolve o modo escuro do desenho que vier a ser escolhido. A escolha e suas razões devem ser registradas em `docs/product/ui-ux-exploration.md`. Quando a escolha ocorrer, a skill `prototype` orienta capturar este fonte na branch temporária e apontar sua origem na issue de implementação; reimplementar a opção selecionada com os aceites da aplicação, antes de promover mudanças para `main`.
