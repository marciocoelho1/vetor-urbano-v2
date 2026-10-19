package br.com.vetorurbano.api.collection;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;

/** Recorte legal vigente da Região Metropolitana e cruzamento com os nomes da fonte. */
class MetropolitanMunicipalitiesTest {
    private final MetropolitanMunicipalities municipalities = MetropolitanMunicipalities.current();

    @Test
    void holdsTheCurrentLegalCompositionWithItsSource() {
        assertEquals(22, municipalities.municipalities().size());
        assertTrue(municipalities.municipalities().contains("Rio de Janeiro"));
        assertTrue(municipalities.municipalities().contains("Petrópolis"));
        assertTrue(municipalities.municipalities().contains("Cachoeiras de Macacu"));
        assertTrue(municipalities.municipalities().contains("Mesquita"));
        assertTrue(municipalities.municipalities().contains("Rio Bonito"));
        assertTrue(municipalities.legalSource().contains("Lei Complementar 184/2018"));
        assertEquals("2026-10-19", municipalities.recordedAt());
        assertFalse(municipalities.limitations().isBlank());
    }

    @Test
    void comparesSourceNamesNormalisingCaseAndAccents() {
        var crossCheck = municipalities.crossCheck(List.of("MAGÉ", "ITABORAI", "RIO DE JANEIRO"));

        assertTrue(crossCheck.missing().contains("Magé") == false);
        assertEquals(3, crossCheck.observed());
        assertEquals(22, crossCheck.configured());
        assertTrue(crossCheck.missing().contains("Petrópolis"));
        assertTrue(crossCheck.missing().contains("Rio Bonito"));
        assertFalse(crossCheck.missing().contains("Magé"));
        assertFalse(crossCheck.missing().contains("Itaboraí"));
        assertFalse(crossCheck.missing().contains("Rio de Janeiro"));
        assertEquals(19, crossCheck.missing().size());
    }

    @Test
    void reportsEveryAbsentMunicipalityInsteadOfInventingCoverage() {
        var crossCheck = municipalities.crossCheck(List.of("SÃO PAULO"));

        assertEquals(22, crossCheck.missing().size());
        assertEquals(municipalities.municipalities(), crossCheck.missing());
    }

    @Test
    void carriesTheSourceProvenanceFileRequiredBeforeAnyRealCollection() {
        var ficha = CollectionSourceFicha.authorized("fogo-cruzado");

        assertEquals("Instituto Fogo Cruzado", ficha.credit());
        assertEquals("Fonte: Instituto Fogo Cruzado", CollectionSourceFicha.ATTRIBUTION);
        assertTrue(ficha.license().contains("uso livre declarado pela fonte"));
        assertTrue(ficha.license().contains("atribuição obrigatória"));
        assertEquals("2026-10-19", ficha.obtainedAt());
        assertEquals("https://api.fogocruzado.org.br/docs", ficha.documentationUrl());
        assertTrue(ficha.limitations().contains("sem SLA"));
        assertTrue(ficha.limitations().contains("região metropolitana"));
        assertTrue(ficha.limitations().contains("não repassados a terceiros"));

        var provenance = ficha.provenance(java.time.Instant.parse("2026-10-19T12:00:00Z"));
        assertEquals("Instituto Fogo Cruzado", provenance.get("credit"));
        assertEquals("Fonte: Instituto Fogo Cruzado", provenance.get("attribution"));
        assertEquals("2026-10-19", provenance.get("obtainedAt"));
        assertEquals("https://api.fogocruzado.org.br/docs", provenance.get("documentationUrl"));
        assertFalse(provenance.containsValue(null));
    }
}
