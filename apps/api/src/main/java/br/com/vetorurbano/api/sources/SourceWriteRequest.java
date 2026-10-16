package br.com.vetorurbano.api.sources;

import java.util.List;

public record SourceWriteRequest(
        String name,
        String channel,
        String url,
        List<String> territories,
        List<String> pillars,
        String accessMethod,
        Integer rating,
        String ratingJustification,
        Integer expectedVersion) {}
