package br.com.vetorurbano.api.occurrences;

import java.time.Instant;

public record ClippingReference(
        String id,
        String title,
        SourceReference source,
        Instant sourcePublishedAt,
        Instant collectedAt,
        String reference
) {
    public ClippingReference {
        if (id == null || id.isBlank() || title == null || title.isBlank() || source == null) {
            throw new IllegalArgumentException("A clipping needs public identity and source fields.");
        }
        if (sourcePublishedAt == null || collectedAt == null) {
            throw new IllegalArgumentException("A clipping needs source and collection timestamps.");
        }
    }
}
