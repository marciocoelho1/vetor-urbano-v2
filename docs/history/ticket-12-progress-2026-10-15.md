# Ticket 12 — progresso e conclusão local

Registro inicial parcial preservado abaixo. **Estado atual: aceito no recorte local**, conforme a conclusão ao final deste documento.

Data: 15/10/2026. Critérios-fonte: [issue original](../../.scratch/consulta-coerente/issues/12-consulta-persistida.md). O contrato da primeira etapa permanece em [registro do contrato](ticket-12-contract-2026-10-15.md) e [documento técnico](../architecture/api-query-v1.md). Este checkpoint preserva o ID e todos os seis critérios; não declara aceite integral.

## Estado por critério original

1. **Navegador → API Java → PostgreSQL/PostGIS, migrações e reinício:** migração V1, modelo e endpoint Java implementados. Teste Failsafe real passou por HTTP contra PostGIS em contêiner e confirmou persistência/reinício da API. Integração do frontend no navegador ainda não foi implementada.
2. **Somente publicadas, localização territorial apenas em lista e clippings sem duplicar fatos:** a resposta HTTP verificada exclui o controle `PENDING`, devolve quatro publicadas, conserva a ocorrência sem coordenadas e retorna um único efeito de Trânsito com três clippings. A verificação foi pela API real; o navegador ainda está pendente.
3. **Filtros, período/fuso, borda espacial real e falha visível:** HTTP verificou categoria, fonte, texto sem acento, nota mínima, situação e exclusão no fim do intervalo. O teste de offset falhou por expectativa incompatível com o próprio intervalo; portanto, a borda de raio não foi alcançada. Resposta 503 por API/banco indisponível e apresentação visível no navegador não foram demonstradas.
4. **Execução local sintética até o Ticket 14:** aplicação configurada para `127.0.0.1`, banco de desenvolvimento, migração com dados fictícios e apenas endpoint GET. Não há escrita, autenticação, coleta nem liberação de módulos operacionais. Implementação local registrada; integração do cliente segue pendente.
5. **Contagens distintas, precisão temporal, validação e fronteira pública:** teste HTTP passou pelas contagens de ocorrência/acontecimento/mapeadas/lista/certas/possíveis, exclusão de não publicada e ausência de campo interno. Parâmetro inválido retornou 400 sem contagens. Erro de banco 503 está definido no código, mas ainda não foi verificado por HTTP.
6. **Chromium/Firefox, estados, teclado/foco, mobile e verificações `api`/`web`/`planning`:** pendentes para a nova integração navegador–API. O modo `api` executou unidade/migração e teste HTTP real, mas encerrou com uma falha temporal descrita abaixo; não houve aprovação. Resultados web anteriores não demonstram esta integração.

## Implementação e infraestrutura

- Escolha de JDK 21 para compilar: o host tem runtime Java 25, mas não `javac`. JDK 21 foi extraído de imagem Maven/JDK já disponível localmente; Maven Wrapper 3.3.4 baixa/usa Maven 3.9.11. O ambiente tem Chromium, Firefox, conexão HTTP local e Podman rootless 5.8.7 com API Docker via `unix:///tmp/vu-podman-ticket12.sock`.
- PostgreSQL 17.5/PostGIS 3.5.2 sintético em `127.0.0.1:55432` e PostgreSQL 17.5/PostGIS 3.5 de Testcontainers foram usados nos testes. Testcontainers limpa seus contêineres ao encerrar; Ryuk fica desabilitado por compatibilidade com Podman rootless. O contêiner local sintético permanece disponível para retomada.
- Migração V1 cria fatos, ocorrências, fontes, clippings e relações; impõe precisão espaço-temporal e estados; cria índices espaciais/temporais; semeia quatro registros publicados e um controle não publicado, todos fictícios. A API usa filtro publicado, `EXISTS` para fonte, busca `unaccent`, intervalo semiaberto, `ST_DWithin` geodésico e DTO público explícito.
- A primeira verificação HTTP respondeu 503 porque a configuração do Spring Boot 4 tinha `flyway-core`, sem o starter de auto-configuração. O log identificou `relation "occurrences" does not exist`; foi adicionado `spring-boot-starter-flyway`. Não repetir esse diagnóstico: os logs atuais confirmam migração no início e reinício.

