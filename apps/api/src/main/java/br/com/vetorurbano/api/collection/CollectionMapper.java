package br.com.vetorurbano.api.collection;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import tools.jackson.databind.JsonNode;

/**
 * Mapeamento e minimização de uma ocorrência da fonte autorizada.
 *
 * <p><b>Minimização obrigatória:</b> a resposta traz atributos por vítima (idade, gênero, raça,
 * corporação, unidade, partido, situação de serviço, cargo). Nada disso é projetado: a extração é
 * construída por allowlist explícita, então um campo novo da fonte nunca vaza por omissão —
 * só contagens e o contexto do fato entram.
 *
 * <p><b>Identidade, não proximidade:</b> a única chave de associação é a identidade da fonte
 * ({@code documentNumber}/ {@code id}); {@code relatedRecord} é registrado como referência declarada
 * pela fonte (vazio conta como ausente) e nunca funde dois itens. Duas ocorrências do mesmo
 * município/bairro com referências distintas permanecem dois itens e dois clippings — sem fusão
 * automática por lugar.
 *
 * <p><b>Forma observada na fonte (19/10/2026):</b> {@code city}, {@code neighborhood} e
 * {@code contextInfo.mainReason} são objetos com {@code name}; {@code latitude}/{@code longitude} vêm
 * como texto; {@code documentNumber} é numérico; {@code victims[].situation} vem {@code Dead}/
 * {@code Wounded} e {@code personType} vem {@code Civilian}/{@code Agent}.
 *
 * <p><b>Instantes:</b> a documentação v2 declara datas em {@code America/Sao_Paulo}, mas a resposta
 * observada traz {@code date} como instante ISO-8601 com sufixo {@code Z}. O valor é tratado como
 * instante com deslocamento explícito e normalizado para UTC; um valor sem fuso é recusado
 * ({@code INVALID_RESPONSE}) em vez de ser interpretado como hora local ingênua. A ambiguidade entre
 * documentação e resposta real fica registrada como limitação.
 */
public final class CollectionMapper {
    public static final String CATEGORY = "SEGURANCA";
    public static final String TYPE_DISPAROS = "DISPAROS";
    public static final String TYPE_OPERACAO_POLICIAL = "OPERACAO_POLICIAL";
    public static final String PRIORITY_HIGH = "HIGH";
    public static final String PRIORITY_NORMAL = "NORMAL";

    /** Atributos por vítima que nunca podem aparecer na extração persistida. */
    public static final List<String> PERSONAL_ATTRIBUTE_FIELDS = List.of(
            "age", "ageGroup", "genre", "gender", "race", "skinColor", "coorporation", "corporation",
            "policeUnit", "unit", "partie", "party", "serviceStatus", "politicalPosition",
            "politicalStatus", "agentPosition", "agentStatus", "qualifications", "cpf", "name",
            "birthDate", "document", "email", "phone", "deathDate", "address");

    private CollectionMapper() {}

    /**
     * Item minimizado pronto para virar clipping + entrada da fila de revisão.
     * Nunca publica: o handoff entrega estado {@code PENDING} ao fluxo humano do ticket 17.
     */
    public record CollectionItemDraft(
            String reference,
            String title,
            String summary,
            Instant sourcePublishedAt,
            Map<String, Object> extracted,
            String priority,
            boolean massacre,
            String municipality,
            String neighborhood) {}

