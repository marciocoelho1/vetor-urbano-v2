package br.com.vetorurbano.api.occurrences;

import java.time.Instant;
import org.springframework.jdbc.core.JdbcTemplate;
import static br.com.vetorurbano.api.occurrences.ActiveReportQueryService.Validity;

/** Read only: only human evidence tied to the current revision can extend membership. */
public final class PersistedValidityPolicy implements ActiveReportQueryService.ValidityPolicy {
    private final JdbcTemplate jdbc;
    public PersistedValidityPolicy(JdbcTemplate jdbc){this.jdbc=jdbc;}
    @Override public boolean isCurrentlyValid(OccurrenceRecord effect,Instant at){return assess(effect,at)==Validity.CONFIRMED;}
    @Override public Validity assess(OccurrenceRecord effect,Instant at) {
        if(effect.situation()!=OccurrenceSituation.ONGOING)return Validity.NOT_APPLICABLE;
        if(OccurrenceVerificationService.duration(effect.type())==null)
            return OccurrenceVerificationService.NO_APPROVED_EXTENSION.contains(effect.type())
                ? Validity.NO_APPROVED_EXTENSION : Validity.MISSING_CONFIGURATION;
        var rows=jdbc.queryForList("""
            SELECT v.confirmed_at,v.expires_at,v.effect_version,o.revision FROM occurrences o
            JOIN LATERAL (SELECT * FROM occurrence_verifications WHERE occurrence_id=o.id ORDER BY verification_version DESC LIMIT 1) v ON true
            WHERE o.id=?
            """,effect.id());
        if(rows.isEmpty())return Validity.MISSING_EVIDENCE;
        var row=rows.getFirst();
        if(!row.get("effect_version").equals(row.get("revision"))||((java.sql.Timestamp)row.get("confirmed_at")).toInstant().isAfter(at))return Validity.MISSING_EVIDENCE;
        var expiry=(java.sql.Timestamp)row.get("expires_at");
        return expiry!=null&&at.isBefore(expiry.toInstant())?Validity.CONFIRMED:Validity.EXPIRED;
    }
}
