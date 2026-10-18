# Conta, identidade e registros

Atualização: 17/10/2026. Decisões de produto **parciais e aprovadas** nesta entrevista; não é política de privacidade publicável nem declaração de implementação. Complementa D11/D13 e CA23/CA24 da [especificação](specification.md), preservando RF05, RNF02 e RNF06–RNF08 originais. Aprovações e fundamentos no [registro da entrevista](../history/decision-interview-2026-10-17.md).

## Jornadas aprovadas

### E01 — Recuperação de senha

Recuperação pelo e-mail confirmado, com link temporário de uso único e resposta que não revele existência de conta. Pedir o link não encerra sessões. Ao concluir a recuperação, invalidar todas as sessões e links de recuperação pendentes; exigir login normal. O MFA administrativo é preservado.

Justificativa: recuperar controle da senha sem conservar sessões anteriores e sem transformar recuperação de senha em remoção do segundo fator. Perda de e-mail/autenticador segue E05/E12; suspeita de comprometimento e execução do procedimento excepcional ainda exigem detalhamento.

### E02 — Alterações da própria conta

Nome de exibição pode mudar em sessão autenticada sem desconectar. Alteração de senha/e-mail exige senha atual e novo código MFA para Administrador. Novo e-mail somente substitui o antigo após confirmação. Na efetivação da senha/e-mail, revogar todas as sessões e links pendentes de recuperação/troca de e-mail, exigindo novo login. Recuperação E01 é jornada distinta da alteração autenticada.

Justificativa: reduzir interrupção em alteração sem efeito no acesso, comprovar controle das mudanças sensíveis e evitar substituir o endereço atual por outro incorreto ou não controlado.

### E03 — Encerramento voluntário

Exigir senha atual, novo código MFA para Administrador e confirmação explícita das consequências. Após confirmação, encerrar o acesso e revogar sessões/links, sem período de reativação. Isso não define prazo de eliminação dos dados. A preservação de fatos e decisões coletivas já estava aprovada.

Justificativa: encerramento inequívoco, sem manter acesso ou prometer cancelamento futuro. O último Administrador segue E06; os dados cadastrais seguem E07. Confirmação nas exceções de acesso e demais vínculos pessoais permanecem pendentes.

## E04 — Classificação aprovada dos registros

| Classe | Conteúdo e exemplos | Limite |
|---|---|---|
| Uso | Consultas, filtros e geração/exportação de relatórios de consulta | Administrador consultando/exportando tem a mesma classe de uso |
| Segurança e conta | Cadastro, login/logout, MFA, recuperação, alterações e encerramento | Não guardar senhas, códigos ou credenciais |
| Operação administrativa | Coleta, gestão de fontes, revisão, publicação, retirada e avaliações | Alterações preservam antes/depois; leitura dos logs segue restrita ao Administrador |
| Histórico de domínio | Versões, decisões/justificativas e conteúdo das solicitações de correção | Não é descartado automaticamente pela rotina de expurgo de logs |

Classificar pela finalidade da ação, não apenas pelo perfil. Uma alteração pode gerar evento administrativo e versão histórica, com ciclos de vida distintos. O evento de envio/transição de uma solicitação é distinto do conteúdo/histórico da solicitação; seu enquadramento detalhado e seus campos ainda serão explicitados.

Justificativa: separar evidência de uso/segurança dos registros necessários para explicar a evolução da base. Preservar histórico não significa guardar toda identidade ou todo conteúdo pessoal indefinidamente.

## E05 — Recuperação do segundo fator e QR code

Aprovados códigos de recuperação individuais de uso único, guardados pelo Administrador fora da aplicação. Senha + código de recuperação permitem somente substituir o fator; confirmar o novo autenticador é obrigatório antes de restabelecer acesso administrativo. Ao concluir, revogar sessões e os demais códigos antigos e gerar conjunto novo.

Na configuração inicial e na substituição do autenticador, oferecer QR code para leitura pelo aplicativo, com chave manual como alternativa acessível. A leitura do QR substitui a digitação da chave de configuração, não a confirmação pelo código temporário gerado pelo aplicativo. QR/chave são segredos de configuração: exibir apenas no fluxo autorizado, sem serviços externos de geração, logs ou persistência no navegador. Quantidade/formato dos códigos e geração local do QR são escolhas técnicas de implementação futura, sem novos parâmetros de produto nesta entrevista.

