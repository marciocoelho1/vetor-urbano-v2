#!/usr/bin/env bash
# Campanha E2E por família — selo por execução do piloto.
#
# POR QUE ESTE ARQUIVO EXISTE: uma execução única da suíte mede a base errada em
# 18 das 19 famílias. A API carrega UMA base por processo (o JDBC é fixado no
# arranque), enquanto cada spec lê/escreve a sua família por
# `VETOR_E2E_DATABASE_NAME`. Rodar tudo de uma vez faz o `fixtureSql` gravar
# numa base e o HTTP responder de outra — falso diagnóstico silencioso.
#
# PERFIL DE EXECUÇÃO (o número só é comparável com ele escrito):
#   - um processo Playwright por família (`--workers=1`)
#   - uma API por família, com `VETOR_DATABASE_URL` apontando para
#     `jdbc:postgresql://127.0.0.1:55442/<família>` em `vu-uxh01-five-db`
#   - prova por ciclo: `jdbc` lido de `/proc/<pid>/environ` idêntico ao esperado
#     (ciclo aborta em `JDBC_DIVERGENTE`), `/auth/session` → 401
#   - argumentos de conta do ensaio de navegador (apps/api/README.md:47 e :71):
#       --vetor.accounts.enabled=true
#       --vetor.accounts.token-ttl=5s
#       --vetor.accounts.recovery-ttl=5s
#       --vetor.accounts.resend-cooldown=1s
#       --vetor.accounts.resends-per-hour=2
#     SEM ELES a campanha mede o launcher, não o app: o TTL padrão é 15 min e
#     os specs de conta esperam expiração em segundos.
#   - terceira coluna do mapa: flags de modo do próprio spec
#       VETOR_PERSISTED_E2E=1 · VETOR_COLLECTION_E2E=configured|unconfigured
#       VETOR_SOURCE_E2E=1 · VETOR_SESSION_E2E=1 · VETOR_LOCAL_ACCESS_E2E=1
#     FAMÍLIA QUE RODA FORA DO MODO DO SPEC NÃO MEDE O PRODUTO: não conta como
#     verde nem como vermelha. Sem esta coluna o número mistura "quebrado" com
#     "modo não configurado" — foi o que produziu os 11 casos de collection.
#   - SIGTERM na API anterior + espera de 8080 livre antes de cada arranque
#     (dois arranques sobrepostos morrem com BindException na 8025)
#
# SAÍDA: $OUT/resumo.tsv (família, EXIT, passed/failed) e $OUT/test-<família>.log
#
# Uso:  bash scripts/campanha-e2e.sh            # as 19 famílias
#       MAX_FAMILIAS=3 bash scripts/campanha-e2e.sh
#       MAPA_FILE=mapa.tsv bash scripts/campanha-e2e.sh   # subconjunto

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/apps/web"
JAR="$ROOT/apps/api/target/vetor-urbano-api-0.1.0-SNAPSHOT.jar"
CONT="vu-uxh01-five-db"
OUT="${OUT:-$(mktemp -d -t campanha-e2e-XXXXXX)}"
mkdir -p "$OUT"
RESUMO="$OUT/resumo.tsv"
: > "$RESUMO"

# credenciais lidas do processo da API que está no ar (nunca impressas)
API_PID="$(ss -ltnp 2>/dev/null | awk '/:8080 /{print $NF}' | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)"
if [[ -n "${API_PID:-}" ]]; then
  DB_USER="$(tr '\0' '\n' < "/proc/$API_PID/environ" | awk -F= '/^VETOR_DATABASE_USERNAME=/{print $2}')"
  DB_PASS="$(tr '\0' '\n' < "/proc/$API_PID/environ" | awk -F= '/^VETOR_DATABASE_PASSWORD=/{print $2}')"
else
  # Sem API no ar: credenciais do próprio contêiner sintético (nunca impressas).
  DB_USER="$(podman exec "$CONT" printenv POSTGRES_USER 2>/dev/null)"
  DB_PASS="$(podman exec "$CONT" printenv POSTGRES_PASSWORD 2>/dev/null)"
fi
if [[ -z "${DB_USER:-}" || -z "${DB_PASS:-}" ]]; then
  echo "credenciais não encontradas no environ da API" >&2
  exit 1
fi

parar_api() {
  local pid
  pid="$(ss -ltnp 2>/dev/null | awk '/:8080 /{print $NF}' | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)"
  [[ -n "${pid:-}" ]] && kill "$pid" 2>/dev/null
  for _ in $(seq 1 40); do
    ss -ltn 2>/dev/null | grep -q ':8080 ' || return 0
    sleep 0.5
  done
  return 1
}

subir_api() {
  local familia="$1"
  VETOR_DATABASE_URL="jdbc:postgresql://127.0.0.1:55442/$familia" \
  VETOR_DATABASE_USERNAME="$DB_USER" \
  VETOR_DATABASE_PASSWORD="$DB_PASS" \
  nohup java -jar "$JAR" --spring.profiles.active=local \
    --vetor.accounts.enabled=true --vetor.accounts.mailbox-port=8025 \
    --vetor.accounts.token-ttl=5s --vetor.accounts.recovery-ttl=5s \
    --vetor.accounts.resend-cooldown=1s --vetor.accounts.resends-per-hour=2 \
    > "$OUT/api-$familia.log" 2>&1 &
  local pid=$!
  for _ in $(seq 1 120); do
    local codigo
    codigo="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:8080/api/v1/auth/session || true)"
    if [[ "$codigo" == "401" ]]; then
      local jdbc
      jdbc="$(tr '\0' '\n' < "/proc/$pid/environ" 2>/dev/null | awk -F= '/^VETOR_DATABASE_URL=/{print $2}')"
      echo "$pid|$jdbc"
      return 0
    fi
    sleep 1
  done
  return 1
}

