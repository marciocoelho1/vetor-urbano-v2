# Escopo do produto

O Vetor Urbano reúne consulta e análise geográfica de ocorrências urbanas. A versão atual valida a experiência com dados fictícios; a integração operacional será construída em etapas.

## Disponível na demonstração

Mapa e lista, busca, filtros combinados por categoria/período/raio, pontos de interesse e territórios atribuídos à fonte. Também há informes ativos, histórico, indicadores, comparação, reprodução temporal, filtros salvos, importação manual de fontes e exportação XLSX.

O formulário de Trânsito, Segurança e Contingência valida campos e coordenadas, mas não envia dados. A moderação apresentada na interface é local. Não há contas, permissões de servidor, persistência ou monitoramento de fontes.

## Região e fontes

O recorte solicitado é o Rio de Janeiro e a Baixada Fluminense. A lista de municípios e os limites operacionais ainda precisam de definição. A massa fictícia distribuída em nove municípios metropolitanos serve à demonstração e não comprova cobertura.

CSV agregado e GeoJSON de eventos podem ser importados manualmente com origem, URL, licença/autorização, data e limitações. As camadas territoriais mantêm atribuição à fonte e data-base; não certificam domínio territorial ou risco atual. Consulte [fontes territoriais](../maps/territorial-sources.md).

## Requisitos originais

Os IDs de RF/RNF permanecem os de [initial-context.md](../references/initial-context.md). A demonstração não encerra um requisito que também exige servidor, segurança ou medição operacional.

| ID | Capacidade | Estado atual |
|---|---|---|
| RF01 | Cadastro de ocorrências | Formulário local; escrita persistida pendente |
| RF02 | Mapa, marcadores, calor e filtros | Implementado no cliente; consulta espacial persistida e validação semântica pendentes |
| RF03 | Alertas ao entrar em perímetro ativo | Pesquisa de plataforma, permissões e precisão |
| RF04 | Votos e relevância | Backlog; regras de conflito e abuso pendentes |
| RF05 | Autenticação e permissões por perfil | Não implementado |
| RF06 | Gestão de Operadores | Não implementado |
| RF07 | Fila exclusiva de moderação | Triagem local; controle de acesso pendente |
| RNF01 | Consulta em até 1,5 s em 4G | Meta preservada; ensaio representativo pendente |
| RNF02 | Privacidade e separação da identidade | Dados fictícios; proteção do fluxo real ainda a validar |
| RNF03 | Disponibilidade de alertas de 99,9% | Serviço e medição não implementados |
| RNF04 | 20.000 conexões ativas | Meta futura; sem ensaio de carga |
| RNF05 | 30 fps estáveis no mapa móvel | Medição em aparelho físico pendente |
| RNF06 | Armazenamento seguro de senhas | Obrigatório antes de introduzir contas |
| RNF07 | Sessão com limite de inatividade e revogação | Não implementado; limite original de uma hora preservado |
| RNF08 | MFA para Gestor | Obrigatório antes de liberar esse perfil |

As [regras RN-P01–RN-P14, aceites CA01–CA08 e protocolos de medição](../archive/planning/scope-2026-10.md) estão preservados como propostas, sujeitos à reconciliação antes do backend. Os requisitos legados em `archive/specifications/` têm numeração própria e não substituem os IDs acima.

## Decisões em aberto

Definir consulta anônima ou autenticada, criação e gestão de Operadores, poderes do Gestor, estados de moderação, campos públicos/restritos e políticas de sessão/retenção. Também faltam cobertura territorial validada e configuração cartográfica para hospedagem.

A direção prevista restringe o cadastro real a Operador/Gestor. Cadastro comunitário, alertas e votos dependem de decisão própria. A [ordem das entregas](../../PLAN.md) é a referência para o próximo trabalho.
