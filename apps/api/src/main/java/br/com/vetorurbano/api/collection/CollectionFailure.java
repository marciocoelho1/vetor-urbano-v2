package br.com.vetorurbano.api.collection;

/** Falha de superfície administrativa da coleta; vira código HTTP explícito, nunca 200. */
public class CollectionFailure extends RuntimeException {
    private final int status;
    private final String code;

    public CollectionFailure(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public int status() { return status; }
    public String code() { return code; }

    public static CollectionFailure notConfigured() {
        return new CollectionFailure(409, "NOT_CONFIGURED",
                "Coleta não configurada: credencial ausente ou coleta desligada.");
    }

    public static CollectionFailure notFound() {
        return new CollectionFailure(404, "COLLECTION_RUN_NOT_FOUND", "Execução de coleta não encontrada.");
    }

    public static CollectionFailure conflict(String code, String message) {
        return new CollectionFailure(409, code, message);
    }

    public static CollectionFailure invalid(String message) {
        return new CollectionFailure(400, "INVALID_COLLECTION_RUN", message);
    }
}
