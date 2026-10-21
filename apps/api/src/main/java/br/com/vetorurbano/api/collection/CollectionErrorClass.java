package br.com.vetorurbano.api.collection;

import java.util.Locale;

/**
 * Classe de falha da coleta. Uma falha nunca vira zero ocorrências nem {@code SUCCEEDED_NO_CHANGES}.
 * {@code UPSTREAM_BLOCKED} é distinta de {@code AUTH_FAILED}: a fonte recusou o cliente pela
 * proteção de borda (HTTP 403 com «error code: 1010»), o que não é credencial inválida nem 429/5xx.
 */
public enum CollectionErrorClass {
    AUTH_FAILED,
    RATE_LIMITED,
    UPSTREAM_UNAVAILABLE,
    UPSTREAM_BLOCKED,
    INVALID_RESPONSE,
    BACKFILL_LIMIT_REACHED;

    /** Proteção de borda da fonte quando o cliente não se identifica com User-Agent próprio. */
    public static final String BLOCKED_MARKER = "error code: 1010";

    public static CollectionErrorClass fromHttpStatus(int status, String body) {
        if (status == 401) return AUTH_FAILED;
        if (status == 403) return isBlocked(body) ? UPSTREAM_BLOCKED : AUTH_FAILED;
        if (status == 429) return RATE_LIMITED;
        if (status >= 500) return UPSTREAM_UNAVAILABLE;
        return INVALID_RESPONSE;
    }

    public static boolean isBlocked(String body) {
        return body != null && body.toLowerCase(Locale.ROOT).contains(BLOCKED_MARKER);
    }

    public static CollectionErrorClass parse(String value) {
        if (value == null || value.isBlank()) return null;
        return valueOf(value.trim().toUpperCase(Locale.ROOT));
    }
}
