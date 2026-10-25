# UXH-02 — Inventariar fontes e cobertura territorial metropolitana

**Estado:** parcial em 24/10/2026; pesquisa de metadados realizada, sem aceite ou publicação no GitHub.
**Lote:** A.
**Bloqueado por:** Nenhum ticket; pesquisa pública de fontes/metadados autorizada no Lote A em 24/10/2026.
**Condição adicional:** Sem acesso a bases reais, download/ingestão de geometrias, importação ou publicação de dados reais nesta rodada.

## Entrega verificável

Entregar inventário conferível de municípios, bairros e, no Rio, RAs/APs, com fontes candidatas, direitos, datas e lacunas, dando prioridade extrema à cartografia.

## Critérios de aceite

- [ ] Conferir a lista metropolitana vigente em fonte adequada; calcular totais esperado/disponível/pendente por nível e município, sem presumir contagens antigas.
- [ ] Registrar origem, licença/autorização, data-base/obtenção e limitações de cada conjunto; metadados consultados não comprovam licença ou cobertura.
- [ ] Desambiguar unidades e relações; distinguir divisões administrativas de Áreas de Risco e nome de localidade de geometria disponível.
- [ ] Mapear divergências e fontes indisponíveis sem desenhar limites fictícios, publicar extrações ou aprovar aquisição paga.
- [ ] Indicar quais conjuntos podem seguir para ingestão e quais exigem decisão/fonte adicional; indisponibilidade permanece bloqueio, não aceite espacial.

## Rastreabilidade e prova

Critérios compartilhados: **UXH-CA09, UXH-CA10, UXH-CA11, UXH-CA12, UXH-CA23**, na [especificação](../ui-ux-pilot-specification.md). Este ticket cobre sua parcela, não declara todo critério compartilhado encerrado isoladamente.

Aplicar verificações pertinentes da especificação; registrar versão, comandos, ambiente e limitações. API/PostGIS real quando houver seleção/persistência; navegador integrado quando houver jornada. Resultados de testes pulados ou de outra árvore não comprovam entrega. Preservar critérios antigos não superados explicitamente e não reduzir aceite para obter verde.

Ao concluir futuramente, preencher evidência real e pendências remanescentes, atualizar plano/checklist e submeter ao responsável. Não marcar este arquivo como entregue nesta consolidação.

## Checkpoint — 24/10/2026

- Entregue parcela documental: [pesquisa com fontes/direitos/datas/lacunas](../../history/uxh-02-inventory-2026-10-24.md) e [inventário calculado](../uxh-02-territorial-inventory-2026-10-24.json), 22 municípios e 46 linhas de investigação. Unicidade e contagens recalculadas pela sessão principal; desconhecido permanece `null`.
- Critérios demonstrados parcialmente: composição publicada pelo IRM, distinção município/bairro/RA/AP/Área de Risco, fontes candidatas e encaminhamento por conjunto. MMD2025 é candidata prioritária, não incorporada.
- Pendências materiais: totais esperados/disponíveis de bairros e RA/AP, relações por unidade, atos atuais, direitos específicos e validação espacial. Geometrias não baixadas; nenhuma cobertura completa declarada. Sem teste de aplicação necessário à pesquisa documental; prova espacial não executada.
- Próxima ação: aprofundar atos/metadados primários e obter autorização específica para aquisição/validação cartográfica real antes de ingestão. Aceite não marcado; checkboxes acima preservados para conferência.

[Plano e dependências](../ui-ux-pilot-plan.md). ID local do incremento UXH, sem equivalência com números antigos 01–36 ou issues do GitHub.