# spec → família (19 famílias, 21 specs gated)
MAPA="${MAPA_FILE:-}"
if [[ -z "$MAPA" ]]; then
  MAPA="$(mktemp)"
  cat > "$MAPA" <<'MAPA_DEFAULT'
vetor_final_account_closure|VETOR_ACCOUNTS_E2E=1|e2e/account-closure.spec.ts
vetor_final_account_recovery|VETOR_ACCOUNTS_E2E=1|e2e/account-recovery.spec.ts
vetor_final_account_registration|VETOR_ACCOUNTS_E2E=1|e2e/account-registration.spec.ts
vetor_final_account_self_service|VETOR_ACCOUNTS_E2E=1|e2e/account-self-service.spec.ts
vetor_final_active_report_renewal|VETOR_ACCOUNTS_E2E=1|e2e/active-report-renewal.spec.ts
vetor_final_active_reports_api|VETOR_ACCOUNTS_E2E=1|e2e/active-reports-api.spec.ts
vetor_final_admin_local_sources|VETOR_ACCOUNTS_E2E=1|e2e/admin-local-sources.spec.ts
vetor_final_audit_authorship|VETOR_ACCOUNTS_E2E=1|e2e/audit-authorship.spec.ts
vetor_final_audit_log|VETOR_ACCOUNTS_E2E=1 VETOR_PERSISTED_E2E=1|e2e/audit-log.spec.ts
vetor_final_collection_recent|VETOR_ACCOUNTS_E2E=1 VETOR_COLLECTION_E2E=configured|e2e/collection-recent.spec.ts
vetor_final_correction_channel|VETOR_ACCOUNTS_E2E=1|e2e/correction-channel.spec.ts
vetor_final_occurrences_admin|VETOR_ACCOUNTS_E2E=1|e2e/occurrences-admin.spec.ts
vetor_final_operations_panel|VETOR_ACCOUNTS_E2E=1|e2e/operations-panel.spec.ts e2e/panel-rhythm.spec.ts e2e/contrast-tokens.spec.ts e2e/responsive-navigation.spec.ts
vetor_final_publication_editor|VETOR_ACCOUNTS_E2E=1|e2e/publication-editor.spec.ts
vetor_final_publication_review|VETOR_ACCOUNTS_E2E=1|e2e/publication-review.spec.ts
vetor_final_query_update_notices|VETOR_ACCOUNTS_E2E=1|e2e/query-update-notices.spec.ts
vetor_final_reliability_panel|VETOR_ACCOUNTS_E2E=1|e2e/reliability-panel.spec.ts
vetor_final_risk_area_drawing|VETOR_ACCOUNTS_E2E=1|e2e/risk-area-drawing.spec.ts
vetor_final_risk_area_versions|VETOR_ACCOUNTS_E2E=1|e2e/risk-area-versions.spec.ts
MAPA_DEFAULT
fi

contador=0
while IFS='|' read -r familia flags specs; do
  [[ -z "$familia" ]] && continue
  contador=$((contador+1))
  if [[ -n "${MAX_FAMILIAS:-}" && "$contador" -gt "$MAX_FAMILIAS" ]]; then echo "limite de $MAX_FAMILIAS famílias atingido"; break; fi
  echo "=== $familia ==="
  if ! parar_api; then echo "$familia	API_NAO_PAROU" >> "$RESUMO"; continue; fi
  prova="$(subir_api "$familia")" || { echo "$familia	API_NAO_SUBIU" >> "$RESUMO"; continue; }
  pid="${prova%%|*}"; jdbc="${prova#*|}"
  echo "  pid=$pid jdbc=$jdbc"
  if [[ "$jdbc" != *"/$familia" ]]; then
    echo "$familia	JDBC_DIVERGENTE:$jdbc" >> "$RESUMO"; continue
  fi
  # Terceira coluna: modo de execução do próprio spec. Família que roda fora do
  # modo do spec NÃO mede o produto e não conta nem como verde nem como vermelha.
  ( cd "$WEB" && VETOR_ACCOUNTS_E2E=1 \
      VETOR_E2E_DATABASE_CONTAINER="$CONT" \
      VETOR_E2E_DATABASE_NAME="$familia" \
      ${flags:+env $flags} \
      npx playwright test $specs --project=chromium --workers=1 --reporter=list \
      > "$OUT/test-$familia.log" 2>&1 )
  codigo=$?
  linha="$(grep -Eo '[0-9]+ (passed|failed)' "$OUT/test-$familia.log" | tr '\n' ' ')"
  echo "$familia	EXIT=$codigo	$linha" >> "$RESUMO"
  echo "  $familia EXIT=$codigo $linha"
done < "$MAPA"

echo "--- resumo ---"
cat "$RESUMO"
