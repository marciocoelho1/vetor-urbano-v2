package br.com.vetorurbano.api.occurrences;

import br.com.vetorurbano.api.auth.AuthService;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PdfExportService {
    private final NamedParameterJdbcTemplate jdbc;
    private final org.springframework.beans.factory.ObjectProvider<AuthService> auth;

    public PdfExportService(NamedParameterJdbcTemplate jdbc, org.springframework.beans.factory.ObjectProvider<AuthService> auth) {
        this.jdbc = jdbc;
        this.auth = auth;
    }

    /**
     * This authorizes the supplied IDs, not arbitrary browser PDF bytes or a signed snapshot.
     * SHARE locks conflict with the publication UPDATE and remain held through the audit commit.
     * READ COMMITTED rechecks a row after waiting for a concurrent withdrawal to commit.
     */
    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public void record(UUID account, OccurrenceQuery query, ReportQueryController.PdfExportRequest body) {
        List<String> ids = body.snapshotOccurrenceIds();
        if ("SUCCEEDED".equals(body.outcome())) {
            if (ids == null || ids.size() < body.counts().occurrences()
                    || ids.stream().anyMatch(id -> id == null || id.isBlank() || id.length() > 200)
                    || ids.stream().distinct().count() != ids.size()
                    || (body.counts().occurrences() == 0 && !ids.isEmpty()))
                throw new InvalidQueryException("Identificadores do snapshot PDF inválidos.");
            if (!ids.isEmpty()) {
                var statuses = jdbc.queryForList(
                        "SELECT publication_status FROM occurrences WHERE id IN (:ids) ORDER BY id FOR SHARE",
                        java.util.Map.of("ids", ids), String.class);
                if (statuses.size() != ids.size() || statuses.stream().anyMatch(status -> !"PUBLISHED".equals(status)))
                    throw new SnapshotUnavailableException();
            }
        }
        auth.getObject().auditPdfExport(account, query, body.counts(), body.generatedAt(), body.outcome());
    }

    public static class SnapshotUnavailableException extends RuntimeException {}
}
