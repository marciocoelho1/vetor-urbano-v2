package br.com.vetorurbano.api.sources;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Service
public class SourceService {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String DETAILS_SQL = """
            SELECT s.id, v.name, v.channel, v.public_url, v.territories::text AS territories,
                   v.pillars::text AS pillars, a.method AS access_method,
                   a.id AS access_configuration_ref, v.rating, v.rating_justification,
                   v.version, v.author_id, v.created_at
            FROM sources s
            JOIN source_versions v ON v.source_id = s.id AND v.version = s.current_version
            JOIN source_access_configurations a ON a.source_id = v.source_id
                AND a.version = v.version AND a.id = v.access_configuration_id
            """;

    private final JdbcTemplate jdbc;

    public SourceService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional(readOnly = true)
    public PublicSourcesResponse publicSources() {
        var items = jdbc.query("""
                SELECT v.name, v.public_url
                FROM sources s
                JOIN source_versions v ON v.source_id = s.id AND v.version = s.current_version
                ORDER BY lower(v.name), lower(COALESCE(v.public_url, '')), s.id
                """, (row, index) -> new PublicSource(row.getString("name"), row.getString("public_url")));
        return new PublicSourcesResponse(items);
    }

    @Transactional(readOnly = true)
    public SourceAdminListResponse list() {
        return new SourceAdminListResponse(jdbc.query(DETAILS_SQL + " ORDER BY lower(v.name), lower(v.channel), s.id", SourceService::details));
    }

    @Transactional(readOnly = true)
    public SourceDetails find(String id) {
        return jdbc.query(DETAILS_SQL + " WHERE s.id = ?", SourceService::details, id).stream().findFirst()
                .orElseThrow(SourceService::notFound);
    }

    @Transactional(readOnly = true)
    public SourceHistoryResponse history(String id) {
        if (!exists(id)) throw notFound();
        var versions = jdbc.query("""
                SELECT ?::text AS id, v.name, v.channel, v.public_url, v.territories::text AS territories,
                       v.pillars::text AS pillars, a.method AS access_method,
                       a.id AS access_configuration_ref, v.rating, v.rating_justification,
                       v.version, v.author_id, v.created_at
                FROM source_versions v
                JOIN source_access_configurations a ON a.source_id = v.source_id
                    AND a.version = v.version AND a.id = v.access_configuration_id
                WHERE v.source_id = ?
                ORDER BY v.version DESC
                """, SourceService::details, id, id);
        return new SourceHistoryResponse(id, versions);
    }

    @Transactional
    public SourceDetails create(SourceWriteRequest request, UUID actor) {
        if (request.expectedVersion() != null) throw invalid();
        var fields = SourceValidator.validate(request);
        String id = UUID.randomUUID().toString();
        int version = 1;
        Instant now = Instant.now();
        UUID configId = UUID.randomUUID();
        UUID versionId = UUID.randomUUID();
        jdbc.update("INSERT INTO sources (id, public_name, current_version) VALUES (?, ?, ?)", id, fields.name(), version);
        insertAccessConfig(configId, id, version, fields.accessMethod(), actor, now);
        insertVersion(versionId, id, version, fields, configId, actor, now);
        var after = find(id);
        insertAudit(id, actor, now, "CREATE", null, after);
        return after;
    }

    @Transactional
    public SourceDetails update(String id, SourceWriteRequest request, UUID actor) {
        if (request.expectedVersion() == null || request.expectedVersion() < 1) throw invalid();
        var fields = SourceValidator.validate(request);
        var current = jdbc.query("SELECT current_version FROM sources WHERE id = ? FOR UPDATE",
                (row, index) -> row.getInt("current_version"), id).stream().findFirst().orElseThrow(SourceService::notFound);
        if (!current.equals(request.expectedVersion()))
            throw new SourceFailure(409, "SOURCE_VERSION_CONFLICT", "A fonte mudou. Recarregue antes de editar.");

        var before = find(id);
        int version = current + 1;
        Instant now = Instant.now();
        UUID configId = UUID.randomUUID();
        UUID versionId = UUID.randomUUID();
        insertAccessConfig(configId, id, version, fields.accessMethod(), actor, now);
        insertVersion(versionId, id, version, fields, configId, actor, now);
        jdbc.update("UPDATE sources SET public_name = ?, current_version = ? WHERE id = ?", fields.name(), version, id);
        var after = find(id);
        insertAudit(id, actor, now, "UPDATE", before, after);
        return after;
    }

