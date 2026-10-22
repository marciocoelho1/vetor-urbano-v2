#!/usr/bin/env bash
# Abre o Vetor Urbano nesta branch: sobe a API local contra o banco sintético que tem as contas de
# teste e, com --check, prova por HTTP que USER e ADMIN entram. Não usa dados reais nem a fonte.
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
DB_CONTAINER="${VETOR_LOCAL_DB_CONTAINER:-vetor-spec-postgis}"
DB_NAME="${VETOR_LOCAL_DB_NAME:-vetor_spec_test}"
API_URL="http://127.0.0.1:8080"
WEB_URL="http://127.0.0.1:4201/?consulta=api"
JAR="$ROOT/apps/api/target/vetor-urbano-api-0.1.0-SNAPSHOT.jar"
KEY_DIR="$HOME/.local/share/vetor-urbano"
KEY_FILE="$KEY_DIR/mfa.key"
MAVEN_IMAGE="docker.io/library/maven:3.9.11-eclipse-temurin-21"
MODE="run"
for arg in "$@"; do
  case "$arg" in
    --check) MODE="check" ;;
    --reset-admin-mfa) MODE="reset-mfa" ;;
    -h|--help)
      printf 'Uso: %s [--check|--reset-admin-mfa]\n\n' "${0##*/}"
      printf '  (sem opção)          sobe a API em %s contra %s/%s\n' "$API_URL" "$DB_CONTAINER" "$DB_NAME"
      printf '  --check              só verifica banco, API e login de USER e ADMIN, e sai\n'
      printf '  --reset-admin-mfa    limpa o segundo fator do ADMIN sintético para você cadastrar o seu\n'
      exit 0 ;;
    *) printf 'Opção desconhecida: %s\n' "$arg" >&2; exit 2 ;;
  esac
done

say() { printf '%s\n' "$*"; }
die() { printf 'BLOQUEADO: %s\n' "$*" >&2; exit 2; }

health() {
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$API_URL/api/v1/auth/session" || true)"
  [[ "$code" == "200" || "$code" == "401" ]]
}

probe() { # probe <email> <senha> <rótulo>
  local body
  body="$(curl -s --max-time 15 -X POST "$API_URL/api/v1/auth/login" \
    -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:4201" \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" || true)"
  # Comparações independentes de ordem: os campos do JSON não vêm em ordem fixa.
  if printf '%s' "$body" | grep -q '"code":"AUTHENTICATED"'; then
    say "  ✓ $3 ($1): sessão autenticada"
  elif printf '%s' "$body" | grep -q '"code":"MFA_REQUIRED"'; then
    if printf '%s' "$body" | grep -q '"mfaEnrolled":false'; then
      say "  ✓ $3 ($1): entra e pede cadastro do autenticador (primeiro acesso)"
    else
      say "  ! $3 ($1): entra, mas exige um autenticador já cadastrado que você não tem — rode --reset-admin-mfa"
    fi
  else
    say "  ✗ $3 ($1): login recusado -> $(printf '%s' "$body" | head -c 200)"
  fi
}

# 0) proveniência do arranque: manifesto sanitizado (pid, porta e destino JDBC), sem credenciais.
# Um GET de origem incerta no passado não pôde ser atribuído a nenhum banco; registrando pid e URL
# efetiva, o mesmo evento deixa de ser indeterminado. O banco de dados reais
# (vu-fogo-cruzado-db, 55438) nunca é alvo deste script.
MANIFEST_DIR="${VETOR_STARTUP_MANIFEST_DIR:-$HOME/.local/state/vetor-urbano}"
MANIFEST="$MANIFEST_DIR/api-startup.log"

listener_pid() {
  ss -ltnp 2>/dev/null | grep ':8080 ' | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2
}

