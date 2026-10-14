#!/usr/bin/env bash
# Convenção local de verificações. Não é um executor autônomo do Hermes.
set -Eeuo pipefail

VU_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "$VU_ROOT"

trap 'vu_rc=$?; printf "FALHA: verificação interrompida na linha %s (status %s).\n" "$LINENO" "$vu_rc" >&2; exit "$vu_rc"' ERR

usage() {
  cat <<'HELP'
Uso: bash scripts/verify.sh {docs|planning|web|api|all|help}
Aliases de compatibilidade: frontend = web; backend = api.

docs      Confere orientação/referências, links Markdown locais e sintaxe Bash.
planning  Confere docs + presença dos documentos atuais de produto/roadmap.
web       Exige projeto e dependências locais; executa lint, test:ci e build.
api       Exige Maven Wrapper, Java e Docker; executa Maven clean verify.
all       Executa planning, web e api; exige as duas aplicações.

Sem argumento: mostra esta ajuda. Não assume que algum teste passou.
Status: 0 = comando concluído; 2 = uso/pré-requisito ausente;
outros erros = status devolvido pela ferramenta que falhou.

docs/planning conferem estrutura, não qualidade dos requisitos nem produto.
web está disponível; api/all ficam bloqueados até existir a aplicação Java.
HELP
}

blocked() {
  printf 'BLOQUEADO: %s\n' "$*" >&2
  exit 2
}

require_file() {
  [[ -s "$1" ]] || blocked "arquivo ausente ou vazio: $1"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || blocked "comando não disponível: $1"
}

check_docs() {
  local vu_file
  for vu_file in \
    AGENTS.md PLAN.md \
    docs/references/initial-context.md \
    docs/references/ui/app.html \
    docs/references/ui/app.scss \
    docs/references/ui/styles.scss; do
    require_file "$vu_file"
  done
  bash -n "$VU_ROOT/scripts/verify.sh"
  bash -n "$VU_ROOT/harness.sh"
  require_command python3
  require_file scripts/check-doc-links.py
  python3 "$VU_ROOT/scripts/check-doc-links.py"
  printf 'OK: arquivos de orientação presentes e sintaxe Bash válida. Aplicação não verificada.\n'
}

check_planning() {
  check_docs
  local vu_file
  for vu_file in README.md CONTRIBUTING.md CHANGELOG.md docs/README.md docs/development/repository-layout.md docs/product/scope.md docs/product/interface.md docs/architecture/overview.md docs/operations/web.md docs/maps/territorial-sources.md; do
    require_file "$vu_file"
  done
  printf 'OK: documentos de produto e roadmap presentes. Conteúdo ainda exige revisão humana.\n'
}

check_web() {
  require_command node
  require_command npm
  require_file apps/web/package.json
  require_file apps/web/package-lock.json
  [[ -d apps/web/node_modules ]] || blocked 'dependências ausentes: execute npm ci em apps/web após revisar o projeto.'
  (
    cd -- "$VU_ROOT/apps/web"
    node <<'NODE'
const fs = require('node:fs');
const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
for (const name of ['lint', 'test:ci', 'build']) {
  if (typeof manifest.scripts?.[name] !== 'string' || !manifest.scripts[name].trim()) {
    console.error(`BLOQUEADO: configure o script real "${name}" em apps/web/package.json.`);
    process.exit(2);
  }
}
NODE
    npm run lint
    npm run test:ci
    npm run build
  )
  printf 'OK: lint, test:ci e build da aplicação web concluídos.\n'
}

check_api() {
  require_file apps/api/pom.xml
  require_command java
  require_command docker
  require_file apps/api/mvnw
  require_file apps/api/.mvn/wrapper/maven-wrapper.properties
  [[ -x apps/api/mvnw ]] || blocked 'apps/api/mvnw precisa de permissão de execução.'
  docker info >/dev/null 2>&1 || blocked 'Docker não está acessível; necessário aos testes de integração PostgreSQL/PostGIS via Testcontainers.'
  (
    cd -- "$VU_ROOT/apps/api"
    ./mvnw -B -ntp \
      -DskipTests=false -Dmaven.test.skip=false \
      -DskipITs=false -DfailIfNoTests=true clean verify
  )
  compgen -G 'apps/api/target/surefire-reports/TEST-*.xml' >/dev/null || blocked 'faltam relatórios Surefire de testes unitários.'
  compgen -G 'apps/api/target/failsafe-reports/TEST-*.xml' >/dev/null || blocked 'faltam relatórios Failsafe de integração; configure integration-test e verify no pom.xml.'
  printf 'OK: Maven clean verify concluído com relatórios unitários e de integração.\n'
}

[[ $# -le 1 ]] || blocked 'informe apenas um modo; consulte help.'
case "${1:-help}" in
  docs) check_docs ;;
  planning) check_planning ;;
  web|frontend) check_web ;;
  api|backend) check_api ;;
  all)
    check_planning
    check_web
    check_api
    printf 'OK: verificações configuradas concluídas. Aceite funcional e revisão continuam necessários.\n'
    ;;
  help|-h|--help) usage ;;
  *) blocked "modo desconhecido: $1; consulte help." ;;
esac