    public static CollectionItemDraft map(JsonNode occurrence, String sourceId) {
        if (occurrence == null || !occurrence.isObject())
            throw new FogoCruzadoException(CollectionErrorClass.INVALID_RESPONSE,
                    "Ocorrência da fonte sem objeto JSON.");
        String reference = firstText(occurrence, "documentNumber", "id");
        if (reference == null)
            throw new FogoCruzadoException(CollectionErrorClass.INVALID_RESPONSE,
                    "Ocorrência da fonte sem identidade (documentNumber/id).");
        String municipality = named(occurrence, "city");
        String neighborhood = firstNamed(occurrence, "neighborhood", "subNeighborhood", "locality");
        Instant publishedAt = parseSourceInstant(occurrence.get("date"));
        boolean policeAction = flag(occurrence, "policeAction");
        JsonNode context = occurrence.path("contextInfo");
        boolean massacre = flag(context, "massacre");
        String type = policeAction ? TYPE_OPERACAO_POLICIAL : TYPE_DISPAROS;
        Map<String, Object> victims = victimCounts(occurrence.path("victims"));

        Map<String, Object> extracted = new LinkedHashMap<>();
        extracted.put("category", CATEGORY);
        extracted.put("type", type);
        // Nenhum subtipo é inventado: o catálogo não tem subtipo aprovado para esta fonte.
        extracted.put("subtype", null);
        extracted.put("municipality", municipality);
        extracted.put("neighborhood", neighborhood);
        extracted.put("locality", named(occurrence, "locality"));
        extracted.put("sourceState", named(occurrence, "state"));
        extracted.put("coordinates", coordinates(occurrence));
        extracted.put("locationPrecision", coordinates(occurrence) == null ? "TERRITORY" : "POINT");
        extracted.put("occurredAt", publishedAt.toString());
        extracted.put("documentNumber", text(occurrence, "documentNumber"));
        extracted.put("relatedRecord", relatedRecord(occurrence.path("relatedRecord")));
        extracted.put("policeAction", policeAction);
        extracted.put("agentPresence", flag(occurrence, "agentPresence"));
        extracted.put("massacre", massacre);
        extracted.put("mainReason", named(context, "mainReason"));
        extracted.put("complementaryReasons", names(context.path("complementaryReasons")));
        extracted.put("victims", victims);
        extracted.put("animalVictims", occurrence.path("animalVictims").isArray()
                ? occurrence.path("animalVictims").size() : 0);
        extracted.put("transports", names(occurrence.path("transports")));
        extracted.put("sourceId", sourceId);
        extracted.put("sourceReference", reference);
        extracted.put("sourceCredit", CollectionSourceFicha.CREDIT);
        // Contrapartida exigida pela fonte: atribuição disponível no item devolvido à fila.
        extracted.put("sourceAttribution", CollectionSourceFicha.ATTRIBUTION);
        extracted.put("sourceDocumentationUrl", CollectionSourceFicha.DOCUMENTATION_URL);

        return new CollectionItemDraft(reference, title(reference, neighborhood, municipality),
                summary(type, municipality, neighborhood, victims, policeAction, massacre, reference, context),
                publishedAt, extracted, massacre ? PRIORITY_HIGH : PRIORITY_NORMAL, massacre,
                municipality, neighborhood);
    }

    /**
     * Só contagens. Chaveamento por {@code situation} normalizado ({@code Dead}/{@code Wounded}) e por
     * {@code personType} ({@code Civilian}/{@code Agent}); nada por pessoa.
     */
    public static Map<String, Object> victimCounts(JsonNode victims) {
        int total = 0;
        int dead = 0;
        int injured = 0;
        int agents = 0;
        int civilians = 0;
        if (victims != null && victims.isArray()) {
            for (JsonNode victim : victims) {
                total++;
                String situation = MetropolitanMunicipalities.normalize(text(victim, "situation"));
                if (situation.contains("DEAD") || situation.contains("MORT") || situation.contains("OBITO")
                        || situation.contains("FATAL")) dead++;
                else if (situation.contains("WOUNDED") || situation.contains("FERID")
                        || situation.contains("LESAO") || situation.contains("BALEAD")) injured++;
                String personType = MetropolitanMunicipalities.normalize(text(victim, "personType"));
                if (personType.contains("AGENT")) agents++;
                if (personType.contains("CIVILIAN")) civilians++;
            }
        }
        Map<String, Object> counts = new LinkedHashMap<>();
        counts.put("total", total);
        counts.put("dead", dead);
        counts.put("injured", injured);
        counts.put("agents", agents);
        counts.put("civilians", civilians);
        counts.put("other", total - dead - injured);
        return counts;
    }

    /**
     * Instante da fonte: aceita {@code Z} ou deslocamento explícito; recusa hora local ingênua.
     */
    public static Instant parseSourceInstant(JsonNode value) {
        String text = value == null || value.isNull() ? null : value.asString();
        if (text == null || text.isBlank())
            throw new FogoCruzadoException(CollectionErrorClass.INVALID_RESPONSE,
                    "Ocorrência da fonte sem instante declarado.");
        String stripped = text.strip();
        try {
            return Instant.parse(stripped);
        } catch (DateTimeParseException ignored) {
            // segue para o deslocamento explícito
        }
        try {
            return OffsetDateTime.parse(stripped).toInstant();
        } catch (DateTimeParseException ignored) {
            throw new FogoCruzadoException(CollectionErrorClass.INVALID_RESPONSE,
                    "Instante da fonte sem deslocamento explícito; não é interpretado como hora local.");
        }
    }

