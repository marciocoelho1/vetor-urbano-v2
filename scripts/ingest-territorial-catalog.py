#!/usr/bin/env python3
"""Ingestão do catálogo territorial municipal (UXH-03) no banco sintético.

Fonte: API pública de Malhas do IBGE (`servicodados.ibge.gov.br`), produto derivado da Malha
Municipal Digital. O recorte é exatamente a lista legal de `MetropolitanMunicipalities`
(22 municípios da Região Metropolitana do Rio de Janeiro) com o código IBGE fixado na versão 2 do
recurso legal; município do recorte sem malha na fonte é relatado como pendente e nunca inventado.
Se um nome do recorte resolver, na API de Localidades, para um código diferente do fixado, a
ingestão **reprova** e lista o par esperado×obtido: código é identidade, nome é rótulo.

O script não fala com a API da aplicação: escreve direto no PostgreSQL/PostGIS sintético, porque é
ferramenta de ingestão, não de operação. Destino fora do ambiente sintético (porta 55438, base
`vetor_urbano`, host diferente de 127.0.0.1) é recusado **antes de abrir conexão**.

Proveniência gravada em `catalog_datasets` (origem, licença, atribuição, data-base, obtenção,
checksum do instantâneo e limitações). Os arquivos originais ficam fora do repositório, em
`~/.local/share/vetor-urbano/territorial-catalog/`, junto de um `manifest.json` reproduzível.

Uso:
    python3 scripts/ingest-territorial-catalog.py --database vu_catalog_probe --dry-run
    python3 scripts/ingest-territorial-catalog.py --database vu_catalog_probe
    python3 scripts/ingest-territorial-catalog.py --database vu_catalog_probe --approve

`--approve` publica as versões desta execução (é o equivalente local de aprovar na administração);
sem ele, o catálogo fica ingerido e invisível no endpoint público, como manda a regra de aprovação.
"""

from __future__ import annotations

import argparse
import datetime as dt
import gzip
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
import unicodedata
import urllib.error
import urllib.request

LEGAL_LIST = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "apps/api/src/main/resources/collection/metropolitan-municipalities-v2.json",
)
# Destino sintético permitido; qualquer outro exige a flag explícita e consciente.
SYNTHETIC_PORTS = {"55432", "55436", "55437", "55442", "55443"}
REAL_PORTS = {"55438"}
REAL_DATABASES = {"vetor_urbano"}
LOCALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/33/municipios"
MESH_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/municipios/{code}"
    "?formato=application/vnd.geo+json&qualidade=maxima"
)
STATE_MESH_URL = "https://servicodados.ibge.gov.br/api/v3/malhas/estados/33?formato=application/vnd.geo+json&qualidade=maxima"

SOURCE = "IBGE — API de Malhas (produto derivado da Malha Municipal Digital)"
LICENSE = "CC BY 4.0"
ATTRIBUTION = "IBGE — Malha Municipal Digital, produto derivado via API de Malhas v3"
LIMITATIONS = (
    "Recorte GeoJSON simplificado por município (qualidade máxima da API); a resposta não declara "
    "a edição da MMD, então a data-base registrada é a data de obtenção. Simplificação por "
    "município não garante continuidade de divisas entre vizinhos e não serve para medir área."
)


def normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value.strip())
    return "".join(char for char in decomposed if unicodedata.category(char) != "Mn").upper()


def fetch(url: str, cache_path: str | None = None, attempts: int = 3) -> bytes:
    if cache_path and os.path.exists(cache_path):
        data = open(cache_path, "rb").read()
        return gzip.decompress(data) if data[:2] == b"\x1f\x8b" else data
    last: Exception | None = None
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(request, timeout=120) as response:
                data = response.read()
            if data[:2] == b"\x1f\x8b":
                data = gzip.decompress(data)
            if cache_path:
                os.makedirs(os.path.dirname(cache_path), exist_ok=True)
                with open(cache_path, "wb") as handle:
                    handle.write(data)
            return data
        except (urllib.error.URLError, TimeoutError) as failure:  # fonte pública, tentativa limitada
            last = failure
            time.sleep(2 * (attempt + 1))
    raise SystemExit(f"BLOQUEADO: fonte pública indisponível ({url}): {last}")


