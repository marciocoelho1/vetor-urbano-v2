package br.com.vetorurbano.api.occurrences;

public record SourceReference(String id, String name) {
    public SourceReference {
        if (id == null || id.isBlank() || name == null || name.isBlank()) {
            throw new IllegalArgumentException("A public source reference needs an id and a name.");
        }
    }
}
