package br.com.vetorurbano.api.accounts;

import java.time.Duration;

public record AccountSettings(Duration tokenTtl, Duration recoveryTtl, Duration resendCooldown, int resendsPerHour,
        int requestsPerMinute, int sensitiveAttempts, int mailboxPort, int passwordIterations) {
    public AccountSettings {
        for (var duration : new Duration[]{tokenTtl, recoveryTtl})
            if (duration.compareTo(Duration.ofSeconds(1)) < 0 || duration.compareTo(Duration.ofDays(1)) > 0)
                throw new IllegalArgumentException("Prazo de link local fora dos limites de desenvolvimento.");
        if (resendCooldown.isNegative() || resendCooldown.compareTo(Duration.ofHours(1)) > 0
                || resendsPerHour < 1 || resendsPerHour > 20 || requestsPerMinute < 1 || requestsPerMinute > 1000
                || sensitiveAttempts < 1 || sensitiveAttempts > 1000
                || mailboxPort < 0 || mailboxPort > 65535 || passwordIterations < 600000 || passwordIterations > 2000000) {
            throw new IllegalArgumentException("Configuração de contas locais fora dos limites de desenvolvimento.");
        }
    }
}
