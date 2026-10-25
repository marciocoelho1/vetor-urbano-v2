# UXH-02 — inventário territorial por metadados — 24/10/2026

## Resultado e fronteira

**Pesquisa documental local executada; cobertura espacial e aceite de produto não demonstrados.** Autorização específica desta rodada: páginas públicas de fontes/metadados, sem baixar geometrias ou datasets reais, acessar bancos, importar, publicar, criar recursos externos ou operar Git além de inspeção. Não houve consulta `/query`, download SHP/GPKG/GeoJSON ou leitura de dados de bancos. PDFs metodológicos/legais são documentação, não conjuntos de feições. PLAN, CHANGELOG, tickets, checklist e controlador ficaram fora da propriedade desta entrega.

O [inventário estruturado](../product/uxh-02-territorial-inventory-2026-10-24.json) contém somente linhas de investigação por município/nível, não feições nem um catálogo de bairros incorporado. A lista vigente publicada pelo órgão metropolitano tem **22 municípios**, incluindo Petrópolis. Foram geradas por código **46 linhas: 22 municipais, 22 de investigação de bairros, uma de RA e uma de AP**. Estas últimas são linhas de conjuntos, não contagens de regiões. Não foi possível determinar todos os totais intramunicipais vigentes apenas pelas evidências consultadas. Isso é bloqueio explícito, não entrega integral do critério de inventário por unidade.

## Base documental do repositório

Lidos AGENTS.md, PLAN.md, [ticket UXH-02](../product/ui-ux-pilot-tickets/uxh-02.md), [especificação UXH](../product/ui-ux-pilot-specification.md), [plano](../product/ui-ux-pilot-plan.md), [prioridade territorial](../product/territorial-mapping-priority.md), [auditoria de fontes cartográficas](../maps/territorial-sources.md), [pesquisa de território/hospedagem](pilot-territory-hosting-research-2026-10-23.md), [pesquisa inicial de fontes](initial-source-research-2026-10-17.md) e [contrato de versões](../architecture/territorial-versions-local-v1.md). Preservadas as alterações preexistentes. Evidências históricas não foram tratadas como verificação atual. A lista municipal e os retângulos demonstrativos descritos na pesquisa anterior não provam geometria municipal. Nenhum material real existente foi reimportado ou validado.

## Fontes e evidências atuais

Todas as consultas abaixo ocorreram em **24/10/2026**; obtenção de geometrias: **não realizada**. Data de consulta não substitui data-base, publicação ou vigência.

