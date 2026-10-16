package br.com.vetorurbano.api.accounts;

import java.time.Duration;

public record AccountSettings(Duration tokenTtl, Duration resendCooldown, int resendsPerHour,
        int requestsPerMinute, int mailboxPort, int passwordIterations) {
    public AccountSettings {
        if (tokenTtl.compareTo(Duration.ofSeconds(1)) < 0 || tokenTtl.compareTo(Duration.ofDays(1)) > 0
                || resendCooldown.isNegative() || resendCooldown.compareTo(Duration.ofHours(1)) > 0
                || resendsPerHour < 1 || resendsPerHour > 20 || requestsPerMinute < 1 || requestsPerMinute > 1000
                || mailboxPort < 0 || mailboxPort > 65535 || passwordIterations < 600000 || passwordIterations > 2000000) {
            throw new IllegalArgumentException("Configuração de contas locais fora dos limites de desenvolvimento.");
        }
    }
}