## Falha que exige revisão antes de nova execução

Comando mais recente:

```bash
JAVA_HOME=/tmp/vu-jdk-21 PATH=/tmp/vu-jdk-21/bin:$PATH \
DOCKER_HOST=unix:///tmp/vu-podman-ticket12.sock \
TESTCONTAINERS_RYUK_DISABLED=true ./scripts/verify.sh api
```

Resultado: status 1; 8/8 unitários e 2/2 testes de migração passaram. Dos três testes HTTP, passaram consulta pública com reinício e consulta inválida; falhou `httpHonorsOffsetHalfOpenIntervalsAndPostgisDistanceBoundary`, linha 104, `expected 2, got 1`. A execução anterior da mesma verificação produziu o mesmo resultado depois de uma edição do intervalo, sem avançar o teste.

Diagnóstico calculado a partir dos dados V1: o registro pontual esperado é `2026-10-15T09:00:00Z`. O intervalo atual do teste `08:00–10:00 -03:00` equivale a `11:00–13:00Z` e, corretamente, exclui esse ponto. O intervalo anterior `12:00–13:00 -03:00` também o excluía. A janela `05:00–10:00 -03:00` equivaleria a `08:00–13:00Z` e incluiria o ponto e o intervalo incerto; é uma correção candidata do dado de teste, sem alterar o aceite. A regra local após duas tentativas foi respeitada: não houve terceira execução. Borda espacial, abaixo da borda, contagens de resultado espacial e indisponibilidade continuam sem evidência.

## Revisão própria do código

Revisão própria, não independente: o endpoint é somente GET; parâmetros desconhecidos/repetidos ou fora dos limites falham sem contar zero; datas exigem offset; coordenadas validam WGS 84; registros territoriais retornam `coordinates: null`; apenas publicados entram; a busca de fonte não multiplica ocorrências; o DTO não serializa avaliações internas; erros de consulta devolvem 503 distinto de lista vazia. Os testes HTTP que passaram confirmam filtros, exclusão do controle, contagens, metadados públicos e reinício. A precisão espacial não recebe aceite próprio até executar a parte de raio do teste.

## Arquivos e Git

- Implementação local não commitada: `apps/api/pom.xml`, Maven Wrapper e propriedades em `apps/api/.mvn/`, `apps/api/mvnw*`, aplicação/configuração e domínio/repositório/endpoint em `apps/api/src/main/java/`, migração e propriedades em `apps/api/src/main/resources/`, testes em `apps/api/src/test/java/`, `apps/api/README.md` e adaptação de pré-requisitos de `scripts/verify.sh` para JDK e Podman compatível.
- Contrato: commit `6d86498` (`docs: define persisted query contract (ticket 12)`); correções de referência do JDK estão no arquivo técnico local ainda modificado. O código do Ticket 12 permanece sem commit porque a verificação mais recente falhou. Nenhum arquivo preexistente de frontend ou de reconciliação foi staged.
- Revisão do diff não encontrou razão para mudar critérios ou dados do produto; o único ajuste conhecido é a janela do caso de teste temporal. Não houve navegador conectado à API, commit do código, push, publicação, credencial real ou dado real.

## Tickets adjacentes e continuidade

