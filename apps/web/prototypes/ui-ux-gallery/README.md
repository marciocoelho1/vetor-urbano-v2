# Galeria de UI/UX

Experimento de consulta com seis alternativas de layout. A proposta 6 foi escolhida e aplicada à interface principal em 14/10/2026; esta galeria preserva a comparação.

Na raiz do repositório:

```bash
npm run prototype:ui --prefix apps/web
```

Abra **http://127.0.0.1:4210/?variant=6**. A barra inferior troca as propostas; `?variant=1` a `?variant=6` mantém a escolha na recarga. Filtros, seleção e câmera são compartilhados durante as trocas.

| Variante | Direção |
|---|---|
| 1 | Verde institucional |
| 2 | Azul cívico |
| 3 | Grafite e areia |
| 4 | Terracota urbana |
| 5 | Verde-azulado contemporâneo |
| 6 | Composição da 5 com a paleta original do Vetor Urbano v2 |

A galeria usa 71 registros fictícios, relógio fixo e sugestões de endereço locais. Não há geocodificação real ou envio de dados. A base raster e as licenças são as da aplicação.

```bash
npm run lint:prototype --prefix apps/web
npm run build:prototype --prefix apps/web
```

A entrada e o `tsconfig.prototype.json` são exclusivos deste experimento. O build padrão começa em `src/main.ts` e mantém a galeria fora da aplicação entregue.

Briefing e decisões: [histórico da exploração](../../../../docs/history/design/ui-ux-exploration.md). Verificações anteriores: [evidências da galeria](../../../../docs/evidence/ui-ux-gallery/).
