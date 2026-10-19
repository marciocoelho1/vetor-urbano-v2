package br.com.vetorurbano.api.collection;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Unidade de mapeamento e minimização, sobre a forma observada da fonte. O fixture traz atributos por
 * vítima de propósito: nenhum deles pode sobreviver à extração persistida.
 */
class CollectionMapperTest {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String SOURCE = "fogo-cruzado";

    private static JsonNode json(String value) { return JSON.readTree(value); }

    private static JsonNode occurrence(long documentNumber, String city, String neighborhood, String date,
            boolean policeAction, boolean massacre, List<String> situations, List<String> personTypes) {
        return StubFogoCruzado.occurrence(documentNumber, city, neighborhood, date, policeAction, massacre,
                situations, personTypes);
    }

    @Test
    void neverPersistsAnyPerVictimPersonalAttribute() {
        var draft = CollectionMapper.map(occurrence(70001, "Rio de Janeiro", "BAIRRO SINTETICO",
                "2026-06-01T06:30:00.000Z", true, false, List.of("Dead", "Wounded"),
                List.of("Civilian", "Agent")), SOURCE);

        assertNoPersonalAttributes(draft.extracted());
        String serialized = JSON.writeValueAsString(draft.extracted());
        for (String value : List.of("Adulto", "Masculino", "sintética", "corporação sintética",
                "unidade sintética", "partido sintético", "27", "logradouro sintético", "victim-0"))
            assertFalse(serialized.contains(value), "extração não pode conter atributo pessoal: " + value);
        assertFalse(draft.summary().contains("27"));
        assertFalse(draft.title().contains("Masculino"));
    }

    @Test
    void keepsOnlyAggregatedVictimCounts() {
        var draft = CollectionMapper.map(occurrence(70002, "Niterói", "CENTRO", "2026-06-02T10:15:00.000Z",
                false, false, List.of("Dead", "Wounded", "Wounded"),
                List.of("Civilian", "Agent", "Civilian")), SOURCE);

        @SuppressWarnings("unchecked")
        Map<String, Object> victims = (Map<String, Object>) draft.extracted().get("victims");
        assertEquals(3, victims.get("total"));
        assertEquals(1, victims.get("dead"));
        assertEquals(2, victims.get("injured"));
        assertEquals(1, victims.get("agents"));
        assertEquals(2, victims.get("civilians"));
        assertEquals(0, victims.get("other"));
    }

    @Test
    void keepsShotsWithoutVictimsInTheApprovedWindow() {
        // O recorte aprovado não filtra por presença de vítima: disparo sem vítima é ocorrência do produto.
        var withoutVictims = CollectionMapper.map(occurrence(70006, "Niterói", "CENTRO",
                "2026-06-06T02:00:00.000Z", false, false, List.of(), List.of()), SOURCE);

        assertEquals("DISPAROS", withoutVictims.extracted().get("type"));
        assertEquals("NORMAL", withoutVictims.priority());
        assertFalse(withoutVictims.massacre());
        @SuppressWarnings("unchecked")
        Map<String, Object> victims = (Map<String, Object>) withoutVictims.extracted().get("victims");
        assertEquals(0, victims.get("total"));
        assertEquals(0, victims.get("dead"));
        assertEquals(0, victims.get("injured"));
        assertFalse(withoutVictims.summary().isBlank());
    }

    @Test
    void mapsCategoryTypeAndPriorityWithoutInventingSubtype() {
        var shots = CollectionMapper.map(occurrence(70003, "Magé", "CENTRO", "2026-06-03T00:00:00.000Z",
                false, false, List.of("Wounded"), List.of("Civilian")), SOURCE);
        assertEquals("SEGURANCA", shots.extracted().get("category"));
        assertEquals("DISPAROS", shots.extracted().get("type"));
        assertNull(shots.extracted().get("subtype"));
        assertEquals("NORMAL", shots.priority());

        var operation = CollectionMapper.map(occurrence(70004, "Magé", "CENTRO", "2026-06-03T01:00:00.000Z",
                true, true, List.of("Dead"), List.of("Agent")), SOURCE);
        assertEquals("OPERACAO_POLICIAL", operation.extracted().get("type"));
        assertNull(operation.extracted().get("subtype"));
        assertEquals("HIGH", operation.priority());
        assertEquals(Boolean.TRUE, operation.extracted().get("massacre"));
    }

