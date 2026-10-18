# Escopo do produto

Atualização: 15/10/2026. A [especificação funcional interna v1.1](specification.md) consolida as decisões Q1–Q88 e prevalece sobre lacunas superadas da entrevista anterior Q1–Q14. Aprovação funcional não comprova implementação. Esta reconciliação e a proposta de tickets permanecem locais, sem publicação autorizada.

## Decisões aprovadas

O Vetor Urbano reúne acompanhamento e análise geográfica nos pilares Trânsito, Segurança e Contingência. A cobertura desejada passou a ser toda a Região Metropolitana do Rio de Janeiro; limites e municípios precisam de referência oficial antes do uso operacional. Preserva-se a referência original Rio/Baixada sem apresentá-la como a cobertura completa agora desejada.

- Catálogo de tipos/subtipos aprovado em D04; a pendência anterior de Q9 não bloqueia mais a consulta inicial. Evoluções de catálogo exigem decisão explícita e preservação histórica.
- Fonte, clipping, ocorrência e acontecimento são distintos. Notícias repetidas não multiplicam ocorrências; efeitos distintos do mesmo acontecimento têm situações independentes.
- Modo simples inicia em Últimas 24 horas/três pilares; Análise e Inteligência acrescenta filtros completos, Histórico, Relatórios, comparação, exportações e calor. Preferência de modo é preservada; troca suspende filtros ocultos e concilia os compatíveis com aviso.
- Módulos exigem cadastro/autenticação; páginas institucionais, fontes e explicações continuam anônimas. MVP com Usuário e Administrador; modos não são privilégios administrativos nem planos comerciais. “Mapa público” é denominação legada da consulta comum autenticada.
- Informes inclui recentes de 24 horas, inclusive encerradas, mais vigentes antigas; raio inicial/máximo 5 km, centro explícito e escolha manual. Localização real entra com backend. Situações: Em andamento, Encerrada, Desconhecida; confirmação expirada não comprova encerramento.
- Município/bairro filtra; endereço/referência posiciona a câmera e oferece aplicar área visível. Pan não muda consulta. Precisão apenas territorial permite lista e estatística compatível, sem pin/calor/raio artificiais.
- Áreas de Risco é camada territorial distinta, com fonte, referência temporal e versões; não é índice automático de risco. Calor avançado representa concentração de ocorrências únicas e precisas.
- Histórico inclui todas as publicadas, inclusive vigentes. Relatórios tem filtros independentes, transferência explícita pelo mapa e atualização explícita do momento gerado. Síntese determinística, comparações e XLSX/PDF fazem parte do MVP.
- Fontes, coleta e fila são administrativas com autorização no servidor. Revisão precede publicação; pendentes, descartadas e retiradas ficam fora de consulta/análises. Correções preservam versões e auditoria. Usuário pode solicitar correção, sem cadastrar nova ocorrência.
- Confiabilidade da ocorrência é a denominação pública da antiga credibilidade da informação (1–5), distinta de confiabilidade da fonte e confiança de extração. Público vê número/link resumido; rubrica, fórmula e notas das fontes são internas.

Decisões completas e CA01–CA25 locais estão na spec. O primeiro lote proposto é somente consulta demonstrativa com fixtures; não encerra o MVP nem a comprovação de scraping anteriormente solicitada.

## Disponível hoje

Frontend Angular demonstrativo, 75 ocorrências e dois POIs fictícios: mapa/lista, busca, filtros locais, marcadores/calor, camada territorial atribuída, Informes por estado, Histórico textual, comparação/indicadores, reprodução temporal experimental, filtros salvos, importação manual e XLSX. As regras atuais ainda divergem da spec.

O formulário valida campos/coordenadas, mas não cria, envia ou persiste ocorrência. Triagem local de referências não é fila real. Não há API Java, PostgreSQL/PostGIS integrado, contas, autorização de servidor ou coleta automática. A camada territorial existente tem procedência e autorização próprias; não é fixture de ocorrência nem cobertura operacional validada. Consulte [inventário](development-status.md) e [fontes territoriais](../maps/territorial-sources.md).