- 06 e 10: verificados localmente nesta retomada; commits isolados `8ca44bc` (10) e dependência territorial `c528644` (05). 07: seleção por mouse MapLibre/Firefox ainda sem causa/correção reproduzível; permanece pendente após diagnósticos anteriores. 36: quatro textos v1.2 verificados em Chromium/Firefox; critérios 1, 2 e 4 atendidos localmente, critério 3 (envio/acompanhamento real) depende do canal do 27, sem canal inventado.
- Nenhum ticket 16–35 está desbloqueado: 16/19 dependem do 14 reservado; 17→16→14, 18→17, 20→17 mais fonte/canal/autorização/limites/custo pendentes, 21/22→20, 23/24→17 e parâmetros numéricos pendentes, 25→08 e 14, 26→09 e 14, 27→26, 28/29/32/33→06 e 14, 30→29, 31/34→30 e 35→10 e 18. 13–15 permanecem sem alteração. Não foram criados parâmetros para contornar esses bloqueios.
- **Resumo para revisão do Sol:** Ticket 12, nenhuma alteração de código commitada; contrato `6d86498`; API/migração/testes parciais locais. Evidência: 8 unitários + 2 migrações + 2/3 cenários HTTP passaram; o cenário temporal falha na linha 104 porque `08:00–10:00 -03` não inclui o ponto de `09:00Z`. Próxima verificação candidata: corrigir apenas a janela para `05:00–10:00 -03`, manter asserções e executar `api`; depois validar o raio que ainda não foi alcançado. Nenhum aceite independente declarado.

## Verificação deste checkpoint

`bash scripts/verify.sh planning` passou e validou 212 links locais. `git diff --check` e checagem de whitespace dos novos arquivos da API/registros passaram. Nenhum processo da API permaneceu ativo; o único contêiner listado é o banco PostgreSQL/PostGIS sintético local em `127.0.0.1:55432`, mantido para retomada. O modo `web` não foi reexecutado porque esta etapa não alterou o frontend; sua integração com a API continua sem implementação/verificação.


## Conclusão local após retomada — 15/10/2026

**Aceite:** seis critérios originais atendidos no recorte de leitura local sintética. Sem controlador, subagentes, push, publicação, contratação, coleta ou dados reais. A fundação não foi reimplementada: V1, wrapper, modelo, repositório, endpoint e testes do Luna foram aproveitados. O contrato base é `6d86498` (HEAD inicial); não há commits posteriores a ele no início desta retomada, apenas alterações locais. A entrega corresponde ao commit com assunto `feat: complete persisted public query (ticket 12)`, filho desse contrato.

### Critérios e evidências finais

| Critério original | Evidência desta revisão |
|---|---|
| 1. Navegador → API Java → PostgreSQL/PostGIS, migração e reinício | `/?consulta=api` em loopback consulta a API real. Flyway V1 validada sem reescrita; 2 testes de migração, HTTP com fechamento/reabertura do contexto Java e reinício adicional do processo JAR. Payloads antes/depois do processo idênticos exceto `generatedAt`; 4 ocorrências, 2 acontecimentos, 3 referências de uma ocorrência preservados. Navegadores repetiram a jornada após reinício. |
| 2. Somente publicadas, territorial apenas em lista, clipping sem duplicação | HTTP exclui controle `PENDING` em resultados e relacionados. Navegadores: 4/2, 3 mapeadas/1 lista; bairro isolado retorna 1 registro e 0 pins. Trânsito retorna 1/1 com 3 referências e 2 efeitos relacionados fora do recorte, sem alterar a lista ou os totais. |
| 3. Filtros, período/fuso, borda PostGIS e falha visível | HTTP combina categoria, tipo/subtipo vinculado, fonte, texto sem acento, notas, situação, município/bairro, horários e área visível. Navegadores exercitam filtros combinados com resposta HTTP observada, fuso, início incluído/fim excluído e raio 900/1000 m. SQL + HTTP conferem precisamente 999/1000 m. Pausa real do banco gera 503 e retry recupera; navegador offline também mostra erro. |
| 4. Local e sintético até acesso autenticado | API vinculada a 127.0.0.1; ativação do cliente exige host local e parâmetro explícito, com aviso visível. Nenhuma escrita pública, conta ou módulo operacional liberado. |
| 5. Contagens, precisão, erros e fronteira pública | Totais separados, classificação temporal CERTAIN/POSSIBLE (OUTSIDE somente em contexto relacionado), coordenadas nulas sem ponto artificial. Filtros espaciais não são reaplicados por distância esférica no cliente. HTTP 400/503 sem `counts`, sem rascunhos nem dados internos. Leituras/contagens/relações no mesmo snapshot transacional. |
| 6. Navegadores, teclado, estados, móvel e verificações | Integração real: 6/6 Chromium/Firefox, teclado/acionamento/retorno de foco, estados carregando/erro/vazio, lista móvel em 390 px sem overflow. Regressão das áreas afetadas: 26/26. API, web, planning e diff-check passaram conforme comandos abaixo. |

