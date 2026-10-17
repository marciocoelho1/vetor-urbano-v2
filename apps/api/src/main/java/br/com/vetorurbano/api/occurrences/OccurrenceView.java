package br.com.vetorurbano.api.occurrences;

import java.util.List;

public record OccurrenceView(
        String id,
        String happeningId,
        String title,
        String description,
        OccurrenceCategory category,
        String type,
        String subtype,
        OccurrenceSituation situation,
        int reliability,
        String municipality,
        String neighborhood,
        LocationPrecision locationPrecision,
        List<Double> coordinates,
        TemporalMatch temporalMatch,
        TemporalFactView temporal,
        List<OccurrenceClippingView> clippings
) {
    public OccurrenceView {
        coordinates = coordinates == null ? null : List.copyOf(coordinates);
        clippings = List.copyOf(clippings);
    }

    public static OccurrenceView from(OccurrenceRecord record) {
        var temporal = new TemporalFactView(
                record.occurredAt(),
                record.occurredFrom(),
                record.occurredUntil());
        var coordinates = record.coordinates() == null
                ? null
                : List.of(record.coordinates().longitude(), record.coordinates().latitude());
        var clippings = record.clippings().stream()
                .map(clipping -> new OccurrenceClippingView(
                        clipping.id(),
                        clipping.title(),
                        clipping.source(),
                        clipping.sourcePublishedAt(),
                        clipping.collectedAt(), clipping.reference()))
                .toList();

        return new OccurrenceView(
                record.id(),
                record.happeningId(),
                record.title(),
                record.description(),
                record.category(),
                record.type(),
                record.subtype(),
                record.situation(),
                record.reliability(),
                record.municipality(),
                record.neighborhood(),
                record.locationPrecision(),
                coordinates,
                record.temporalMatch(),
                temporal,
                clippings);
    }
}
