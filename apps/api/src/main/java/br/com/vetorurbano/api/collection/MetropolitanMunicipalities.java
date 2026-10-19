package br.com.vetorurbano.api.collection;

import java.io.IOException;
import java.io.InputStream;
import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Lista versionada da composição legal da Região Metropolitana do Rio de Janeiro (22 municípios),
 * com a fonte legal registrada. É o recorte aprovado; não é limite oficial nem promessa de cobertura
 * da fonte. O cruzamento com {@code GET /cities} é feito em {@link #crossCheck(List)}: município do
 * recorte ausente na fonte é <b>relatado</b>, nunca silenciado nem substituído.
 */
public final class MetropolitanMunicipalities {
    public static final String RESOURCE = "/collection/metropolitan-municipalities-v1.json";

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final MetropolitanMunicipalities INSTANCE = load();

    private final int version;
    private final String recordedAt;
    private final String legalSource;
    private final String limitations;
    private final List<String> municipalities;

    private MetropolitanMunicipalities(int version, String recordedAt, String legalSource,
            String limitations, List<String> municipalities) {
        this.version = version;
        this.recordedAt = recordedAt;
        this.legalSource = legalSource;
        this.limitations = limitations;
        this.municipalities = List.copyOf(municipalities);
    }

    public static MetropolitanMunicipalities current() { return INSTANCE; }

    private static MetropolitanMunicipalities load() {
        try (InputStream input = MetropolitanMunicipalities.class.getResourceAsStream(RESOURCE)) {
            if (input == null) throw new IllegalStateException("Recurso de municípios ausente: " + RESOURCE);
            JsonNode root = JSON.readTree(input);
            List<String> names = new java.util.ArrayList<>();
            root.path("municipalities").forEach(node -> names.add(node.asString()));
            return new MetropolitanMunicipalities(root.path("version").asInt(), root.path("recordedAt").asString(),
                    root.path("legalSource").asString(), root.path("limitations").asString(), names);
        } catch (IOException failure) {
            throw new IllegalStateException("Recurso de municípios ilegível.", failure);
        }
    }

    public int version() { return version; }
    public String recordedAt() { return recordedAt; }
    public String legalSource() { return legalSource; }
    public String limitations() { return limitations; }
    public List<String> municipalities() { return municipalities; }

    /**
     * Compara o recorte legal com os nomes devolvidos por {@code GET /cities}. Nomes da fonte vêm em
     * caixa alta e podem divergir em acento; a comparação normaliza caixa e acentos.
     */
    public CrossCheck crossCheck(List<String> sourceCityNames) {
        Map<String, String> normalized = new LinkedHashMap<>();
        for (String name : sourceCityNames) normalized.putIfAbsent(normalize(name), name);
        List<String> missing = municipalities.stream().filter(name -> !normalized.containsKey(normalize(name))).toList();
        return new CrossCheck(missing, municipalities.size(), sourceCityNames.size());
    }

    public static String normalize(String value) {
        if (value == null) return "";
        String decomposed = Normalizer.normalize(value.strip(), Normalizer.Form.NFD);
        return decomposed.replaceAll("\\p{M}+", "").toUpperCase(Locale.ROOT);
    }

    /** {@code missing} é relatado (nunca inventado nem substituído); a coleta segue com o que existe. */
    public record CrossCheck(List<String> missing, int configured, int observed) {
        public CrossCheck { missing = List.copyOf(missing); }
    }
}
