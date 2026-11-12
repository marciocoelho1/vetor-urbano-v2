# Fontes territoriais da RMRJ — registro verificado

29/10/2026. Verificação feita por HTTP e por leitura do arquivo baixado, não por relato de terceiro.
Complementa a conversa trazida pelo responsável (link do ChatGPT), cujas afirmações foram conferidas uma a
uma; o que não pôde ser conferido está marcado como tal.

## 1. O que existe e foi conferido

| Camada | Fonte | Verificação em 29/10 | Sistema | Limitação |
|---|---|---|---|---|
| Municípios da RMRJ (22) | IBGE, Malha Municipal 2025 (UF RJ) — `RJ_Municipios_2025.zip` | HTTP **200**, **4.959.687 bytes**, `Last-Modified 26/02/2026` | SIRGAS 2000 | Os 22 vêm da LC estadual 184/2018; conferir códigos IBGE de 7 dígitos contra o catálogo da V23 |
| Bairros, RAs e APs da capital | Prefeitura do Rio / IPP, serviço ArcGIS REST `Cartografia/Limites_administrativos` | serviço ativo; camada **4 «Limite de Bairros»** com **`count: 167`** por `returnCountOnly` | nativo **31983** (UTM 23S) → reprojetar para 4326 | Atributos reais: `nome`, `codbairro`, `codra`, `regiao_adm`, `rp`, `cod_rp`, `area_plane`; `maxRecordCount 2000` |
| Bairros dos demais municípios | IBGE, Bairros do Censo 2022 — `RJ_bairros_CD2022.gpkg` | HTTP **200**, **6.778.880 bytes**, `Last-Modified 12/11/2024`, **1.727 feições** | SIRGAS 2000 (`srs_id 4674`) | Cobre **31 dos 92 municípios** do estado e **13 dos 22 da RMRJ** |
| GEO-PEDES (estado) | citada na conversa | **não verificável**: a conversa não traz URL | — | Fica como candidata só se aparecer endereço |

## 2. Cobertura real de bairros por município da RMRJ

Contagem medida no `RJ_bairros_CD2022.gpkg` (uma linha por bairro):

| Município | Código IBGE | Bairros |
|---|---|---|
| São Gonçalo | 3304904 | 122 |
| Itaboraí | 3301900 | 75 |
| Nova Iguaçu | 3303500 | 69 |
| Niterói | 3303302 | 66 |
| Duque de Caxias | 3301702 | 42 |
| Cachoeiras de Macacu | 3300803 | 36 |
| Belford Roxo | 3300456 | 30 |
| Japeri | 3302270 | 30 |
| Mesquita | 3302858 | 18 |
| São João de Meriti | 3305109 | 17 |
| Nilópolis | 3303203 | 15 |
| Tanguá | 3305752 | 10 |
| Rio de Janeiro | 3304557 | 294 (ver §3) |
| **Sem geometria de bairro na base** | — | **Guapimirim, Itaguaí, Magé, Maricá, Paracambi, Petrópolis, Queimados, Rio Bonito, Seropédica** (9 de 22) |

Total na RMRJ: **824 feições**. Ausência de bairro na base não prova que o município não tenha bairros —
prova que esta fonte não os publica. A frase do ticket UXH-05 vale literalmente: lacuna registrada não é
cobertura completa.

## 3. Divergência entre bases para a capital

O IPP devolve **167** bairros do Rio; o IBGE devolve **294** na mesma cidade. As duas bases usam
subdivisões diferentes — não são a mesma lista com nomes trocados. Regra de ingestão: **capital pelo IPP**
(fonte municipal, inclui RA/RP/AP na própria feição) e **IBGE só para os demais municípios**, sem somar as
duas para o Rio. Quem somar vai contar bairro duas vezes e criar homônimo artificial.

## 4. O que isso muda no código

O modelo da V23 (`catalog_datasets`, `catalog_territories`, `catalog_territory_versions`) **já aceita**
`MUNICIPALITY`, `BAIRRO`, `RA` e `AP`, com proveniência obrigatória, ponto interno derivado por gatilho e
histórico imutável. Portanto **não há migração nova de estrutura**: UXH-04 e UXH-05 são trabalho de
ingestão — um importador que lê as duas fontes, reprojeta para 4326, valida topologia, calcula checksum do
arquivo original e grava versão aprovada. É o mesmo desenho do `ingest-territorial-catalog.py` que já
ingere município.

## 5. Pendências de fonte que ainda exigem prova

- **Licença do IPP:** a conversa declara CC BY 4.0. **Não confirmei na fonte**; até confirmação, o dataset
  não pode ser gravado com licença preenchida por suposição — o `CHECK` da V23 exige texto não vazio, e
  texto inventado é pior que ausência.
- **Termos do IBGE** para as duas bases (malha municipal e bairros): registrar por dataset, com data de
  obtenção e limitações.
- **Topologia:** nenhuma das duas bases foi validada por `ST_IsValid` nesta rodada (sem PostGIS no ar). Os
  `CHECK` da V23 reprovam polígono inválido, então a validação acontece na carga, não na leitura.
- **Data-base:** a malha municipal é de 2025; os bairros do Censo 2022. As duas datas entram separadas.
