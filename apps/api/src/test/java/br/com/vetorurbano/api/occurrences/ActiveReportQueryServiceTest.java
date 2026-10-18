package br.com.vetorurbano.api.occurrences;

import static org.junit.jupiter.api.Assertions.*;
import java.time.*;
import org.junit.jupiter.api.Test;

class ActiveReportQueryServiceTest {
    @Test
    void rejectsMissingPolicyAndInvalidSpatialInputBeforeAccessingRepository() {
        var repository = new OccurrenceQueryRepository(null);
        var clock = Clock.fixed(Instant.parse("2026-10-17T12:00:00Z"), ZoneOffset.UTC);
        assertThrows(NullPointerException.class, () -> new ActiveReportQueryService(repository, clock, null));
        var service = new ActiveReportQueryService(repository, clock, (effect, at) -> false);
        assertThrows(InvalidQueryException.class, () -> service.find(null, 5000));
        assertThrows(IllegalArgumentException.class, () -> service.find(new Coordinates(Double.NaN, 0), 5000));
        assertThrows(IllegalArgumentException.class, () -> service.find(new Coordinates(0, Double.POSITIVE_INFINITY), 5000));
        assertThrows(IllegalArgumentException.class, () -> service.find(new Coordinates(181, 0), 5000));
        assertThrows(IllegalArgumentException.class, () -> service.find(new Coordinates(0, -91), 5000));
        for (var radius : new int[]{Integer.MIN_VALUE, -1, 0, 5001, Integer.MAX_VALUE}) {
            assertThrows(InvalidQueryException.class, () -> service.find(new Coordinates(0, 0), radius));
        }
    }
}