## Parâmetros pendentes

Fórmula/calibragem da nota; rubrica/amostra/janela da fonte; validade de confirmação por tipo; correspondência automática de publicações; limites oficiais/interseção de trechos; confirmação/recuperação/sessão/MFA/desvinculação; fontes autorizadas, custo/frequência/extração; paginação/desempate de datas imprecisas; granularidade/colunas/composição dos arquivos; retenção definitiva e textos institucionais. A hipótese configurável de logs de 60 dias/um ano não é política definitiva.

Esses parâmetros bloqueiam apenas os incrementos correspondentes. Não impedem catálogo, consulta e fixtures rotuladas. A referência legada de uma hora de inatividade permanece até reconciliação explícita. RF06 e perfis legados exigem reconciliação; não é reaberta a decisão atual Usuário/Administrador.

## Futuro e fora do recorte inicial

Relatos da população, resumo por IA, reprodução temporal integrada ao mapa avançado, paywall/planos, login externo, alertas/geofencing, votos e escala operacional. Landing page está prevista, mas sua definição foi adiada. Refinamento específico de mobile permanece adiado; acessibilidade, alternativa em lista e conferência de apresentação não são dispensadas.

## Requisitos originais

IDs e textos de [initial-context.md](../references/initial-context.md) preservados. Nem a spec nem tickets locais renumeram RF/RNF; CA01–CA25 da spec e CA legados têm escopos distintos.

| ID | Capacidade original | Estado e reconciliação |
|---|---|---|
| RF01 | Cadastro de ocorrências | Formulário local sem escrita. Revisão/edição persistida futura; severidade original não é confiabilidade, reconciliação pendente. Relatos da população adiados. |
| RF02 | Mapa, marcadores, calor e filtros | Cliente parcial; primeiro lote reconcilia consulta. Servidor/espacial/análise e medições não encerrados. |
| RF03 | Alertas em perímetro ativo | Futuro; Informes e avisos de atualização não implementam geofencing. |
| RF04 | Votos e relevância | Futuro; solicitação de correção e nota administrativa não são votação. |
| RF05 | Autenticação e permissões por perfil | Não implementado; Usuário/Administrador aprovados para MVP, sem apagar referência Gestor/Operador/Usuário. |
| RF06 | Gestão de Operadores | Não implementado; permanece em reconciliação, sem equivalência automática com gestão de Administrador. |
| RF07 | Fila exclusiva de moderação | Não implementada; spec reserva ao Administrador. Divergência com Operador/Gestor legados registrada, sem declarar requisito encerrado. |
| RNF01 | Consulta até 1,5 s em 4G | Meta preservada; ensaio representativo pendente. |
| RNF02 | Privacidade e separação da identidade | Fixtures não comprovam proteção real; separar pessoa, consulta e local da ocorrência. |
| RNF03 | Disponibilidade de alertas 99,9% | Futuro; sem serviço/medição. |
| RNF04 | 20.000 conexões ativas | Futuro; sem carga/serviço. |
| RNF05 | Mapa móvel 30 fps | Meta preservada, aparelho físico pendente; refinamento mobile adiado. |
| RNF06 | Senhas protegidas | Obrigatório antes de contas reais; não implementado. |
| RNF07 | Inatividade e revogação | Não implementado; referência original de uma hora preservada até reconciliação. |
| RNF08 | MFA para Gestor | Não implementado; Administrador exige segundo fator pela spec. Correspondência com Gestor não é presumida. |

[RN-P01–RN-P14 e CA01–CA08 legados](../archive/planning/scope-2026-10.md) continuam propostas arquivadas para reconciliação. [Registro da reconciliação](../history/spec-to-tickets-2026-10-15.md), [definição funcional](feature-definition.md) e [plano](../../PLAN.md) orientam a continuidade local.
