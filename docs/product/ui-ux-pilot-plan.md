# Incremento UX e piloto — tickets e lotes propostos

23/10/2026 • **Grill de produto encerrado; consolidação local autorizada.**

A [especificação consolidada](ui-ux-pilot-specification.md) registra o escopo aprovado e seus critérios. Esta divisão propõe **23 tickets locais em sete lotes**, com granularidade/dependências para revisão antes de executar. Cada ticket tem seu arquivo, entrega verificável, critérios, bloqueios e condições adicionais. Nenhum foi iniciado, aceito, atribuído ou publicado como issue. Sem integração com controlador ou GitHub nesta fase.

## Como ler e executar futuramente

- Prefixo **UXH** identifica o novo incremento. Não renumerar os tickets anteriores 01–36 nem inferir equivalência com issues do GitHub. Não registrar todos como `ready-for-agent` enquanto divisão/autorização e bloqueios estiverem pendentes.
- Lotes agrupam objetivos; não impõem uma fila global A → B → C. Executar apenas a fronteira de dependências e o escopo autorizado. Cartografia é prioridade extrema e corre em paralelo às correções independentes de UI.
- Dependência de ticket é diferente de permissão/condição externa. Não há autorização atual para implementar, acessar material real, contratar, criar conta/recurso, publicar issues, fazer commit/merge/push ou deploy.
- Cada slice precisa entregar comportamento verificável, incluindo API/banco quando afetados, UI e prova; não transformar UI, endpoint e testes em três tickets horizontais. Pesquisa de fontes, verificação e implantação são entregas documentais/operacionais completas próprias.
- A especificação anterior e os tickets antigos ignorados continuam intactos. Novos documentos locais não foram adicionados ao índice Git; a autorização de consolidar não resolve o destino/publicação daqueles materiais. UXH-01 deve apresentar essa decisão com evidência antes de recomendar main.
- Primeiro candidato para uma rodada: **UXH-01 + UXH-02**. A seleção é proposta, não início de execução.

## Inventário e dependências

| ID local | Entrega | Lote | Bloqueado por tickets |
|---|---|---|---|
| [UXH-01](ui-ux-pilot-tickets/uxh-01.md) | Reproduzir e reconciliar o candidato de integração | A | — |
| [UXH-02](ui-ux-pilot-tickets/uxh-02.md) | Inventariar fontes e cobertura territorial metropolitana | A | — |
| [UXH-03](ui-ux-pilot-tickets/uxh-03.md) | Consultar municípios por catálogo territorial versionado | B | UXH-01, UXH-02 |
| [UXH-04](ui-ux-pilot-tickets/uxh-04.md) | Consultar bairros, RAs e APs da cidade do Rio | B | UXH-03 |
| [UXH-05](ui-ux-pilot-tickets/uxh-05.md) | Consultar respectivos bairros dos demais municípios da RMRJ | B | UXH-03 |
| [UXH-06](ui-ux-pilot-tickets/uxh-06.md) | Definir centro do raio por local com geometria validada | B | UXH-03 |
| [UXH-07](ui-ux-pilot-tickets/uxh-07.md) | Tornar navegação e linguagem visual responsivas | C | UXH-01 |
| [UXH-08](ui-ux-pilot-tickets/uxh-08.md) | Ampliar mapa e unificar filtros, ferramentas e resultados | C | UXH-07 |
| [UXH-09](ui-ux-pilot-tickets/uxh-09.md) | Aplicar área visível explicitamente sem ocultar contexto | C | UXH-08 |
| [UXH-10](ui-ux-pilot-tickets/uxh-10.md) | Operar o mapa móvel com painéis exclusivos | C | UXH-09 |
| [UXH-11](ui-ux-pilot-tickets/uxh-11.md) | Reunir telas administrativas em Configurações | C | UXH-07 |
| [UXH-12](ui-ux-pilot-tickets/uxh-12.md) | Abrir detalhe único e retornar ao contexto de consulta | C | UXH-07 |
| [UXH-13](ui-ux-pilot-tickets/uxh-13.md) | Refinar Informes por filtros próprios no servidor | D | UXH-12 |
| [UXH-14](ui-ux-pilot-tickets/uxh-14.md) | Consultar Histórico com filtros no topo e sem reprodução | D | UXH-12 |
| [UXH-15](ui-ux-pilot-tickets/uxh-15.md) | Gerar Relatórios por formulário e ciclo de vida independentes | D | UXH-07 |
| [UXH-16](ui-ux-pilot-tickets/uxh-16.md) | Gerar pelo Mapa e separar painéis e filtros salvos | D | UXH-09, UXH-15 |
| [UXH-17](ui-ux-pilot-tickets/uxh-17.md) | Exportar PDF e XLSX do mesmo resultado gerado | D | UXH-15 |
| [UXH-18](ui-ux-pilot-tickets/uxh-18.md) | Preparar pacote validado das Áreas de Risco atuais para o piloto | E | UXH-01, UXH-02 |
| [UXH-19](ui-ux-pilot-tickets/uxh-19.md) | Preparar integração remota, acesso restrito e operação segura | E | UXH-01 |
| [UXH-20](ui-ux-pilot-tickets/uxh-20.md) | Disponibilizar formulário simples de feedback do piloto | E | UXH-07 |
| [UXH-21](ui-ux-pilot-tickets/uxh-21.md) | Validar candidato integrado antes de hospedagem | F | UXH-04, UXH-06, UXH-10, UXH-11, UXH-13, UXH-14, UXH-16, UXH-17, UXH-18, UXH-19, UXH-20 |
| [UXH-22](ui-ux-pilot-tickets/uxh-22.md) | Implantar piloto restrito em Neon, Render e Vercel | G | UXH-21 |
| [UXH-23](ui-ux-pilot-tickets/uxh-23.md) | Homologar piloto e liberar convidados com feedback | G | UXH-22 |

