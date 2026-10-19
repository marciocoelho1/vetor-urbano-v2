# Ticket 20 (e 21/22) — decisões recebidas e contrato da fonte — 19/10/2026

## Decisões do responsável nesta rodada

- **Fonte autorizada:** API do Fogo Cruzado v2 (`https://api.fogocruzado.org.br/docs`), usada com a conta do próprio responsável; ele declara ter concluído a autenticação e deter autorização de uso da API. A captura enviada mostra apenas a confirmação
  «Sua conta foi autenticada com sucesso» para «Marcio Coelho» — **nenhuma credencial real foi vista, pedida ou registrada**, nem aqui nem no repositório.
- **Recorte geográfico:** municípios da **Região Metropolitana do Estado do Rio de Janeiro** e a **cidade do Rio de Janeiro**.
- **Recorte temporal:** ocorrências **desde 01/06/2026**, mantido como limite único «até que as configurações de banco de dados estejam consolidadas».
- **21 e 22 seguem o mesmo recorte/fonte do 20.**
- **23 e 24 continuam bloqueados:** a regra de confiabilidade ainda será definida; nada de fórmula, limiar ou rubrica foi aprovado.

## Contrato técnico observado (v2, leitura pública da documentação)

| Item | Observação |
|---|---|
| Base | `https://api-service.fogocruzado.org.br/api/v2` (401 sem token; `api.fogocruzado.org.br` não serve a API) |
| Autenticação | `POST /auth/login` com `{email, password}` → `data.accessToken` + `expiresIn` (3600 s); demais rotas usam `Authorization: Bearer <token>` |
| Renovação | `POST /auth/refresh` com `Bearer` + `{accessToken}` → novo token |
| Estados | `GET /states` → `data[{id,name}]` |
| Cidades | `GET /cities` com `?stateId=`, `?cityId=`, `?cityName=` → `data[{id,name,state}]` |
| Ocorrências | `GET /occurrences` com `initialdate`, `finaldate`, `idState`, `idCities` (repetível), `order`, `page`, `take`, `typeOccurrence` |
| Paginação | `pageMeta {page, take, itemCount, pageCount, hasPreviousPage, hasNextPage}` |
| Metadados | Headers `X-Last-Update` e `X-Last-Update-State` |
| Fuso | Documentação v2 declara datas em `America/Sao_Paulo` (UTC-3) — **a confirmar na primeira resposta real**, não presumida |
| Campos por ocorrência | `id`, `documentNumber`, `address`, `state`, `region`, `city`, `neighborhood`, `subNeighborhood`, `locality`, `latitude`, `longitude`, `date`, `policeAction`, `agentPresence`, `relatedRecord`, `contextInfo{mainReason, complementaryReasons, clippings, massacre, policeUnit}`, `transports[]`, `victims[]`, `animalVictims[]` |

## Como isto entra no produto (proposta, coerente com os contratos atuais)

1. **Nada é publicado automaticamente.** A coleta cria **clipping/referência rastreável** e entrega o item à fila de revisão do ticket 17; publicar continua decisão humana.
2. **Minimização obrigatória.** O atributo por vítima (idade, gênero, raça, cargo, corporação, unidade, partido, situação de serviço) **não entra na projeção pública**: o que pode ser derivado para o público são **contagens** e os atributos de contexto do fato. Identidade e localização da pessoa permanecem separadas da ocorrência.
3. **Idempotência por identidade da fonte:** `noteId/documentNumber` do Fogo Cruzado é a chave; reprocessar a mesma publicação não duplica ocorrência nem clipping.
4. **Três estados distintos:** sucesso sem novidade ≠ tentativa que falhou ≠ ausência de configuração. Falha parcial conserva a retomada e não apaga o que já foi revisado.
5. **Janela única:** `2026-06-01` até o instante da execução, aplicada tanto à carga inicial (21) quanto à coleta periódica (20).

## Proveniência, licença e limitações (registro exigido antes de ingerir dados reais)

Levantamento feito em **19/10/2026** nas páginas públicas da fonte:

| Item | Registro |
|---|---|
| Origem | Instituto Fogo Cruzado — `https://api.fogocruzado.org.br` (documentação) e `https://api-service.fogocruzado.org.br/api/v2` (API) |
| Licença declarada | Página pública da API (HTML servido em 19/10/2026) afirma «os dados são livres» / «o uso do conteúdo é livre» e exibe as marcas **Creative Commons** e **Public Domain** no rodapé; a versão em inglês repete «Our data is free to use». **O instrumento exato (versão da licença CC ou dedicação a domínio público) não está publicado em texto versionado nas páginas alcançáveis** — o site do instituto responde 403 a requisições automatizadas |
| Autorização de acesso | A página da API declara exigir **autorização prévia**; o responsável afirma tê-la obtido com a própria conta. Os termos apresentados nessa autorização estão em poder dele e não foram vistos por este executor |
| Atribuição | «Instituto Fogo Cruzado» é o crédito obrigatório a exibir onde os dados da fonte aparecerem; a fonte precisa ser registrada no cadastro de fontes com crédito, licença declarada, data de obtenção e limitações |
| Data de obtenção | 19/10/2026 (levantamento documental) |
| Limitações declaradas pela fonte | Cobertura por região metropolitana (RJ desde jul/2016; PE, BA e PA em outros recortes); base colaborativa, sujeita a revisão; API de terceiros pode mudar de contrato; sem SLA |
| Cobertura observada | A página informa «mais de 40 indicadores de **49 municípios**» — número inferior aos 22 municípios da RM-RJ somados a outras regiões, o que reforça a necessidade de **relatar municípios ausentes** em vez de presumir cobertura universal |

