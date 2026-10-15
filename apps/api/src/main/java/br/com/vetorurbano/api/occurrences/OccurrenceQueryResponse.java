package br.com.vetorurbano.api.occurrences;

import java.time.Instant;
import java.util.List;

public record OccurrenceQueryResponse(
        Instant generatedAt,
        OccurrenceQueryCounts counts,
        List<OccurrenceView> items,
        List<OccurrenceView> relatedItems
) {
    public OccurrenceQueryResponse {
        items = List.copyOf(items);
        relatedItems = List.copyOf(relatedItems);
    }
}
