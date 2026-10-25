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
        assertEquals(2, municipalities.version());
    }

    /** Código IBGE é identidade: o recorte v2 o carrega, e a cobertura é calculada sobre ele. */
    @Test
    void carriesTheIbgeCodeOfEveryMunicipalityAndSaysWhereItCameFrom() {
        assertEquals(22, municipalities.municipalityCodes().size());
        assertEquals(22, municipalities.entries().size());
        municipalities.entries().forEach(entry -> assertTrue(entry.ibgeCode().matches("[0-9]{7}"),
                "código fora do padrão IBGE: " + entry.ibgeCode()));
        assertEquals(22, new java.util.HashSet<>(municipalities.municipalityCodes()).size(),
                "código repetido no recorte legal");
        assertEquals(22, municipalities.entries().stream()
                .map(entry -> MetropolitanMunicipalities.normalize(entry.name())).distinct().count(),
                "nome normalizado repetido no recorte legal");
        assertEquals("3304557", municipalities.entries().stream()
                .filter(entry -> entry.name().equals("Rio de Janeiro")).findFirst().orElseThrow().ibgeCode());
        assertEquals("3303203", municipalities.entries().stream()
                .filter(entry -> entry.name().equals("Nilópolis")).findFirst().orElseThrow().ibgeCode());
        // Origem do código é declarada: ele vem da API de Localidades, não da lei.
        assertTrue(municipalities.codesSourceUrl().startsWith("https://servicodados.ibge.gov.br/"));
        assertEquals("2026-10-24", municipalities.codesSourceObtainedAt());
        assertTrue(municipalities.codesSourceNote().contains("não da lei"));
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
