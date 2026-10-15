package br.com.vetorurbano.api.occurrences;

public record OccurrenceQueryCounts(
        long occurrences,
        long happenings,
        long mappedOccurrences,
        long listOnlyOccurrences,
        long temporallyCertain,
        long temporallyPossible
) {}