    private static String title(String reference, String neighborhood, String municipality) {
        StringBuilder title = new StringBuilder("Ocorrência Fogo Cruzado ").append(reference);
        if (neighborhood != null || municipality != null) {
            title.append(" em ");
            title.append(neighborhood == null ? "" : neighborhood);
            title.append(neighborhood != null && municipality != null ? ", " : "");
            title.append(municipality == null ? "" : municipality);
        }
        return title.length() > 200 ? title.substring(0, 200) : title.toString();
    }

    /** Resumo factual minimizado para o revisor humano; sem atributo pessoal. */
    private static String summary(String type, String municipality, String neighborhood,
            Map<String, Object> victims, boolean policeAction, boolean massacre, String reference, JsonNode context) {
        StringBuilder summary = new StringBuilder();
        summary.append(TYPE_OPERACAO_POLICIAL.equals(type)
                ? "Ocorrência de segurança com ação policial"
                : "Ocorrência de segurança com disparos");
        if (neighborhood != null && municipality != null) summary.append(" em ").append(neighborhood).append(", ").append(municipality);
        else if (municipality != null) summary.append(" em ").append(municipality);
        summary.append(". Vítimas: ").append(victims.get("total"))
                .append(" (mortas: ").append(victims.get("dead"))
                .append(", feridas: ").append(victims.get("injured")).append(").");
        if (massacre) summary.append(" Chacina sinalizada pela fonte.");
        String mainReason = named(context, "mainReason");
        if (mainReason != null && !mainReason.isBlank())
            summary.append(" Motivo principal relatado: ").append(mainReason).append('.');
        summary.append(" Referência da fonte: ").append(reference).append('.');
        return summary.toString();
    }

    private static List<Double> coordinates(JsonNode occurrence) {
        Double longitude = number(occurrence, "longitude");
        Double latitude = number(occurrence, "latitude");
        if (longitude == null || latitude == null) return null;
        return List.of(longitude, latitude);
    }

    /** Vazio conta como ausente: a fonte devolve {@code ""} quando não há registro relacionado. */
    private static String relatedRecord(JsonNode node) {
        if (node == null || node.isNull()) return null;
        String value = node.isObject() ? firstText(node, "id", "documentNumber", "recordId") : node.asString();
        return value == null || value.isBlank() ? null : value.strip();
    }

    /** Lista de nomes a partir de objetos ({@code name}/{@code transport}) ou de textos simples. */
    private static List<String> names(JsonNode node) {
        List<String> values = new ArrayList<>();
        if (node == null || !node.isArray()) return List.copyOf(values);
        for (JsonNode item : node) {
            String value = item.isObject()
                    ? firstText(item, "name", "transport", "type", "value")
                    : (item.isNull() ? null : item.asString());
            if (value != null && !value.isBlank()) values.add(value.strip());
        }
        return List.copyOf(values);
    }

    private static String named(JsonNode node, String field) {
        if (node == null) return null;
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) return null;
        if (value.isObject()) return firstText(value, "name", "region", "value");
        return value.asString();
    }

    private static String firstNamed(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = named(node, field);
            if (value != null && !value.isBlank()) return value.strip();
        }
        return null;
    }

    private static String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = text(node, field);
            if (value != null && !value.isBlank()) return value.strip();
        }
        return null;
    }

    /** Aceita texto e número (a fonte devolve {@code documentNumber} numérico e coordenadas em texto). */
    static String text(JsonNode node, String field) {
        if (node == null) return null;
        JsonNode value = node.get(field);
        if (value == null || value.isNull() || value.isObject() || value.isArray()) return null;
        return value.asString();
    }

    private static Double number(JsonNode node, String field) {
        String value = text(node, field);
        if (value == null || value.isBlank()) return null;
        try {
            return Double.valueOf(value.strip());
        } catch (NumberFormatException failure) {
            throw new FogoCruzadoException(CollectionErrorClass.INVALID_RESPONSE,
                    "Coordenada da fonte em formato inesperado.");
        }
    }

    static boolean flag(JsonNode node, String field) {
        if (node == null) return false;
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) return false;
        if (value.isObject()) return value.size() > 0;
        if (value.isArray()) return value.size() > 0;
        return "true".equalsIgnoreCase(value.asString().strip());
    }
}
