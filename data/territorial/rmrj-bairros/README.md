# Catálogo territorial — bairros da RMRJ (IBGE Censo 2022)

Proveniência do pacote que publicou **658 bairros de 13 municípios** da Região Metropolitana
do Rio de Janeiro em `catalog_territories` (nível `BAIRRO`, `approved_version` preenchido).

- Fonte: IBGE, Malha de Bairros do Quadro Geográfico 2022, via WFS `CGMAT:qg_2022_650_bairro_agreg`; licença **CC BY 4.0**.
- Detalhe: `qualidade=maxima`, `simplificar=nenhuma` — o padrão da ferramenta, registrado em `catalog_datasets.limitations`.
- `manifest.json` é a saída literal de `agente.py`: origem, `sourceUrl`, licença, atribuição, data de referência, `checksum` do conjunto e **sha256 por arquivo**. O campo `destino` guarda o caminho absoluto da máquina que gerou o pacote.
- `alvos.json` são os 658 alvos (`nivel=bairro`, código IBGE do município + id do bairro) efetivamente usados.
- `municipios-rmrj.json` é a lista de 22 municípios (LC 184/2018) usada no inventário de cobertura.

## Como regerar

```bash
cd /home/marciocoelho/Documentos/Projetos/geo-poligonos-br
python3 agente.py catalogo-vetor-urbano \
  --arquivo <este diretório>/alvos.json --destino ./pacote-bairros-rmrj13
# aplica no banco sintético, com publicação explícita:
python3 agente.py catalogo-vetor-urbano \
  --arquivo <este diretório>/alvos.json --destino ./pacote-bairros-rmrj13 \
  --aplicar --database vetor_spec_test --approve
```

`raw/*.geojson` (6,4 MB) e `catalogo.sql` (5,4 MB) **não são versionados**: são derivados
determinísticos do `manifest.json` + `alvos.json` + ferramenta, e o sha256 de cada arquivo
está no manifest para conferência depois de regerar.

## Proveniência operacional

A resolução do nome do município pai foi feita por tabela local com os 13 nomes obtidos de
`agente.py municipios --uf RJ` (nomes do IBGE, nenhum valor inventado), porque a chamada a
`servicodados.ibge.gov.br` ficou presa em `SYN-SENT` no host de geração. Extração, geometria,
checksums e SQL rodaram pela ferramenta sem alteração. `catalog_datasets` é imutável por
gatilho, então esta nota vive aqui e no `manifest.json`, não na linha do banco.

## Lacunas declaradas

- **9 municípios sem malha oficial de bairro no IBGE:** Guapimirim, Itaguaí, Magé, Maricá,
  Paracambi, Petrópolis, Queimados, Rio Bonito, Seropédica — zero `BAIRRO` no banco.
- **RA/AP do Rio sem fonte oficial:** o IBGE dá 162 bairros e 1 distrito; mapear distrito→RA
  seria inventar vocabulário do V23.
