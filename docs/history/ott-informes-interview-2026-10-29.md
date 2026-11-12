# Informes em tempo real do OTT — viabilidade e entrevista de decisão

29/10/2026 · branch `integration/functional-spec-v1` · `HEAD b9814d4` · árvore com os 8 modificados e 3 não
rastreados da rodada anterior, preservados.

Pedido do responsável: «Preciso de um sistema que consiga acessar o aplicativo OTT360 (Android) e extraia
os dados dos informes e os publique no Vetor Urbano. Verifique a viabilidade, como criaremos este sistema
e como integraremos ao Vetor Urbano, após análise, realize um `/grill-with-docs` para alinharmos tudo, e
feche o grill criando tickets.»

Este documento é a parte documental do grill: registra **o que foi medido** (não relatado), a leitura de
viabilidade, a arquitetura proposta e a **fronteira de decisões ainda aberta**. Ele não decide, não
autoriza implementação, não registra a fonte como autorizada, não cria ticket e não publica nada.

## 1. Medições desta data

### 1.1 Site público — feed JSON de informes (leitura única, sem autenticação)

O site `https://ondetemtiroteio.com/website/ott/` carrega «Últimos alertas» por `app.js`, que chama:

```text
GET https://ondetemtiroteio.com/website/ott/report-data.php?action=informes&state=RJ
```

Resposta medida em 29/10/2026 19:26 -03 (HTTP 200, `application/json`, 9.256 bytes):

| Medida | Valor |
|---|---|
| Itens | **34** |
| Janela coberta | 28/10 19:06 → 29/10 18:21 (23,2 h) — rótulo da própria página: «últimas 24 horas» |
| Itens com `lat`/`lng` | **34 de 34** |
| Itens com `address` | **34 de 34** |
| Chaves por item | exatamente `date, type, neighborhood, city, state, lat, lng, address` |
| Tipos | Disparos ouvidos 10, Tiroteio 10, Operação Policial 8, Manifestação 3, Toque de recolher 1, Incêndio 1, Utilidade Pública 1 |
| Cidades | Rio de Janeiro 33, Niterói 1 |
| Bairros | Madureira 13, Irajá 2, Realengo 2, Cavalcanti 2, Vicente de Carvalho 2, demais 1 cada |
| Autor, e-mail, mídia, descrição | **ausentes** |

Exemplo literal de item: `{"date":"29/10/26 18:21","type":"Disparos ouvidos","neighborhood":"Curicica",
"city":"Rio de Janeiro","state":"RJ","lat":-22.9434513,"lng":-43.3821473,"address":"Rua Juranda, 275"}`.

O cliente do site usa somente o parâmetro `state` (lista de 14 UFs em `informes`, 25 em `reports`).
O segundo endpoint, `action=reports`, devolve agregados históricos do ano corrente x anterior por mês,
bairro e município — RJ 2026: **4.678** contra 3.167 em 2025 no mesmo período.

**Consequência medida:** o que a página exibe é menos do que o endpoint entrega. O site mostra tipo,
data e localidade; o JSON já traz **coordenada e endereço**. Ou seja, para o recorte de informes das
últimas 24 h, o canal público entrega o núcleo do dado — e o faz **sem dado pessoal algum**.

### 1.2 Aplicativo Android — inspeção estática

APK obtido de espelho público (APKPure), sem instalação nem execução:

| Campo | Valor |
|---|---|
| Pacote / versão | `com.ondetemtiroteio.app` · **25.64** |
| Tamanho | 30.135.686 bytes |
| SHA-256 | `d9ded4e4f6ef2fdf91ae23677ad7b6ee11d47e3e0f450b631c11e2ce563c8edb` |
| Conteúdo | 3 `classes.dex`, **zero bibliotecas nativas** |
| Natureza | **Capacitor + Ionic/Angular**: `assets/capacitor.config.json` e `assets/public/` com o app web completo (6,9 MB, 197 chunks) |
| Atualização | OTA próprio (`/ott360-config/releases/latest.json`, build `2026-08-30-25-57-web-fixes`) |

O app **não tem «API do app»** própria: o bundle chama duas superfícies de backend e uma de dados.

| Superfície | Evidência no bundle |
|---|---|
| API pública | `apiBase="https://ondetemtiroteio.com/public/api"` (PHP): `social.php`, `notify_alert_insert.php`, `update_alert.php`, `area_report.php`, `locations-rj.php`, `get_user_profile.php`, `uploadchatmedia.php`, `save_push_preferences.php` |
| API administrativa (espelho) | `mirrorBase="https://ondetemtiroteio.com/public/ott-admin/api"` — `postAdmin(...)`, com `moderate_alert.php`, `moderate_alert_comment.php`, `moderate_chat_message.php`, `ranking_user_admin.php` |
| Feed e dados | **Firestore** do projeto `ott3-b2275`: `readFeedSnapshot()` lê `collection("posts_firestore")`, `orderBy("datetime","desc")`, filtro por `state`, paginação; `signInAnonymously` e `signInWithCustomToken` presentes |

