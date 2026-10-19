package br.com.vetorurbano.api.collection;

/**
 * Estados distintos da coleta — nunca fundidos (contrato local v1).
 * {@code NOT_CONFIGURED} é estado de leitura da fonte (sem credencial ou coleta desligada),
 * não é falha nem resultado vazio e por isso não é gravado em {@code collection_runs}.
 */
public enum CollectionRunState {
    NOT_CONFIGURED,
    RUNNING,
    PAUSED,
    SUCCEEDED_NO_CHANGES,
    SUCCEEDED_NEW_ITEMS,
    PARTIAL,
    FAILED
}
