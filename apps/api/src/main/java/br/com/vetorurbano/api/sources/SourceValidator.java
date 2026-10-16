package br.com.vetorurbano.api.sources;

import java.net.URI;
import java.util.*;

final class SourceValidator {
    private static final Set<String> PILLARS = Set.of("TRANSITO", "SEGURANCA", "CONTINGENCIA");
    private static final Set<String> ACCESS_METHODS = Set.of("MANUAL", "PUBLIC_PAGE", "RSS", "PUBLIC_API", "OTHER");

    private SourceValidator() {}

    static SourceFields validate(SourceWriteRequest request) {
        if (request == null) throw invalid();
        String name = text(request.name(), 160);
        String channel = text(request.channel(), 160);
        String method = text(request.accessMethod(), 32);
        String justification = text(request.ratingJustification(), 2000);
        if (name == null || channel == null || method == null || justification == null) throw invalid();
        if (!ACCESS_METHODS.contains(method)) throw invalid();
        if (request.rating() == null || request.rating() < 1 || request.rating() > 5) throw invalid();
        return new SourceFields(name, channel, normalizeUrl(request.url()), normalizeTerritories(request.territories()),
                normalizePillars(request.pillars()), method, request.rating(), justification);
    }

    private static String text(String raw, int maximum) {
        if (raw == null) return null;
        String value = raw.strip();
        return value.isEmpty() || value.length() > maximum ? null : value;
    }

    private static String normalizeUrl(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String value = raw.strip();
        if (value.length() > 2048) throw invalid();
        try {
            URI uri = URI.create(value);
            String scheme = uri.getScheme();
            if (!uri.isAbsolute() || uri.getHost() == null || uri.getRawUserInfo() != null
                    || uri.getRawQuery() != null || uri.getRawFragment() != null
                    || !("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme))) throw invalid();
            return uri.toASCIIString();
        } catch (IllegalArgumentException failure) {
            throw invalid();
        }
    }

    private static List<String> normalizeTerritories(List<String> input) {
        if (input == null || input.isEmpty() || input.size() > 20) throw invalid();
        var result = new ArrayList<String>();
        for (var item : input) {
            String value = text(item, 120);
            if (value == null || result.stream().anyMatch(existing -> existing.equalsIgnoreCase(value))) throw invalid();
            result.add(value);
        }
        return List.copyOf(result);
    }

    private static List<String> normalizePillars(List<String> input) {
        if (input == null || input.isEmpty() || input.size() > PILLARS.size()) throw invalid();
        var result = new ArrayList<String>();
        for (var item : input) {
            if (!PILLARS.contains(item) || result.contains(item)) throw invalid();
            result.add(item);
        }
        return List.copyOf(result);
    }

    private static SourceFailure invalid() {
        return new SourceFailure(400, "INVALID_SOURCE", "Revise os campos obrigatórios da fonte.");
    }
}

record SourceFields(String name, String channel, String url, List<String> territories,
        List<String> pillars, String accessMethod, int rating, String justification) {}