Schema do informe **no app**, extraído do mapeador `mapBackendAlert` (portanto: o que o app exibe além do
site): `need`/`subtype`/`ocorrencia` (tipo), `moreinfo` (**descrição**), `location{lat,lng,address,bairro,
municipio,state,country}`, `datetime`, `qtdL`/`qtdC`/`qtd`/`shares` (votos e comentários),
`userid`/`name`/`email`/`avatar` (**identidade do informante**), `mediaPhoto` (**foto**), `link`,
`linkvideo`. Taxonomia do app: tiroteio, arrastão, operação policial, manifestação, alagamento, incêndio,
disparos ouvidos, carros na contramão, perseguição policial, utilidade pública, comercial, roubo de carga,
toque de recolher, assalto, falta de água, falta de luz, «alerta» (desconhecido).

Configuração do feed publicada pelo próprio app (`/ott360-config/app-config.json`, atualizada em
31/07/2026): `feed.refreshSeconds = 30`, `feed.pageSize = 80`, `features.reports = true`, `areaPushV2 = true`.
A configuração pública do Firebase (incluindo `apiKey`) está no bundle e **não foi transcrita aqui**.

### 1.3 Termos e dados pessoais

«Termo de Uso da Plataforma OTT» (`/website/ott/termos.html`, 18.962 caracteres de texto, lido **integralmente**
em 29/10/2026) — não é um extrato:

| Cláusula | Texto | Efeito para nós |
|---|---|---|
| 1.1–1.2 | «Este termo de uso **de plataforma de comentários** […] regulamenta a utilização da plataforma para a postagem de comentários»; destina-se «apenas para fins informativos e de entretenimento, **excluindo qualquer utilização comercial ou publicitária**» | as proibições têm por objeto a **plataforma de comentários**, não o consumo dos informes |
| 3.2.1 | «não utilizar qualquer sistema automatizado, inclusive […] 'robôs', 'spiders' ou 'offline readers', que acessem a Plataforma **de maneira a enviar mais mensagens de solicitações aos servidores […] do que seja humanamente possível responder no mesmo período** através de um navegador convencional» | a vedação é **qualificada por volume** — não é proibição de acesso automatizado em si |
| 3.2.1 (2ª parte) | «É igualmente vedada a **coleta de qualquer informação pessoal dos demais usuários** da Plataforma» | sustenta a sua regra de não coletar dado de quem informa |
| 3.3 (j) | veda uso «para fins comerciais ou publicitários», «inclusive: **spam**» | o «spam» que você leu está aqui, e é sobre a Plataforma |
| **6.1 «NÃO LICENÇA»** | «autoriza o Usuário a utilizar **os dados fornecidos pelo aplicativo** […] desde que tal fato ocorra **unicamente para utilizar a Plataforma** em conformidade com este Termo»; «**não concede nenhuma outra licença ou autorização de uso de nenhuma classe** sobre os seus direitos de propriedade industrial e intelectual» | **é esta a cláusula que decide o nosso caso**: usar os informes em outro produto está fora da licença concedida |
| 10.2 | «não se responsabiliza por inexatidão da localização, onde a mesma será dada **de forma aproximada**» | a própria OTT declara a coordenada aproximada — a precisão exibida é decisão nossa, não um dado exato herdado |

- `https://ondetemtiroteio.com/robots.txt`: 80 bytes, termina em **`Allow: /`** — não há restrição de
  rastreamento declarada. Isso não concede licença nenhuma.
- `https://ondetemtiroteio.com/terms` — o endereço que o **próprio app** declara como «terms» em
  `app-config.json` — devolve **termos de terceiro** («Media Social LLC», «Who»/«Who Web», `wisschat.com`),
  um modelo genérico de EULA de aplicativo; **não** é instrumento da OTT e também não autoriza reuso de
  dado. O link de termos do app está, na prática, quebrado.
- Política de privacidade versionada em 13/07/2021 (`/website/ott/privacy.html`): coleta de localização e
  push; **sem** menção a redistribuição de informes por terceiros.
- Não existe canal público de reuso: procura do bundle por embed/widget (`web_embed`, `embed`) só encontra
  webview interna e iframes de Waze/YouTube, e o domínio `ott360.app` citado no bundle **não resolve**.
- **Ausente em todos eles:** autorização, licença ou contrato para terceiros consumirem ou redistribuírem
  os informes. Nada equivale ao termo de consentimento obtido do Fogo Cruzado (ticket 20).