Justificativa: recuperar o segundo fator sem depender exclusivamente de intervenção manual e configurar o autenticador sem transcrever uma chave longa. O código de recuperação não equivale à senha e não libera acesso administrativo antes da confirmação do fator novo. Ausência também dos códigos segue a fronteira aprovada em E12; critérios do procedimento excepcional ainda serão definidos.

## E06 — Encerramento do último Administrador

Avisar sobre necessidade de sucessão e recomendar sua preparação antes de encerrar; permitir o encerramento sem obrigar a nomeação de sucessor. Sem outro Administrador, revisão/publicação ficam indisponíveis até recomposição legítima. Conteúdo publicado continua consultável pelas regras existentes, sem promessa de continuidade de infraestrutura.

Justificativa: não condicionar a saída de uma pessoa à continuidade da administração. Responsável e procedimento operacional de recomposição ainda pendentes; ferramenta offline sintética não é homologada para esse fim.

## E07 — Destino do cadastro ativo

O responsável delegou a escolha ao agente, pedindo convenções adequadas ao escopo. Aplicada a orientação de minimização e eliminação quando termina a finalidade, com base nos arts. 6º, 15 e 16 da LGPD e na orientação da ANPD; não se alega existir um padrão universal de mercado ou prazo universal de exclusão.

Após confirmação do encerramento, eliminar do cadastro ativo nome, e-mail, senha derivada, segredo MFA, códigos de recuperação, tokens e sessões; não conservar cadastro recuperável para reativação. Novo cadastro do mesmo e-mail recebe identidade nova, sem restaurar preferências, solicitações ou privilégios antigos. Apenas trocar nome/e-mail por rótulos, conservando vínculos identificáveis, não satisfaz por si só esta decisão.

Conservação obrigatória exige registro separado e restrito de finalidade/fundamento, campos necessários, acesso, prazo e destinação; não é autorização genérica para guardar uma cópia do cadastro. Autoria histórica, logs de uso e solicitações seguem E09–E11; destino da identidade nos demais logs ainda será definido. São regras de produto para implementação futura; restrições das migrações atuais deverão ser reconciliadas por novas migrações.

Backups não serão tratados como cadastro utilizável nem como mecanismo de reativação. A futura restauração deverá reaplicar eliminações e revogações antes de devolver o serviço ao uso; não declarar exclusão de todas as cópias enquanto o ciclo de expurgo não estiver definido e comprovado. Teto/ciclo de backups segue E17; mecanismo de reaplicação e sua comprovação serão definidos na implementação futura.

Justificativa: preservar apenas o necessário a finalidades justificadas, encerrar o acesso de forma definitiva e evitar que restauração técnica desfaça a exclusão. Fundamentos: [LGPD compilada](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm) e [ANPD, seção 5.5](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes). Esses fundamentos não fixam prazo de backup ou garantem anonimização de históricos.

## E08 — Precisão dos logs de uso

Guardar ação, instante, módulo, resultado, contagem retornada e filtros estruturados necessários: período, classificação, fontes, notas, situação e município/bairro. Texto e recorte espacial geram apenas indicadores de utilização. Não persistir nesses logs texto digitado, endereço, coordenadas de centro, raio ou bounds. Durante a conta ativa, mantém-se o identificador interno do ator previsto em D13, sem nome/e-mail no evento. Retenção segue E16 e, no encerramento, aplica-se E10.

Justificativa: diagnosticar uso e resultados com menor exposição dos locais pesquisados, aceitando perder a reprodução exata do recorte espacial pelo log. A regra substitui o detalhe espacial da auditoria local atual quando implementada; não altera os filtros efetivos da consulta nem os metadados do arquivo solicitado pelo usuário. Logs de infraestrutura e falhas também deverão evitar captura incidental desses parâmetros; registros legais de acesso, quando aplicáveis, têm finalidade distinta.

## E09 — Autoria histórica após encerramento

Preservar versões, antes/depois, justificativas, datas e papel do autor. Substituir ligação à conta encerrada por referência histórica sem nome/e-mail, distinta do ID de login, sem tabela de correspondência para a identidade eliminada. Essa referência permite distinguir atos do mesmo autor histórico; não restaura cadastro e não acompanha novo cadastro do mesmo e-mail.