## Lotes e paralelismo

### Lote A — Base e fontes

**Tickets:** UXH-01, UXH-02.

UXH-01 e UXH-02 podem ser selecionados em paralelo. A pesquisa não exige API funcional.

### Lote B — Cartografia de prioridade extrema

**Tickets:** UXH-03, UXH-04, UXH-05, UXH-06.

Após base/fontes, municípios primeiro; bairros do Rio e demais municípios podem seguir em paralelo. Centro por local aproveita parcelas validadas; ausência de fonte mantém cobertura pendente. Rodar esta trilha em paralelo à UX, não depois dela.

### Lote C — Interface, mapa e administração

**Tickets:** UXH-07, UXH-08, UXH-09, UXH-10, UXH-11, UXH-12.

Navegação primeiro; mapa/filtros → área explícita → painéis móveis. Configurações e detalhe podem seguir em paralelo ao mapa quando a base visual estiver pronta.

### Lote D — Informes, Histórico e Relatórios

**Tickets:** UXH-13, UXH-14, UXH-15, UXH-16, UXH-17.

Informes e Histórico após detalhe; formulário de Relatórios após base visual. Transferência depende do mapa/aplicação espacial e do formulário; exportação pode evoluir após o formulário, sem esperar a transferência.

### Lote E — Preparação segura do piloto

**Tickets:** UXH-18, UXH-19, UXH-20.

Pacote territorial, integração remota/operação e feedback podem ser preparados em paralelo às jornadas, respeitando fontes, decisões operacionais e autorização de acesso. Sem provisionamento externo.

### Lote F — Verificação do candidato

**Tickets:** UXH-21.

Integrar o conjunto selecionado e registrar pendências reais. Revisão de candidato pode produzir bloqueios; não reduz os critérios nem autoriza publicar cobertura parcial.

### Lote G — Hospedagem e teste com convidados

**Tickets:** UXH-22, UXH-23.

Somente após preparação, evidência e permissões específicas. UXH-22 provisiona Neon → Render → Vercel; UXH-23 homologa e pede liberação dos convidados.

## Cobertura cartográfica e bloqueios que não podem virar aceite

UXH-05 é trabalho de prioridade extrema, mas uma fonte ausente não deve paralisar navegação, filtros ou relatórios independentes. Por isso a verificação do candidato não depende do encerramento de toda a cartografia: ela deve **registrar** a situação real de UXH-05/UXH-CA12, e não declarar completude. O responsável precisa decidir explicitamente sobre qualquer publicação com lacunas; nenhuma liberação parcial é presumida nesta divisão.

UXH-06 depende da geometria de cada opção usada: município por UXH-03, bairro do Rio por UXH-04, outros bairros por UXH-05 e Área de Risco por versão validada. A dependência mínima permite entregar/validar o comportamento com localidades disponíveis, mas não encerrar UXH-CA09 para opções indisponíveis ou prometer cobertura completa.

Direitos de fonte e validação espacial bloqueiam ingestão/envio respectivo. Aprovação para enviar Áreas de Risco atuais ao piloto não prova licença da fonte. Evidências reais de publicação, cobertura e testes devem acompanhar a decisão, sem baixar critérios para terminar o lote.

## Condições antes de hospedagem e convidados

