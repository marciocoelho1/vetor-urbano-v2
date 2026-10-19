package br.com.vetorurbano.api.occurrences;

import static org.junit.jupiter.api.Assertions.*;
import static br.com.vetorurbano.api.occurrences.ActiveReportQueryService.Validity.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class ConfiguredValidityPolicyTest {
    static final Instant NOW = Instant.parse("2026-10-15T18:00:00Z");
    static final OccurrenceRecord EFFECT = new OccurrenceRecord("synthetic-25", "synthetic-happening-25", "Sintético", "Teste",
            OccurrenceCategory.TRANSITO, "ACIDENTE", "COLISAO", OccurrenceSituation.ONGOING, 3,
            "Rio de Janeiro", "Centro", LocationPrecision.POINT, new Coordinates(-43.1915,-22.9033),
            NOW.minusSeconds(3600), null, null, TemporalMatch.CERTAIN, List.of());
    ConfiguredValidityPolicy policy(Map<String,Duration> durations, ActiveReportConfiguration.Confirmation evidence) {
        return new ConfiguredValidityPolicy(new ActiveReportConfiguration.Settings(durations, evidence == null ? Map.of() : Map.of(EFFECT.id(), evidence)));
    }
    @Test void deniesMissingConfigurationAndMissingIncompleteFutureOrWrongTypeEvidence() {
        var durations=Map.of("ACIDENTE",Duration.ofSeconds(60)); // synthetic, not product policy
        assertEquals(MISSING_CONFIGURATION,policy(Map.of(),new ActiveReportConfiguration.Confirmation("ACIDENTE",NOW,"synthetic-ref")).assess(EFFECT,NOW));
        assertEquals(MISSING_EVIDENCE,policy(durations,null).assess(EFFECT,NOW));
        for(var evidence:List.of(new ActiveReportConfiguration.Confirmation("ACIDENTE",null,"ref"),
                new ActiveReportConfiguration.Confirmation("ACIDENTE",NOW," "),
                new ActiveReportConfiguration.Confirmation("ACIDENTE",NOW.plusSeconds(1),"ref"),
                new ActiveReportConfiguration.Confirmation("OUTRO",NOW,"ref"))) {
            assertEquals(MISSING_EVIDENCE,policy(durations,evidence).assess(EFFECT,NOW));
            assertFalse(policy(durations,evidence).isCurrentlyValid(EFFECT,NOW));
        }
    }
    @Test void syntheticValidityEndsExclusivelyAtExpiryAndNeverUsesTheFactTimestamp() {
        var policy=policy(Map.of("ACIDENTE",Duration.ofSeconds(60)),new ActiveReportConfiguration.Confirmation("ACIDENTE",NOW,"synthetic-ref"));
        assertEquals(CONFIRMED,policy.assess(EFFECT,NOW.plusSeconds(59)));
        assertEquals(EXPIRED,policy.assess(EFFECT,NOW.plusSeconds(60)));
        assertFalse(policy.isCurrentlyValid(EFFECT,NOW.plusSeconds(60)));
        assertEquals(OccurrenceSituation.ONGOING,EFFECT.situation());
    }
    @Test void invalidConfiguredDurationsAreRejectedRatherThanMadeInfinite() {
        for(var duration:List.of(Duration.ZERO,Duration.ofSeconds(-1)))
            assertThrows(IllegalArgumentException.class,()->new ActiveReportConfiguration.Settings(Map.of("ACIDENTE",duration),Map.of()));
    }
}
