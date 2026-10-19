package br.com.vetorurbano.api.collection;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Ficha de procedência da fonte autorizada, exigida antes de qualquer coleta real.
 * Vive no cadastro de fontes ({@code sources.provenance} JSONB) e é idempotente.
 *
 * <p>Conformidade com o termo de consentimento da fonte: acesso gratuito, dados de cadastro usados
 * apenas para autenticação e não repassados a terceiros, e contrapartida de <b>atribuição</b> —
 * por isso {@link #ATTRIBUTION} acompanha o item devolvido à fila e o estado da coleta.
 */
public record CollectionSourceFicha(
        String sourceId,
        String publicName,
        String credit,
        String license,
        String obtainedAt,
        String documentationUrl,
        String channel,
        String limitations) {

    public static final String CREDIT = "Instituto Fogo Cruzado";
    public static final String ATTRIBUTION = "Fonte: Instituto Fogo Cruzado";
    public static final String LICENSE = "uso livre declarado pela fonte + atribuição obrigatória";
    public static final String OBTAINED_AT = "2026-10-19";
    public static final String DOCUMENTATION_URL = "https://api.fogocruzado.org.br/docs";
    public static final String LIMITATIONS = "base colaborativa de terceiros, sem SLA, cobertura por região "
            + "metropolitana; dados de cadastro usados apenas para autenticação e não repassados a terceiros";
    public static final String PUBLIC_NAME = "Fogo Cruzado (API v2)";
    public static final String CHANNEL = "API Fogo Cruzado v2 (conta autorizada do responsável)";

    /** Sem URL de licença versionada: o instrumento exato do termo não é publicado pela fonte. */
    public static CollectionSourceFicha authorized(String sourceId) {
        return new CollectionSourceFicha(sourceId, PUBLIC_NAME, CREDIT, LICENSE, OBTAINED_AT,
                DOCUMENTATION_URL, CHANNEL, LIMITATIONS);
    }

    public Map<String, Object> provenance(Instant recordedAt) {
        Map<String, Object> provenance = new LinkedHashMap<>();
        provenance.put("credit", credit);
        provenance.put("attribution", ATTRIBUTION);
        provenance.put("license", license);
        provenance.put("obtainedAt", obtainedAt);
        provenance.put("documentationUrl", documentationUrl);
        provenance.put("channel", channel);
        provenance.put("limitations", limitations);
        provenance.put("recordedAt", recordedAt.toString());
        return provenance;
    }
}
