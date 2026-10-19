package br.com.vetorurbano.api.occurrences;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

/** Independent read-only query core; never changes a stored situation. */
@org.springframework.stereotype.Service
public final class ActiveReportQueryService {
    /**
     * Integration port for an explicitly supplied validity policy and its evidence.
     * Implementations must return false for missing configuration/evidence. This port does not
     * define what constitutes confirmation or derive confirmation time from occurrence time.
     */
    @FunctionalInterface
    public interface ValidityPolicy {
        boolean isCurrentlyValid(OccurrenceRecord effect, Instant evaluatedAt);

        default Validity assess(OccurrenceRecord effect, Instant evaluatedAt) {
            return isCurrentlyValid(effect, evaluatedAt) ? Validity.CONFIRMED : Validity.NOT_CONFIRMED;
        }
    }

    public enum Validity { CONFIRMED, NOT_CONFIRMED, MISSING_CONFIGURATION, MISSING_EVIDENCE, EXPIRED, NOT_APPLICABLE }
    public record Entry(OccurrenceRecord occurrence, Validity validity) {}
    public record Snapshot(Instant evaluatedAt, List<Entry> items) {}

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
        return snapshot(center, radiusMeters).items().stream().map(Entry::occurrence).toList();
    }

    public Snapshot snapshot(Coordinates center, int radiusMeters) {
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
        var entries = repository.find(query).stream().map(effect -> new Entry(effect,
                effect.situation() == OccurrenceSituation.ONGOING ? assess(effect, now) : Validity.NOT_APPLICABLE))
                .filter(entry -> {
            var effect = entry.occurrence();
            boolean recent = effect.occurredAt() != null
                    ? !effect.occurredAt().isBefore(start) && effect.occurredAt().isBefore(now)
                    : effect.occurredFrom().isBefore(now) && effect.occurredUntil().isAfter(start);
            var beganAt = effect.occurredAt() != null ? effect.occurredAt() : effect.occurredFrom();
            return recent || (beganAt.isBefore(start) && entry.validity() == Validity.CONFIRMED);
        }).map(entry -> new Entry(withTemporalMatch(entry.occurrence(), start, now), entry.validity())).toList();
        return new Snapshot(now, entries);
    }

    public static final class PolicyUnavailableException extends RuntimeException {
        PolicyUnavailableException(RuntimeException cause) { super("Validity policy unavailable", cause); }
    }
    private Validity assess(OccurrenceRecord effect, Instant at) {
        try { return Objects.requireNonNull(validity.assess(effect, at)); }
        catch (RuntimeException failure) { throw new PolicyUnavailableException(failure); }
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
