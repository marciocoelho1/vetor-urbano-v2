package br.com.vetorurbano.api.collection;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class CollectionCredentialsTest {
    @TempDir Path directory;

    @Test
    void readsPrivateKeyValueFileAndNeverExposesTheSecret() throws Exception {
        Path file = directory.resolve("fogo-cruzado.env");
        Files.writeString(file, """
                # credencial fora do repositório
                VETOR_FOGO_CRUZADO_EMAIL=conta@example.test
                VETOR_FOGO_CRUZADO_PASSWORD=segredo sintético
                """);

        var credentials = CollectionCredentials.load(file);

        assertTrue(credentials.available());
        assertEquals("conta@example.test", credentials.email());
        assertEquals("segredo sintético", credentials.password());
        assertEquals("CollectionCredentials[available=true, value=REDACTED]", credentials.toString());
        assertFalse(credentials.toString().contains("segredo sintético"));
    }

    @Test
    void missingFileIsNotConfiguredAndNotAnError() {
        var credentials = CollectionCredentials.load(directory.resolve("ausente.env"));

        assertFalse(credentials.available());
        assertEquals("CollectionCredentials[available=false, value=REDACTED]", credentials.toString());
    }

    @Test
    void incompleteFileIsNotConfigured() throws Exception {
        Path file = directory.resolve("incompleto.env");
        Files.writeString(file, "VETOR_FOGO_CRUZADO_EMAIL=conta@example.test\n");

        assertFalse(CollectionCredentials.load(file).available());
        assertFalse(CollectionCredentials.of(null, "segredo").available());
        assertFalse(CollectionCredentials.of("conta@example.test", "  ").available());
    }
}