### 1.4 Verificação das afirmações do responsável (pedido expresso em 29/10)

| Afirmação | Veredito | Evidência |
|---|---|---|
| «Os termos não proíbem uso para spam e coleta de dado pessoal de usuários» | **Correta, com correção da minha leitura anterior** | 3.2.1 veda acesso automatizado **por volume** e coleta de dado pessoal; 3.3(j) veda spam. Eu havia caracterizado 3.2.1 como vedação absoluta de acesso automatizado — **estava errado**. O obstáculo real é a cláusula **6.1 (não licença)**, que não proíbe conduta: ela simplesmente **não concede** direito de usar os informes fora da Plataforma |
| «Extrairemos os informes sem os dados de quem informou; nenhum dado pessoal usado ou armazenado» | **Correta para o feed público; falsa para o feed do app** | o feed público devolve exatamente 8 chaves, nenhuma pessoal; o feed do app carrega `userid`, `name`, `email`, `avatar`, `authorPhoto`. Ressalva: a **coordenada publicada tende a coincidir com a posição de quem informou** (o relato é enviado de onde a pessoa está) — não é dado pessoal por si, mas é inferência possível sobre uma pessoa, e a OTT anuncia «anonimato» como característica |
| «Preciso de categoria, local, data e hora e descrição» | **3 de 4 no canal público; descrição só no app** | `type` ✓, `lat`/`lng`+`address` ✓, `date` («29/10/26 18:21», minuto, fuso não declarado) ✓, **`descricao` ✗** — o feed público não tem campo de descrição; ela existe no app como `moreinfo` |
| «O app pode ser usado como visitante, sem conta» | **Confirmada** | i18n `login.continue_visitor = «Entrar como visitante»` e guards `isVisitor`/`uid === "guest"` que bloqueiam **chat, comentários, envio de alerta e premium**; a leitura do feed (`fetchAlerts`) **não** é bloqueada por visitante |

## 2. Leitura de viabilidade

1. **O pedido original («acessar o aplicativo e extrair os informes») não é o caminho mais curto nem o
   mais defensável.** Os 34 informes de 24 h medidos chegam por HTTP público, com coordenada e endereço,
   sem autenticação e sem dado pessoal. Montar emulador, automação de UI e sessão de app para obter os
   mesmos campos custa mais, quebra mais e não ganha cobertura legal.
2. **O que só o app tem é exatamente o que exige cuidado:** descrição livre, foto, identidade do
   informante (nome, e-mail, avatar) e engajamento. Descrição e foto são obra de terceiro; identidade é
   dado pessoal — e o Vetor Urbano separa, por decisão, localização da ocorrência de identidade de quem
   informa (`GLOSSARY.md`, `docs/architecture/overview.md`).
3. **Ler o Firestore por fora é tecnicamente possível e não é proposta.** Depende das regras de segurança
   deles, usa credenciais embarcadas no app (que não foram extraídas nem usadas), contraria a interface
   pretendida pelo fornecedor e arrasta a identidade do informante junto. Trato como rejeitado, salvo
   decisão explícita em contrário do responsável.
4. **Automação de UI no Android é viável** (o app é Capacitor, então o conteúdo é DOM no WebView, mais
   estável que raspagem de pixel) **e ainda assim inferior**: infraestrutura ligada 24 h, seletores
   frágeis a cada OTA, mesma informação que já vem por HTTP, e nenhuma cobertura adicional de direitos.
5. **A janela é curta.** O feed público cobre ~24 h e não aceita janela; não existe `BACKFILL`. Isso
   reposiciona o requisito: «informe em tempo real» é um fluxo de **captura contínua com validade curta**,
   não um histórico a importar.
6. **Não há campo de situação.** O informes do OTT não distingue «em andamento» de «encerrada»; no
   modelo do Vetor Urbano isso entra como situação `UNKNOWN`, e a vigência passa a depender da janela.
7. **Nada aqui é autorização.** A existência técnica de um canal público não é licença de redistribuição;
   o Termo de Uso da OTT explicitamente **não** concede licença de uso dos dados fora da Plataforma
   (cláusula 6.1), e a regra do projeto exige origem, licença/autorização, data e limitações registradas
   para fonte nova.
8. **A descrição é o campo que decide o caminho.** Categoria, local e instante — os três primeiros campos
   que você listou — chegam pelo canal público; a descrição só existe no app. Pedi-la em escopo significa
   pedir autorização à OTT, não procurar outro caminho técnico.
9. **Cobertura desigual e sem aviso.** Fonte de terceiro, sem contrato: formato, taxonomia e
   disponibilidade podem mudar a qualquer momento, e o feed medido variou por bairro no mesmo dia.

## 3. Arquitetura proposta (proposta, não aprovada)

