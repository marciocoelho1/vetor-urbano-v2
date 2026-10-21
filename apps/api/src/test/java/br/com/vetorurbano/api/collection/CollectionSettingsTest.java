package br.com.vetorurbano.api.collection;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class CollectionSettingsTest {
    @Test
    void rejectsConfiguredWindowBeforeApprovedStart() {
        assertThrows(IllegalArgumentException.class, () -> settings(LocalDate.of(2026, 5, 31)));
    }

    @Test
    void acceptsApprovedStartAndNarrowerWindow() {
        assertDoesNotThrow(() -> settings(LocalDate.of(2026, 6, 1)));
        assertDoesNotThrow(() -> settings(LocalDate.of(2026, 6, 2)));
    }

    private static CollectionSettings settings(LocalDate windowStart) {
        return new CollectionSettings(
                false,
                CollectionSettings.DEFAULT_BASE_URL,
                CollectionSettings.DEFAULT_SOURCE_ID,
                null,
                60,
                windowStart,
                100,
                20,
                CollectionSettings.DEFAULT_USER_AGENT);
    }
}
