package br.com.vetorurbano.api.collection;

/**
 * Falha ao falar com a fonte autorizada. A mensagem nunca carrega credencial nem token.
 */
public class FogoCruzadoException extends RuntimeException {
    private final CollectionErrorClass errorClass;

    public FogoCruzadoException(CollectionErrorClass errorClass, String message) {
        super(message);
        this.errorClass = errorClass;
    }

    public CollectionErrorClass errorClass() { return errorClass; }
}
