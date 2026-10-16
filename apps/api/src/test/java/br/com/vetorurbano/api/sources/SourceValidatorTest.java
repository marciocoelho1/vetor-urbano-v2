package br.com.vetorurbano.api.sources;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;

class SourceValidatorTest {
    @Test void acceptsAConcreteChannelAndOptionalPublicUrl() {
        var noUrl = SourceValidator.validate(request(null, List.of("Rio de Janeiro"), List.of("TRANSITO"), 3));
        assertNull(noUrl.url());
        assertEquals("Rio de Janeiro", noUrl.territories().getFirst());
        assertEquals("MANUAL", noUrl.accessMethod());

        var withUrl = SourceValidator.validate(request("https://example.test/canal", List.of("Baixada Fluminense"),
                List.of("CONTINGENCIA", "SEGURANCA"), 5));
        assertEquals("https://example.test/canal", withUrl.url());
        assertEquals(List.of("CONTINGENCIA", "SEGURANCA"), withUrl.pillars());
    }

    @Test void rejectsSecretsInPublicUrlsAndInvalidEvaluationOrCoverage() {
        assertInvalid(request("https://usuario:senha@example.test/canal", List.of("Rio"), List.of("TRANSITO"), 3));
        assertInvalid(request("https://example.test/canal?token=valor-sintetico", List.of("Rio"), List.of("TRANSITO"), 3));
        assertInvalid(request("file:///etc/passwd", List.of("Rio"), List.of("TRANSITO"), 3));
        assertInvalid(request(null, List.of("Rio", " rio "), List.of("TRANSITO"), 3));
        assertInvalid(request(null, List.of("Rio"), List.of("TRANSITO", "TRANSITO"), 3));
        assertInvalid(request(null, List.of("Rio"), List.of("OUTRO"), 3));
        assertInvalid(request(null, List.of("Rio"), List.of("TRANSITO"), 0));
        assertInvalid(new SourceWriteRequest("Nome", "", null, List.of("Rio"), List.of("TRANSITO"), "MANUAL", 3, "Justificativa", null));
    }

    private static SourceWriteRequest request(String url, List<String> territories, List<String> pillars, int rating) {
        return new SourceWriteRequest("Fonte sintética", "Canal concreto", url, territories, pillars,
                "MANUAL", rating, "Justificativa sintética da avaliação.", null);
    }

    private static void assertInvalid(SourceWriteRequest request) {
        var error = assertThrows(SourceFailure.class, () -> SourceValidator.validate(request));
        assertEquals("INVALID_SOURCE", error.code());
    }
}
