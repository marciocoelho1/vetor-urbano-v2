# Vetor Urbano

O Vetor Urbano é uma aplicação web para explorar ocorrências urbanas no mapa e entender como elas se distribuem por lugar, categoria e período. Reúne consulta geográfica, histórico e indicadores em uma interface voltada ao Rio de Janeiro e à Baixada Fluminense.

**A versão atual é uma demonstração local.** Usa dados fictícios e permite experimentar os fluxos antes da integração com serviços e dados reais. Esta branch já inclui API Java, PostgreSQL/PostGIS e contas com sessão e MFA, no recorte de desenvolvimento local sintético.

## O que você pode fazer

- Consultar ocorrências de Trânsito, Segurança e Contingência no mapa ou em lista.
- Combinar busca, categoria, período e raio; explorar pontos de interesse, territórios e camadas de densidade.
- Ver detalhes, informes ativos, histórico, indicadores e comparações entre períodos.
- Salvar filtros neste navegador, reproduzir o histórico local e exportar resultados para Excel.
- Importar CSV agregado ou GeoJSON de eventos, informando origem, licença, data e limitações da fonte.
- Experimentar o cadastro com escolha do local no mapa e validação dos campos.

O cadastro não envia informações. As importações permanecem na aba atual e são descartadas ao recarregar. Os exemplos e as camadas territoriais não representam informação de segurança em tempo real.

## O que está por vir

