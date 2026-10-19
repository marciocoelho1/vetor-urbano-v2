package br.com.vetorurbano.api.collection;

/**
 * Decisão do estado final de uma execução. Função pura para que a máquina de estados seja testável
 * sem banco: falha nunca vira zero, sucesso sem novidade nunca vira falha.
 */
public final class CollectionRunOutcome {
    private CollectionRunOutcome() {}

    public static CollectionRunState decide(int pagesDone, int itemsCreated, CollectionErrorClass error) {
        if (error != null) return pagesDone > 0 ? CollectionRunState.PARTIAL : CollectionRunState.FAILED;
        return itemsCreated > 0 ? CollectionRunState.SUCCEEDED_NEW_ITEMS : CollectionRunState.SUCCEEDED_NO_CHANGES;
    }
}
