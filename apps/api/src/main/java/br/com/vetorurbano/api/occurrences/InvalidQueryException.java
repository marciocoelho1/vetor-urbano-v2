package br.com.vetorurbano.api.occurrences;

public class InvalidQueryException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    public InvalidQueryException(String message) {
        super(message);
    }
}