### Divergência temporal e correções fundamentadas

O contrato define instantes com offset e intervalo `[início,fim)`. O fato pontual V1 é `2026-10-15T09:00:00Z`. `08:00–10:00 -03` corresponde a `11:00–13:00Z`: deve devolver somente o intervalo incerto, com 0 certas/1 possível. O erro original estava na expectativa de duas ocorrências, não na conversão do servidor. O caso que exige o ponto agora usa `05:00–10:00 -03` (`08:00–13:00Z`), mantendo 1 certa/1 possível. Ambos os intervalos, equivalência em UTC e fim exclusivo têm asserções HTTP; o navegador também verifica as duas janelas. Não se alterou V1 nem a semântica temporal para forçar sucesso.

A revisão incluiu extensões técnicas do contrato necessárias aos controles existentes: horário diário de Brasília (inclusive faixa atravessando meia-noite), área visível explicitamente aplicada, subtipo vinculado ao tipo e consulta Em andamento sem inventar data inicial. Não foram definidos limites ou prazos operacionais novos. A API fornece relacionados publicados como contexto separado; sua inclusão temporal é calculada contra a mesma janela, sem afirmar certeza artificial.

O teste de indisponibilidade revelou um problema real depois de incluir snapshot transacional: erro ao abrir transação escapava como 500. O handler passou a tratar também `TransactionException` como 503; o teste com pausa real e recuperação passou. O primeiro ensaio de pausa ainda tinha um segundo `?` incorreto na URL JDBC do teste, impedindo `socketTimeout`; foi corrigido para `&` antes da verificação válida. Nos primeiros E2E houve ajustes de oráculo/locators (texto territorial e `combobox` por papel), além da expectativa de foco: disclosure mantém foco no acionador, anuncia `aria-expanded` e devolve foco ao fechar. Os ensaios falhos/interrompidos não foram contados como sucesso. A inspeção também corrigiu apresentação do tipo/subtipo no adaptador e rejeição de coordenadas vazias no cliente.

### Comandos e resultados

Executados da raiz, salvo indicação:

```bash
JAVA_HOME=/tmp/vu-jdk-21 PATH=/tmp/vu-jdk-21/bin:$PATH \
DOCKER_HOST=unix:///tmp/vu-podman-ticket12.sock \
TESTCONTAINERS_RYUK_DISABLED=true bash scripts/verify.sh api
# Final: status 0; 8 unitários, 2 migrações, 5 HTTP, zero falhas/pulados.

bash scripts/verify.sh web
# Final: status 0; lint, 88 testes e build; aviso de 106,17 kB além de 500 kB.

cd apps/web
VETOR_PERSISTED_E2E=1 VETOR_E2E_DATABASE_CONTAINER=vetor-api-ticket12-db \
  npx playwright test e2e/persisted-query.spec.ts --workers=1 --output=test-results/persisted-final
# Final: 6/6 em Chromium/Firefox, API e PostGIS reais, sem mock de ocorrências.

npx playwright test e2e/two-modes.spec.ts e2e/query-updates-and-states.spec.ts \
  e2e/territory-query.spec.ts --workers=2
# 26/26 Chromium/Firefox; preservação de modos, câmera, precisão e estados.

# Após reiniciar o JAR, jornada repetida nos dois navegadores:
VETOR_PERSISTED_E2E=1 VETOR_E2E_DATABASE_CONTAINER=vetor-api-ticket12-db \
  npx playwright test e2e/persisted-query.spec.ts --grep publicadas --workers=1 \
  --output=test-results/persisted-after-restart
# 2/2; a execução final completa de 6/6 também usou o processo reiniciado.

cd ../..
bash scripts/verify.sh planning
# Final: status 0; 211 links locais válidos.
git diff --check
# Status 0; também conferido o diff staged antes do commit.
```