    /**
     * Ticket 24: nova versão da fonte com a nota decidida, preservando o restante do cadastro.
     * A versão anterior continua legível no histórico; nada é sobrescrito.
     */
    @Transactional
    public SourceDetails reRate(String id, int rating, String justification, UUID actor) {
        if (rating < 1 || rating > 5 || justification == null || justification.isBlank()) throw invalid();
        var current = jdbc.query("SELECT current_version FROM sources WHERE id = ? FOR UPDATE",
                (row, index) -> row.getInt("current_version"), id).stream().findFirst()
                .orElseThrow(SourceService::notFound);
        var before = find(id);
        int version = current + 1;
        Instant now = Instant.now();
        UUID configId = UUID.randomUUID();
        UUID versionId = UUID.randomUUID();
        // Copia configuração de acesso e campos da versão vigente sem reinterpretar JSON no código.
        jdbc.update("""
                INSERT INTO source_access_configurations (id, source_id, version, method, created_by, created_at)
                SELECT ?::uuid, sv.source_id, ?::integer, a.method, ?::uuid, ?::timestamptz
                FROM source_versions sv
                JOIN source_access_configurations a ON a.id = sv.access_configuration_id
                WHERE sv.source_id = ? AND sv.version = ?
                """, configId, version, actor, Timestamp.from(now), id, current);
        jdbc.update("""
                INSERT INTO source_versions (
                    id, source_id, version, name, channel, public_url, territories, pillars,
                    rating, rating_justification, access_configuration_id, author_id, created_at
                )
                SELECT ?::uuid, source_id, ?::integer, name, channel, public_url, territories, pillars,
                       ?::smallint, ?::text, ?::uuid, ?::uuid, ?::timestamptz
                FROM source_versions WHERE source_id = ? AND version = ?
                """, versionId, version, rating, justification, configId, actor, Timestamp.from(now), id, current);
        jdbc.update("UPDATE sources SET current_version = ? WHERE id = ?", version, id);
        var after = find(id);
        insertAudit(id, actor, now, "UPDATE", before, after);
        return after;
    }

    private void insertAccessConfig(UUID id, String sourceId, int version, String method, UUID actor, Instant now) {
        jdbc.update("""
                INSERT INTO source_access_configurations (id, source_id, version, method, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """, id, sourceId, version, method, actor, Timestamp.from(now));
    }

    private void insertVersion(UUID versionId, String sourceId, int version, SourceFields fields,
            UUID configId, UUID actor, Instant now) {
        jdbc.update("""
                INSERT INTO source_versions (
                    id, source_id, version, name, channel, public_url, territories, pillars,
                    rating, rating_justification, access_configuration_id, author_id, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, ?, ?)
                """, versionId, sourceId, version, fields.name(), fields.channel(), fields.url(),
                json(fields.territories()), json(fields.pillars()), fields.rating(), fields.justification(),
                configId, actor, Timestamp.from(now));
    }

    private void insertAudit(String id, UUID actor, Instant now, String action, SourceDetails before, SourceDetails after) {
        jdbc.update("""
                INSERT INTO source_audit_events (
                    source_id, actor_id, occurred_at, action, before_version_id, after_version_id,
                    before_access_configuration_id, after_access_configuration_id, before_snapshot, after_snapshot
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb)
                """, id, actor, Timestamp.from(now), action,
                before == null ? null : beforeId(id, before.version()), versionId(id, after.version()),
                before == null ? null : before.accessConfigurationRef(), after.accessConfigurationRef(),
                before == null ? null : json(snapshot(before)), json(snapshot(after)));
    }

    private UUID beforeId(String id, int version) { return versionId(id, version); }

    private UUID versionId(String id, int version) {
        return jdbc.queryForObject("SELECT id FROM source_versions WHERE source_id = ? AND version = ?", UUID.class, id, version);
    }

    private Map<String, Object> snapshot(SourceDetails value) {
        var snapshot = new LinkedHashMap<String, Object>();
        snapshot.put("name", value.name()); snapshot.put("channel", value.channel()); snapshot.put("url", value.url());
        snapshot.put("territories", value.territories()); snapshot.put("pillars", value.pillars());
        snapshot.put("accessMethod", value.accessMethod()); snapshot.put("accessConfigurationRef", value.accessConfigurationRef());
        snapshot.put("rating", value.rating()); snapshot.put("ratingJustification", value.ratingJustification());
        snapshot.put("version", value.version()); snapshot.put("authorId", value.authorId()); snapshot.put("createdAt", value.createdAt());
        return snapshot;
    }

    private boolean exists(String id) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM sources WHERE id = ?)", Boolean.class, id));
    }

    private static SourceDetails details(ResultSet row, int index) throws SQLException {
        String territoriesJson = row.getString("territories");
        String pillarsJson = row.getString("pillars");
        UUID author = row.getObject("author_id", UUID.class);
        Timestamp createdAt = row.getTimestamp("created_at");
        return new SourceDetails(row.getString("id"), row.getString("name"), row.getString("channel"),
                row.getString("public_url"), parseStrings(territoriesJson), parseStrings(pillarsJson),
                row.getString("access_method"), row.getObject("access_configuration_ref", UUID.class),
                row.getInt("rating"), row.getString("rating_justification"), row.getInt("version"), author,
                createdAt.toInstant());
    }

    private static List<String> parseStrings(String value) {
        try { return JSON.readValue(value, JSON.getTypeFactory().constructCollectionType(List.class, String.class)); }
        catch (Exception failure) { throw new IllegalStateException("Metadados de fonte inválidos."); }
    }

    private static String json(Object value) {
        try { return JSON.writeValueAsString(value); }
        catch (Exception failure) { throw new IllegalStateException("Não foi possível registrar a fonte."); }
    }

    private static SourceFailure invalid() {
        return new SourceFailure(400, "INVALID_SOURCE", "Revise os campos obrigatórios da fonte.");
    }

    private static SourceFailure notFound() { return new SourceFailure(404, "SOURCE_NOT_FOUND", "Fonte não encontrada."); }
}
