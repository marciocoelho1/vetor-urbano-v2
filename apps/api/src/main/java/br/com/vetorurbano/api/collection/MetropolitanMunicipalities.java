package br.com.vetorurbano.api.collection;

import java.io.IOException;
import java.io.InputStream;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Lista versionada da composição legal da Região Metropolitana do Rio de Janeiro (22 municípios),
 * com a fonte legal registrada e o código IBGE de cada município. É o recorte aprovado; não é limite
 * oficial nem promessa de cobertura da fonte. O cruzamento com {@code GET /cities} é feito em
 * {@link #crossCheck(List)}: município do recorte ausente na fonte é <b>relatado</b>, nunca silenciado
 * nem substituído.
 *
 * <p>Identidade é o código IBGE, não o nome: nome é rótulo, e dois rótulos diferentes podem apontar
 * para o mesmo território. Por isso o recurso carrega os códigos e a carga <b>falha rápido</b> quando o
 * arquivo é internamente inconsistente (código fora de 7 dígitos, código repetido, nome normalizado
 * repetido) — melhor derrubar a aplicação do que publicar cobertura menor em silêncio.
 */
public final class MetropolitanMunicipalities {
    /** v2 acrescenta o código IBGE por município; o v1 permanece como histórico, sem edição. */
    public static final String RESOURCE = "/collection/metropolitan-municipalities-v2.json";

    private static final String IBGE_CODE = "[0-9]{7}";

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final MetropolitanMunicipalities INSTANCE = load();

    private final int version;
    private final String recordedAt;
    private final String legalSource;
    private final String limitations;
    private final String codesSourceUrl;
    private final String codesSourceObtainedAt;
    private final String codesSourceNote;
    private final List<Entry> entries;

    private MetropolitanMunicipalities(int version, String recordedAt, String legalSource,
            String limitations, String codesSourceUrl, String codesSourceObtainedAt,
            String codesSourceNote, List<Entry> entries) {
        this.version = version;
        this.recordedAt = recordedAt;
        this.legalSource = legalSource;
        this.limitations = limitations;
        this.codesSourceUrl = codesSourceUrl;
        this.codesSourceObtainedAt = codesSourceObtainedAt;
        this.codesSourceNote = codesSourceNote;
        this.entries = List.copyOf(entries);
    }

    public static MetropolitanMunicipalities current() { return INSTANCE; }

    private static MetropolitanMunicipalities load() {
        try (InputStream input = MetropolitanMunicipalities.class.getResourceAsStream(RESOURCE)) {
            if (input == null) throw new IllegalStateException("Recurso de municípios ausente: " + RESOURCE);
            JsonNode root = JSON.readTree(input);
            List<Entry> entries = new ArrayList<>();
            root.path("municipalities").forEach(node -> entries.add(
                    new Entry(node.path("name").asString(), node.path("ibgeCode").asString())));
            validate(entries);
            JsonNode codesSource = root.path("codesSource");
            return new MetropolitanMunicipalities(root.path("version").asInt(), root.path("recordedAt").asString(),
                    root.path("legalSource").asString(), root.path("limitations").asString(),
                    codesSource.path("url").asString(), codesSource.path("obtainedAt").asString(),
                    codesSource.path("note").asString(), entries);
        } catch (IOException failure) {
            throw new IllegalStateException("Recurso de municípios ilegível.", failure);
        }
    }

    /**
     * Invariantes do recurso versionado. Não fixa o tamanho do recorte: o arquivo é a verdade da lei e
     * uma alteração legal entra por nova versão do recurso, não por edição de código.
     */
    private static void validate(List<Entry> entries) {
        if (entries.isEmpty()) throw new IllegalStateException("Recorte legal sem municípios: " + RESOURCE);
        Set<String> codes = new HashSet<>();
        Set<String> names = new HashSet<>();
        for (Entry entry : entries) {
            if (entry.name() == null || entry.name().isBlank())
                throw new IllegalStateException("Município sem nome no recorte legal: " + RESOURCE);
            if (entry.ibgeCode() == null || !entry.ibgeCode().matches(IBGE_CODE))
                throw new IllegalStateException("Código IBGE inválido para " + entry.name() + ": " + entry.ibgeCode());
            if (!codes.add(entry.ibgeCode()))
                throw new IllegalStateException("Código IBGE repetido no recorte legal: " + entry.ibgeCode());
            if (!names.add(normalize(entry.name())))
                throw new IllegalStateException("Nome normalizado repetido no recorte legal: " + entry.name());
        }
    }

    public int version() { return version; }
    public String recordedAt() { return recordedAt; }
    public String legalSource() { return legalSource; }
    public String limitations() { return limitations; }
    public String codesSourceUrl() { return codesSourceUrl; }
    public String codesSourceObtainedAt() { return codesSourceObtainedAt; }
    public String codesSourceNote() { return codesSourceNote; }

    /** Pares nome↔código IBGE, na ordem do recurso legal. */
    public List<Entry> entries() { return entries; }

    /** Identidade territorial do recorte; é sobre estes códigos que a cobertura é calculada. */
    public List<String> municipalityCodes() {
        return entries.stream().map(Entry::ibgeCode).toList();
    }

    /** Nomes do recorte, na ordem do recurso legal; usados onde o cruzamento é por rótulo ({@code /cities}). */
    public List<String> municipalities() {
        return entries.stream().map(Entry::name).toList();
    }

    /**
     * Compara o recorte legal com os nomes devolvidos por {@code GET /cities}. Nomes da fonte vêm em
     * caixa alta e podem divergir em acento; a comparação normaliza caixa e acentos.
     */
    public CrossCheck crossCheck(List<String> sourceCityNames) {
        Map<String, String> normalized = new LinkedHashMap<>();
        for (String name : sourceCityNames) normalized.putIfAbsent(normalize(name), name);
        List<String> missing = municipalities().stream().filter(name -> !normalized.containsKey(normalize(name))).toList();
        return new CrossCheck(missing, municipalities().size(), sourceCityNames.size());
    }

    public static String normalize(String value) {
        if (value == null) return "";
        String decomposed = Normalizer.normalize(value.strip(), Normalizer.Form.NFD);
        return decomposed.replaceAll("\\p{M}+", "").toUpperCase(Locale.ROOT);
    }

    /** Município do recorte: o nome é rótulo, o código IBGE é identidade. */
    public record Entry(String name, String ibgeCode) {}

    /** {@code missing} é relatado (nunca inventado nem substituído); a coleta segue com o que existe. */
    public record CrossCheck(List<String> missing, int configured, int observed) {
        public CrossCheck { missing = List.copyOf(missing); }
    }
}
