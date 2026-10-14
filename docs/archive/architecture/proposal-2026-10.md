# Arquitetura — frontend demonstrativo existente; backend proposto

**UI/UX atual — 14/10/2026:** a proposta 6 foi escolhida e aplicada à interface principal: mapa/lista lado a lado no desktop, alternância no celular, cabeçalho com os seis menus e Manrope também nos títulos. Paletas, regras, dados, motores cartográficos e recursos existentes preservados. Fontes Newsreader continuam somente na comparação. Detalhes em [visual-v6.md](../../history/design/visual-v6.md); o registro abaixo descreve a origem desta cópia.

**Versão visual 02:** esta cópia preserva a base `311875a` e acrescenta somente GSAP 3.15.0. O tema escuro/navegação lateral descritos como referência original abaixo foram substituídos nesta alternativa, por autorização explícita, por tema claro e navegação horizontal. Angular, mapas, regras e contratos existentes permanecem. Fontes WOFF2 locais Newsreader/Manrope e estilos compartilhados/tema separados; porta 4201 e armazenamento `vu2.*`. Decisões e verificação em [visual-v2.md](../../history/design/visual-v2.md). O incremento de modo escuro acrescenta tokens comuns em `theme.scss`, preferência local `vu2.theme` e inicialização antes de Angular, sem nova dependência ou alteração de provedor.


Revisão: 11/10/2026. Stack fornecida: **Angular + SCSS, Java, PostgreSQL**. O frontend demonstrativo existe com MapLibre/estilo Bright personalizado como renderizador principal e Leaflet/Alidade Bright raster como fallback sem WebGL2 ou com GPU por software identificada; **não existe backend Java executável, API, migração ativa ou banco do produto**. Decisão aprovada: concluir o frontend local antes da fase de banco/API e não implementar alertas neste incremento. Google Maps não foi escolhido para esta demonstração.

## 1. Evidência atual e fluxo pretendido

Existe o protótipo Angular em `apps/web/`, com componentes, manifest/lockfile e renderizadores MapLibre/Leaflet carregados sob demanda. A demonstração usa ocorrências/POIs sintéticos em memória e, sob demanda, uma camada GeoJSON territorial com origem e limitações identificadas. Ainda não existem `apps/api/pom.xml`, Maven Wrapper, API ou schema/migração ativa do banco do produto. O SQL histórico não aplicado em `apps/api/src/main/resources/db/migration/V1__Initial_Schema.sql` foi preservado na consolidação; não equivale a backend ou banco implementado e precisa de reconciliação em R0. Playwright validou os fluxos em Firefox/Chromium; um smoke test em Firefox 157 headless, com WebGL2 desativado, carregou os dois mapas e tiles OSM reais na configuração anterior. Leitor de tela e hardware móvel real continuam pendentes.

Fluxo legado P1.1 (somente leitura; reconciliar antes de iniciar):

```text
Carga local de demonstração (sem endpoint de escrita)
    → PostgreSQL + PostGIS: ocorrência sintética aprovada
    → repositório de consulta → serviço → controlador HTTP / DTO público
    → Angular: cliente HTTP → estado da consulta → mapa MapLibre/Leaflet + lista
```

Falha de tiles/WebGL não deve apagar uma lista recebida pela API. O navegador não se conecta diretamente ao banco; a API decide quais campos e estados são públicos. Implantação inicial apenas local, sem compromisso de disponibilidade operacional.

