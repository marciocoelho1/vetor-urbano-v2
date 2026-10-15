package br.com.vetorurbano.api.occurrences;

import java.time.Instant;

public record TemporalFactView(Instant occurredAt, Instant occurredFrom, Instant occurredUntil) {}
