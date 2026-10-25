# Vetor Urbano

Consulta e registro de ocorrências urbanas. A interface atual apresenta dados de demonstração.

## Linguagem

**Administrador**:
Perfil responsável pela gestão de fontes, coleta, revisão, publicação, correções e avaliações do Vetor Urbano.
_Evitar_: Gestor, Operador (como equivalências automáticas dos perfis legados)

**Informes Ativos**:
Consulta de proximidade às ocorrências das últimas 24 horas, inclusive encerradas, e às ainda em andamento iniciadas antes da janela, em até 5 km de um ponto de referência explícito.
_Evitar_: Ocorrências em andamento (como sinônimo do conjunto inteiro)

**Clipping**:
Registro de uma publicação externa utilizada como material de referência sobre ocorrências urbanas.
_Evitar_: Ocorrência (quando se tratar da publicação de referência)

**Ocorrência**:
Registro consultável de um fato ou efeito urbano, distinto das publicações que o descrevem. Vários clippings podem referenciar uma ocorrência; efeitos distintos podem compartilhar um acontecimento.
_Evitar_: Clipping (quando se tratar do fato)

**Credibilidade da informação**:
Conceito anteriormente denominado credibilidade da informação, apresentado ao público como Confiabilidade da ocorrência. Avalia em escala de 1 a 5 o suporte das evidências ao registro, sem equivaler a probabilidade matemática de verdade.
_Evitar_: Confiabilidade da fonte, confiança de extração

**Confiabilidade da fonte**:
Avaliação recorrente, em escala de 1 a 5, de uma fonte identificada; seu nome é obrigatório e sua URL pública é opcional.
_Evitar_: Credibilidade da informação

**Confiança de extração**:
Avaliação da confiança na interpretação dos dados de um clipping pela IA.
_Evitar_: Credibilidade da informação, confiabilidade da fonte

**Relato da população**:
Informação sobre uma ocorrência fornecida diretamente por uma pessoa da população ao Vetor Urbano.
_Evitar_: Clipping

**Mapa público**:
Denominação legada da consulta cartográfica comum, acompanhada de filtros e lista, cujo acesso aos módulos exige autenticação. Não designa as páginas institucionais de acesso anônimo.
_Evitar_: Mapa de cadastro

**Mapa de cadastro**:
Visão cartográfica usada para escolher a localização de uma ocorrência durante seu registro.
_Evitar_: Mapa público

**Usuário**:
Perfil que consulta os módulos do produto, nos modos disponíveis, sem poderes administrativos.
_Evitar_: Visitante (quando já se trata de conta autenticada), Administrador

**Fonte**:
Entidade, veículo, perfil ou canal identificável que fornece informações de referência, com avaliação própria e histórico.
_Evitar_: Clipping, rede social inteira (quando a origem é um canal específico)

**Acontecimento**:
Contexto que relaciona ocorrências de efeitos distintos, cujas situações podem evoluir independentemente.
_Evitar_: Notícia, ocorrência (como sinônimo indistinto)

**Confiabilidade da ocorrência**:
Nome público da avaliação de 1 a 5 do suporte das evidências à informação da ocorrência, anteriormente denominada credibilidade da informação.
_Evitar_: Confiabilidade da fonte, confiança de extração, probabilidade de verdade

**Situação**:
Condição da ocorrência: Em andamento, Encerrada ou Desconhecida. É distinta da aprovação editorial e do estado de coleta.
_Evitar_: Estado de publicação, expiração (como prova de encerramento)

**Região Administrativa do Rio de Janeiro**:
Divisão administrativa oficial da cidade do Rio usada para organizar territorialmente seus bairros, distinta de Área de Planejamento e de Área de Risco.
_Evitar_: Zona (como equivalência automática), Área de Planejamento, Área de Risco

**Área de Planejamento do Rio de Janeiro**:
Recorte oficial de planejamento da cidade do Rio, relacionado às Regiões Administrativas e aos bairros sem se confundir com essas unidades.
_Evitar_: Região Administrativa (como sinônimo), Área de Risco

**Área de Risco**:
Polígono territorial de contexto com nome, grupo indicado, fonte e referência temporal, distinto de ocorrência e de índice automático de risco.
_Evitar_: Área Dominada, garantia de risco ou segurança atual

**Modo simples**:
Experiência de consulta cotidiana com mapa, lista, detalhes, Informes, períodos recentes, pilares, tipos e Áreas de Risco.
_Evitar_: Perfil Usuário, plano gratuito

**Análise e Inteligência**:
Modo de consulta aprofundada com filtros completos, Histórico, Relatórios, síntese, comparações, exportações e mancha térmica.
_Evitar_: Administrador, premium (como bloqueio comercial já ativo), interpretação por IA

**Solicitação de correção**:
Pedido de usuário para revisar uma ocorrência ou Área de Risco existente, acompanhado de explicação e referências.
_Evitar_: Relato da população, nova ocorrência

**Encerramento de conta**:
Término do acesso de uma pessoa por sua conta, sem período de reativação. É distinto da eliminação dos dados pessoais e da preservação dos registros coletivos.
_Evitar_: Desativação reversível, exclusão de ocorrências

**Histórico de domínio**:
Registro da evolução das informações do Vetor Urbano, incluindo versões, decisões e justificativas, e o conteúdo das solicitações de correção. É distinto do registro de acesso ou uso da aplicação.
_Evitar_: Log de uso, histórico de navegação

**Autor histórico**:
Referência à pessoa responsável por versões e decisões preservadas na base, que permite distinguir seus atos após o encerramento da conta sem manter ligação recuperável com o cadastro eliminado. Não equivale a uma conta ativa ou a uma garantia de anonimização.
_Evitar_: Usuário ativo, autor anônimo (como garantia de impossibilidade de identificação)
