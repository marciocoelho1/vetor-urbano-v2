package br.com.vetorurbano.api.collection;

import java.nio.file.Path;
import java.time.LocalDate;

/**
 * Configuração da coleta autorizada. Default desligado: sem arquivo de credencial ou com a coleta
 * desligada, a superfície responde {@code NOT_CONFIGURED} — não é falha nem vazio.
 */
public record CollectionSettings(
        boolean enabled,
        String sourceBaseUrl,
        String sourceId,
        Path credentialsFile,
        int pollSeconds,
        LocalDate windowStart,
        int pageSize,
        int maxPages,
        String userAgent) {

    public static final String DEFAULT_BASE_URL = "https://api-service.fogocruzado.org.br/api/v2";
    public static final String DEFAULT_SOURCE_ID = "fogo-cruzado";
    /**
     * User-Agent explícito e identificável. O cliente programático padrão é bloqueado pela proteção
     * de borda da fonte (HTTP 403, «error code: 1010»), o que vira a classe própria
     * {@link CollectionErrorClass#UPSTREAM_BLOCKED}.
     */
    public static final String DEFAULT_USER_AGENT =
            "VetorUrbanoLocalCollector/0.1 (coleta autorizada pelo responsável; conta Fogo Cruzado)";

    public CollectionSettings {
        if (sourceBaseUrl == null || sourceBaseUrl.isBlank())
            throw new IllegalArgumentException("Base da fonte obrigatória.");
        if (sourceId == null || sourceId.isBlank())
            throw new IllegalArgumentException("Identificador da fonte obrigatório.");
        if (pollSeconds < 60 || pollSeconds > 86400)
            throw new IllegalArgumentException("Cadência da coleta fora do intervalo aceito.");
        if (pageSize < 1 || pageSize > 1000)
            throw new IllegalArgumentException("Tamanho de página fora do intervalo aceito.");
        if (maxPages < 1 || maxPages > 10000)
            throw new IllegalArgumentException("Teto de páginas fora do intervalo aceito.");
        if (windowStart == null)
            throw new IllegalArgumentException("Início da janela obrigatório.");
        if (userAgent == null || userAgent.isBlank())
            throw new IllegalArgumentException("User-Agent identificável obrigatório.");
    }
}