Reuso deliberado do módulo de coleta do ticket 20 — mesmos estados (`NOT_CONFIGURED`…`FAILED`),
superfície administrativa, fila de revisão e minimização — com **cliente e mapeador próprios** por fonte.

```text
Feed/serviço da fonte (condicionado a autorização)
  → cliente da fonte (novo, isolado por fonte; cadência, timeout, backoff, classes de erro)
  → mapeador com allowlist: tipo, subtipo, coordenada, endereço, bairro/município/UF, instante, referência
  → (a) clipping → fila de revisão → ocorrência publicada    [fluxo existente, com autoria humana]
  → (b) informe não verificado com validade curta            [superfície nova, se aprovada]
  → atribuição «Fonte: OTT360» onde o dado aparecer
```

Decisões de projeto que a proposta já assume, e que precisam de confirmação:

- **Minimização:** allowlist explícita; sem autor, e-mail, avatar, foto ou comentário; endereço usado para
  precisão `POINT` com ressalva, nunca como identidade de pessoa. **Descrição só existe no app**: se
  autorizada, fica restrita ao revisor, nunca é republicada verbatim e nunca é usada para identificar quem
  informou. A coordenada publicada tende a coincidir com a posição de quem informou: exibir o ponto exato é
  decisão explícita, não efeito colateral.
- **Idempotência:** chave `(source_id, source_reference)` como no ticket 20; sem fusão automática de
  informes de fontes distintas que descrevam o mesmo fato.
- **Sem revisão, sem ocorrência:** nada vira ocorrência publicada por automação.
- **Mapeamento de tipos** (tabela a versionar, com «não mapeado» explícito em vez de suposição):

| OTT360 | Catálogo do Vetor Urbano (D04) |
|---|---|
| Tiroteio, Disparos ouvidos | Segurança · Disparos/tiroteio |
| Operação Policial, Perseguição Policial | Segurança · Operação policial |
| Arrastão, Assalto, Roubo de carga | Segurança · Roubo/assalto (subtipos existentes) |
| Incêndio | Contingência · Incêndio |
| Alagamento | Contingência · Alagamento/inundação |
| Falta de água | Contingência · Interrupção de abastecimento de água |
| Falta de luz | Contingência · Interrupção de energia |
| Manifestação, Toque de recolher, Carros na contramão | **sem tipo equivalente** — decisão pendente |
| Utilidade Pública, Comercial | **não é ocorrência** — descartar com motivo registrado |

## 4. Fronteira aberta

Pendente de decisão do responsável; nenhuma linha abaixo está aprovada.

1. Acesso à fonte: pedir autorização formal à OTT **antes** de qualquer execução real — a cláusula 6.1 não
   concede licença de uso dos informes fora da Plataforma —, ou operar o canal público do site como
   candidato condicionado, com limites de volume bem abaixo do patamar humano da 3.2.1, atribuição e
   limitação declarada, deixando a formalização para antes de hospedar.
2. Escopo do dado **depende de 1**: descrição existe só no feed do app, então pedi-la em escopo força a
   autorização. Alternativa: o incremento sai sem descrição (tipo, local, instante, com o que o canal
   público entrega) e a descrição entra depois, por autorização.
3. Destino no produto: fila de revisão existente, superfície nova de informe não verificado com validade
   curta, ou as duas em sequência.
4. Exposição pública do informe não verificado: rótulo, prazo de validade, exclusão de relatórios/notas e
   convivência com «Confiabilidade da ocorrência» 1–5.
5. Taxonomia: o que fazer com Manifestação, Toque de recolher e Carros na contramão sem ampliar o catálogo
   aprovado por suposição.
6. Cadência, retenção e limite de requisições; ausência de `BACKFILL` declarada como limitação.
7. Onde o código mora e como o novo ticket se relaciona ao módulo de coleta existente.
8. Formato e destino dos tickets deste incremento (prefixo próprio, arquivo por ticket, fora do
   controlador 01–36).

## 5. Limites desta rodada

Nenhum código, migração, contêiner, serviço, ticket, commit, merge, push ou deploy. Cada endpoint da fonte
foi lido **uma vez**; nenhum contato com a OTT foi feito. Além do feed, foram lidos integralmente nesta data
o Termo de Uso (18.962 caracteres), `robots.txt`, a política de privacidade e o `/terms` para onde o próprio
app aponta; a modalidade visitante foi verificada no bundle. O APK veio de espelho público e foi apenas
inspecionado estaticamente — não houve instalação, emulação, interceptação de tráfego, uso de credencial
ou leitura do Firestore. As chaves presentes no bundle não foram transcritas, usadas ou testadas. As
medições valem para 29/10/2026 e para a versão 25.64 do app; ambas podem mudar sem aviso.