**Termo de consentimento registrado (texto integral, fornecido pelo responsável em 19/10/2026):**

> O Fogo Cruzado disponibiliza sua base de dados de registros de violência armada em tempo real para interessados através da API. Este é um compromisso importante para nós, como forma de contribuir com a construção de uma sociedade mais segura e participativa. Para acessar a API o usuário precisa fazer um cadastro com (apelido de usuário, email e senha). Suas informações serão utilizadas apenas para fins de login e não serão repassadas para terceiros. O acesso à API é gratuito. Em troca, pedimos apenas que os usuários citem a fonte quando utilizarem essas informações em aplicações ou publicações.

O que isso vincula no produto:

1. **Atribuição é a única contrapartida exigida** — «citem a fonte quando utilizarem essas informações em aplicações ou publicações». Onde dado do Fogo Cruzado aparecer (item na fila de revisão, seção de coleta, exportação e relatório que carregue ocorrência dessa origem) precisa exibir «Fonte: Instituto Fogo Cruzado». Sem isso, a fatia não está em conformidade.
2. **Acesso gratuito** — a coleta não gera custo por requisição; nenhuma contratação é necessária nem autorizada.
3. **Dados de cadastro** (apelido, e-mail, senha) servem **apenas para login** e não podem ser repassados a terceiros: a credencial não entra em log, resposta HTTP, evidência, fixture ou repositório; permanece no arquivo privado `0600`.
4. **Licença do conteúdo:** o termo não fixa instrumento Creative Commons versionado — o que existe é a declaração pública de uso livre no site da API e esta autorização de acesso. Registra-se assim: **uso livre declarado + atribuição obrigatória**, e o instrumento formal continua como item a confirmar com o instituto, se o produto vier a redistribuir a base.


## Verificação real contra a fonte (19/10/2026, conta do responsável)

Leitura delimitada, autorizada, sem persistir nada e **sem imprimir credencial** (o token ficou apenas em arquivo temporário 0600 fora do repositório):

| Verificação | Resultado real |
|---|---|
| Login | `POST /auth/login` → **HTTP 201**, `msg: Successfully login`, `code: 201`, `data.expiresIn: 3600` |
| Estado do RJ | `id = b112ffbe-17b3-4ad0-8f2a-2038745d1d14`, `name: Rio de Janeiro` |
| Cidades cobertas no RJ | **21** — exatamente a lista legal da RM-RJ **menos Petrópolis**; nenhuma cidade extra fora da lista |
| Recorte aprovado (RM-RJ, 2026-06-01 → 2026-10-19) | **807 ocorrências** (`pageMeta.itemCount`) |
| Somente cidade do Rio, mesma janela | **524 ocorrências** |
| Cabeçalhos de atualização | `X-Last-Update: 2026-10-19T11:26:28-03:00`; `X-Last-Update-State: 2026-10-19T09:57:12-03:00` (+ `-Timestamp` e `-State-Id`) |
| Formato de `date` | instante UTC com sufixo `Z` (ex.: `2026-06-01T06:30:00.000Z`) — **contradiz** a doc, que afirma America/Sao_Paulo |
| `relatedRecord` ausente | vem como string **vazia**, não `null` |
| Ordenação | `order=ASC` → mais antigo primeiro (adequado ao checkpoint de retomada) |
| Bloqueio por assinatura | cliente programático com UA padrão recebe **403** com corpo `error code: 1010`; UA identificável passa |

**Município ausente relatado:** **Petrópolis** integra a RM-RJ pela redação consolidada mas **não consta da fonte**. A implementação deve listá-lo como ausente e não substituí-lo.

**Minimização confirmada como necessária:** a resposta traz, por vítima, idade, grupo de idade, gênero, raça, local, situação de serviço, qualificações, posição/status político, partido, corporação, unidade e tipo de agente. Nada disso é persistido nem projetado — só contagens (`Dead`/`Wounded`) e contexto do fato.


## Pendências abertas desta fatia

- **Credencial fora do repositório:** o executor precisa do e-mail/senha da conta Fogo Cruzado em arquivo ou ambiente privado. O valor **não** deve ser colado no chat nem no repositório.
- **Banco de destino dos dados reais:** separado dos bancos sintéticos usados por testes (as fixtures de E2E truncam tabelas).
- **Cadência da coleta periódica** e política de pausa/retomada.
- **Lista de municípios:** texto legal consolidado da Região Metropolitana difere entre versões (19 municípios na redação original, 22 na consolidada, incluindo Petrópolis, Cachoeiras de Macacu, Mesquita e Rio Bonito). A implementação deve usar a composição vigente, registrar a fonte e **relatar quais municípios a fonte não cobre** em vez de inventar limite.
- **Termos/licença de uso da fonte:** a página de termos do projeto respondeu 403 na consulta; origem, licença, data e limitações precisam ficar registradas em `docs/` antes da ingestão de dados reais.
