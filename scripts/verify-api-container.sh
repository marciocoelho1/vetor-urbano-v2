#!/usr/bin/env bash
# Execute o runner existente com JDK 21, sem instalar JDK no host.
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
SOCKET="${VU_PODMAN_SOCKET:-${TMPDIR:?Defina TMPDIR fora do repositório}/vu.sock}"
[[ -S "$SOCKET" ]] || { printf 'BLOQUEADO: socket REST Podman ausente: %s\n' "$SOCKET" >&2; exit 2; }
[[ "$(curl --fail --silent --show-error --unix-socket "$SOCKET" http://d/_ping)" == OK ]] || {
  printf 'BLOQUEADO: REST Podman não respondeu OK.\n' >&2; exit 2;
}
SHIM="$(mktemp -d "${TMPDIR:?}/vu-api-shim.XXXXXX")"
trap 'rm -rf -- "$SHIM"' EXIT
printf '%s\n' '#!/bin/sh' 'if [ "$#" -eq 1 ] && [ "$1" = info ]; then' '  exec curl --fail --silent --show-error --unix-socket /tmp/podman.sock http://d/_ping' 'fi' 'printf "BLOQUEADO: shim aceita somente docker info.\\n" >&2' 'exit 2' > "$SHIM/docker"
chmod 755 "$SHIM/docker"
mkdir -p "$HOME/.m2"
podman run --rm --security-opt label=disable --network=host \
  -v "$ROOT:/w" -w /w -v "$HOME/.m2:/root/.m2" \
  -v "$SOCKET:/tmp/podman.sock" -v "$SHIM:/vu-bin:ro" \
  -e DOCKER_HOST=unix:///tmp/podman.sock \
  -e TESTCONTAINERS_HOST_OVERRIDE=127.0.0.1 -e TESTCONTAINERS_RYUK_DISABLED=true \
  -e "VETOR_API_UNIT_TESTS=${VETOR_API_UNIT_TESTS:-}" \
  -e "VETOR_API_INTEGRATION_TESTS=${VETOR_API_INTEGRATION_TESTS:-}" \
  docker.io/library/maven:3.9.11-eclipse-temurin-21 \
  bash -c 'export PATH="/vu-bin:$PATH"; bash scripts/verify.sh api'