Atualização de compatibilidade em 11/10/2026: a sondagem consulta localmente o renderizador gráfico e encaminha SwiftShader/llvmpipe/softpipe e equivalentes identificados para Leaflet, após o ensaio de arraste. Se o navegador ocultar essa informação, tenta o vetorial; não grava/envia identidade da GPU. Fallback não depende somente da sondagem WebGL2; também recupera falha do construtor, erro inicial, perda de contexto e ausência do primeiro `idle` vetorial em oito segundos. Após falha, reutiliza raster na mesma instância do aplicativo. Watchdog é cancelado no descarte; tiles raster realmente recebidos determinam prontidão, não apenas o evento de término da fila. Nenhuma nova dependência ou alteração em preferências do navegador. O smoke anterior em Firefox instalado 157.0.1 validou OSM raster real; a verificação atual inclui WebGL2 e Alidade Bright raster real em Firefox/Chromium e escala geográfica preservada. O ensaio anterior com janela usou Alidade Smooth. Resultados finais em `PLAN.md`. Limites/medições atuais em `docs/maps/visual-reference.md`; histórico em `docs/maps/compatibility.md`.

## 2. Componentes, alternativas e consequências

| Proposta | Problema que resolve | Alternativa principal / consequência |
|---|---|---|
| Spring Boot, um serviço | Agrupar HTTP, validação, configuração e posterior segurança na stack Java solicitada | Java com configuração manual aumenta trabalho inicial; microserviços multiplicam implantação/contratos sem necessidade demonstrada. |
| Pacotes por funcionalidade (`ocorrencias`; identidade/moderação somente depois) | Manter regra, transporte e persistência próximos, com fronteiras legíveis | Camadas globais podem dispersar uma mudança; não criar framework interno, CQRS, event bus ou interfaces sem uso concreto. |
| PostgreSQL + PostGIS | Tipos e consultas espaciais para o raio previsto | Apenas latitude/longitude e cálculo manual exigiriam resolver distância/índice por conta própria. Proposta: `geography(Point,4326)` com GiST; `ST_DWithin` em geography recebe metros e aproveita filtro por índice.[5] |
| Migrações versionadas com Flyway | Banco reproduzível e evolução rastreável | SQL manual solto perde histórico de aplicação. Nunca editar migração já aplicada; gerar nova. Seed demonstrativo separado e restrito ao ambiente de demonstração. |
| API HTTP JSON, contrato documentado | Fronteira explícita entre Angular e Java; testes independentes | OpenAPI em arquivo no incremento, sem biblioteca de geração automática obrigatória; mocks só nos testes, não como entrega integrada. |
| MapLibre/Bright personalizado + Leaflet/Alidade Bright raster (fallback) | Aproximar a paleta solicitada, reduzir camadas da base e conservar escala na recuperação do Firefox | Engines/CSS continuam lazy. Raster usa `apps/web/public/maps/raster-provider.json`; atribuição Stadia Maps/OpenMapTiles/OpenStreetMap. Sem novas dependências. Desenvolvimento sem autenticação limitado a localhost/127.0.0.1; outros hosts exigem configuração autorizada. Estilo local em `public/maps/urban-style.json`, sprites próprios; paleta raster semelhante, não idêntica. Fonte/limites em `docs/maps/visual-reference.md`. |
| SQL explícito com suporte JDBC do Spring para consulta espacial | Deixar filtros/projeção pública visíveis e estudáveis | JPA é alternativa válida, mas acrescentaria mapeamento espacial sem necessidade neste primeiro endpoint; validar escolha no início de P1.1. |
| npm com lockfile; Maven Wrapper | Registrar resoluções de dependências e execução do build | Versões flutuantes dificultam reproduzir evidências. Wrapper/lockfile ainda não existem; não alegar instalação concluída. |
| Testcontainers com PostgreSQL/PostGIS; Docker no desenvolvimento/teste | Exercitar o mesmo mecanismo espacial, isolado e repetível | H2 não comprova comportamento PostGIS. Docker é requisito do harness atual, não decisão de deploy nem motivo para adicionar Kubernetes. |

Sem Redis, broker, SSE, WebSockets, microsserviços ou cluster em P1.1. Escolher uma dependência implica documentar licença, versão e manutenção antes de incorporá-la; tabela não é lista de pacotes já instalados.

## 3. Versões e compatibilidade — gate antes de gerar projetos

