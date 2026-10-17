package br.com.vetorurbano.api.occurrences;

import java.time.Instant;
import java.util.List;

public record OccurrenceQuery(
        Instant periodStart,
        Instant periodEnd,
        List<String> categories,
        boolean noCategoriesSelected,
        List<String> types,
        List<String> subtypes,
        List<String> municipalities,
        List<String> neighborhoods,
        List<String> sourceIds,
        String text,
        Integer minReliability,
        Integer maxReliability,
        List<String> situations,
        Coordinates center,
        Integer radiusMeters,
        String timeStart,
        String timeEnd,
        List<Double> bounds
) {
    public OccurrenceQuery {
        categories = List.copyOf(categories);
        types = List.copyOf(types);
        subtypes = List.copyOf(subtypes);
        municipalities = List.copyOf(municipalities);
        neighborhoods = List.copyOf(neighborhoods);
        sourceIds = List.copyOf(sourceIds);
        situations = List.copyOf(situations);
        bounds = List.copyOf(bounds);
    }
}