    @Test
    void readsNestedObjectsTextCoordinatesAndEmptyRelatedRecordFromTheObservedShape() {
        var draft = CollectionMapper.map(occurrence(70005, "Nova Iguaçu", "CENTRO", "2026-06-04T12:00:00.000Z",
                false, false, List.of("Dead"), List.of("Civilian")), SOURCE);

        assertEquals("70005", draft.reference());
        assertEquals("Nova Iguaçu", draft.extracted().get("municipality"));
        assertEquals("CENTRO", draft.extracted().get("neighborhood"));
        assertEquals(List.of(-43.3, -22.9), draft.extracted().get("coordinates"));
        assertEquals("POINT", draft.extracted().get("locationPrecision"));
        assertEquals("Operação policial", draft.extracted().get("mainReason"));
        assertEquals(List.of("Bus"), draft.extracted().get("transports"));
        assertEquals(0, draft.extracted().get("animalVictims"));
        assertEquals(Instant.parse("2026-06-04T12:00:00Z"), draft.sourcePublishedAt());
        // A fonte devolve string vazia quando não há registro relacionado: conta como ausente.
        assertNull(draft.extracted().get("relatedRecord"));
        assertFalse(draft.extracted().containsKey("address"));
    }

    @Test
    void keepsADeclaredRelatedRecordWithoutUsingItToMergeAnything() {
        var withRelated = json("""
                {"documentNumber": 70010, "city": {"name": "Niterói"}, "neighborhood": {"name": "CENTRO"},
                 "date": "2026-06-05T10:00:00.000Z", "relatedRecord": "70009", "victims": []}
                """);

        assertEquals("70009", CollectionMapper.map(withRelated, SOURCE).extracted().get("relatedRecord"));
        assertEquals("70010", CollectionMapper.map(withRelated, SOURCE).reference());
    }

    @Test
    void identityIsTheSourceReferenceAndNeverProximity() {
        var first = CollectionMapper.map(occurrence(70006, "Rio de Janeiro", "COMPLEXO DO ALEMAO",
                "2026-06-05T10:00:00.000Z", false, false, List.of("Dead"), List.of("Civilian")), SOURCE);
        var second = CollectionMapper.map(occurrence(70007, "Rio de Janeiro", "COMPLEXO DO ALEMAO",
                "2026-06-05T10:05:00.000Z", false, false, List.of("Wounded"), List.of("Civilian")), SOURCE);

        assertEquals("70006", first.reference());
        assertEquals("70007", second.reference());
        assertNotEquals(first.reference(), second.reference());
        // Mesmo município e mesmo bairro não criam identidade: nada é fundido pelo lugar.
        assertNotEquals(first.extracted().get("sourceReference"), second.extracted().get("sourceReference"));
        assertNotEquals(first.title(), second.title());
        assertNotEquals(first.summary(), second.summary());
    }

    @Test
    void usesDocumentNumberThenIdAsTheIdentityAndRejectsOccurrenceWithoutEither() {
        var byId = json("{\"id\":\"uuid-only\",\"city\":{\"name\":\"Niterói\"},\"date\":\"2026-06-06T00:00:00.000Z\"}");
        assertEquals("uuid-only", CollectionMapper.map(byId, SOURCE).reference());

        var failure = assertThrows(FogoCruzadoException.class,
                () -> CollectionMapper.map(json("{\"city\":{\"name\":\"Niterói\"},\"date\":\"2026-06-06T00:00:00.000Z\"}"), SOURCE));
        assertEquals(CollectionErrorClass.INVALID_RESPONSE, failure.errorClass());
    }

    @Test
    void normalisesExplicitOffsetsToUtcAndRejectsNaiveLocalTimes() {
        assertEquals(Instant.parse("2026-06-01T03:00:00Z"),
                CollectionMapper.parseSourceInstant(json("\"2026-06-01T03:00:00.000Z\"")));
        assertEquals(Instant.parse("2026-06-01T03:00:00Z"),
                CollectionMapper.parseSourceInstant(json("\"2026-06-01T00:00:00-03:00\"")));
        assertEquals(Instant.parse("2026-06-01T03:00:00Z"),
                CollectionMapper.parseSourceInstant(json("\"2026-06-01T05:00:00+02:00\"")));

        var failure = assertThrows(FogoCruzadoException.class,
                () -> CollectionMapper.parseSourceInstant(json("\"2026-06-01T03:00:00\"")));
        assertEquals(CollectionErrorClass.INVALID_RESPONSE, failure.errorClass());
    }

    /** Só projeta contagens e contexto: nenhuma chave de atributo pessoal sobrevive. */
    private static void assertNoPersonalAttributes(Object node) {
        if (node instanceof Map<?, ?> map) {
            for (var entry : map.entrySet()) {
                String key = String.valueOf(entry.getKey());
                assertFalse(CollectionMapper.PERSONAL_ATTRIBUTE_FIELDS.contains(key),
                        "campo pessoal projetado: " + key);
                assertNoPersonalAttributes(entry.getValue());
            }
        } else if (node instanceof Iterable<?> iterable) {
            iterable.forEach(CollectionMapperTest::assertNoPersonalAttributes);
        }
    }
}
