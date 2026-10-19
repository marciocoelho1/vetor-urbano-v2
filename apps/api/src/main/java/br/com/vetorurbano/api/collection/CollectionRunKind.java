package br.com.vetorurbano.api.collection;

import java.util.Locale;

public enum CollectionRunKind {
    /** Acompanhamento periódico recente. */
    RECENT,
    /** Carga retroativa delimitada (ticket 21 usa o mesmo recorte). */
    BACKFILL;

    public static CollectionRunKind parse(String value) {
        if (value == null || value.isBlank()) return RECENT;
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException failure) {
            throw new CollectionFailure(400, "INVALID_COLLECTION_RUN", "Tipo de execução inválido.");
        }
    }
}
