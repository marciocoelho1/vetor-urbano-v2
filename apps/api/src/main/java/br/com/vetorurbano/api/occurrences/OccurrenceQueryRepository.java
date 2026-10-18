package br.com.vetorurbano.api.occurrences;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class OccurrenceQueryRepository {
    private enum ResultOrder {
        STANDARD,
        HISTORY
    }

    private static final String SELECT_CORE = """
            SELECT
                o.id,
                o.happening_id,
                o.title,
                o.description,
                o.category,
                o.occurrence_type,
                o.subtype,
                o.situation,
                o.reliability_score,
                o.municipality,
                o.neighborhood,
                o.location_precision,
                ST_X(o.location::geometry) AS longitude,
                ST_Y(o.location::geometry) AS latitude,
                o.occurred_at,
                o.occurred_from,
                o.occurred_until,
                CASE
                    WHEN :withoutPeriod THEN 'CERTAIN'
                    WHEN o.occurred_at IS NOT NULL THEN
                        CASE WHEN o.occurred_at >= :periodStart AND o.occurred_at < :periodEnd
                             THEN 'CERTAIN' ELSE 'OUTSIDE' END
                    WHEN o.occurred_from >= :periodStart AND o.occurred_until <= :periodEnd THEN 'CERTAIN'
                    WHEN o.occurred_from < :periodEnd AND o.occurred_until > :periodStart THEN 'POSSIBLE'
                    ELSE 'OUTSIDE'
                END AS temporal_match
            """;

    private static final String SELECT_SQL = SELECT_CORE + "            FROM occurrences o\n            ";

    /** Same projection plus the publication status that decides whether a register may still be read. */
    private static final String SELECT_LOOKUP_SQL = SELECT_CORE + """
            ,
                o.publication_status,
                o.withdrawn_at
            FROM occurrences o
            """;

    private static final String BASE_SQL = SELECT_SQL + """
            WHERE o.publication_status = 'PUBLISHED'
              AND (:withoutPeriod OR (
                  (o.occurred_at IS NOT NULL
                      AND o.occurred_at >= :periodStart
                      AND o.occurred_at < :periodEnd)
                  OR (o.occurred_at IS NULL
                      AND o.occurred_from < :periodEnd
                      AND o.occurred_until > :periodStart)
              ))
            """;

    private static final RowMapper<OccurrenceRow> OCCURRENCE_MAPPER = (result, rowNumber) ->
            new OccurrenceRow(
                    result.getString("id"),
                    result.getString("happening_id"),
                    result.getString("title"),
                    result.getString("description"),
                    OccurrenceCategory.valueOf(result.getString("category")),
                    result.getString("occurrence_type"),
                    result.getString("subtype"),
                    OccurrenceSituation.valueOf(result.getString("situation")),
                    result.getInt("reliability_score"),
                    result.getString("municipality"),
                    result.getString("neighborhood"),
                    LocationPrecision.valueOf(result.getString("location_precision")),
                    coordinates(result),
                    instant(result, "occurred_at"),
                    instant(result, "occurred_from"),
                    instant(result, "occurred_until"),
                    TemporalMatch.valueOf(result.getString("temporal_match")));

    private static final RowMapper<ClippingRow> CLIPPING_MAPPER = (result, rowNumber) ->
            new ClippingRow(
                    result.getString("occurrence_id"),
                    new ClippingReference(
                            result.getString("clipping_id"),
                            result.getString("title"),
                            new SourceReference(
                                    result.getString("source_id"),
                                    result.getString("source_name")),
                            instant(result, "source_published_at"),
                            instant(result, "collected_at"), result.getString("reference")));

    private final NamedParameterJdbcTemplate jdbc;

    public OccurrenceQueryRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<OccurrenceRecord> find(OccurrenceQuery query) {
        return find(query, ResultOrder.STANDARD);
    }

    public List<OccurrenceRecord> findHistory(OccurrenceQuery query) {
        return find(query, ResultOrder.HISTORY);
    }

    private List<OccurrenceRecord> find(OccurrenceQuery query, ResultOrder resultOrder) {
        var parameters = new MapSqlParameterSource()
                .addValue("withoutPeriod", query.periodStart() == null)
                .addValue("periodStart", query.periodStart() == null ? null : Timestamp.from(query.periodStart()), java.sql.Types.TIMESTAMP)
                .addValue("periodEnd", query.periodEnd() == null ? null : Timestamp.from(query.periodEnd()), java.sql.Types.TIMESTAMP);
        var sql = new StringBuilder(BASE_SQL);

        if (query.noCategoriesSelected()) {
            sql.append(" AND FALSE");
        } else {
            appendIn(sql, parameters, "o.category", "categories", query.categories());
        }
        appendIn(sql, parameters, "o.occurrence_type", "types", query.types());
        if (!query.subtypes().isEmpty()) {
            var alternatives = new ArrayList<String>();
            for (int index = 0; index < query.subtypes().size(); index++) {
                var pair = query.subtypes().get(index).split(":", 2);
                var key = "subtype" + index;
                if (pair.length == 2) {
                    alternatives.add("(o.occurrence_type = :" + key + "Type AND o.subtype = :" + key + ")");
                    parameters.addValue(key + "Type", pair[0]);
                } else alternatives.add("o.subtype = :" + key);
                parameters.addValue(key, pair[pair.length - 1]);
            }
            sql.append(" AND (").append(String.join(" OR ", alternatives)).append(')');
        }
        appendIn(sql, parameters, "o.municipality", "municipalities", query.municipalities());
        appendIn(sql, parameters, "o.neighborhood", "neighborhoods", query.neighborhoods());
        appendIn(sql, parameters, "o.situation", "situations", query.situations());

        if (!query.sourceIds().isEmpty()) {
            sql.append("""
                    AND EXISTS (
                        SELECT 1
                        FROM occurrence_clippings oc
                        JOIN clippings c ON c.id = oc.clipping_id
                        WHERE oc.occurrence_id = o.id
                          AND c.source_id IN (:sourceIds)
                    )
                    """);
            parameters.addValue("sourceIds", query.sourceIds());
        }
        if (query.text() != null) {
            sql.append("""
                    AND (
                        (:searchOccurrenceId AND strpos(unaccent(lower(o.id)), unaccent(lower(:text))) > 0)
                        OR strpos(
                            unaccent(lower(concat_ws(' ', o.title, o.description, o.municipality, o.neighborhood))),
                            unaccent(lower(:text))
                        ) > 0
                    )
                    """);
            parameters.addValue("text", query.text());
            parameters.addValue("searchOccurrenceId", resultOrder == ResultOrder.HISTORY);
        }
        if (query.minReliability() != null) {
            sql.append(" AND o.reliability_score >= :minReliability");
            parameters.addValue("minReliability", query.minReliability());
        }
        if (query.maxReliability() != null) {
            sql.append(" AND o.reliability_score <= :maxReliability");
            parameters.addValue("maxReliability", query.maxReliability());
        }
        if (query.center() != null && query.radiusMeters() != null) {
            sql.append("""
                    AND o.location IS NOT NULL
                    AND ST_DWithin(
                        o.location,
                        ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
                        :radiusMeters
                    )
                    """);
            parameters.addValue("longitude", query.center().longitude());
            parameters.addValue("latitude", query.center().latitude());
            parameters.addValue("radiusMeters", query.radiusMeters());
        }

        if (!query.bounds().isEmpty()) {
            sql.append(" AND ST_Intersects(o.location::geometry, ST_MakeEnvelope(:west, :south, :east, :north, 4326))");
            parameters.addValue("west", query.bounds().get(0)).addValue("south", query.bounds().get(1))
                    .addValue("east", query.bounds().get(2)).addValue("north", query.bounds().get(3));
        }
        // Preserve the existing daily HH:mm filter in America/Sao_Paulo, including midnight wrap.
        // An uncertain interval does not claim an exact hour and is not excluded by this filter.
        var clock = "to_char(o.occurred_at AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI')";
        if (query.timeStart() != null && query.timeEnd() != null) {
            var operator = query.timeStart().compareTo(query.timeEnd()) <= 0 ? " AND " : " OR ";
            sql.append(" AND (o.occurred_at IS NULL OR (").append(clock)
                    .append(" >= :timeStart").append(operator).append(clock).append(" <= :timeEnd))");
        } else if (query.timeStart() != null) {
            sql.append(" AND (o.occurred_at IS NULL OR ").append(clock).append(" >= :timeStart)");
        } else if (query.timeEnd() != null) {
            sql.append(" AND (o.occurred_at IS NULL OR ").append(clock).append(" <= :timeEnd)");
        }
        parameters.addValue("timeStart", query.timeStart()).addValue("timeEnd", query.timeEnd());

        if (resultOrder == ResultOrder.HISTORY) {
            sql.append(" ORDER BY COALESCE(o.occurred_at, o.occurred_until) DESC NULLS LAST, o.id DESC");
        } else {
            sql.append(" ORDER BY COALESCE(o.occurred_at, o.occurred_from) DESC, o.id");
        }
        var rows = jdbc.query(sql.toString(), parameters, OCCURRENCE_MAPPER);
        if (rows.isEmpty()) {
            return List.of();
        }

        var clippingByOccurrence = findClippings(rows.stream().map(OccurrenceRow::id).toList());
        return rows.stream()
                .map(row -> row.toRecord(clippingByOccurrence.getOrDefault(row.id(), List.of())))
                .toList();
    }

    /**
     * Single-record read including withdrawn registers, so an old address can report unavailability
     * without ever resending the retracted content. Absent identifiers return an empty list, and a
     * withdrawn row carries no readable record.
     */
    public List<LookupRow> findAny(String id) {
        var parameters = new MapSqlParameterSource()
                .addValue("withoutPeriod", true)
                .addValue("periodStart", null, java.sql.Types.TIMESTAMP)
                .addValue("periodEnd", null, java.sql.Types.TIMESTAMP)
                .addValue("id", id);
        var rows = jdbc.query(SELECT_LOOKUP_SQL + " WHERE o.id = :id",
                parameters,
                (result, rowNumber) -> new LookupRow(
                        result.getString("publication_status"),
                        instant(result, "withdrawn_at"),
                        OCCURRENCE_MAPPER.mapRow(result, rowNumber).toRecord(List.of())));
        if (rows.isEmpty()) {
            return List.of();
        }
        var row = rows.getFirst();
        if (!"PUBLISHED".equals(row.publicationStatus()) || row.record() == null) {
            return List.of(new LookupRow(row.publicationStatus(), row.withdrawnAt(), null));
        }
        return List.of(new LookupRow(row.publicationStatus(), row.withdrawnAt(),
                row.record().withClippings(findClippings(List.of(id)).getOrDefault(id, List.of()))));
    }

    /** A stored row: either a readable record or only the fact and moment of its withdrawal. */
    public record LookupRow(String publicationStatus, Instant withdrawnAt, OccurrenceRecord record) {}

    public List<OccurrenceRecord> findPublishedRelated(OccurrenceQuery query, List<String> happeningIds) {
        if (happeningIds.isEmpty()) return List.of();
        var parameters = new MapSqlParameterSource()
                .addValue("withoutPeriod", query.periodStart() == null)
                .addValue("periodStart", query.periodStart() == null ? null : Timestamp.from(query.periodStart()), java.sql.Types.TIMESTAMP)
                .addValue("periodEnd", query.periodEnd() == null ? null : Timestamp.from(query.periodEnd()), java.sql.Types.TIMESTAMP)
                .addValue("happeningIds", happeningIds);
        var rows = jdbc.query(SELECT_SQL + " WHERE o.publication_status = 'PUBLISHED' AND o.happening_id IN (:happeningIds) ORDER BY o.id", parameters, OCCURRENCE_MAPPER);
        var clippings = findClippings(rows.stream().map(OccurrenceRow::id).toList());
        return rows.stream().map(row -> row.toRecord(clippings.getOrDefault(row.id(), List.of()))).toList();
    }

    private Map<String, List<ClippingReference>> findClippings(List<String> occurrenceIds) {
        var sql = """
                SELECT
                    oc.occurrence_id,
                    c.id AS clipping_id,
                    c.title,
                    s.id AS source_id,
                    s.public_name AS source_name,
                    c.source_published_at,
                    c.collected_at,
                    c.reference
                FROM occurrence_clippings oc
                JOIN clippings c ON c.id = oc.clipping_id
                JOIN sources s ON s.id = c.source_id
                WHERE oc.occurrence_id IN (:occurrenceIds)
                ORDER BY c.source_published_at, c.id
                """;
        var parameters = new MapSqlParameterSource("occurrenceIds", occurrenceIds);
        var grouped = new HashMap<String, List<ClippingReference>>();
        for (var row : jdbc.query(sql, parameters, CLIPPING_MAPPER)) {
            grouped.computeIfAbsent(row.occurrenceId(), ignored -> new ArrayList<>()).add(row.reference());
        }
        return grouped;
    }

    private static void appendIn(
            StringBuilder sql,
            MapSqlParameterSource parameters,
            String column,
            String parameterName,
            List<String> values) {
        if (!values.isEmpty()) {
            sql.append(" AND ").append(column).append(" IN (:").append(parameterName).append(')');
            parameters.addValue(parameterName, values);
        }
    }

    private static Coordinates coordinates(ResultSet result) throws SQLException {
        var longitude = result.getObject("longitude", Double.class);
        var latitude = result.getObject("latitude", Double.class);
        return longitude == null || latitude == null ? null : new Coordinates(longitude, latitude);
    }

    private static Instant instant(ResultSet result, String name) throws SQLException {
        var timestamp = result.getTimestamp(name);
        return timestamp == null ? null : timestamp.toInstant();
    }

    private record OccurrenceRow(
            String id,
            String happeningId,
            String title,
            String description,
            OccurrenceCategory category,
            String type,
            String subtype,
            OccurrenceSituation situation,
            int reliability,
            String municipality,
            String neighborhood,
            LocationPrecision locationPrecision,
            Coordinates coordinates,
            Instant occurredAt,
            Instant occurredFrom,
            Instant occurredUntil,
            TemporalMatch temporalMatch) {
        OccurrenceRecord toRecord(List<ClippingReference> clippings) {
            return new OccurrenceRecord(
                    id,
                    happeningId,
                    title,
                    description,
                    category,
                    type,
                    subtype,
                    situation,
                    reliability,
                    municipality,
                    neighborhood,
                    locationPrecision,
                    coordinates,
                    occurredAt,
                    occurredFrom,
                    occurredUntil,
                    temporalMatch,
                    clippings);
        }
    }

    private record ClippingRow(String occurrenceId, ClippingReference reference) {}
}