def assert_synthetic_destination(database: str, allow_real: bool) -> None:
    """Recusa destino não sintético antes de qualquer conexão: este script escreve, não lê."""
    port = os.environ.get("PGPORT", "55436")
    host = os.environ.get("PGHOST", "127.0.0.1")
    problems = []
    if port in REAL_PORTS:
        problems.append(f"porta {port} (banco de dados reais)")
    if database in REAL_DATABASES:
        problems.append(f"base {database} (dados reais)")
    if host not in {"127.0.0.1", "localhost", "::1"}:
        problems.append(f"host {host} (fora do local)")
    if port not in SYNTHETIC_PORTS | REAL_PORTS:
        problems.append(f"porta {port} (não declarada sintética)")
    if not problems:
        return
    if allow_real:
        print(
            "AVISO: destino não sintético liberado por --allow-real-database: " + "; ".join(problems),
            file=sys.stderr,
        )
        return
    raise SystemExit(
        "RECUSADO: destino não sintético (" + "; ".join(problems) + "). "
        "A ingestão só escreve em banco sintético; --allow-real-database exige autorização explícita."
    )


def psql_command(container: str, database: str) -> list[str]:
    """Executa psql no host; sem PGPASSWORD, resolve as credenciais do contêiner sintético."""
    if shutil.which("psql") is None:
        raise SystemExit("BLOQUEADO: psql ausente no host.")
    if not os.environ.get("PGPASSWORD"):
        try:
            user = subprocess.run(
                ["podman", "exec", container, "printenv", "POSTGRES_USER"],
                capture_output=True, text=True, check=True,
            ).stdout.strip()
            password = subprocess.run(
                ["podman", "exec", container, "printenv", "POSTGRES_PASSWORD"],
                capture_output=True, text=True, check=True,
            ).stdout.strip()
        except (subprocess.CalledProcessError, FileNotFoundError) as failure:
            raise SystemExit(f"BLOQUEADO: credenciais sintéticas indisponíveis em {container}: {failure}")
        os.environ["PGPASSWORD"] = password
        os.environ.setdefault("PGUSER", user)
    os.environ.setdefault("PGHOST", "127.0.0.1")
    os.environ.setdefault("PGPORT", "55436")
    return ["psql", "-d", database, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-F", "\t"]


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def main() -> int:
    parser = argparse.ArgumentParser(description="Ingere a malha municipal do recorte metropolitano.")
    parser.add_argument("--database", required=True, help="banco sintético de destino")
    parser.add_argument("--container", default="vetor-spec-postgis", help="contêiner sintético com as credenciais")
    parser.add_argument(
        "--cache-dir",
        default=os.path.expanduser("~/.local/share/vetor-urbano/territorial-catalog"),
        help="diretório dos arquivos originais e do manifest (fora do repositório)",
    )
    parser.add_argument("--dry-run", action="store_true", help="baixa e valida, mas não escreve no banco")
    parser.add_argument("--approve", action="store_true", help="publica as versões desta execução")
    parser.add_argument(
        "--allow-real-database",
        action="store_true",
        help="libera destino não sintético; exige autorização explícita e consciente",
    )
    arguments = parser.parse_args()
    assert_synthetic_destination(arguments.database, arguments.allow_real_database)

    legal = json.load(open(LEGAL_LIST, encoding="utf-8"))
    expected = [(entry["name"], str(entry["ibgeCode"])) for entry in legal["municipalities"]]
    raw_dir = os.path.join(arguments.cache_dir, "raw")
    os.makedirs(raw_dir, exist_ok=True)

    # A fonte de nomes confirma o código fixado; ela não decide o código. Divergência reprova tudo.
    localities = json.loads(fetch(LOCALITIES_URL))
    by_name = {normalize(item["nome"]): str(item["id"]) for item in localities}
    divergent = []
    for name, code in expected:
        found = by_name.get(normalize(name))
        if found is None:
            divergent.append((name, code, "ausente na API de Localidades"))
        elif found != code:
            divergent.append((name, code, found))
    print(f"recorte legal v{legal['version']}: {len(expected)} municípios com código IBGE fixado")
    if divergent:
        for name, code, found in divergent:
            print(f"DIVERGÊNCIA: {name} esperado={code} obtido={found}", file=sys.stderr)
        print("RECUSADO: recorte legal e fonte divergem em identidade; nada foi escrito.", file=sys.stderr)
        return 3

    manifest_entries = []
    digitized = []
    for name, code in expected:
        raw = fetch(MESH_URL.format(code=code), os.path.join(raw_dir, f"{code}.geojson"))
        document = json.loads(raw)
        features = document.get("features") or []
        if not features:
            print(f"PENDENTE: {name} ({code}) sem feição na fonte")
            continue
        manifest_entries.append(
            {
                "officialCode": code,
                "name": name,
                "url": MESH_URL.format(code=code),
                "sha256": hashlib.sha256(raw).hexdigest(),
                "bytes": len(raw),
                "obtainedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            }
        )
        digitized.append((code, features[0]["geometry"]))

    if not digitized:
        print("BLOQUEADO: nenhuma geometria obtida; nada a ingerir.")
        return 2

    state_mesh = json.loads(fetch(STATE_MESH_URL, os.path.join(raw_dir, "estado-33.geojson")))
    state_geometry = state_mesh["features"][0]["geometry"]

    combined = hashlib.sha256()
    for entry in sorted(manifest_entries, key=lambda item: item["officialCode"]):
        combined.update(f"{entry['officialCode']}:{entry['sha256']}\n".encode())
    checksum = combined.hexdigest()
    obtained_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    reference_date = obtained_at.date()

    manifest = {
        "source": SOURCE,
        "license": LICENSE,
        "attribution": ATTRIBUTION,
        "referenceDate": reference_date.isoformat(),
        "obtainedAt": obtained_at.isoformat(),
        "checksum": checksum,
        "legalList": os.path.relpath(LEGAL_LIST, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "legalRecorteVersion": legal["version"],
        "codesSource": legal.get("codesSource"),
        "entries": manifest_entries,
    }
    with open(os.path.join(arguments.cache_dir, "manifest.json"), "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=2)
    print(f"instantâneo: {len(manifest_entries)} arquivos, checksum {checksum[:16]}…, data-base {reference_date}")

    statements = [
        "BEGIN;",
        "CREATE TEMP TABLE catalog_ingest_staging (code TEXT PRIMARY KEY, boundary geometry, state_mesh geometry) ON COMMIT DROP;",
    ]
    for code, geometry in digitized:
        statements.append(
            "INSERT INTO catalog_ingest_staging(code, boundary) VALUES ("
            f"{sql_literal(code)}, ST_SetSRID(ST_GeomFromGeoJSON({sql_literal(json.dumps(geometry))}),4326));"
        )
    statements.append(
        "UPDATE catalog_ingest_staging SET state_mesh = ST_SetSRID(ST_GeomFromGeoJSON("
        f"{sql_literal(json.dumps(state_geometry))}),4326);"
    )
    statements.append(
        "INSERT INTO catalog_datasets(id,source,source_url,license,attribution,reference_date,obtained_at,checksum,limitations) "
        "SELECT gen_random_uuid(), "
        f"{sql_literal(SOURCE)}, {sql_literal(MESH_URL)}, {sql_literal(LICENSE)}, {sql_literal(ATTRIBUTION)}, "
        f"DATE {sql_literal(reference_date.isoformat())}, TIMESTAMPTZ {sql_literal(obtained_at.isoformat())}, "
        f"{sql_literal(checksum)}, {sql_literal(LIMITATIONS)} "
        f"WHERE NOT EXISTS (SELECT 1 FROM catalog_datasets WHERE checksum = {sql_literal(checksum)});"
    )
    statements.append(
        "CREATE TEMP TABLE catalog_ingest_dataset ON COMMIT DROP AS "
        "SELECT id FROM catalog_datasets ORDER BY recorded_at DESC LIMIT 1;"
    )
    # Todo município do recorte legal existe no catálogo, com ou sem geometria: ausência de malha é
    # pendência visível (validated=false), não omissão. O código vem do recurso legal, não da fonte.
    for name, code in expected:
        statements.append(
            "INSERT INTO catalog_territories(id,level,official_code,name) VALUES "
            f"(gen_random_uuid(),'MUNICIPALITY',{sql_literal(code)},{sql_literal(name)}) "
            "ON CONFLICT (level,official_code) DO UPDATE SET name = excluded.name;"
        )
    statements.append(
        """
INSERT INTO catalog_territory_versions(territory_id,version,dataset_id,boundary,reference_date)
SELECT t.id,
       COALESCE((SELECT max(v.version) FROM catalog_territory_versions v WHERE v.territory_id = t.id),0) + 1,
       d.id, s.boundary, DATE """
        + sql_literal(reference_date.isoformat())
        + """
FROM catalog_ingest_staging s
JOIN catalog_territories t ON t.level = 'MUNICIPALITY' AND t.official_code = s.code
CROSS JOIN catalog_ingest_dataset d
WHERE s.boundary IS NOT NULL
  AND NOT ST_IsEmpty(s.boundary)
  AND ST_IsValid(s.boundary)
  AND NOT EXISTS (
        SELECT 1 FROM catalog_territory_versions v
        WHERE v.territory_id = t.id AND ST_Equals(v.boundary, s.boundary));
"""
    )
    statements.append(
        "UPDATE catalog_territories t SET revision = great.newest FROM ("
        "SELECT territory_id, max(version) AS newest FROM catalog_territory_versions GROUP BY territory_id) great "
        "WHERE t.id = great.territory_id AND t.revision <> great.newest;"
    )
    if arguments.approve:
        statements.append(
            "UPDATE catalog_territories SET approved_version = revision "
            "WHERE level = 'MUNICIPALITY' AND revision > 0 AND approved_version IS DISTINCT FROM revision;"
        )
    statements.append(
        """
SELECT 'RESULTADO', t.official_code, t.name, coalesce(v.version,0),
       coalesce(ST_GeometryType(v.boundary),'-'),
       coalesce(ST_NPoints(v.boundary)::text,'-'),
       coalesce(ST_AsText(v.internal_point),'-'),
       coalesce(ST_Contains(v.boundary, v.internal_point)::text,'-'),
       coalesce(ST_Intersects(s.state_mesh, v.boundary)::text,'-'),
       coalesce(t.approved_version::text,'-')
FROM catalog_territories t
LEFT JOIN catalog_territory_versions v ON v.territory_id = t.id
     AND v.version = coalesce(t.approved_version, t.revision)
LEFT JOIN catalog_ingest_staging s ON s.code = t.official_code
WHERE t.level = 'MUNICIPALITY'
ORDER BY t.normalized_name;
"""
    )
    statements.append("COMMIT;")

    if arguments.dry_run:
        print("--dry-run: SQL gerado, nada escrito no banco.")
        return 0

    command = psql_command(arguments.container, arguments.database)
    result = subprocess.run(command, input="\n".join(statements), capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr.strip()[-4000:], file=sys.stderr)
        print("FALHA: ingestão abortada; transação desfeita.")
        return 1

    ingested = 0
    with_geometry = 0
    published = 0
    for line in result.stdout.splitlines():
        if not line.startswith("RESULTADO\t"):
            continue
        _, code, name, version, geometry_type, points, point, inside, in_state, approved = line.split("\t")
        ingested += 1
        if version != "0":
            with_geometry += 1
        if approved != "-":
            published += 1
        print(
            f"  {code} {name:<24} v{version} {geometry_type:<12} pontos={points:<5} "
            f"ponto={point} dentro={inside} no_estado={in_state} aprovada={approved}"
        )
    print(
        f"catálogo: {ingested} municípios, {with_geometry} com geometria ingerida, "
        f"{published} publicados, {ingested - with_geometry} pendentes de fonte"
    )
    print(f"aprovado nesta execução: {'sim' if arguments.approve else 'não (use --approve ou aprove na administração)'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
