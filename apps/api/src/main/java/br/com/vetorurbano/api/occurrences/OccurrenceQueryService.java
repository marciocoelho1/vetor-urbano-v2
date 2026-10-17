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

    public OccurrenceQueryService(OccurrenceQueryRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public OccurrenceQueryResponse find(OccurrenceQuery query) {
        return toResponse(query, repository.find(query));
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public OccurrenceQueryResponse findHistory(OccurrenceQuery query) {
        return toResponse(query, repository.findHistory(query));
    }

    private OccurrenceQueryResponse toResponse(OccurrenceQuery query, List<OccurrenceRecord> records) {
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
        var items = records.stream().map(OccurrenceView::from).toList();
        var matchedIds = new HashSet<>(records.stream().map(OccurrenceRecord::id).toList());
        var related = repository.findPublishedRelated(query, List.copyOf(uniqueHappenings)).stream()
                .filter(record -> !matchedIds.contains(record.id()))
                .map(OccurrenceView::from).toList();
        return new OccurrenceQueryResponse(Instant.now(), counts, items, related);
    }
}
