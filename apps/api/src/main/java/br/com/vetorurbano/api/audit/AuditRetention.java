package br.com.vetorurbano.api.audit;

import java.time.Duration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.*;
import org.springframework.core.env.Environment;

@Configuration
@org.springframework.scheduling.annotation.EnableScheduling
@Profile("local")
@ConditionalOnProperty(name = "vetor.accounts.enabled", havingValue = "true")
public class AuditRetention {
    public record Policy(Duration use, Duration security, Duration admin) {}
    /** Decisão do responsável em 22/10/2026: retenção de 15 dias para uso, segurança e administração. */
    static final int APPROVED_DAYS = 15;

    @Bean Policy auditPolicy(Environment environment) {
        return new Policy(duration(environment, "use", APPROVED_DAYS),
                duration(environment, "security", APPROVED_DAYS),
                duration(environment, "admin", APPROVED_DAYS));
    }
    private static Duration duration(Environment environment, String purpose, int days) {
        var maximum = Duration.ofDays(days);
        var value = environment.getProperty("vetor.audit." + purpose + "-retention", Duration.class, maximum);
        if (value.compareTo(Duration.ofSeconds(1)) < 0 || value.compareTo(maximum) > 0)
            throw new IllegalArgumentException("Retenção fora dos limites aprovados para " + purpose);
        return value;
    }
}
