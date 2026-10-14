# Vetor Urbano

O Vetor Urbano é uma aplicação web para explorar ocorrências urbanas no mapa e entender como elas se distribuem por lugar, categoria e período. Reúne consulta geográfica, histórico e indicadores em uma interface voltada ao Rio de Janeiro e à Baixada Fluminense.

**A versão atual é uma demonstração local.** Usa dados fictícios e permite experimentar os fluxos antes da integração com serviços e dados reais. Ainda não há API, contas de usuário ou banco de dados.

## O que você pode fazer

- Consultar ocorrências de Trânsito, Segurança e Contingência no mapa ou em lista.
- Combinar busca, categoria, período e raio; explorar pontos de interesse, territórios e camadas de densidade.
- Ver detalhes, informes ativos, histórico, indicadores e comparações entre períodos.
- Salvar filtros neste navegador, reproduzir o histórico local e exportar resultados para Excel.
- Importar CSV agregado ou GeoJSON de eventos, informando origem, licença, data e limitações da fonte.
- Experimentar o cadastro com escolha do local no mapa e validação dos campos.

O cadastro não envia informações. As importações permanecem na aba atual e são descartadas ao recarregar. Os exemplos e as camadas territoriais não representam informação de segurança em tempo real.

## O que está por vir

A próxima etapa prevista é integrar uma API Java com PostgreSQL/PostGIS para persistir e consultar ocorrências. Depois vêm autenticação, permissões de Operador e Gestor, moderação e auditoria. A evolução também prevê filtros no servidor e revisão das fontes e da cobertura territorial.

Alertas, notificações e colaboração por votos fazem parte do backlog e dependem de pesquisa e decisões de produto. A ordem e as condições de cada etapa estão no [plano de trabalho](PLAN.md).

## Executar localmente

Use a versão de Node.js indicada em [.nvmrc](.nvmrc). O pacote web declara o gerenciador em `packageManager` e mantém as dependências no lockfile.

```bash
npm ci --prefix apps/web
npm start --prefix apps/web
```

Abra **http://localhost:4201/**. Os mapas precisam de acesso ao provedor cartográfico. A configuração atual atende ao desenvolvimento em `localhost` e `127.0.0.1`; outros domínios precisam de configuração própria. Consulte o [guia de operação](docs/operations/web.md) antes de preparar hospedagem.

## Verificar

Na raiz do repositório:

```bash
bash scripts/verify.sh planning
bash scripts/verify.sh web
```

Para os testes de navegador:

```bash
cd apps/web
npx playwright install chromium firefox
npm run test:e2e -- --workers=1
```

`web` executa formatação, testes unitários e build. A matriz Playwright é separada. Resultados e pendências atuais ficam em [PLAN.md](PLAN.md).

## Estrutura

```text
apps/web/       Aplicação Angular, testes e protótipos isolados
apps/api/       Espaço reservado para a futura API Java
assets/brand/   Materiais e fontes dos vídeos de marca
docs/           Produto, arquitetura, operação e registros históricos
scripts/        Verificações do repositório
tools/          Extração cartográfica e revisão visual
```

O frontend usa Angular, TypeScript e SCSS, com MapLibre e recuperação por Leaflet. O build de produção contém apenas a aplicação principal.

[Documentação](docs/README.md) · [Contribuir](CONTRIBUTING.md) · [Arquitetura](docs/architecture/overview.md) · [Histórico de mudanças](CHANGELOG.md)
