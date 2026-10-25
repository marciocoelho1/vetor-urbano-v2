# Publicação territorial e revelação de tema

Aceita em 25/10/2026, registrada após `c0b70ac` (API, V23) e `b8c6027` (web, consumindo o contrato). Seis decisões, todas verificáveis no código citado — nenhuma delas autoriza coleta nova, publicação de dado real ou declaração de cobertura completa.

## 1. Fronteira do módulo e identidade oficial

O catálogo administrativo é módulo próprio — `catalog_datasets`, `catalog_territories`, `catalog_territory_versions` (V23) — e **não referencia nem reutiliza** `territorial_versions` (Áreas de Risco, V13). Os dois recortes não são equivalentes e não podem ser tratados como um só.

Município se identifica por código IBGE de 7 dígitos (`CHECK (level <> 'MUNICIPALITY' OR official_code ~ '^[0-9]{7}$')`); bairro, RA e AP usam o código da própria fonte, com `(level, official_code)` único. `normalized_name` é derivado por gatilho (`upper(unaccent(btrim(name)))`) e nunca digitado: busca e exibição não divergem. Hierarquia é restrição de banco — município não tem pai, e os demais níveis exigem um.

## 2. Proveniência é pré-requisito, não metadado

Toda versão aponta para um `catalog_datasets` com origem, `source_url` https, licença, atribuição, data-base, instante de obtenção, checksum sha256 (64 hex minúsculos) e limitações — todos `NOT NULL` e não vazios. Conjunto sem trilha de proveniência não entra no catálogo; conjunto ingerido não pode ter sua trilha reescrita (decisão 3).

## 3. Histórico imutável; correção entra como versão nova

`catalog_territory_versions` e `catalog_datasets` recusam `UPDATE` e `DELETE` por gatilho (`catalog_history_immutable`, `ERRCODE 23514`). Geometria, data-base, proveniência e ponto representativo de uma versão publicada não são editáveis; qualquer correção é uma versão nova, com seu próprio `dataset_id` e `reference_date`. A revisão histórica é o produto, não um efeito colateral de auditoria.

## 4. Publicação só da versão aprovada, com cobertura parcial explícita

`catalog_territories.approved_version` é FK diferível para `(territory_id, version)`; `/api/v1/territories` serve **apenas** a versão aprovada e revisão não aprovada não vaza para o público. Aprovação exige papel `ADMIN` e CSRF, no padrão de `/risk-areas`; a leitura pública não exige sessão. Município sem geometria validada continua aparecendo como indisponível (`aria-disabled`, não selecionável) e a contagem de cobertura é calculada no servidor — a tela não conta itens para dizer «22 de 22».

## 5. Ponto representativo derivado do polígono, no banco

`internal_point` é escrito por gatilho `BEFORE INSERT` como `ST_PointOnSurface(boundary)` e o `CHECK ST_Contains(boundary, internal_point)` recusa ponto fora. Quem inserir outro ponto tem o valor sobrescrito: não existe caminho para centroide de bounding box, média de ocorrências ou centro escolhido no cliente. O frontend consome `internalPoint` como centro do raio e da câmera; escolher centro no mapa ou digitar coordenadas desfaz o vínculo com o território em vez de manter nome de município sobre centro que não é o dele.

Limite declarado: o catálogo hoje cobre **municípios** (22 no ambiente sintético). Bairro, RA e AP dependem de fonte autorizada e seguem pendentes em [Cartografia territorial](../product/territorial-mapping-priority.md); a cobertura parcial é publicada como parcial.

## 6. Revelação de tema ancorada no controle real

A troca de paleta usa View Transitions com `clip-path` circular centrado no botão que a disparou (`--theme-reveal-x/-y/-radius` medidos do elemento). Sem `startViewTransition`, a paleta interpola por CSS; com `prefers-reduced-motion: reduce`, a troca é imediata, sem snapshot. Durante a captura o conteúdo sai do hit-test, então o clique dentro dos limites reais do controle é reencaminhado a ele — o botão continua alcançável enquanto o reveal está no ar, e nenhum outro controle é atingido pelo reencaminhamento.

A duração deste reveal ainda **não** obedece ao vocabulário fechado de movimento do [ADR 0003](0003-ux-lotes-e-tokens.md): `theme-motion.scss` declara 640 ms na animação, 420 ms no caminho de interpolação e 180/260/480 ms no botão. O lote UX-4 é quem traz esses valores para 120/240/400 ms; até lá a asserção de UX-4 reprova e isso é dívida registrada, não exceção concedida.

## Consequências

- V23 aplicada no ambiente sintético `vetor-spec-postgis` (`127.0.0.1:55436`, base `vetor_spec_test`): 23 migrações com `success=true`, 22 linhas em `catalog_territories` e 22 em `catalog_territory_versions`. Nada aponta para a base real em `55438`: o ingestor recusa explicitamente essa porta e a base `vetor_urbano`.
- A folga da folha móvel deixou de ser constante declarada e virou objeto de asserção em `b8c6027` (`e2e/territory-selector-visibility.spec.ts` exige 12 px a 390 e 320). UX-6 reescreve essa asserção para «altura medida da barra + 12», como fixado no ADR 0003.
- O catálogo é a fonte do centro por localidade em [UXH-03](../product/uxh-03-territory-center-selector.md). Nenhuma consulta de ocorrências é disparada pela seleção de território.
