# Contribuir com o Vetor Urbano

Leia o [escopo](docs/product/scope.md), a [arquitetura](docs/architecture/overview.md) e o [plano](PLAN.md) antes de começar. `main` é a branch principal; a aplicação executável está em `apps/web/`.

## Fluxo de trabalho

1. Confira as mudanças locais e atualize a branch com `git pull --ff-only` quando a árvore estiver limpa.
2. Crie uma branch curta: `feat/<assunto>`, `fix/<assunto>`, `refactor/<assunto>`, `docs/<assunto>` ou `chore/<assunto>`.
3. Faça uma alteração com escopo claro e atualize a documentação afetada.
4. Execute as verificações correspondentes e registre resultados e limitações.
5. Use commits descritivos, como `refactor(repo): organize source and documentation`, e abra um pull request para `main`.

## Ambiente e verificações

Use o Node.js de `.nvmrc` e instale com `npm ci --prefix apps/web`. Para desenvolver, execute `npm start --prefix apps/web` e abra `http://localhost:4201/`.

Na raiz:

```bash
bash scripts/verify.sh planning
bash scripts/verify.sh web
npm run lint:prototype --prefix apps/web
npm run build:prototype --prefix apps/web
```

Verifique a galeria quando alterar seus fontes ou configuração. Para testes de navegador, instale Chromium e Firefox pelo Playwright e execute `npm run test:e2e --prefix apps/web -- --workers=1`.

`planning` confere documentos e links locais. `web` executa Prettier, testes unitários e build; não inclui E2E. `api` e `all` exigem a futura aplicação Java e falham enquanto ela não existir. `harness.sh` mantém compatibilidade com os comandos antigos.

O repositório ainda não tem CI automatizada. Informe as verificações locais no pull request; uma execução anterior não valida código novo.

## Convenções

- Pastas e novos documentos usam nomes em inglês, minúsculos e `kebab-case`.
- Código fica no módulo responsável; testes unitários ficam próximos dele, e E2E em `apps/web/e2e/`.
- Protótipos ficam em `apps/web/prototypes/`, com entrada própria e fora do build padrão.
- `public/` contém apenas recursos servidos pelo frontend. Materiais de marca e evidências ficam fora da aplicação.
- Dependências, builds, caches e credenciais ficam fora do Git. Exemplos usam dados fictícios.
- Preserve IDs dos requisitos e referências de origem. Use `CHANGELOG.md` para mudanças e `PLAN.md` para o estado atual; detalhes históricos vão em `docs/history/`.

Veja a [estrutura do repositório](docs/development/repository-layout.md) para decidir onde colocar um arquivo.
