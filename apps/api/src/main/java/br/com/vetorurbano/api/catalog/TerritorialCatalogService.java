package br.com.vetorurbano.api.catalog;

import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;
import br.com.vetorurbano.api.collection.MetropolitanMunicipalities;
import br.com.vetorurbano.api.corrections.CorrectionService;

/**
 * Catálogo territorial administrativo (UXH-03): municípios com geometria versionada e ponto interno
 * derivado. Módulo próprio, sem nenhuma equivalência com {@code /risk-areas} (Áreas de Risco).
 *
 * <p>Regras que a resposta pública respeita e que não podem ser afrouxadas:
 * <ul>
 *   <li>só versão aprovada é publicada; revisão sem aprovação não vaza para {@code /api/v1/territories};</li>
 *   <li>{@code internalPoint} é o {@code ST_PointOnSurface} persistido por gatilho, em {@code [lon, lat]};
 *       nenhum centroide de bounding box, média de ocorrências ou cálculo no cliente;</li>
 *   <li>território sem geometria aprovada aparece com {@code validated=false} e {@code internalPoint=null};</li>
 *   <li>cobertura é calculada por <b>código IBGE</b> sobre o recorte legal inteiro (22 municípios),
 *       nunca por nome e nunca sobre a lista filtrada — nome é rótulo, código é identidade;</li>
 *   <li>catálogo existente e vazio responde 200 com {@code items: []}; falha de banco responde 503.</li>
 * </ul>
 */
