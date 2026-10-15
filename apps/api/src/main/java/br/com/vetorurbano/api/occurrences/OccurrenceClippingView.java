package br.com.vetorurbano.api.occurrences;

import java.time.Instant;

public record OccurrenceClippingView(
        String id,
        String title,
        SourceReference source,
        Instant sourcePublishedAt,
        Instant collectedAt
) {}
