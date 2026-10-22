package br.com.vetorurbano.api.occurrences;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;

@Service
public class OccurrenceQueryService {
    private final OccurrenceQueryRepository repository;

    private final java.time.Clock clock;
    private final ActiveReportQueryService.ValidityPolicy validity;
    private final OccurrenceVerificationService verifications;
    public OccurrenceQueryService(OccurrenceQueryRepository repository,java.time.Clock clock,ActiveReportQueryService.ValidityPolicy validity,OccurrenceVerificationService verifications) {
        this.repository=repository;this.clock=clock;this.validity=validity;this.verifications=verifications;
    }
    private OccurrenceSituation effective(OccurrenceRecord record,Instant at) {
        try {
            return record.situation()==OccurrenceSituation.ONGOING && !validity.isCurrentlyValid(record,at)?OccurrenceSituation.UNKNOWN:record.situation();
        } catch (RuntimeException failure) {
            throw new ActiveReportQueryService.PolicyUnavailableException(failure);
        }
    }
    private OccurrenceView view(OccurrenceRecord record,Instant at) {
        return OccurrenceView.from(record,effective(record,at),verifications.summary(record.id()));
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public OccurrenceQueryResponse find(OccurrenceQuery query) {
        return toResponse(query, repository.find(query.withoutSituations()));
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public OccurrenceQueryResponse findHistory(OccurrenceQuery query) {
        return toResponse(query, repository.findHistory(query.withoutSituations()));
    }

    /** Single-record read; a record withdrawn after review answers only with its unavailability. */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public java.util.Map<String,Object> findOne(String id) {
        var rows = repository.findAny(id);
        if (rows.isEmpty()) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.NOT_FOUND, "Ocorrência indisponível.");
        }
        var row = rows.getFirst();
        if (row.record() == null) {
            return OccurrenceLookup.unavailable(id, row.withdrawnAt());
        }
        var result=OccurrenceLookup.published(row.record());
        result.put("occurrence",view(row.record(),clock.instant()));return result;
    }
    private OccurrenceQueryResponse toResponse(OccurrenceQuery query, List<OccurrenceRecord> records) {
        var at=clock.instant();
        records=records.stream().filter(record->query.situations().isEmpty()||query.situations().contains(effective(record,at).name())).toList();
        var uniqueHappenings = new HashSet<String>();
        long mapped = 0;
        long certain = 0;
        long possible = 0;

        for (var record : records) {
            uniqueHappenings.add(record.happeningId());
            if (record.locationPrecision() == LocationPrecision.POINT && record.coordinates() != null) {
                mapped++;
            }
            if (record.temporalMatch() == TemporalMatch.CERTAIN) {
                certain++;
            } else {
                possible++;
            }
        }

        var counts = new OccurrenceQueryCounts(
                records.size(),
                uniqueHappenings.size(),
                mapped,
                records.size() - mapped,
                certain,
                possible);
        var items = records.stream().map(record->view(record,at)).toList();
        var matchedIds = new HashSet<>(records.stream().map(OccurrenceRecord::id).toList());
        var related = repository.findPublishedRelated(query, List.copyOf(uniqueHappenings)).stream()
                .filter(record -> !matchedIds.contains(record.id()))
                .map(record->view(record,at)).toList();
        var sourceIds = new java.util.LinkedHashSet<String>();
        for (var item : items) item.clippings().forEach(clipping -> sourceIds.add(clipping.source().id()));
        for (var item : related) item.clippings().forEach(clipping -> sourceIds.add(clipping.source().id()));
        var attribution = repository.attributions(List.copyOf(sourceIds));
        return new OccurrenceQueryResponse(at, counts, items, related, attribution);
    }
}
