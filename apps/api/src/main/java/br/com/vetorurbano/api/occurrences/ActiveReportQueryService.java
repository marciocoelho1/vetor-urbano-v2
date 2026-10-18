package br.com.vetorurbano.api.occurrences;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

/** Independent read-only query core. Not registered as an HTTP or production Spring service. */
public final class ActiveReportQueryService {
    /**
     * Integration port for an explicitly supplied validity policy and its evidence.
     * Implementations must return false for missing configuration/evidence. This port does not
     * define what constitutes confirmation or derive confirmation time from occurrence time.
     */
    @FunctionalInterface
    public interface ValidityPolicy {
        boolean isCurrentlyValid(OccurrenceRecord effect, Instant evaluatedAt);
    }

    private final OccurrenceQueryRepository repository;
    private final Clock clock;
    private final ValidityPolicy validity;

    public ActiveReportQueryService(OccurrenceQueryRepository repository, Clock clock, ValidityPolicy validity) {
        this.repository = Objects.requireNonNull(repository);
        this.clock = Objects.requireNonNull(clock);
        this.validity = Objects.requireNonNull(validity);
    }

    /** Returns original published records, not a recalculated situation or persisted transition. */
    public List<OccurrenceRecord> find(Coordinates center, int radiusMeters) {
        if (center == null || !Double.isFinite(center.longitude()) || !Double.isFinite(center.latitude())
                || Math.abs(center.longitude()) > 180 || Math.abs(center.latitude()) > 90
                || radiusMeters <= 0 || radiusMeters > 5000) {
            throw new InvalidQueryException("Centro explícito e raio entre 1 e 5000 metros são obrigatórios.");
        }
        var now = clock.instant();
        var start = now.minus(Duration.ofHours(24));
        // No report/history filters, time restriction or related-effects expansion is inherited.
        var query = new OccurrenceQuery(null, null, List.of(), false, List.of(), List.of(),
                List.of(), List.of(), List.of(), null, null, null, List.of(), center, radiusMeters,
                null, null, List.of());
        return repository.find(query).stream().filter(effect -> {
            boolean recent = effect.occurredAt() != null
                    ? !effect.occurredAt().isBefore(start) && effect.occurredAt().isBefore(now)
                    : effect.occurredFrom().isBefore(now) && effect.occurredUntil().isAfter(start);
            var beganAt = effect.occurredAt() != null ? effect.occurredAt() : effect.occurredFrom();
            return recent || (beganAt.isBefore(start) && effect.situation() == OccurrenceSituation.ONGOING
                    && validity.isCurrentlyValid(effect, now));
        }).map(effect -> withTemporalMatch(effect, start, now)).toList();
    }

    private static OccurrenceRecord withTemporalMatch(OccurrenceRecord effect, Instant start, Instant end) {
        TemporalMatch match;
        if (effect.occurredAt() != null) {
            match = !effect.occurredAt().isBefore(start) && effect.occurredAt().isBefore(end)
                    ? TemporalMatch.CERTAIN : TemporalMatch.OUTSIDE;
        } else if (!effect.occurredFrom().isBefore(start) && !effect.occurredUntil().isAfter(end)) {
            match = TemporalMatch.CERTAIN;
        } else {
            match = effect.occurredFrom().isBefore(end) && effect.occurredUntil().isAfter(start)
                    ? TemporalMatch.POSSIBLE : TemporalMatch.OUTSIDE;
        }
        return new OccurrenceRecord(effect.id(), effect.happeningId(), effect.title(), effect.description(),
                effect.category(), effect.type(), effect.subtype(), effect.situation(), effect.reliability(),
                effect.municipality(), effect.neighborhood(), effect.locationPrecision(), effect.coordinates(),
                effect.occurredAt(), effect.occurredFrom(), effect.occurredUntil(), match, effect.clippings());
    }
}
