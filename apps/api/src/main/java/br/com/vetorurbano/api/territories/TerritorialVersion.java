package br.com.vetorurbano.api.territories;

import java.time.LocalDate;

/** Snapshot details: null means unavailable, never inferred from registration time. */
public record TerritorialVersion(
        String name,
        String indicatedGroup,
        String sourceId,
        String evidenceReference,
        LocalDate referenceDate,
        String limitations,
        String boundaryEwkt) {
}