O frontend já possui versões fixadas no lockfile; o backend ainda não possui combinação executável escolhida. As versões registradas abaixo distinguem dependências instaladas de candidatos; documentação de compatibilidade não substitui build/teste.

| Componente | Proposta / estado |
|---|---|
| Angular + Angular CLI, Node.js, TypeScript, RxJS | Frontend registrado em `docs/product/implementation-2026-10.md` e `apps/web/package-lock.json`; não confundir essas versões com decisão de backend. Revalidar a matriz oficial ao atualizar.[6] |
| Java + Spring Boot | Contrato de implementação registra Spring Boot 3.5.16 e Java 21 em contêiner como proposta; nenhum apps/api/build foi executado. Revalidar compatibilidade antes de scaffold.[7] |
| Maven / Wrapper | Maven 3.9.11 é candidato registrado no contrato de implementação; Wrapper e build backend ainda não existem. |
| PostgreSQL + PostGIS | Versões/patches e imagem ainda a selecionar; verificar suporte conjunto, extensão disponível e registrar tag/digest. Não usar `latest`. |
| MapLibre 6.11.2 + Leaflet 1.9.4 (`@types/leaflet` 1.9.22); Bright personalizado vetorial e Bright raster; Google Maps não selecionado | MapLibre e Leaflet estão instalados e carregados sob demanda. O asset `raster-provider.json` permite substituir URL/zoom/atribuição raster sem recompilar JavaScript; o estilo vetorial está em `public/maps/urban-style.json`, carregado/reaproveitado por `urban-map-style.ts`. Mantém a família Bright; o raster não recebe as cores customizadas. Pins usam SVG/sprites locais nas duas engines. A atribuição vetorial vem do estilo, evitando créditos duplicados. O raster adiciona um nível ao zoom do MapLibre e usa `zoomSnap: 0.1`, conservando escala e limites equivalentes. O Stadia Maps libera localhost/127.0.0.1 sem autenticação, sujeito a limites; outros hosts exigem domínio autorizado/chave própria. A camada territorial continua independente do mapa-base. |

Antes do scaffold: inventariar runtimes instalados e Docker (sem instalar ou alterar o sistema sem necessidade/escopo), consultar matrizes vigentes, registrar a combinação exata neste documento, então gerar e executar build/testes. Documentação de compatibilidade não substitui execução. Consulta realizada em 26/09/2026; revalidar ao iniciar P1.1.

## 4. Modelo conceitual mínimo

Entidade proposta **Ocorrencia** em P1.1:

| Campo conceitual | Representação candidata | Regra |
|---|---|---|
| id | UUID, chave primária | Identifica a ocorrência, não pessoa/dispositivo |
| categoria | Código textual restrito | FURTO, TIROTEIO, COLISAO_VIARIA ou ALAGAMENTO; catálogo a validar |
| severidade | Código textual restrito | BAIXA, MODERADA, ALTA ou CRITICA; rubrica pendente |
| ocorrido_em | `timestamptz` / `Instant` | Instante do evento; entrada com offset, saída UTC |
| localizacao_publica | `geography(Point,4326)` | Ponto público da ocorrência; índice GiST para P1.3 |
| status_moderacao | Código textual restrito | PENDENTE, APROVADA, REJEITADA, RETIRADA; transições RN-P03 |
| origem | Código textual restrito | Somente SINTETICA em P1 |
| criado_em | `timestamptz` / `Instant` | Metadado interno, distinto do instante do evento |

As restrições incluem NOT NULL e domínios válidos; validar também coordenadas antes de construir o ponto. **Não haverá coluna autor_id/telefone/endereço do denunciante nesta entidade.** Não duplicar categoria e severidade como um único “nível de risco”.

`Conta`, `Sessao` e `RegistroModeracao` são conceitos de P2, **não tabelas a criar antecipadamente**. Auditoria futura identifica o responsável pela moderação, com acesso restrito; não reintroduz autoria da denúncia criminal. Dados de conta ficam separados. Armazenar uma ligação reversível ainda permitiria reidentificação; a política RNF02 exige revisão do fluxo completo, incluindo logs e backups.