record_provenance() { # record_provenance <origem> [pid]
  local origem="$1" pid="${2:-}" url
  if [[ -n "$pid" && -r "/proc/$pid/environ" ]]; then
    url="$(tr '\0' '\n' < "/proc/$pid/environ" | sed -n 's/^VETOR_DATABASE_URL=//p' | head -1)"
    [[ -n "$url" ]] || url="ausente-no-ambiente"
  else
    url="nao-observavel"
  fi
  mkdir -p "$MANIFEST_DIR"
  (umask 077; printf '%s pid=%s origem=%s http=%s caixa=8025 jdbc=%s container=%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${pid:-?}" "$origem" "$API_URL" "$url" "$DB_CONTAINER" >> "$MANIFEST")
}

# 1) banco sintético com as contas de teste
if ! podman container exists "$DB_CONTAINER"; then
  die "contêiner $DB_CONTAINER ausente. Ele é o banco sintético com as contas de teste (127.0.0.1:55436)."
fi
podman start "$DB_CONTAINER" >/dev/null 2>&1 || true
DB_USER="$(podman exec "$DB_CONTAINER" printenv POSTGRES_USER)"
DB_PASSWORD="$(podman exec "$DB_CONTAINER" printenv POSTGRES_PASSWORD)"

# 2) chave do segundo fator: 32 bytes, arquivo 0600, sem symlink
mkdir -p "$KEY_DIR"
if [[ ! -f "$KEY_FILE" ]]; then
  (umask 077; head -c 32 /dev/urandom > "$KEY_FILE")
  say "Chave do autenticador criada em $KEY_FILE (32 bytes, 0600)."
fi
[[ "$(wc -c < "$KEY_FILE")" -eq 32 ]] || die "chave do autenticador em $KEY_FILE precisa ter exatamente 32 bytes."
[[ "$(stat -c '%a' "$KEY_FILE")" == "600" ]] || die "chave $KEY_FILE precisa estar em 0600."

# 3) limpar o segundo fator do ADMIN sintético, quando pedido
if [[ "$MODE" == "reset-mfa" ]]; then
  [[ -f "$JAR" ]] || die "jar ausente em $JAR; rode este script sem opção para construí-lo."
  export VETOR_DATABASE_URL="jdbc:postgresql://127.0.0.1:55436/$DB_NAME"
  export VETOR_DATABASE_USERNAME="$DB_USER" VETOR_DATABASE_PASSWORD="$DB_PASSWORD"
  printf '{"action":"reset-mfa","email":"admin@vetorurbano.test"}\n' \
    | java -Dloader.main=br.com.vetorurbano.api.auth.LocalAccountAdmin \
        -cp "$JAR" org.springframework.boot.loader.launch.PropertiesLauncher --synthetic-local-only >/dev/null
  say "Segundo fator do ADMIN sintético limpo. Entre como admin e use «Configurar autenticador»."
  exit 0
fi

if [[ "$MODE" == "check" ]]; then
  health || die "a API não respondeu em $API_URL. Suba-a com ${0##*/} (sem opção)."
  say "API de pé em $API_URL."
  probe usuario@vetorurbano.test 123456 USER
  probe admin@vetorurbano.test 123456 ADMIN
  exit 0
fi

# 4) jar atualizado (compila pelo runner Maven quando ausente; o host só precisa de JRE)
if [[ ! -f "$JAR" ]]; then
  say "jar ausente: construindo pelo runner Maven em contêiner (o host não tem javac)..."
  podman run --rm --security-opt label=disable -v "$ROOT:/w" -w /w/apps/api \
    -v "$HOME/.m2:/root/.m2" "$MAVEN_IMAGE" bash -c 'mvn -B -ntp -DskipTests package' >/dev/null
fi

if health; then
  say "A API já está de pé em $API_URL (não subi outra)."
  record_provenance "reaproveitada" "$(listener_pid)"
  say "Proveniência registrada em $MANIFEST (pid, porta e destino efetivo)."
  "${BASH_SOURCE[0]}" --check
  exit 0
fi

say "Frontend (outro terminal): npm start --prefix apps/web -- --host 127.0.0.1"
say "Depois abra: $WEB_URL"
say "  USER   usuario@vetorurbano.test / 123456"
say "  ADMIN  admin@vetorurbano.test / 123456  (primeiro acesso pede cadastrar o autenticador)"
say ""
say "Subindo a API em $API_URL contra $DB_CONTAINER/$DB_NAME — Ctrl+C encerra."
export VETOR_DATABASE_URL="jdbc:postgresql://127.0.0.1:55436/$DB_NAME"
export VETOR_DATABASE_USERNAME="$DB_USER"
export VETOR_DATABASE_PASSWORD="$DB_PASSWORD"
# O pid registrado é o do próprio processo: o exec o transforma no processo Java da API.
record_provenance "iniciada" "$$"
say "Proveniência: $MANIFEST (o pid registrado passa a ser o da API)."
exec java -jar "$JAR" --spring.profiles.active=local \
  --vetor.accounts.enabled=true --vetor.accounts.mailbox-port=8025
