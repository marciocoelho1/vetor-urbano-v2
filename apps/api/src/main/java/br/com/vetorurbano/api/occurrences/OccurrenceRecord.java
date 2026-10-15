package br.com.vetorurbano.api.occurrences;

import java.time.Instant;
import java.util.List;

public record OccurrenceRecord(
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
        Coordinates coordinates,
        Instant occurredAt,
        Instant occurredFrom,
        Instant occurredUntil,
        TemporalMatch temporalMatch,
        List<ClippingReference> clippings
) {
    public OccurrenceRecord {
        if (id == null || id.isBlank() || happeningId == null || happeningId.isBlank()) {
            throw new IllegalArgumentException("An occurrence needs stable occurrence and happening ids.");
        }
        if (title == null || title.isBlank() || description == null) {
            throw new IllegalArgumentException("An occurrence needs a title and public description.");
        }
        if (category == null || type == null || type.isBlank() || subtype == null || subtype.isBlank()) {
            throw new IllegalArgumentException("An occurrence needs its public classification.");
        }
        if (situation == null || reliability < 1 || reliability > 5) {
            throw new IllegalArgumentException("Situation and public reliability must be valid.");
        }
        if (municipality == null || municipality.isBlank() || neighborhood == null || neighborhood.isBlank()) {
            throw new IllegalArgumentException("An occurrence needs a known synthetic territory.");
        }
        if (locationPrecision == null) {
            throw new IllegalArgumentException("Location precision must be explicit.");
        }
        if (locationPrecision == LocationPrecision.POINT && coordinates == null) {
            throw new IllegalArgumentException("Point precision requires coordinates.");
        }
        if (locationPrecision == LocationPrecision.TERRITORY && coordinates != null) {
            throw new IllegalArgumentException("Territory-only precision cannot have coordinates.");
        }
        boolean exact = occurredAt != null && occurredFrom == null && occurredUntil == null;
        boolean interval = occurredAt == null
                && occurredFrom != null
                && occurredUntil != null
                && occurredFrom.isBefore(occurredUntil);
        if (!exact && !interval) {
            throw new IllegalArgumentException("An occurrence needs one exact instant or a valid interval.");
        }
        if (temporalMatch == null) {
            throw new IllegalArgumentException("Temporal inclusion must distinguish certain and possible matches.");
        }
        clippings = List.copyOf(clippings == null ? List.of() : clippings);
    }
}