| ID / conjunto | Evidência primária e referência temporal | Direitos e limitações / encaminhamento |
|---|---|---|
| RMRJ legal/institucional | [IRM — Formação RMRJ](https://www.rj.gov.br/irm/formacao_rjrm) publica nominalmente os 22 municípios abaixo. [Legislação IRM](https://www.rj.gov.br/irm/publicacoes) aponta LC 184 de 27/12/2018 como norma de composição/gestão | Relação institucional atual confirmada; não é geometria. A página contém menção histórica a Constituição estadual em 1998 que não foi usada como fundamento. O PDF da LC vinculado retornou 502 no extrator; não alegamos leitura integral/consolidação independente das alterações da lei. Revisão jurídica de vigência continua aconselhável antes da ingestão |
| MMD2025 / municípios | [IBGE — Malha Municipal](https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas-territoriais/15774-malhas.html) apresenta edição 2025, publicação 2026, SHP por UF/Brasil, SIRGAS 2000 e coordenadas geográficas. [Notas metodológicas 01/2026](https://biblioteca.ibge.gov.br/visualizacao/livros/liv102268.pdf), seções limitações/condições e características técnicas | Texto primário explicita licença **compatível com CC BY 4.0** para MMD e derivados: crédito e explicitação de processamento que altere características. Candidata prioritária para próxima etapa autorizada; não há contagem de feições RJ conferida, hash de arquivo ou validação espacial. Não é SRID 4326 por simples renomeação: requer transformação documentada. A página alerta instabilidade; alterações comunicadas após 30/4 podem entrar no ano seguinte |
| IBGE_BAIRROS2022 / toda RMRJ como universo candidato | [Malha de setores e divisões intramunicipais](https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas-territoriais/26565-malhas-de-setores-censitarios-divisoes-intramunicipais.html) lista arquivo geoespacial de bairros Censo 2022 SHP/GPKG. [Quadro geográfico — bairros](https://www.ibge.gov.br/apps/quadrogeografico/pdf/qg_2022_650_bairro.pdf), referência 2022, explica conceito, generalização e geocódigo | Candidata nacional não significa cobertura dos 22 municípios. O quadro mostra exemplo de Belford Roxo, mas isso não fornece total local. Licença específica do pacote e alterações posteriores precisam ser conferidas: não estender automaticamente a licença da MMD a outro produto. Bairro censitário pode aproximar limite legal; não representa todo nome de localidade. Direitos/contagens/adequação atual pendentes |
| RIO_CENSO2022 / bairros, RA, AP | [Serviço IPP](https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Censo/Limites_administrativos_Censo_2022/MapServer), [AP camada 0](https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Censo/Limites_administrativos_Censo_2022/MapServer/0), [RA camada 1](https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Censo/Limites_administrativos_Censo_2022/MapServer/1), [bairros camada 2](https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Censo/Limites_administrativos_Censo_2022/MapServer/2). Metadados dizem Polygon, JSON/GeoJSON/PBF, referência espacial 31983 no serviço e recorte Censo 2022 | Copyright IPP/Prefeitura/IBGE não é licença de reutilização. Disponibilidade do serviço confirmada somente para metadados; integridade, contagens e vigência desconhecidas. Nota do serviço cita estimativa de domicílios adicionada em 04/04/2024: isso não data a geometria. Bloqueado para ingestão até direitos e reconciliação legal/temporal. Não confundir `MaxRecordCount=2000` com número de bairros |
| SIGeo / Niterói | [Portal municipal de dados abertos](https://www.sigeo.niteroi.rj.gov.br/pages/dados-abertos) oferece documentos, planilhas e camadas públicas; rodapé ©2024 não é data-base | Portal primário localizado, mas camada específica de bairros, data-base, quantitativo e licença não confirmados. Não adotada a afirmação de domínio público nem contagem aproximada presente em repositório de terceiros. Investigação municipal adicional, não fonte pronta |
| IRM / base metropolitana | [Base cartográfica](https://www.rj.gov.br/irm/base_cartografica) informa que, pelo tamanho, é necessário agendar retirada pela Ouvidoria | Conjunto não obtido, data/escala/licença/cobertura intramunicipal não informadas no texto consultado. Não enviar e-mail/agendar sem autorização. Não supor que cobre Petrópolis porque o portal lista a RMRJ atual |
| Áreas de Risco atuais | Evidência interna: auditoria territorial e pesquisa de 23/10 citadas acima, base declarada julho/2026 e autorização do responsável para demonstração/envio ao piloto sob gates | Nenhuma nova consulta/extração real. Não é divisão administrativa; licença da fonte, atualização, validade, comunicação e destino continuam gates de UXH-18/CA23. Autorização do usuário não é instrumento da fonte |

### Indisponibilidades e divergências relevantes

- URLs sob `www.irm.rj.gov.br/irm/...` devolveram conteúdo genérico de início, apesar de HTTP aparentemente útil. O conteúdo específico foi recuperado em **www.rj.gov.br/irm/**. Não contar página genérica como prova de fonte ausente ou de cobertura.
- `https://www.data.rio/datasets/limite-bairro` retornou 404 pelo extrator. A alternativa primária IPP acima funciona para metadados; falha do link antigo não prova inexistência dos dados.
- O item ArcGIS `554c36237966407fbb674396ecc641f5`, indicado no serviço IPP, não retornou licença/datas no compartilhamento público: `https://www.arcgis.com/sharing/rest/content/items/554c36237966407fbb674396ecc641f5?f=pjson` respondeu erro 400 `Item does not exist or is inaccessible.` em requisição direta. Não interpretar como inexistência do MapServer que foi lido.
- Há **alerta secundário recente**, não comprovação legal primária nesta rodada: [Extra, limites do Argentino](https://extra.globo.com/rio/noticia/2026/10/prefeitura-do-rio-define-limites-do-argentino-novo-bairro-da-zona-norte.ghtml) menciona Lei 8.909/2025 e Decreto 58.828 de 21/10/2026, alterando Brás de Pina. Pesquisa localizou também postagem atribuída à Câmara no Instagram, mas não foi usada como texto legal consolidado. Conferir Diário Oficial/Câmara e atualização IPP antes de fechar o total vigente. **Não adotados 160/163/165/166 como total atual**, nem somado um bairro automaticamente ao catálogo 2022. Lei de criação, regulamentação e atualização de geometria são eventos diferentes.
- Uma publicação da [SME em 2023](https://educacao.prefeitura.rio/wp-content/uploads/sites/42/2023/12/Mapeamento-Convite-a-reflexao-narrativas-em-foco-vf.pdf) é pista histórica sobre 33 RAs, não prova de vigência em outubro/2026. Também não inferimos quantidade de AP pelo número de categorias de um renderer do serviço.

## Matriz municipal esperado / disponível na fonte / pendente de validação

`?` = desconhecido, não zero. Municipal esperado = uma identidade territorial por município listado pelo IRM; pendente municipal = uma unidade ainda sem validação **nesta pesquisa**, não uma geometria comprovadamente ausente na fonte. Disponível significa feições efetivamente verificadas na fonte, não capacidade declarada do serviço. Todos os números de geometria validada **nesta rodada** são 0 por restrição de escopo; isso não afirma zero dados no repositório/provedor. Para bairros, esperado e pendente desconhecidos até reconciliação legal e conferência por unidade. Candidata IBGE comum não prova cobertura municipal.

| Município | Município E / D / P | Bairros E / D / P | Trilha candidata |
|---|---|---|---|
| Belford Roxo | 1 / ? / 1 | ? / ? / ? | IBGE 2022 |
| Cachoeiras de Macacu | 1 / ? / 1 | ? / ? / ? | IBGE 2022 |
| Duque de Caxias | 1 / ? / 1 | ? / ? / ? | IBGE 2022 |
| Guapimirim | 1 / ? / 1 | ? / ? / ? | IBGE 2022 |
| Itaboraí | 1 / ? / 1 | ? / ? / ? | IBGE 2022 |
| Itaguaí | 1 / ? / 1 | ? / ? / ? | IBGE 2022 |
| Japeri | 1 / ? / 1 | ? / ? / ? | IBGE 2022 |
| Magé | 1 / ? / 1 | ? / ? / ? | IBGE 2022 |
| Maricá | 1 / ? / 1 | ? / ? / ? | IBGE 2022 |
| Mesquita | 1 / ? / 1 | ? / ? / ? | IBGE 2022 |
| Nilópolis | 1 / ? / 1 | ? / ? / ? | IBGE 2022 |
| Niterói | 1 / ? / 1 | ? / ? / ? | IBGE 2022; SIGeo como candidata adicional |
| Nova Iguaçu | 1 / ? / 1 | ? / ? / ? | IBGE 2022 |
| Paracambi | 1 / ? / 1 | ? / ? / ? | IBGE 2022 |
| Petrópolis | 1 / ? / 1 | ? / ? / ? | IBGE 2022 |
| Queimados | 1 / ? / 1 | ? / ? / ? | IBGE 2022 |
| Rio Bonito | 1 / ? / 1 | ? / ? / ? | IBGE 2022 |
| Rio de Janeiro | 1 / ? / 1 | ? / ? / ? | IPP bairros + RA/AP; IBGE como comparação |
| São Gonçalo | 1 / ? / 1 | ? / ? / ? | IBGE 2022 |
| São João de Meriti | 1 / ? / 1 | ? / ? / ? | IBGE 2022 |
| Seropédica | 1 / ? / 1 | ? / ? / ? | IBGE 2022 |
| Tanguá | 1 / ? / 1 | ? / ? / ? | IBGE 2022 |

Agregação por código do JSON: municípios **22 / desconhecido / 22**; bairros metropolitano **desconhecido / desconhecido / desconhecido**. Rio RA e AP: cada nível **desconhecido / desconhecido / desconhecido**. Não somar campos desconhecidos como zero; nenhuma soma completa de bairros está demonstrada. Todos os municípios têm ao menos uma linha de investigação, não uma fonte municipal específica homologada. Nos municípios sem fonte municipal específica identificada, a lacuna é **pesquisa adicional necessária**, não declaração de que a prefeitura não publica limites.

## Unidades, identidade e relações a provar

- Município, bairro, RA, AP e Área de Risco são tipos distintos. RA/AP aqui significam **Região Administrativa/Área de Planejamento**, nunca risco. Zona informal/subprefeitura/distrito/setor censitário não substituem esses níveis.
- IBGE define bairro como divisão legal municipal; sua instituição não é obrigatória. Nome conhecido não comprova unidade legal nem polígono. O quadro de referência informa geocódigo de bairro com dez dígitos (sete do município + três do bairro), mas não foi feita coleta desses códigos nesta rodada.
- IPP bairros declara `codbairro` (texto de 3), `codra`, `regiao_adm`, `area_plane`; RA declara `codra` e `area_plane`; AP declara `area_plane`. Isso permite **propor** município → bairro → RA → AP no Rio, mas não comprova unicidade, integridade de todos os vínculos ou ausência de exceções. A descrição da camada RA repete “limites de bairros”: inconsistência textual a esclarecer.
- Não juntar nomes isolados; usar fonte + município + tipo + código original + versão/data e tabela de correspondência explícita entre IPP e IBGE. `OBJECTID` de serviço não foi homologado como identificador estável. Não inventar códigos oficiais; homônimos exigem município/tipo visíveis.
- Na futura etapa autorizada: confirmar Polygon/MultiPolygon válido/não vazio, SRID real, transformação para 4326, ordem longitude/latitude, pertencimento, sobreposições/lacunas e ponto representativo interno ligado à versão. Sem geometrias, PostGIS ou navegador integrado nesta rodada, nada disso foi executado.

## Encaminhamento sem aceite inferido

1. **Municípios/MMD2025:** melhor candidata documentada; direitos explicitados, mas somente elegível a uma futura avaliação/ingestão autorizada, após aquisição controlada e contagem por código IBGE, recorte dos 22, validação e atribuição. Não está incorporada.
2. **Rio bairros/RA/AP:** metadados concretos localizados; bloquear incorporação até licença e comparação com atos legais atuais, especialmente mudanças posteriores a 2022. Recuperar fonte primária atual do Argentino; não desenhar memorial em polígono improvisado.
3. **Demais bairros:** IBGE 2022 é trilha inicial a comparar com normas/prefeituras. SIGeo é alternativa para Niterói; IRM exige autorização de contato/retirada. Total desconhecido não impede documentar a lacuna, mas impede declarar o inventário por unidade completo.
4. **CA09–CA12 e CA23:** contribuição documental realizada; aceites espaciais, vínculo por unidade, geometrias, ponto interno e envio ao piloto não satisfeitos por pesquisa. UXH-02 permanece com pendências materiais de quantitativos intramunicipais e direitos. Não marcar como entregue/aceito automaticamente.

## Verificação reproduzível e limites

Ambiente: repositório local Linux, Python 3, ferramentas públicas de pesquisa/extração e requisição HTTP apenas de metadados. Git inspecionado com `git status --short`, sem operações de rede Git. JSON serializado e contagens calculadas por Python, não manualmente. Reprodução na raiz:

```python
import json
from collections import Counter
from pathlib import Path
p = Path('docs/product/uxh-02-territorial-inventory-2026-10-24.json')
r = json.loads(p.read_text())['linhas']
assert len(r) == 46
assert len({x['municipio'] for x in r}) == 22
assert Counter(x['nivel'] for x in r) == {'municipio':22, 'bairro':22, 'RA':1, 'AP':1}
assert len({(x['municipio'],x['nivel']) for x in r}) == len(r)
assert sum(x['esperado'] for x in r if x['nivel']=='municipio') == 22
assert all(x['disponivel_fonte'] is None for x in r)
assert all(x['obtencao_geometrias'] is None for x in r)
assert all(x['validado_nesta_pesquisa'] == 0 for x in r)
print('46 linhas; 22 municípios; 22 municipais pendentes; disponibilidade desconhecida')
```

A validação documental não comprova disponibilidade de downloads, licença não encontrada, topologia ou prontidão operacional. Nenhum teste de aplicação/API/banco foi necessário ou executado por esta pesquisa; a validação global do Lote A cabe ao coordenador. Verificação final executada nesta árvore: assertions Python aprovadas (46 linhas, 22 municípios, unicidade município/nível, totais por nível e preservação de valores desconhecidos); `bash scripts/verify.sh docs` aprovado, 695 links locais em Markdown e sintaxe Bash válida, sem verificar âncoras/URLs externas; `git diff --check` aprovado. Esses comandos não validam cobertura ou geometrias.
