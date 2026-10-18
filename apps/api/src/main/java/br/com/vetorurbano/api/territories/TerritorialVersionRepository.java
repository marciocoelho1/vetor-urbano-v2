package br.com.vetorurbano.api.territories;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Inactive persistence prototype: deliberately not a Spring bean or HTTP write boundary.
 * Schema exists only in test resources until authorship/closure and rollout are integrated.
 * A version is a historical snapshot, NOT a candidate or a publication decision.
 */
public final class TerritorialVersionRepository {
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;

    public TerritorialVersionRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        this.transaction = new TransactionTemplate(new DataSourceTransactionManager(
                Objects.requireNonNull(jdbc.getDataSource())));
    }

    public void append(UUID territoryId, int expectedVersion, TerritorialVersion details) {
        Objects.requireNonNull(territoryId);
        Objects.requireNonNull(details);
        if (expectedVersion < 0) throw new IllegalArgumentException("Negative version");
        transaction.executeWithoutResult(status -> {
            jdbc.update("INSERT INTO territorial_identities(id) VALUES (?) ON CONFLICT DO NOTHING", territoryId);
            int revision = jdbc.queryForObject(
                    "SELECT revision FROM territorial_identities WHERE id = ? FOR UPDATE", Integer.class, territoryId);
            if (revision != expectedVersion) {
                throw new OptimisticLockingFailureException("Territorial version changed");
            }
            jdbc.update("""
                    INSERT INTO territorial_versions
                    (territory_id, version, name, indicated_group, source_id, evidence_reference,
                     reference_date, limitations, boundary)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ST_GeomFromEWKT(?))
                    """, territoryId, revision + 1, details.name(), details.indicatedGroup(),
                    details.sourceId(), details.evidenceReference(), details.referenceDate(),
                    details.limitations(), details.boundaryEwkt());
            jdbc.update("UPDATE territorial_identities SET revision = ? WHERE id = ?", revision + 1, territoryId);
        });
    }

    public List<Snapshot> history(UUID territoryId) {
        return jdbc.query("""
                SELECT *, ST_AsEWKT(boundary) AS boundary_ewkt
                FROM territorial_versions WHERE territory_id = ? ORDER BY version
                """, (row, index) -> new Snapshot(row.getObject("territory_id", UUID.class),
                row.getInt("version"), row.getTimestamp("recorded_at").toInstant(),
                new TerritorialVersion(row.getString("name"), row.getString("indicated_group"),
                        row.getString("source_id"), row.getString("evidence_reference"),
                        row.getObject("reference_date", LocalDate.class), row.getString("limitations"),
                        row.getString("boundary_ewkt"))), territoryId);
    }

    public record Snapshot(UUID territoryId, int version, Instant recordedAt, TerritorialVersion details) {}
}
