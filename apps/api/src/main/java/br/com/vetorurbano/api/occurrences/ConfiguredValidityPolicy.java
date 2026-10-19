package br.com.vetorurbano.api.occurrences;

import java.time.Duration;
import java.time.Instant;
import static br.com.vetorurbano.api.occurrences.ActiveReportQueryService.Validity;

/** Read-only configured policy. Configuration does not certify the factual evidence it references. */
public final class ConfiguredValidityPolicy implements ActiveReportQueryService.ValidityPolicy {
    private final ActiveReportConfiguration.Settings settings;
    public ConfiguredValidityPolicy(ActiveReportConfiguration.Settings settings) { this.settings = java.util.Objects.requireNonNull(settings); }
    @Override public boolean isCurrentlyValid(OccurrenceRecord effect, Instant evaluatedAt) {
        return assess(effect, evaluatedAt) == Validity.CONFIRMED;
    }
    @Override public Validity assess(OccurrenceRecord effect, Instant evaluatedAt) {
        if (effect.situation() != OccurrenceSituation.ONGOING) return Validity.NOT_APPLICABLE;
        var duration = settings.validityByType().get(effect.type());
        if (duration == null) return Validity.MISSING_CONFIGURATION;
        var evidence = settings.confirmations().get(effect.id());
        if (evidence == null || !effect.type().equals(evidence.type()) || evidence.confirmedAt() == null
                || evidence.reference() == null || evidence.reference().isBlank() || evidence.confirmedAt().isAfter(evaluatedAt))
            return Validity.MISSING_EVIDENCE;
        // Compare elapsed duration, avoiding overflow from adding an arbitrary configured duration.
        return Duration.between(evidence.confirmedAt(), evaluatedAt).compareTo(duration) < 0
                ? Validity.CONFIRMED : Validity.EXPIRED;
    }
}