Qualquer localização sensível futura precisa de finalidade e política próprias; não copiar coordenadas precisas para um DTO público só porque o nome foi removido. Se a posição pública for generalizada, os filtros operam sobre ela e a interface informa a precisão. P1 só possui pontos sintéticos, sem localização de residência ou de denunciante.

GeoJSON utiliza ordem longitude/latitude no sistema WGS 84; a proposta de SRID 4326 e Point mantém essa convenção.[13] Para raio, usar `ST_DWithin` sobre geography: um valor em metros não deve ser comparado diretamente com graus de geometry 4326.[5] `timestamptz` representa o instante internamente em UTC e não preserva o nome do fuso de origem; por isso America/Sao_Paulo é convenção explícita de apresentação, não inferida da coluna.[14]

## 5. Contrato preliminar P1.1 — somente leitura

**Contrato legado, não ativo até R0:** `GET /api/v1/ocorrencias`, sem autenticação no ambiente local de demonstração. Resposta `200`, `Content-Type: application/geo+json`. Seleção no backend: APROVADA + SINTETICA. Nenhum parâmetro permite trocar esse predicado. Ele foi escrito para uma demonstração somente de leitura e deve ser reconciliado com o cadastro exclusivo por Operador e moderação da proposta 1.0 antes de implementação.