Não declarar anonimização garantida: contexto, datas e textos podem permitir reidentificação. Revisar dados pessoais desnecessários nas justificativas e demais conteúdos; preservação factual não justifica conservar toda identidade pessoal. Eventual conservação identificada obrigatória tem fundamento e ciclo próprios, não implícitos na referência histórica.

Justificativa: manter continuidade e compreensão das decisões sem guardar uma conta recuperável, em vez de atribuir indistintamente todos os atos a um único antigo Administrador. Decisão arquitetural registrada no [ADR 0001](../adr/0001-historical-authorship-after-account-closure.md); exige migrações novas e prova de eliminação dos vínculos na implementação futura.

## E10 — Logs de uso ao encerrar a conta

Eliminar eventos individuais de uso vinculados à conta encerrada, em vez de somente substituir seu identificador por pseudônimo. Podem permanecer indicadores já agregados com risco de reidentificação controlado, sem possibilidade de reconstruir o histórico individual. Não criar estatísticas individuais com o rótulo de agregado.

Justificativa: não conservar trilha de pesquisas de quem encerrou o vínculo. Segurança e administração seguem os prazos e vínculos residuais de E16; obrigações legais de acesso têm enquadramento e campos próprios ainda pendentes.

## E11 — Solicitações após encerramento

Continuar análise do problema e preservar evidências necessárias e justificativa da decisão, sem nome/e-mail ou vínculo cadastral do solicitante encerrado. Eliminar ou ocultar dados pessoais desnecessários do texto/anexos, preservando conteúdo factual. Ocultar apenas na interface não equivale à eliminação das cópias retidas; conservação de dado indispensável exige finalidade/fundamento e controles próprios.

Não cancelar correção necessária porque o solicitante encerrou a conta. Não há mais acompanhamento autenticado nem envio de retorno para o endereço eliminado; novo cadastro não recupera o vínculo. Retirar nome não garante anonimização do restante do conteúdo.

Justificativa: tratar erro conhecido na base sem conservar identificação desnecessária ou reativar relacionamento encerrado.

## E12 — Falta dos meios de acesso

Não oferecer recuperação automática quando faltarem os meios previamente estabelecidos. Usuário sem e-mail, sem sessão e sem conseguir autenticar cria outra conta, sem recuperar automaticamente histórico privado. Se ainda consegue autenticar com senha, segue alteração E02.

Administrador sem autenticador e sem códigos de recuperação depende de procedimento excepcional, com responsável designado, comprovação e auditoria antes de restaurar poderes. Nome/e-mail declarados não bastam; e-mail isolado não remove MFA. Procedimento também deverá cobrir recomposição administrativa legítima, sem transformar comandos sintéticos locais em política operacional.

Justificativa: não criar recuperação fraca que contorne o segundo fator, nem prometer atendimento ainda inexistente. A autorização segue E13; contato/evidências concretos ainda precisam ser provisionados fora do repositório antes de uso real. Exercício de direitos sobre dados tem tratamento próprio; falta de login não elimina direitos do titular.

## E13 — Autorização exclusiva da recuperação excepcional

Somente o responsável pelo produto nesta conversa pode autorizar recuperação/recomposição administrativa excepcional. Não há delegação da aprovação, segundo aprovador substituto ou autorização automática por outro Administrador. Executor técnico, se necessário, executa apenas mediante autorização expressa do responsável; não decide nem amplia a recuperação por conta própria.

Usar contato reservado e evidência independente estabelecidos previamente, fora da conta comprometida. Nome/e-mail declarados ou canal recém-indicado não comprovam identidade. Registrar motivo, verificação, autorização e resultado sem segredos. Revogar sessões/links/códigos/fatores comprometidos e exigir configuração e confirmação de novo MFA. Sem evidência ou autorização válida, acesso administrativo permanece suspenso.

Justificativa: o responsável escolheu concentrar a autorização em si. Canal concreto e meios de comprovação serão provisionados privadamente antes de uso real; não pedir segredos nem registrar dados desse canal no repositório. A ferramenta sintética existente não fica homologada para operação real.

## E14 — Avisos de segurança

