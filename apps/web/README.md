# Aplicação web

Frontend do Vetor Urbano, em Angular e SCSS. A demonstração usa ocorrências fictícias em memória; o formulário valida dados localmente e não os envia.

Na raiz do repositório:

```bash
npm ci --prefix apps/web
npm start --prefix apps/web
bash scripts/verify.sh web
```

Endereço local: **http://localhost:4201/**. Para testar os navegadores, instale Chromium e Firefox pelo Playwright e execute `npm run test:e2e --prefix apps/web -- --workers=1`.

## Organização

| Pasta | Responsabilidade |
|---|---|
| `src/app/` | Componente principal, configuração e testes da interface |
| `src/app/domain/` | Tipos e regras da consulta |
| `src/app/data/` | Gerador de dados demonstrativos e seus testes |
| `src/app/maps/` | Geometria, estilo e carregamento dos renderizadores |
| `src/app/data-exchange/` | Importação de fontes e exportação XLSX |
| `src/app/core/theme/` | Estado e transição do tema |
| `src/app/ui/` | Diretivas de animação e redimensionamento |
| `src/styles/` | Estilos globais, layout, controles e tokens |
| `public/` | Mapas, pins, fontes, ícones e licenças |
| `e2e/` | Testes Playwright |
| `prototypes/` | Experimentos com build separado |

`npm run build --prefix apps/web` gera `apps/web/dist/web/browser/`. Dependências, build e resultados de testes são ignorados pelo Git.

[Operação e configuração](../../docs/operations/web.md) · [Arquitetura](../../docs/architecture/overview.md) · [Estado e pendências](../../PLAN.md)
