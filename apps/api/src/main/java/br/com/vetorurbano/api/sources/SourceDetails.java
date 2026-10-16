package br.com.vetorurbano.api.sources;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record SourceDetails(
        String id,
        String name,
        String channel,
        String url,
        List<String> territories,
        List<String> pillars,
        String accessMethod,
        UUID accessConfigurationRef,
        int rating,
        String ratingJustification,
        int version,
        UUID authorId,
        Instant createdAt) {}
