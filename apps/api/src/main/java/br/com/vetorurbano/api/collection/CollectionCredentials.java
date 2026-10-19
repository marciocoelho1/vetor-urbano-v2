package br.com.vetorurbano.api.collection;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Credencial da fonte autorizada, lida de arquivo privado {@code chave=valor} fora do repositório.
 * O valor vive apenas em memória durante a execução: nunca é logado, persistido nem serializado.
 * {@link #toString()} é redigido por construção, para que um log acidental não exponha o segredo.
 */
public final class CollectionCredentials {
    public static final String EMAIL_KEY = "VETOR_FOGO_CRUZADO_EMAIL";
    public static final String PASSWORD_KEY = "VETOR_FOGO_CRUZADO_PASSWORD";

    private final String email;
    private final String password;
    private final boolean available;

    private CollectionCredentials(String email, String password, boolean available) {
        this.email = email;
        this.password = password;
        this.available = available;
    }

    public static CollectionCredentials unavailable() {
        return new CollectionCredentials(null, null, false);
    }

    public static CollectionCredentials of(String email, String password) {
        boolean complete = email != null && !email.isBlank() && password != null && !password.isBlank();
        return new CollectionCredentials(complete ? email : null, complete ? password : null, complete);
    }

    /** Arquivo ausente, ilegível ou incompleto resulta em «não configurado», nunca em exceção. */
    public static CollectionCredentials load(Path file) {
        if (file == null) return unavailable();
        if (!Files.isRegularFile(file)) return unavailable();
        Map<String, String> values = new LinkedHashMap<>();
        List<String> lines;
        try {
            lines = Files.readAllLines(file, StandardCharsets.UTF_8);
        } catch (IOException failure) {
            return unavailable();
        }
        for (String line : lines) {
            String trimmed = line.strip();
            if (trimmed.isEmpty() || trimmed.startsWith("#")) continue;
            int separator = trimmed.indexOf('=');
            if (separator < 1) continue;
            values.put(trimmed.substring(0, separator).strip(), trimmed.substring(separator + 1).strip());
        }
        return of(values.get(EMAIL_KEY), values.get(PASSWORD_KEY));
    }

    public boolean available() { return available; }
    public String email() { return Objects.requireNonNull(email); }
    public String password() { return Objects.requireNonNull(password); }

    @Override
    public String toString() {
        return "CollectionCredentials[available=" + available + ", value=REDACTED]";
    }
}