Esta branch já traz a API Java com PostgreSQL/PostGIS persistindo e consultando ocorrências, além de autenticação, permissões, moderação e auditoria — o passo a passo está em [Acessar esta branch de integrações](#acessar-esta-branch-de-integrações). A evolução prevê filtros no servidor, coleta das fontes autorizadas e revisão da cobertura territorial.

Alertas, notificações e colaboração por votos fazem parte do backlog e dependem de pesquisa e decisões de produto. A ordem e as condições de cada etapa estão no [plano de trabalho](PLAN.md).

## Acessar esta branch de integrações

Esta branch (`integration/functional-spec-v1`) reúne a API Java, o PostgreSQL/PostGIS, as contas com sessão e a moderação/revisão. Para abrir o Vetor Urbano aqui, com os dados sintéticos, são **três processos** — banco, API e frontend — mais o acesso pelo host correto.

### Abrir em 3 comandos (para olhar a interface)

```bash
# 1) banco sintético com as contas de teste conhecidas
podman start vetor-spec-postgis

# 2) API apontada para esse banco  (detalhes e variáveis em "2. API Java")
bash scripts/run-local-stack.sh

# 3) frontend
npm ci --prefix apps/web && npm start --prefix apps/web
```

Abra **http://127.0.0.1:4201/?consulta=api** e entre com `usuario@vetorurbano.test` / `123456`
(ou `admin@vetorurbano.test` / `123456`, que pede o autenticador TOTP na primeira vez).
O `?consulta=api` é o que troca a demonstração pela consulta no servidor: sem ele, o app abre
em modo demonstração e o formulário de Fontes, por exemplo, não existe.

**Bases sintéticas desta máquina:** `vetor-spec-postgis:55436` (`vetor_spec_test`) é a que tem as
**duas contas com senha conhecida** — use esta para navegar. `vu-uxh01-five-db:55442` tem as 29
bases de família usadas pelas réguas de teste; as contas de lá são criadas pelos helpers, **sem
senha fixa**, então servem para teste automatizado e não para login manual. A API só pode estar
em uma base por vez: ao trocar de família, reinicie-a.

### Caminho rápido: só a interface, sem banco nem API

```bash
npm ci --prefix apps/web      # só na primeira vez
npm start --prefix apps/web   # abra http://127.0.0.1:4201/
```

Sem API o app abre em modo demonstração, que é a tela de entrada com a tipografia,
o contraste e os contornos atuais — serve para ver o incremento de UX/UI sem subir
banco. O mapa e os painéis ficam atrás do gate de sessão e exigem os três
processos abaixo.

O que observar: o h1 a 32 px no desktop e 28 px a 390, com três pesos; os
contornos de controle (3,17–3,36:1 no claro, 4,30:1 no escuro); o botão
**Modo escuro** no topo, que é o teste mais rápido; e, na busca de território,
o marcador âmbar a 5,41:1. Depois do login, o badge de ocorrências coincidentes
no mapa fica em 6,11:1 no claro e 9,22:1 no escuro. Critérios, dívidas datadas
e o hash de cada lote estão em docs/product/ux-lotes.md.

### 1. Banco sintético

```bash
podman start vetor-spec-postgis          # contêiner PostGIS 17/3.5 em 127.0.0.1:55436, banco vetor_spec_test
podman exec vetor-spec-postgis sh -c 'psql -U "$POSTGRES_USER" -d vetor_spec_test -tAc \
  "select email,role,status from local_accounts order by created_at"'   # confere as contas de teste
```

O contêiner e o banco precisam ser os que contêm as contas usadas no login. Conta existente em outro banco produz `LOGIN DENIED` com `account_id` nulo em `auth_audit_events` — é e-mail ausente no banco em uso, não senha errada.

### 2. API Java em `127.0.0.1:8080`

```bash
export JAVA_HOME=<jdk-21>
PW=$(podman exec vetor-spec-postgis printenv POSTGRES_PASSWORD)
$JAVA_HOME/bin/java -jar apps/api/target/vetor-urbano-api-0.1.0-SNAPSHOT.jar \
  --spring.profiles.active=local \
  --spring.datasource.url=jdbc:postgresql://127.0.0.1:55436/vetor_spec_test \
  --spring.datasource.username=vetor_spec_test --spring.datasource.password="$PW" \
  --vetor.accounts.enabled=true --vetor.accounts.mailbox-port=8025 \
  --vetor.accounts.key-file=<chave do autenticador fora do repositório>
```

O jar sai de `cd apps/api && ./mvnw -DskipTests package`. As migrações pendentes são aplicadas no startup (evolução por migração nova; sem `repair` nem reset). Duas instâncias não podem compartilhar a caixa local: a segunda falha com `Endereço já em uso`.

### 3. Frontend em `127.0.0.1:4201`

```bash
npm ci --prefix apps/web
npm start --prefix apps/web
```

Abra **http://127.0.0.1:4201/?consulta=api**. Use `127.0.0.1` também na API: o cookie de sessão é `SameSite=Strict`, e `localhost` é outro domínio de cookies — a sessão se perde na requisição seguinte. O frontend redireciona `localhost:4201` para `127.0.0.1` antes de iniciar.

| Perfil | E-mail | Senha |
|---|---|---|
| Usuário (USER) | `usuario@vetorurbano.test` | `123456` |
| Administrador (ADMIN) | `admin@vetorurbano.test` | `123456` |

O Administrador exige MFA: no primeiro acesso, use **Configurar autenticador**, registre a chave no aplicativo TOTP (SHA-1, seis dígitos, 30 s) e confirme o código.

### O que já funciona nesta branch

Consulta persistida pela API, contas com confirmação, sessão e MFA, canal privado de correções (27), revisão/publicação humana de clippings (17) e correção/retirada de publicação com histórico auditável (18). Estado consolidado, evidências e a pendência aberta estão em [estado do lote 27 → 36 → 17 → 18](docs/history/batch-27-36-17-18-2026-10-17.md) e no [plano de trabalho](PLAN.md). Detalhes operacionais em [operação da web](docs/operations/web.md).

Continua sendo demonstração local com dados fictícios: sem publicação, deploy, coleta real ou prontidão operacional. Nada aqui autoriza merge para `main`.

## Executar localmente

Use a versão de Node.js indicada em [.nvmrc](.nvmrc). O pacote web declara o gerenciador em `packageManager` e mantém as dependências no lockfile.

```bash
npm ci --prefix apps/web
npm start --prefix apps/web
```

Abra **http://127.0.0.1:4201/**. Os mapas precisam de acesso ao provedor cartográfico. A configuração atual atende ao desenvolvimento em `localhost` e `127.0.0.1`; outros domínios precisam de configuração própria. Para a consulta persistida com sessão, suba também banco e API como em [Acessar esta branch de integrações](#acessar-esta-branch-de-integrações) e consulte o [guia de operação](docs/operations/web.md) antes de preparar hospedagem.

## Credenciais de teste locais

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador (ADMIN) | `admin@vetorurbano.test` | `123456` |
| Usuário (USER) | `usuario@vetorurbano.test` | `123456` |

Estas são contas sintéticas do ambiente local de teste. Com frontend, API e banco local iniciados, abra **http://127.0.0.1:4201/?consulta=api**. As contas precisam estar provisionadas nesse banco; clonar a branch não cria as contas nem inicia os serviços.

O Administrador exige também MFA: no primeiro acesso, use **Configurar autenticador** e confirme o código do aplicativo TOTP. Se já estiver configurado, utilize o autenticador vinculado. A senha sozinha não libera acesso administrativo. A senha curta acima é exclusiva dessas duas contas de teste e não deve ser usada em produção. Segredos do autenticador e credenciais de infraestrutura não fazem parte deste README.

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
apps/api/       API Java (Spring Boot) e migrações Flyway
assets/brand/   Materiais e fontes dos vídeos de marca
docs/           Produto, arquitetura, operação e registros históricos
scripts/        Verificações do repositório
tools/          Extração cartográfica e revisão visual
```

O frontend usa Angular, TypeScript e SCSS, com MapLibre e recuperação por Leaflet. O build de produção contém apenas a aplicação principal.

[Documentação](docs/README.md) · [Contribuir](CONTRIBUTING.md) · [Arquitetura](docs/architecture/overview.md) · [Histórico de mudanças](CHANGELOG.md)