Exemplo inteiramente fictício do contrato (não resposta executada):

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "00000000-0000-4000-8000-000000000001",
      "geometry": {"type": "Point", "coordinates": [-43.2094, -22.9035]},
      "properties": {
        "categoria": "ALAGAMENTO",
        "severidade": "MODERADA",
        "ocorridoEm": "2026-09-26T12:00:00Z",
        "demonstracao": true
      }
    }
  ],
  "metadata": {"demonstracao": true, "limite": 200, "retornados": 1, "truncado": false}
}
```

- `features` é a única fonte de mapa/lista; `id` está em Feature, não duplicado em properties. `metadata` é extensão da aplicação (GeoJSON admite membros adicionais).[13]
- Ordenação determinística: ocorrido_em decrescente e id crescente. Limite fixo de 200; buscar um registro adicional para determinar `truncado`, mas retornar só até o limite. `retornados` conta o array retornado, não o total do banco.
- Sem paginação em P1.1: ao truncar, mostrar “exibição parcial”; nunca apresentar contagem como total territorial. Paginação/estratégia para conjuntos maiores será decidida com P1.2, sem deixar API ilimitada provisoriamente.
- Sem resultados: `200`, `features: []`, `retornados: 0`, `truncado: false`; não é erro. Metadados de demonstração permanecem.
- P1.1 não aceita parâmetros de consulta: desconhecidos retornam `400`. Em especial, não aceitar filtro público que permita consultar estados privados.
- Erros JSON com campos estáveis `codigo`, `mensagem`, `correlacaoId` (sem dados pessoais): `400 CONSULTA_INVALIDA`, `503 SERVICO_INDISPONIVEL` quando o banco não responder; `500 ERRO_INTERNO` para falha inesperada. Não devolver SQL, stack trace ou segredo. Mensagem visual não usa HTML vindo do servidor.
- Escrita não existe: POST/PUT/PATCH/DELETE não são mapeados para criação; testar que não alteram persistência. Não confundir ausência de rota com autorização implementada para P2.
- Sem descrições livres, autor, telefone, posição do informante ou motivo de moderação. DTO/consulta têm lista permitida de campos; não serializar a entidade inteira.

**Futuro contrato P1.2/P1.3, ainda não aceito em P1.1:** parâmetros candidatos `categoria`, `inicio`, `fim`, `longitude`, `latitude`, `raioMetros`. Período requer ambos os limites; trio espacial é indivisível; categoria desconhecida, offset ausente, intervalo invertido, não finitos e raio fora de `(0,25000]` (teto alinhado ao frontend autorizado em 11/10/2026; contrato de API ainda proposto) recebem `400`. Centro não é rastreamento da pessoa. Regras canônicas: RN-P08–RN-P11 em `escopo.md`; detalhar somente quando autorizar esses incrementos.

## 6. Sessões e autorização futuras — sem escolher JWT por reflexo

RNF07 pede tokens, inatividade máxima de uma hora e revogação imediata. Um identificador opaco e imprevisível de sessão também é um token; não é obrigatório que seja JWT. Proposta para P2: sessão persistida do lado servidor, token em cookie Secure/HttpOnly/SameSite, HTTPS em ambiente publicado e defesa CSRF nas escritas. OWASP recomenda expiração de inatividade controlada pelo servidor e invalidação no servidor ao encerrar a sessão.[4]

| Alternativa | Inatividade/revogação | Consequência para este projeto |
|---|---|---|
| Token opaco + estado no servidor | Consultar conta/sessão/permissões a cada requisição protegida; guardar último acesso elegível, expiração e revogação | Recomendada para um serviço: revogação vale já na próxima verificação. Usa persistência e pode integrar Spring Session JDBC; biblioteca ainda a validar. |
| JWT autocontido sem consulta central | `exp` limita validade absoluta, não verifica sozinho inatividade ou revogação anterior à expiração | Não atende sozinho o RNF07. OWASP descreve denylist quando o término da sessão antecede a validade do JWT.[12] |
| JWT + refresh token + registro de sessão/denylist | Precisa de estado e verificação para revogar imediatamente também access tokens já emitidos | Possível, mas traz rotação, armazenamento e mais casos de erro; refresh revogado sozinho não invalida access token ainda aceito. Não recomendado sem cliente/cenário que o justifique.[12] |

“Imediata” será testada como: após confirmar revogação/inativação, **a próxima requisição protegida é negada**, sem cache de permissão obsoleto. Requisição já concluída não pode ser desfeita. Inatividade conta requisições elegíveis verificadas no servidor; polling automático não renova sessão; limite exato e limite absoluto deverão ser documentados em P2.

Antes de liberar escrita: testes de 401/403, matriz de perfis, inatividade no limite de 60 minutos, revogação, inativação e redução de permissão; hashing com salt/custo validado; MFA obrigatório para Gestor, inclusive prevenção de acesso direto à API antes do segundo fator. MFA/recuperação não serão substituídos por conta administrativa pública provisória. Não gravar tokens/senhas em logs. CORS restrito e HTTPS não substituem autorização.

## 7. Interface: preservar, corrigir e verificar

Evidência local: `app.html:1–46`, `app.scss:1–298`, `styles.scss:1–52` em `docs/references/ui/`.

- **Preservar:** marca, tema escuro/tokens, sidebar de 256 px no desktop, mapa em destaque, Bootstrap, estilos lazy de MapLibre e Leaflet, foco visível e breakpoints de 760/420 px. Não adicionar biblioteca de tema ou redesenhar navegação.
- **Completude:** aviso de demonstração, legenda com texto, lista e estados independentes da consulta e do mapa. Carregamento/erro já aparecem no template, mas funções e comportamento não foram fornecidos.
- **Acessibilidade:** reavaliar `role="application"`; preferir região rotulada e alternativa em lista, link para pular mapa, foco previsível, anúncio de estado e botões rotulados. Testar teclado, leitor de tela e contraste; cor isolada não define severidade. Sem afirmar certificação por inspeção de CSS.
- **Mobile:** testar alturas mínimas de 360/420/380 px, áreas de rolagem e tela em paisagem, zoom de 200%, controles/legenda/atribuição sem sobreposição; não interpretar media queries como teste já passado.
- **Manutenção:** substituir novos usos de `::ng-deep` por estilos globais delimitados por classe da área do mapa; Angular desaconselha novos usos desse seletor.[10] Preservar as referências e aplicar ajustes apenas no futuro código.
- **Dependências visuais:** revisar importação de Bootstrap/Sass conforme as versões escolhidas, sem reduzir/trocar biblioteca antecipadamente; prefixar estilos próprios para evitar colisões como `.nav-link`.
- **Fontes e mapa-base:** `styles.scss` referencia fontes Google; Stadia Maps fornece tiles vetoriais/raster, fontes e sprites por requisições de terceiros. A configuração raster está em `apps/web/public/maps/raster-provider.json`; antes de publicação, rever licença/termos, atribuição, política de tiles, contato, limites e disponibilidade. Avaliar auto-hospedagem/fallback das fontes. Não presumir uso ilimitado de serviço público nem alegar cartografia real para uma opção local/sintética.

## 8. Verificação e limites conhecidos

P1.1 exige testes de serialização/privacidade, domínio/validação, integração HTTP + PostgreSQL/PostGIS e componentes Angular. Teste de integração verifica extensão e dados reais no banco do teste; mocks não substituem CA01. Cenários de estados não públicos ficam em fixtures de teste, sem dados pessoais.

`scripts/verify.sh frontend`: exige manifest/lockfile/node_modules e scripts reais lint/test:ci/build; configurar teste de execução única com falha por ausência de testes. `backend`: exige Java, Docker, Wrapper e executa Maven clean verify com flags para não pular testes; exige XML Surefire e Failsafe. Configurar Failsafe ligado a integration-test/verify. Presença de relatórios não comprova que não estejam todos ignorados: revisar contagem, skips e cobertura dos aceites. `all` combina os modos, mas não roda automaticamente um ensaio de carga, E2E ou auditoria de acessibilidade.

P0 executa apenas `docs`/`planning`, verificações estruturais: arquivos não vazios e sintaxe Bash. Detalhamento da única próxima tarefa, dependências e evidências estão em `PLAN.md`.

## Sources

[4] https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
[5] https://postgis.net/docs/ST_DWithin.html
[6] https://angular.dev/reference/versions
[7] https://docs.spring.io/spring-boot/system-requirements.html
[10] https://angular.dev/guide/components/styling
[11] https://maplibre.org/maplibre-style-spec
[12] https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
[13] https://www.rfc-editor.org/info/rfc7946
[14] https://www.postgresql.org/docs/current/datatype-datetime.html
[15] https://openfreemap.org/quick_start/
[16] https://openfreemap.org/tos/

## Incremento frontend de mapas — 11/10/2026

Raio 100–25.000 m, clique esquerdo condicionado ao filtro e arraste nativo; 75 ocorrências sintéticas distribuídas em nove municípios da RMRJ. Estado/lista são imediatos; renderização consolida mudanças por quadro, sem submissão GeoJSON duplicada. Mapa público permanece montado para preservar câmera/tiles, com custo de memória/contexto retido; ResizeObserver acompanha o contêiner e evita invalidar Leaflet sem mudança de dimensão. Google Maps permanece candidato: heatmap nativo foi descontinuado, custo/overlay/prova comparativa pendentes. Detalhes, fontes, proveniência e evidências em [mapas-desempenho-google.md](../../maps/performance-google.md). Sem backend ou novas dependências.

## Consolidação do repositório — 11/10/2026

`main` concentra a versão mais recente em `apps/web/`; `vetor-urbano-web/` foi substituído. `scripts/verify.sh` é o executor atual; `scripts/verify.sh` é um wrapper de compatibilidade. Documentos exclusivos e o SQL da antiga `main` foram preservados com aviso de legado. Divergências de categorias/estados, contratos HTTP, perfil de escrita e IDs RF/RNF são registradas em [consolidacao-branches-2026-10.md](../../history/branch-consolidation-2026-10.md), sem escolher novo contrato full-stack nesta tarefa.
