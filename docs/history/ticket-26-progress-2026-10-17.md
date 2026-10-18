# Ticket 26 — núcleo territorial experimental

17/10/2026. **Iniciado, não concluído.** Recorte autorizado: modelo/repositório e testes reais, sem impor fluxo UI/editor/publicação. Referências: ticket local `.scratch/consulta-coerente/issues/26-versoes-areas-risco.md`, D07/D12–D13 e CA11 da [especificação](../product/specification.md), [ADR 0001](../adr/0001-historical-authorship-after-account-closure.md), E09 da [política parcial](../product/account-and-records-policy.md).

## Entrega e escolhas reversíveis

- `TerritorialVersionRepository`: protótipo inativo, sem anotação Spring, controller, endpoint de escrita ou consumidor em produção. Append transacional com UUID territorial estável, versão incremental, leitura histórica ordenada e comparação da versão esperada sob lock; concorrência não sobrescreve a versão anterior.
- SQL somente em `apps/api/src/test/resources/territories/territorial-version-prototype.sql`, aplicado exclusivamente no PostGIS descartável dos testes. **Nenhuma V10/V11 criada**, evitando gap e conflito com o ticket 25. Coordenar o próximo número quando o rollout real estiver definido; não converter automaticamente este SQL em migração.
- Fonte (`sourceId`, identidade no catálogo), evidência (`evidenceReference` textual), referência temporal (`referenceDate`) e instante técnico de registro são campos distintos. Grupo, fonte, evidência, referência temporal e limitações admitem ausência; null não vira data atual, grupo presumido nem Disputado. A data conhecida usa apenas precisão de dia neste experimento; contrato temporal mais amplo permanece aberto. Não há inferência de vigência ou domínio histórico.
- Fronteira interna do experimento: EWKT, apenas para transportar explicitamente SRID ao PostGIS. **Não escolhe GeoJSON como editor nem formato HTTP**. Polygon/MultiPolygon 2D, SRID explícito 4326, geometria não vazia/válida e limites longitude/latitude. Não usa ST_MakeValid, reprojeção nem correção silenciosa.
- Snapshot anterior permanece intacto pelo repositório, mas o protótipo não implementa proteção contra alteração SQL direta por um papel privilegiado. Fonte preservada por identidade, não como snapshot completo de cada versão do catálogo.

## Evidências reais

Ambiente: JDK em `/home/marciocoelho/.jdks/openjdk-26.0.2.1`, compilação release 21; Podman/Testcontainers com `postgis/postgis:17-3.5` (PostgreSQL 17.5). Banco da aplicação não foi usado como destino dos testes.

1. Primeiro teste falhou por ausência dos tipos novos (antes houve bloqueio pelo runtime Java sem compilador adequado). Após implementar o núcleo, primeira execução passou com 1 integração.
2. Expansão da validação revelou falha real: Polygon sem SRID era aceito porque `geometry(Geometry,4326)` atribui 4326 implicitamente a SRID 0. Resultado vermelho: 17 casos, 1 falha. Correção: coluna geometry sem typmod, com CHECK explícito de `ST_SRID = 4326`. Nenhuma coordenada é reinterpretada silenciosamente.
3. Seleção final: `VETOR_API_INTEGRATION_TESTS=TerritorialVersionRepositoryIT bash scripts/verify.sh api`: **15 unitários + 18 integrações**, zero falhas/erros/ignorados.
4. Regressão final: `bash scripts/verify.sh api`: **15 unitários + 74 integrações**, zero falhas/erros/ignorados (inclui testes do ticket 25 escritos em paralelo). XML Surefire/Failsafe agregado programaticamente. Logs locais em `$TMPDIR/ticket26-final-selected.log` e `$TMPDIR/ticket26-final-full-api.log`.
5. Casos territoriais: identidade estável; mudanças de nome/geometria sem reescrever antes; data/grupo/fonte desconhecidos; fonte/evidência/data separadas; Polygon e MultiPolygon válidos; Point/LineString/collection, SRID ausente/incorreto, vazios, autointerseção, coordenadas fora da faixa, dimensão Z, anel aberto e texto inválido recusados; rollback sem consumir versão; atualização obsoleta e duas atualizações concorrentes.
6. `bash scripts/verify.sh planning` passou: 376 links locais. `git diff --check` passou; são verificações estruturais, não aceite de UI.
7. V9 do repositório conservou SHA-256 `49aa18d36c305c3f8896a0f7d9022d32660bf108f826e2a68904bf884b08e542` antes/depois. Consulta somente leitura no banco original `vetor_urbano`: V9 checksum **1892279936**, success true. Não houve repair, alteração de checksum, migração ou escrita nesse banco pelo ticket 26.

Interferência transitória: execução inicial encontrou o teste do ticket 25 ainda em construção (`Coordinates` inválida antes do assert); não o alterei. Regressão final completa passou após a evolução paralela. Socket Podman foi iniciado para executar os testes.

## Revisão local e limites

Standards: módulo próprio, dados sintéticos e migrações aplicadas preservados; nenhum arquivo compartilhado de frontend/AccountService/PLAN/CHANGELOG editado por esta fatia. Spec: o recorte de núcleo está verificado, **não** os critérios completos do ticket 26. Revisão própria, sem segundo revisor independente nesta execução.

**Autoria não é persistida neste protótipo.** Antes de qualquer ativação/rollout, implementar autoria/papel/justificativa e integração de encerramento em módulo próprio, transacional com E09/ADR 0001, sem vínculo recuperável, incluindo testes reais de encerramento. Não ligar um campo de conta isolado nem declarar autoria pronta. Permanecem revisão/decisão, antes/depois auditável com autor, versão vigente aprovada, autorização HTTP+MFA, UI aprovada e navegadores. Não foram escolhidos candidatura/publicação/editor nem importada geometria externa. Sem novos testes web/E2E, pois nenhuma interface/rota foi alterada; não contam como aceite integral.

Próxima ação: revisar este início pequeno, definir contrato de autoria/encerramento e coordenar sequência de migrações com 25 antes de habilitar persistência em produção. Sem commit, push, deploy ou alegação de prontidão operacional.
