package br.com.vetorurbano.api.occurrences;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class OccurrenceRecordTest {
    private static final Instant OCCURRED_AT = Instant.parse("2026-10-15T09:00:00Z");

    @Test
    void territoryOnlyRecordKeepsCoordinatesAbsent() {
        assertDoesNotThrow(() -> record(
                LocationPrecision.TERRITORY,
                null,
                OCCURRED_AT,
                null,
                null));
    }

    @Test
    void territoryOnlyRecordCannotInventPointCoordinates() {
        assertThrows(IllegalArgumentException.class, () -> record(
                LocationPrecision.TERRITORY,
                new Coordinates(-43.2, -22.9),
                OCCURRED_AT,
                null,
                null));
    }

    @Test
    void intervalMustHaveExclusiveIncreasingBoundsAndNoExactInstant() {
        assertDoesNotThrow(() -> record(
                LocationPrecision.POINT,
                new Coordinates(-43.2, -22.9),
                null,
                OCCURRED_AT,
                OCCURRED_AT.plusSeconds(3600)));

        assertThrows(IllegalArgumentException.class, () -> record(
                LocationPrecision.POINT,
                new Coordinates(-43.2, -22.9),
                null,
                OCCURRED_AT.plusSeconds(3600),
                OCCURRED_AT));

        assertThrows(IllegalArgumentException.class, () -> record(
                LocationPrecision.POINT,
                new Coordinates(-43.2, -22.9),
                OCCURRED_AT,
                OCCURRED_AT,
                OCCURRED_AT.plusSeconds(3600)));
    }

    @Test
    void coordinatesUseFiniteWgs84LongitudeLatitude() {
        assertDoesNotThrow(() -> new Coordinates(-43.2, -22.9));
        assertThrows(IllegalArgumentException.class, () -> new Coordinates(181, -22.9));
        assertThrows(IllegalArgumentException.class, () -> new Coordinates(-43.2, Double.NaN));
    }

    private static OccurrenceRecord record(
            LocationPrecision precision,
            Coordinates coordinates,
            Instant occurredAt,
            Instant occurredFrom,
            Instant occurredUntil) {
        return new OccurrenceRecord(
                "occurrence-1",
                "happening-1",
                "Título sintético",
                "Descrição pública sintética.",
                OccurrenceCategory.TRANSITO,
                "ACIDENTE",
                "COLISAO",
                OccurrenceSituation.UNKNOWN,
                3,
                "Rio de Janeiro",
                "Centro",
                precision,
                coordinates,
                occurredAt,
                occurredFrom,
                occurredUntil,
                TemporalMatch.CERTAIN,
                List.of());
    }
}
