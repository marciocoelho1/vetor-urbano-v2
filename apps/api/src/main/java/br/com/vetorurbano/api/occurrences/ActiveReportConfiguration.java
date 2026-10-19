package br.com.vetorurbano.api.occurrences;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(ActiveReportConfiguration.Settings.class)
public class ActiveReportConfiguration {
    /** Empty by default: no operational duration or confirmation is silently supplied. */
    @ConfigurationProperties("vetor.active-reports")
    public record Settings(Map<String, Duration> validityByType, Map<String, Confirmation> confirmations) {
        public Settings {
            validityByType = Map.copyOf(validityByType == null ? Map.of() : validityByType);
            confirmations = Map.copyOf(confirmations == null ? Map.of() : confirmations);
            if (validityByType.values().stream().anyMatch(duration -> duration.isNegative() || duration.isZero()))
                throw new IllegalArgumentException("A vigência configurada deve ter duração positiva.");
        }
    }
    /** Explicit evidence, not occurrence/publication/collection timestamps. No persistence implied. */
    public record Confirmation(String type, Instant confirmedAt, String reference) {}

    /**
     * The productive policy reads persisted human verifications (V14). The settings-backed
     * {@link ConfiguredValidityPolicy} stays only as a tested legacy core: it is not wired here, so
     * stale maps can never extend validity on their own.
     */
    @Bean ActiveReportQueryService.ValidityPolicy activeReportValidity(org.springframework.jdbc.core.JdbcTemplate jdbc) {
        return new PersistedValidityPolicy(jdbc);
    }
}