1. Candidato reproduzido e versionável; bloqueios de API/PostGIS/navegador resolvidos ou explicitamente apresentados como bloqueios, nunca testes verdes por skip.
2. Revisão da configuração remota, sessão/cookies/CSRF, allowlist, MFA com chave estável, mapa-base e isolamento/coleta desligada.
3. Responsável e serviço de e-mail, confirmação/recuperação, rotina/retenção compatível e prova de backup/restauração em destino isolado.
4. Destino do feedback, tratamento da imagem opcional e responsável pelo recebimento definidos/testados.
5. Segredos provisionados por mecanismo seguro, sem pacote no chat ou valores em Git, bundle, evidência ou logs. Criação/login/OAuth/MFA das contas exige intervenção do responsável.
6. Direitos, atribuições, data/limitações e pacote cartográfico aprovados para o destino; lacunas territoriais explicitadas e submetidas à decisão do responsável.
7. Textos aplicáveis e revisão/publicação pendentes do antigo 36/D3 resolvidos antes dos convidados; não inferir aceite jurídico desta consolidação.
8. Planos vigentes conferidos; cartão/upgrade/cobrança interrompem a execução para alinhamento.
9. Permissões separadas para execução local, operações Git, provisionamento/deploy/envio de dados e abertura aos convidados. Prévia autorização por rodada não se estende automaticamente à seguinte.

A ordenação externa é Neon → Render → Vercel; após ler de volta recursos criados, executar prova remota não destrutiva. Não apontar helpers locais de SQL/limpeza de fixtures para a hospedagem.

## Rastreabilidade dos critérios

Critérios compartilhados têm parcelas em vários tickets. A tabela não significa que cada ticket isolado encerra o critério, nem que verificação local prova hospedagem.

| Critério | Tickets responsáveis por parcelas/prova |
|---|---|
| UXH-CA01 | UXH-07, UXH-21 |
| UXH-CA02 | UXH-07, UXH-08, UXH-21 |
| UXH-CA03 | UXH-08, UXH-21 |
| UXH-CA04 | UXH-06, UXH-08, UXH-21 |
| UXH-CA05 | UXH-09, UXH-21 |
| UXH-CA06 | UXH-09, UXH-18, UXH-21 |
| UXH-CA07 | UXH-08, UXH-10, UXH-21 |
| UXH-CA08 | UXH-10, UXH-21 |
| UXH-CA09 | UXH-02, UXH-03, UXH-04, UXH-05, UXH-06, UXH-21 |
| UXH-CA10 | UXH-02, UXH-03, UXH-21 |
| UXH-CA11 | UXH-02, UXH-04, UXH-21 |
| UXH-CA12 | UXH-02, UXH-05, UXH-21 |
| UXH-CA13 | UXH-11, UXH-21 |
| UXH-CA14 | UXH-12, UXH-21 |
| UXH-CA15 | UXH-13, UXH-21 |
| UXH-CA16 | UXH-14, UXH-21 |
| UXH-CA17 | UXH-15, UXH-21 |
| UXH-CA18 | UXH-15, UXH-21 |
| UXH-CA19 | UXH-16, UXH-21 |
| UXH-CA20 | UXH-16, UXH-21 |
| UXH-CA21 | UXH-17, UXH-21 |
| UXH-CA22 | UXH-15, UXH-16, UXH-17, UXH-21 |
| UXH-CA23 | UXH-02, UXH-18, UXH-19, UXH-21, UXH-22 |
| UXH-CA24 | UXH-19, UXH-21, UXH-22, UXH-23 |
| UXH-CA25 | UXH-19, UXH-21, UXH-22 |
| UXH-CA26 | UXH-19, UXH-21, UXH-22, UXH-23 |
| UXH-CA27 | UXH-20, UXH-21, UXH-22, UXH-23 |
| UXH-CA28 | UXH-19, UXH-21, UXH-22 |
| UXH-CA29 | UXH-01, UXH-21, UXH-22, UXH-23 |

## Estado e evidências desta consolidação

Entrega documental somente. As suítes de aplicação não foram reexecutadas nem capacidades implementadas para produzir esta divisão. Auditoria e resultados históricos permanecem identificados em seus registros. **Validação estrutural executada:** 23 tickets, sete lotes, 29 critérios atribuídos, Q1–Q38 na rastreabilidade, dependências existentes/sem ciclos e 23 checkboxes pendentes fora do repositório; planejamento/diff-check aprovados. Revisão documental independente contra Q1–Q38 sem achado material acionável; isso não comprova comportamento executável. [Registro de evidências e limites](../history/uxh-consolidation-2026-10-23.md).

Checklist externo para marcação à mão: `/home/marciocoelho/Documentos/VetorUrbano-UXH-checklist-2026-10-23.md` (fora do repositório; um checkbox por ticket, todos pendentes). Este caminho local não precisa existir em clones de terceiros e não é link de documentação pública.

Ao executar futuramente, preencher implementação real/evidência/pendência por ticket e aguardar aceites do responsável. A aprovação deste escopo não é declaração de que os 36 tickets antigos estão operacionalmente prontos.