Prever e-mails transacionais de conclusão de recuperação/alteração de senha, troca de e-mail e configuração/substituição de MFA. Na troca de e-mail, confirmação vai ao novo endereço, aviso ao antigo e conclusão também ao novo; aviso isolado não permite reverter a troca por clique. Informar ação, instante e orientação de contestação, sem senhas, códigos, chaves ou QR.

No encerramento, confirmação em tela informa consequências, encerramento do acesso e destino aprovado dos dados; não conservar endereço para avisos posteriores. Transporte, fornecedor e canal de contestação continuam pendências específicas, sem contratação ou envio real autorizado.

Justificativa: permitir perceber mudanças indevidas fora da sessão que as realizou. Integração futura deverá distinguir alteração efetivada de aviso entregue ou falho, evitando indicar entrega inexistente; mecanismos e tratamento de falha não ampliam guarda de dados pessoais sem finalidade/prazo definidos.

## E15 — Links sensíveis: dez minutos

Recuperação de senha e confirmação do novo e-mail expiram **10 minutos após a emissão**, por escolha expressa do responsável, substituindo a proposta de 30 minutos. São de uso único; reenvio efetivo substitui o link anterior sem renovar o mesmo token. Na conclusão, revalidar prazo e estado da conta, inclusive revogações e encerramento.

Justificativa: reduzir o tempo de posse útil de um link sensível, aceitando necessidade maior de reenvio. Não altera prazos locais de sessão, tokens de cadastro/confirmação inicial nem tempos do autenticador. É política de produto aprovada, ainda não implementada; não é prazo prescrito pela OWASP/LGPD.

## E16 — Retenção ordinária e vínculos residuais

| Classe | Retenção desde o evento | Encerramento da conta |
|---|---|---|
| Uso | 60 dias | Eliminar antes, conforme E10 |
| Segurança e conta | 180 dias | Substituir vínculo cadastral por identificador residual próprio, sem nome/e-mail, tabela recuperável para cadastro ou correlação com uso/autoria de domínio |
| Operação administrativa | 365 dias | Ator remanescente segue referência histórica de E09 |
| Versões e decisões de domínio | Enquanto necessárias à rastreabilidade do registro | Preservar conteúdo factual e minimizar dados pessoais, conforme E09/E11 |

Os prazos 60/180/365 dias foram aprovados expressamente nesta rodada; substituem a hipótese anterior de 60 dias/um ano. Segurança não conserva identidade recuperável apenas porque seu evento ainda não venceu. Durante conta ativa, eventos mantêm identificador interno do ator e campos necessários, sem nome/e-mail ou credenciais no log; tentativa não autenticada não recebe identidade declarada pelo cliente.

Histórico não é automaticamente expurgado junto do log administrativo; a necessidade de preservação não autoriza guardar dados pessoais desnecessários indefinidamente. Dados expirados devem ficar indisponíveis e ser eliminados por mecanismo verificável, com falhas visíveis. Configuração técnica não amplia prazos silenciosamente.

Guarda legal e preservação fundamentada por incidente/ordem têm escopo, fundamento, acesso e termo final próprios. Não renovam toda a base nem tornam a conta reativável. **180 dias não equivale a seis meses civis**, nem substitui eventual obrigação do art. 15 do Marco Civil. Registro legal de acesso tem finalidade própria, não contém filtros de consulta e exige verificar enquadramento do futuro serviço. Ciclo de backups e preservação excepcional seguem E17/E18.

Justificativa: diagnóstico recente de uso, investigação de segurança e revisão anual das ações administrativas, com redução de vínculos após encerramento. São escolhas de produto, não durações impostas pelas referências OWASP ou LGPD.

### Aplicação técnica das classes já aprovadas

Sem nova política: pedido de correção enviado/acompanhado pelo Usuário é evento de uso; análise/decisão pelo Administrador é operação administrativa, e conteúdo/justificativa pertencem ao histórico de domínio. Leitura/exportação dos próprios logs é operação administrativa, restrita ao Administrador e auditada. Expiração/revogação de sessão é segurança; tentativa/falha/resultado de coleta é operação administrativa. Logs não guardam corpo livre de pedidos, respostas completas, credenciais ou cópia de arquivo exportado; usam referências de registros quando necessárias, sem replicar identidade desnecessária em snapshots. Esses enquadramentos derivam da finalidade de E04 e dos campos mínimos de D13/E08; não criam nova retenção.

## E17 — Backups: teto de sete dias