@Service
@Profile("local")
@ConditionalOnProperty(name = "vetor.accounts.enabled", havingValue = "true")
public class TerritorialCatalogService {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final Set<String> LEVELS = Set.of("MUNICIPALITY", "BAIRRO", "RA", "AP");
    private static final String TERRITORY_COLUMNS = """
            SELECT t.id,t.level,t.official_code,t.name,t.revision,t.approved_version,
                   v.version AS catalog_version,v.dataset_id,v.reference_date,
                   ST_X(v.internal_point) AS lon,ST_Y(v.internal_point) AS lat,
                   ST_AsGeoJSON(v.boundary,15,0) AS geometry
            FROM catalog_territories t
            LEFT JOIN catalog_territory_versions v ON v.territory_id=t.id AND %s
            """;
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public TerritorialCatalogService(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    /** Listagem do catálogo. {@code admin=false} enxerga apenas a versão aprovada. */
    public Map<String, Object> list(String level, String term, boolean includeGeometry, boolean admin) {
        String normalizedLevel = level == null || level.isBlank()
                ? "MUNICIPALITY" : level.strip().toUpperCase(Locale.ROOT);
        if (!LEVELS.contains(normalizedLevel)) throw CorrectionService.invalid("Nível territorial inválido.");
        String normalizedTerm = term == null || term.isBlank() ? null : MetropolitanMunicipalities.normalize(term);
        var sql = new StringBuilder(TERRITORY_COLUMNS.formatted(versionJoin(admin)) + " WHERE t.level=?");
        List<Object> arguments = new ArrayList<>();
        arguments.add(normalizedLevel);
        if (normalizedTerm != null) {
            // Termo já normalizado (caixa alta, sem acento); strpos evita curinga de LIKE.
            sql.append(" AND strpos(t.normalized_name,?) > 0");
            arguments.add(normalizedTerm);
        }
        sql.append(" ORDER BY t.normalized_name,t.id");
        List<Map<String, Object>> items = jdbc.query(sql.toString(),
                (row, index) -> item(row, includeGeometry, admin), arguments.toArray());
        return response(normalizedLevel, items, admin);
    }

    public Map<String, Object> find(UUID id, boolean admin) {
        var rows = jdbc.query(TERRITORY_COLUMNS.formatted(versionJoin(admin)) + " WHERE t.id=?",
                (row, index) -> item(row, true, admin), id);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Território indisponível.");
        var result = new LinkedHashMap<>(rows.getFirst());
        // Público vê só a versão aprovada; histórico de revisão não aprovada não vaza.
        String history = "SELECT version,dataset_id,reference_date,recorded_at FROM catalog_territory_versions"
                + " WHERE territory_id=?"
                + (admin ? "" : " AND version=(SELECT approved_version FROM catalog_territories WHERE id=?)")
                + " ORDER BY version";
        Object[] historyArguments = admin ? new Object[] {id} : new Object[] {id, id};
        result.put("versions", jdbc.query(history, (row, index) -> {
            var version = new LinkedHashMap<String, Object>();
            version.put("version", row.getInt("version"));
            version.put("dataset", dataset(row.getObject("dataset_id", UUID.class)));
            version.put("referenceDate", row.getObject("reference_date", LocalDate.class));
            version.put("recordedAt", row.getTimestamp("recorded_at").toInstant());
            return version;
        }, historyArguments));
        return result;
    }

    /** Trilha de proveniência: todo conjunto ingerido, mais recente primeiro. */
    public List<Map<String, Object>> datasets() {
        return jdbc.query("SELECT id FROM catalog_datasets ORDER BY recorded_at DESC",
                (row, index) -> dataset(row.getObject("id", UUID.class)));
    }

    /**
     * Aprovação publica a revisão corrente. Só ADMIN chega aqui (AccessBoundary) e o CSRF é exigido
     * no controlador: aprovar é decisão explícita, como em {@code /risk-areas}.
     */
    @Transactional
    public Map<String, Object> approve(UUID id, Map<String, Object> body, UUID actor) {
        if (!body.keySet().equals(Set.of("expectedVersion", "justification")))
            throw CorrectionService.invalid("Campos da aprovação inválidos.");
        if (!(body.get("expectedVersion") instanceof Integer expected) || expected <= 0)
            throw CorrectionService.invalid("Versão esperada inválida.");
        if (!(body.get("justification") instanceof String reason) || reason.isBlank() || reason.length() > 2000)
            throw CorrectionService.invalid("Justificativa da aprovação é obrigatória.");
        var rows = jdbc.queryForList(
                "SELECT revision,approved_version FROM catalog_territories WHERE id=? FOR UPDATE", id);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Território indisponível.");
        var row = rows.getFirst();
        if (!Objects.equals(row.get("revision"), expected) || Objects.equals(row.get("approved_version"), expected))
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Versão territorial mudou ou já está aprovada. Recarregue antes de decidir.");
        jdbc.update("UPDATE catalog_territories SET approved_version=? WHERE id=?", expected, id);
        jdbc.update("""
                INSERT INTO auth_audit_events(account_id,occurred_at,module,action,outcome,parameters)
                VALUES(?,?,'territories','CATALOG_TERRITORY_APPROVED','SUCCEEDED',?::jsonb)
                """, actor, Timestamp.from(clock.instant()), JSON.writeValueAsString(
                Map.of("territoryId", id, "version", expected, "justification", reason.strip())));
        return find(id, true);
    }

    private static String versionJoin(boolean admin) {
        return admin ? "v.version = t.revision" : "v.version = t.approved_version";
    }

    private Map<String, Object> item(java.sql.ResultSet row, boolean includeGeometry, boolean admin)
            throws java.sql.SQLException {
        var item = new LinkedHashMap<String, Object>();
        item.put("id", row.getObject("id", UUID.class));
        item.put("officialCode", row.getString("official_code"));
        item.put("level", row.getString("level"));
        item.put("name", row.getString("name"));
        Object version = row.getObject("catalog_version", Integer.class);
        item.put("version", version);
        item.put("validated", version != null);
        // [longitude, latitude] — ordem do GeoJSON, nunca [lat, lon].
        item.put("internalPoint", row.getObject("lon") == null ? null
                : List.of(row.getDouble("lon"), row.getDouble("lat")));
        item.put("referenceDate", row.getObject("reference_date", LocalDate.class));
        if (includeGeometry) {
            String json = row.getString("geometry");
            item.put("geometry", json == null ? null : JSON.readTree(json));
        }
        if (admin) {
            item.put("revision", row.getInt("revision"));
            item.put("approvedVersion", row.getObject("approved_version", Integer.class));
            item.put("dataset", dataset(row.getObject("dataset_id", UUID.class)));
        }
        return item;
    }

    /**
     * Cobertura vem do recorte legal por código IBGE, não da lista devolvida: filtrar por nome não pode
     * encolher a conta, e nome igual com código errado não pode inflá-la.
     */
    private Map<String, Object> response(String level, List<Map<String, Object>> items, boolean admin) {
        var coverage = new LinkedHashMap<String, Object>();
        coverage.put("level", level);
        if ("MUNICIPALITY".equals(level)) {
            Set<String> expected = new LinkedHashSet<>(MetropolitanMunicipalities.current().municipalityCodes());
            Set<String> available = new HashSet<>(jdbc.queryForList("""
                    SELECT official_code FROM catalog_territories
                    WHERE level='MUNICIPALITY' AND approved_version IS NOT NULL
                    """, String.class));
            available.retainAll(expected);
            coverage.put("expected", expected.size());
            coverage.put("available", available.size());
            coverage.put("pending", expected.size() - available.size());
            coverage.put("expectedSource", "LEGAL_RECORTE");
            // Qual recorte legal gerou o número: a tela e a revisão não precisam adivinhar a versão.
            coverage.put("expectedRecorteVersion", MetropolitanMunicipalities.current().version());
        } else {
            // Sem recorte legal para bairro/RA/AP: esperado é desconhecido e continua null, não zero.
            // `available` conta o nível inteiro numa consulta própria, independente de `q`.
            Integer available = jdbc.queryForObject("""
                    SELECT count(*) FROM catalog_territories WHERE level=? AND approved_version IS NOT NULL
                    """, Integer.class, level);
            coverage.put("expected", null);
            coverage.put("available", available);
            coverage.put("pending", null);
            coverage.put("expectedSource", "SEM_RECORTE_LEGAL");
            coverage.put("expectedRecorteVersion", null);
        }
        var result = new LinkedHashMap<String, Object>();
        result.put("dataset", dataset(activeDataset(level, admin)));
        result.put("coverage", coverage);
        result.put("items", items);
        return result;
    }

    /**
     * Conjunto da versão publicada (ou da revisão, no admin) <b>do próprio nível</b>. Sem conjunto
     * publicado no nível, o dataset é desconhecido e continua {@code null}: pegar o mais recente de
     * outro nível exibiria a licença de outro conjunto na listagem.
     */
    private UUID activeDataset(String level, boolean admin) {
        String where = admin ? "v.version=t.revision" : "v.version=t.approved_version";
        var ids = jdbc.query("""
                SELECT v.dataset_id FROM catalog_territory_versions v JOIN catalog_territories t ON t.id=v.territory_id
                WHERE t.level=? AND %s ORDER BY v.recorded_at DESC LIMIT 1
                """.formatted(where), (row, index) -> row.getObject("dataset_id", UUID.class), level);
        return ids.isEmpty() ? null : ids.getFirst();
    }

    private Map<String, Object> dataset(UUID id) {
        if (id == null) return null;
        var rows = jdbc.query("""
                SELECT id,source,source_url,license,attribution,reference_date,obtained_at,checksum,limitations
                FROM catalog_datasets WHERE id=?
                """, (row, index) -> {
            var dataset = new LinkedHashMap<String, Object>();
            dataset.put("id", row.getObject("id", UUID.class));
            dataset.put("source", row.getString("source"));
            dataset.put("sourceUrl", row.getString("source_url"));
            dataset.put("license", row.getString("license"));
            dataset.put("attribution", row.getString("attribution"));
            dataset.put("referenceDate", row.getObject("reference_date", LocalDate.class));
            dataset.put("obtainedAt", row.getTimestamp("obtained_at").toInstant());
            dataset.put("checksum", row.getString("checksum"));
            dataset.put("limitations", row.getString("limitations"));
            return dataset;
        }, id);
        return rows.isEmpty() ? null : rows.getFirst();
    }
}
