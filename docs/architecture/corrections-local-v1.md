# Solicitações de correção locais — v1

Ticket 27, D12/D13 e CA22. Canal autenticado privado, sem comunicação externa. Dados sintéticos; não é homologação operacional.

## Contrato

- `POST /api/v1/corrections`: `targetKind` (`OCCURRENCE`/`AREA`), `targetId`, `problemType` (`LOCAL`/`DATA`/`CONTEUDO`/`REFERENCIA`/`OUTRO`), `explanation` e `references`. Todos obrigatórios, sem campos extras; textos privados até 4.000 caracteres. Retorna 201 com protocolo e estado `RECEIVED`.
- `GET /api/v1/corrections` e `GET /api/v1/corrections/{id}`: somente pedidos do titular. ID alheio responde 404. Não expõe identificador do solicitante.
- `GET /api/v1/admin/corrections` e `GET /api/v1/admin/corrections/{id}`: fila e histórico privados; exigem ADMIN com MFA completo no servidor.
- `POST /api/v1/admin/corrections/{id}/decisions`: `expectedVersion`, `state`, `reason`; `appliedVersion` opcional somente para conclusão de correção comprovada. CSRF obrigatório em toda escrita. 409 preserva a decisão vigente; cliente precisa recarregar.

Transições: Recebida → Em análise → Concluída ou Não procedente. Todas exigem motivo (até 2.000 caracteres); o motivo é visível ao solicitante e deve conter apenas justificativa factual. A fila ordena estados abertos e espera crescente; não promete SLA. O recebimento e a decisão nunca editam ocorrência/área automaticamente.

## Alvos e versões

Ocorrência deve existir e estar publicada. Áreas devem constar de `correction_area_targets`, cadastro somente de leitura com versão positiva, referência, autor validador e instante; não há endpoint para criar áreas. Nenhuma área é semeada pela migração V10. Fixtures explícitas de teste demonstram validação. O protótipo territorial do 26 permanece inativo e seus IDs não são aceitos por inferência. Integração futura de áreas exige autoria/migração próprias.

Uma conclusão sem alteração material pode não ter versão aplicada; se informada, a referência deve ser comprovada pelo servidor. Neste incremento, somente versão de área validada pode ser referenciada; editor de ocorrência e referência à sua versão pertencem ao ticket 18.

## Privacidade e encerramento

Explicação e referências são restritas ao solicitante e à Administração; nunca entram nas projeções de consulta ou exportação. Logs guardam apenas referência técnica, ação e instante; envio/leitura do titular são USE, análise/leitura administrativa são ADMIN. Histórico de decisões não é apagado pelo expurgo dos logs.

No encerramento, elimina-se o vínculo cadastral do solicitante. Os textos são substituídos por representação minimizada, removendo nome/e-mail/UUID conhecidos e padrões de contato; preservam-se conteúdo factual, referências úteis, alvo, tipo do problema, estado e decisões. A cópia original não é retida. A marca `privacy_review_required` impede decisão até revisão humana por `POST /admin/corrections/{id}/minimization` (`expectedVersion`, `factualSummary`, `factualReferences`). Essa revisão grava autoria/versão e substitui os textos remanescentes. Justificativas administrativas não devem copiar dados pessoais da solicitação. Autoria de decisões e validações é substituída pela referência histórica de domínio, distinta da residual de segurança, na transação de encerramento. Novo cadastro não herda acompanhamento. A minimização automática é heurística: não garante remoção de nomes de terceiros, endereços ou identificação contextual. O conteúdo permanece restrito e exige avaliação humana; E11 operacional continua pendente para dados reais. Não é anonimização garantida.

## Interface e limites

O procedimento público de correções oferece o canal no modo integrado `?consulta=api`, após autenticação. Inclui fila própria, fila administrativa, estados de carga/erro/vazio, reenvio e feedback em foco. A alternativa é uma lista, sem dependência do mapa. Sem arquivos/anexos, e-mail/push, editor territorial ou dados reais.