O responsável escolheu **sete dias**, em lugar dos trinta dias propostos, como teto de permanência de dados nas cópias operacionais. Inclui dumps, snapshots, réplicas de backup e cópias derivadas. Copiar/restaurar não renova idade ou retenção do dado; excluir cópia-base sem descartar cadeia restaurável derivada não comprova eliminação.

Dado eliminado no sistema ativo pode permanecer apenas nas cópias isoladas e cifradas, fora de consulta/uso, até sua expiração, por no máximo sete dias remanescentes. Não acessar backup para reidentificar autor, recuperar pesquisas eliminadas ou reativar conta. Antes de restaurar serviço, reaplicar eliminações, desvinculações, expirações e revogações. Registro mínimo de supressões (IDs técnicos, ação e instante, sem nome/e-mail) permanece apenas enquanto houver cópia restaurável que dependa dele; não é tabela de correspondência com identidade pessoal.

Preservação obrigatória específica é segregada do backup comum e não amplia toda a retenção. A comunicação do encerramento deve distinguir eliminação no ativo da expiração residual em backups. Cadência, infraestrutura, RPO/RTO e custo permanecem decisões operacionais próprias, sem contratação autorizada. Segredos/chaves precisam de plano próprio de proteção e recuperação, não são guardados em logs ou no repositório.

Justificativa: o responsável preferiu reduzir resíduo pessoal e janela de recuperação. Sete dias é política aprovada de produto, não obrigação legal identificada; execução depende de comprovação futura, sem alegar capacidade já implementada.

## E18 — Preservação excepcional

Para preservar registros por investigação de incidente, exigir autorização expressa do responsável pelo produto. Delimitar conjunto mínimo, finalidade/fundamento, acesso restrito e data de término ou revisão obrigatória. Prorrogação exige nova justificativa expressa; não há renovação automática ou autorização genérica para conservar tudo por “segurança”.

Ordem/obrigação legal válida deve ser cumprida conforme seus termos, com registro e comunicação ao responsável, sem depender de veto privado. Não usar preservação para restaurar conta ou manter cópia integral do cadastro sem fundamento específico. Acesso, término e descarte devem ser verificáveis; autorização de guarda não autoriza divulgação a terceiros.

Justificativa: manter evidência necessária de forma delimitada, sem descentralizar prolongamentos para qualquer Administrador. Campos, bases e prazos legais concretos dependem de enquadramento e validação; não se presumem resolvidos.

## E19 — Controle de sessões em suspeita de comprometimento

Oferecer ação autenticada “Encerrar todas as sessões”, exigindo senha atual e código MFA para Administrador. Revogar inclusive a sessão atual, exigir novo login e preservar MFA. Quem não consegue autenticar segue E01/E05/E12/E13; nome/e-mail não criam atalho de recuperação.

Após comprovação de comprometimento, revogar fatores/meios de recuperação comprometidos e revisar alterações de e-mail/MFA por evidência independente previamente estabelecida. Não restaurar automaticamente endereço ou fator antigo potencialmente comprometido. Se a recuperação excepcional remover/substituir fator, aplica-se autorização exclusiva de E13 e confirmação de fator novo antes do acesso administrativo.

Justificativa: dar controle explícito sobre acessos emitidos e não limitar a resposta à troca da senha. Não inclui monitoramento novo, detecção automática de fraude ou recuperação sem comprovação.

## Pendências que continuam abertas

- Provisionamento privado de contato/evidências de recuperação excepcional e canal de contestação; controle de sessões em suspeita de comprometimento aprovado em E19.
- Transporte de mensagens e parâmetros técnicos de antiabuso, sem alterar a validade de dez minutos aprovada.
- Campos legais de acesso condicionados ao enquadramento operacional; mecanismos verificáveis de minimização, expurgo e vínculos residuais.
- Infraestrutura/cadência de backup, execução verificável de E17/E18 e comprovação da eliminação/desvinculação.
- Responsável pelo tratamento, enquadramento operacional e textos institucionais.

Retenção ordinária 60/180/365 dias aprovada em E16 e teto de backups em sete dias aprovado em E17; enquadramento/campos de guarda legal e implantação dos mecanismos permanecem pendentes. Contratos sintéticos existentes não homologam operação com dados reais. Nenhuma implementação, migração ou publicação foi autorizada nesta entrevista.