Conferência direta via `podman exec ... psql` no banco de desenvolvimento (usuário/banco obtidos do ambiente do contêiner, sem registrar credenciais):

```sql
SELECT id,
       round(ST_Distance(location,
         ST_SetSRID(ST_MakePoint(-43.1915,-22.9033),4326)::geography)::numeric,6),
       ST_DWithin(location, ST_SetSRID(ST_MakePoint(-43.1915,-22.9033),4326)::geography,1000),
       ST_DWithin(location, ST_SetSRID(ST_MakePoint(-43.1915,-22.9033),4326)::geography,999)
FROM occurrences WHERE id = 'vu-demo-occurrence-contingency-002';
-- vu-demo-occurrence-contingency-002 | 1000.000000 | t | f
```

O reinício adicional encerrou o processo JAR e iniciou outro no mesmo banco, sem remover contêiner/volume/dados. Flyway informou versão 1 validada, sem migração nova. Comparação canônica do JSON público sem `generatedAt`: SHA-256 `c57c9976132cb7538b4b6c80360c21e2c10b356aea5dd162bd46ce240c450e60`, igual antes/depois inclusive após a última revisão do backend.

Logs finais, payloads públicos sintéticos e capturas ficam localmente em `.scratch/consulta-coerente/evidence/ticket-12-final-2026-10-15/`. Não fazem parte de publicação. Capturas móveis Chromium/Firefox e erro 503 foram preservadas; a apresentação móvel foi inspecionada visualmente. Os testes do 12 forçam Leaflet e bloqueiam somente tiles externos; o HTTP de ocorrências não é interceptado. A regressão territorial também executa MapLibre real. Isto não comprova disponibilidade de cartografia externa nem uso em aparelho físico/leitor de tela.

### Revisão própria, isolamento e checkpoint

Revisão própria do diff: GET de leitura, parâmetros no servidor, SQL parametrizado, filtro publicado também nos relacionados, DTO público explícito e resposta de erro distinta de vazio; consistência transacional, limite de espera para falha, coordenadas/intervalos preservados e cancelamento de respostas obsoletas no cliente. Não houve revisão independente, conforme a restrição de execução. O bundle segue com aviso, não falha de build. A checagem inicial do índice apontou CRLF do wrapper Windows como whitespace; o atributo local `mvnw.cmd text eol=crlf` normaliza o blob no Git e preserva CRLF no checkout Windows. A checagem staged posterior passou.

O commit inclui a fundação não commitada do Luna por pertencer ao próprio Ticket 12, além da integração e correções desta retomada. Em arquivos compartilhados, o índice foi montado somente com os trechos do 12. Alterações preexistentes do 07 em `app.ts`, `app.spec.ts`, `styles.scss` e `clustering-and-overlap.spec.ts`, reconciliação documental, ferramentas/controlador, ODT e demais arquivos continuam preservados e fora do commit. As verificações web foram realizadas sobre essa árvore de trabalho preservada; não declaram aceite dos tickets independentes. O 07 não foi corrigido nem reprovou as jornadas do 12; sua falha histórica de clique MapLibre/Firefox continua pendente.

**Próxima ação:** dependência técnica 12 → 13 liberada. O 13 pode iniciar pela definição do contrato de cadastro/confirmação usando esta mesma infraestrutura; seu próprio ticket ainda exige fechar fluxo/reenvio, validade/limites e política de senha antes da implementação dependente dessas decisões. Nenhum parâmetro foi inventado, nenhum fornecedor escolhido e nenhum trabalho do 13 foi iniciado. Contas, autorização e coleta seguem pendentes. Aceite do 12 é exclusivamente local/sintético, sem segurança operacional ou publicação.

**Estado de processos ao encerrar:** servidores Java e Angular desta rodada encerrados; o contêiner sintético preexistente `vetor-api-ticket12-db` foi preservado ativo. Para retomar, usar os comandos do README da API e `npm start -- --host 127.0.0.1` em `apps/web`; reabrir `/?consulta=api` e selecionar uma janela que contenha as datas V1.
