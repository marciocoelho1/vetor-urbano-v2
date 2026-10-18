# Operação da aplicação web

Este guia descreve o artefato frontend atual. O Vetor Urbano ainda é uma demonstração; não há ambiente de produção ou deploy automatizado configurado.

## Acesso local com sessão

Após `npm start` em `apps/web/`, use `http://127.0.0.1:4201/?consulta=api` para a consulta integrada à API. A entrada em `http://localhost:4201` é encaminhada automaticamente para `127.0.0.1`, preservando caminho, parâmetros e fragmento antes de iniciar a aplicação. Isso mantém o frontend no mesmo host da API local e permite o cookie de sessão `SameSite=Strict`; sem essa normalização, o login pode responder com sucesso e a configuração do autenticador perder a sessão na requisição seguinte. O cadastro local (`?conta=local`) segue o mesmo encaminhamento.

### Banco e credenciais locais

A sessão só funciona se a API em `127.0.0.1:8080` estiver apontada para **o banco que contém a conta usada**. Conferir antes de investigar senha:

```bash
podman ps --format '{{.Names}} {{.Ports}}'
podman exec <contêiner> psql -U postgres -tAc "select email,role,status from local_accounts order by created_at desc limit 5"
```

Contas válidas que a API desconhece geram `LOGIN DENIED` **com `account_id` nulo** em `auth_audit_events` — é o sinal de e-mail ausente no banco em uso, não de senha errada. Em 17/10/2026 as fixtures documentadas em [tickets-status.md](../product/tickets-status.md) estavam em `vetor_spec_test` (contêiner `vetor-spec-postgis`, porta 55436) com o contêiner **parado**, enquanto a API em `127.0.0.1:8080` servia o banco descartável do lote (`vu-batch-27361718-db`:55439) — daí o `LOGIN DENIED`. A correção verificada foi `podman start vetor-spec-postgis`, aplicar as migrações pendentes subindo a API contra esse banco e manter a API em `127.0.0.1:8080`:

```bash
podman start vetor-spec-postgis
export JAVA_HOME=<jdk-21>
PW=$(podman exec vetor-spec-postgis printenv POSTGRES_PASSWORD)
$JAVA_HOME/bin/java -jar apps/api/target/vetor-urbano-api-0.1.0-SNAPSHOT.jar --spring.profiles.active=local \
  --spring.datasource.url=jdbc:postgresql://127.0.0.1:55436/vetor_spec_test \
  --spring.datasource.username=vetor_spec_test --spring.datasource.password="$PW" \
  --vetor.accounts.enabled=true --vetor.accounts.mailbox-port=8025 \
  --vetor.accounts.key-file=<chave fora do repositório>
```

Duas instâncias não podem compartilhar a caixa local: a segunda falha no startup com `Endereço já em uso`. O banco `vetor_urbano` (`vu-selected-db`:55432, 215 contas) continua recusando startup pela divergência de checksum do `V9` registrada no ticket 32 — exige decisão explícita antes de `repair`.

Para criar ou recuperar uma conta local no banco em uso, use o provisionador documentado (`scripts/local-account-admin.py`, entrada por stdin, sem senha em histórico de shell). Nada disso vale para dados reais: o ambiente é sintético.

## Gerar o artefato

Na raiz do repositório, com o Node.js de `.nvmrc`:

```bash
npm ci --prefix apps/web
bash scripts/verify.sh web
```

O build otimizado fica em **`apps/web/dist/web/browser/`**. Esse diretório é o artefato para um servidor de arquivos estáticos. `npm start` inicia o servidor de desenvolvimento; não é o comando de hospedagem.

O frontend usa caminhos absolutos para mapas e fontes. A configuração atual espera publicação na raiz do domínio; hospedagem em subdiretório exige ajustar esses caminhos e validar o build. O servidor deve resolver a entrada da aplicação e servir JS, CSS, WOFF2, TTF e GeoJSON com seus tipos de conteúdo corretos.

Além dos WOFF2 da interface, `apps/web/public/fonts/manrope-pdf-regular.ttf` é a derivação estática usada somente para incorporar a fonte no PDF exportado; origem, licença e limites permanecem no [README do diretório](../../apps/web/public/fonts/README.md) e a derivação é reproduzível por `scripts/prepare-pdf-font.py`. Servi-la exige o tipo `font/ttf` correto, com o mesmo cuidado de cache dos demais assets.

## Configuração cartográfica

| Arquivo | Uso |
|---|---|
| `apps/web/public/maps/urban-style.json` | Estilo, fontes e tiles do mapa vetorial |
| `apps/web/public/maps/raster-provider.json` | URL, atribuição e limites do fallback Leaflet |
| `apps/web/public/maps/areas-territoriais.geojson` | Camada territorial estática com proveniência documentada |

A configuração atual do Stadia Maps permite desenvolvimento local em `localhost`/`127.0.0.1`. Antes de usar outro domínio, configure a autorização apropriada do provedor e revise termos, limites e atribuição descritos em [visual-reference.md](../maps/visual-reference.md). As duas bases precisam estar disponíveis, inclusive durante recuperação do mapa.

Tudo em `public/` e no bundle é acessível ao navegador. Credenciais de servidor ficam fora do frontend; uma chave de cliente eventualmente exigida pelo provedor precisa de restrições próprias de domínio e uso.

## Antes de liberar uma versão

Execute lint, testes unitários, build e a matriz Playwright em Chromium/Firefox. No host escolhido, confira carregamento de mapas, fontes e sprites; alternância de temas; fluxo de consulta/cadastro; teclado e apresentação móvel. Mantenha o aviso de demonstração enquanto houver dados fictícios.

O build atual ultrapassa o aviso de orçamento inicial de 500 kB em 2,64 kB. Há dois problemas de navegador registrados: tema local no mapa vetorial do cadastro e largura do cadastro a 320 px. Eles permanecem no [plano](../../PLAN.md), junto do QA em aparelho físico e leitor de tela.

Hospedagem da demonstração e liberação operacional são etapas diferentes. Uma versão operacional depende de API/banco, autorização, moderação, políticas de dados, cobertura e recuperação verificadas. Commit e push não publicam a aplicação.
