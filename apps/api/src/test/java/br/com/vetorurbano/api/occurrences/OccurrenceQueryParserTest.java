package br.com.vetorurbano.api.occurrences;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.util.LinkedMultiValueMap;

class OccurrenceQueryParserTest {
    private static final String START = "2026-10-15T12:00:00-03:00";
    private static final String END = "2026-10-15T13:00:00-03:00";
    private final OccurrenceQueryParser parser = new OccurrenceQueryParser();

    @Test
    void parsesOffsetDateTimesAndRepeatedFiltersAsAlternatives() {
        var parameters = baseQuery();
        parameters.add("category", "TRANSITO");
        parameters.add("category", "CONTINGENCIA");

        var query = parser.parse(parameters);

        assertEquals(Instant.parse("2026-10-15T15:00:00Z"), query.periodStart());
        assertEquals(Instant.parse("2026-10-15T16:00:00Z"), query.periodEnd());
        assertEquals(2, query.categories().size());
        assertNull(query.center());
    }

    @Test
    void requiresExplicitTimezoneAndIncreasingHalfOpenInterval() {
        var withoutTimezone = baseQuery();
        withoutTimezone.set("periodStart", "2026-10-15T12:00:00");
        assertThrows(InvalidQueryException.class, () -> parser.parse(withoutTimezone));

        var reversed = baseQuery();
        reversed.set("periodStart", END);
        assertThrows(InvalidQueryException.class, () -> parser.parse(reversed));
    }

    @Test
    void validatesReliabilityCoordinatesAndRadiusTogether() {
        var invalidScores = baseQuery();
        invalidScores.set("minReliability", "5");
        invalidScores.set("maxReliability", "2");
        assertThrows(InvalidQueryException.class, () -> parser.parse(invalidScores));

        var radiusWithoutPoint = baseQuery();
        radiusWithoutPoint.set("radiusMeters", "1000");
        assertThrows(InvalidQueryException.class, () -> parser.parse(radiusWithoutPoint));

        var validRadius = baseQuery();
        validRadius.set("longitude", "-43.1915");
        validRadius.set("latitude", "-22.9033");
        validRadius.set("radiusMeters", "1000");
        assertEquals(1000, parser.parse(validRadius).radiusMeters());

        validRadius.set("latitude", "91");
        assertThrows(InvalidQueryException.class, () -> parser.parse(validRadius));
    }

    @Test
    void rejectsUnknownAndRepeatedScalarParameters() {
        var unknown = baseQuery();
        unknown.add("page", "1");
        assertThrows(InvalidQueryException.class, () -> parser.parse(unknown));

        var repeatedStart = baseQuery();
        repeatedStart.add("periodStart", START);
        assertThrows(InvalidQueryException.class, () -> parser.parse(repeatedStart));
    }

    @Test
    void distinguishesExplicitlyEmptyCategorySelectionFromAllCategories() {
        var none = baseQuery();
        none.add("categorySelection", "NONE");
        var noCategories = parser.parse(none);

        assertTrue(noCategories.noCategoriesSelected());
        assertTrue(noCategories.categories().isEmpty());
        assertFalse(parser.parse(baseQuery()).noCategoriesSelected());

        var contradictory = baseQuery();
        contradictory.add("categorySelection", "NONE");
        contradictory.add("category", "TRANSITO");
        assertThrows(InvalidQueryException.class, () -> parser.parse(contradictory));
    }

    private static LinkedMultiValueMap<String, String> baseQuery() {
        var parameters = new LinkedMultiValueMap<String, String>();
        parameters.add("periodStart", START);
        parameters.add("periodEnd", END);
        return parameters;
    }
}
