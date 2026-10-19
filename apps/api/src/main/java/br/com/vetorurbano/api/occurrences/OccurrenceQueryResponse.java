package br.com.vetorurbano.api.occurrences;

import java.time.Instant;
import java.util.List;

public record OccurrenceQueryResponse(
        Instant generatedAt,
        OccurrenceQueryCounts counts,
        List<OccurrenceView> items,
        List<OccurrenceView> relatedItems,
        String revision
) {
    public OccurrenceQueryResponse(Instant generatedAt, OccurrenceQueryCounts counts,
            List<OccurrenceView> items, List<OccurrenceView> relatedItems) {
        this(generatedAt, counts, items, relatedItems, revisionOf(counts, items, relatedItems));
    }

    // Hash the complete public projection, never the query instant or internal publication metadata.
    // Checking saves HTTP transport, not SQL/projection cost: it deliberately performs the same read.
    private static String revisionOf(OccurrenceQueryCounts counts, List<OccurrenceView> items,
            List<OccurrenceView> relatedItems) {
        var order = java.util.Comparator.comparing(OccurrenceView::id);
        var projection = List.of(counts, items.stream().sorted(order).toList(),
                relatedItems.stream().sorted(order).toList());
        try {
            var bytes = tools.jackson.databind.json.JsonMapper.builder().build().writeValueAsBytes(projection);
            return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }

    public OccurrenceQueryResponse {
        items = List.copyOf(items);
        relatedItems = List.copyOf(relatedItems);
    }
}
