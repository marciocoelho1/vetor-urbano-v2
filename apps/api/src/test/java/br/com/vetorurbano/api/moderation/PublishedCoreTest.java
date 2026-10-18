package br.com.vetorurbano.api.moderation;

import static org.junit.jupiter.api.Assertions.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

/** Server-owned rules of a prepared change, exercised without a database. */
class PublishedCoreTest {
    private static Map<String,Object> published(){
        var current=new LinkedHashMap<String,Object>();
        current.put("title","Bloqueio demonstrativo na borda do raio");
        current.put("description","Ponto sintético construído a exatamente mil metros da referência de teste.");
        current.put("category","CONTINGENCIA");current.put("occurrence_type","INTERDICAO");current.put("subtype","NAO_INFORMADO");
        current.put("situation","ONGOING");current.put("reliability_score",(short)4);current.put("municipality","Rio de Janeiro");
        current.put("neighborhood","Centro");current.put("location_precision","POINT");current.put("longitude",-43.1815);current.put("latitude",-22.9033);
        current.put("occurred_at",java.sql.Timestamp.from(java.time.Instant.parse("2026-10-15T09:00:00Z")));
        current.put("occurred_from",null);current.put("occurred_until",null);
        return current;
    }

    @Test void mergesOnlyTheProposedFieldsAndRejectsUnsupportedDetail() {
        Map<String,Object> effective=PublishedCore.validate(Map.of("title","Título corrigido sintético"),published());
        assertEquals("Título corrigido sintético",effective.get("title"));
        assertEquals("INTERDICAO",effective.get("type"));
        assertEquals("Rio de Janeiro",effective.get("municipality"));
        assertFalse(PublishedCore.unchanged(Map.of("title","Título corrigido sintético"),published(),effective));
        assertTrue(PublishedCore.unchanged(Map.of("title","Bloqueio demonstrativo na borda do raio"),published(),
                PublishedCore.validate(Map.of("title","Bloqueio demonstrativo na borda do raio"),published())));
        var failure=assertThrows(ResponseStatusException.class,()->PublishedCore.validate(Map.of("unknown","valor"),published()));
        assertTrue(String.valueOf(failure.getReason()).contains("Campo factual não declarado"));
    }

    @Test void refusesCataloguePrecisionAndTemporalInventations() {
        assertTrue(assertThrows(ResponseStatusException.class,()->PublishedCore.validate(Map.of("type","ROUBO","category","CONTINGENCIA"),published())).getReason().contains("Catálogo"));
        // Pares publicados permanecem legíveis mesmo fora do catálogo de moderação (INTERDICAO do seed).
        assertEquals("CONTINGENCIA",PublishedCore.validate(Map.of("title","Correção do par publicado"),published()).get("category"));
        assertTrue(assertThrows(ResponseStatusException.class,()->PublishedCore.validate(Map.of("subtype","COLISAO"),published())).getReason().contains("Subtipo"));
        assertTrue(assertThrows(ResponseStatusException.class,()->PublishedCore.validate(Map.of("reliability",9),published())).getReason().contains("Nota"));
        assertTrue(assertThrows(ResponseStatusException.class,()->PublishedCore.validate(Map.of("locationPrecision","TERRITORY"),published())).getReason().contains("territorial"));
        assertTrue(assertThrows(ResponseStatusException.class,()->PublishedCore.validate(Map.of("occurredFrom","2026-10-15T10:00:00Z"),published())).getReason().contains("Data"));
    }

    @Test void acceptsASustainedPointCorrectionKeptInsideTheCatalogue() {
        Map<String,Object> effective=PublishedCore.validate(Map.of("locationPrecision","POINT","longitude",-43.19,"latitude",-22.9),published());
        assertEquals(-43.19,effective.get("longitude"));
        // Bairro desconhecido permanece explícito, sem valor inventado.
        assertEquals("Não informado",PublishedCore.validate(Map.of("neighborhood",""),published()).get("neighborhood"));
    }
}
