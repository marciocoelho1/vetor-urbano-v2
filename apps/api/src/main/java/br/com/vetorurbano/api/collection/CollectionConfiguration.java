package br.com.vetorurbano.api.collection;

import java.net.http.HttpClient;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.*;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Configuração da coleta autorizada. Default desligado: a superfície existe sempre que o módulo de
 * contas está ativo (para poder responder «não configurado»), mas só coleta de fato com
 * {@code vetor.collection.enabled=true} e credencial presente.
 */
@Configuration
@Profile("local")
@ConditionalOnProperty(name = "vetor.accounts.enabled", havingValue = "true")
@EnableScheduling
public class CollectionConfiguration {
    @Bean
    CollectionSettings collectionSettings(Environment environment) {
        boolean enabled = Boolean.TRUE.equals(environment.getProperty("vetor.collection.enabled", Boolean.class, false));
        String baseUrl = environment.getProperty("vetor.collection.source-base-url", CollectionSettings.DEFAULT_BASE_URL);
        String sourceId = environment.getProperty("vetor.collection.source-id", CollectionSettings.DEFAULT_SOURCE_ID);
        String credentialsPath = environment.getProperty("vetor.collection.credentials-file", "");
        Path credentialsFile = credentialsPath == null || credentialsPath.isBlank() ? null : Path.of(credentialsPath.strip());
        int pollSeconds = environment.getProperty("vetor.collection.poll-seconds", Integer.class, 60);
        int pageSize = Math.min(environment.getProperty("vetor.collection.page-size", Integer.class, 100), 100);
        int maxPages = Math.min(environment.getProperty("vetor.collection.max-pages", Integer.class, 20), 20);
        LocalDate windowStart = LocalDate.parse(environment.getProperty("vetor.collection.window-start", "2026-06-01").strip());
        String userAgent = environment.getProperty("vetor.collection.user-agent", CollectionSettings.DEFAULT_USER_AGENT);
        return new CollectionSettings(enabled, baseUrl, sourceId, credentialsFile, pollSeconds, windowStart,
                pageSize, maxPages, userAgent);
    }

    @Bean
    CollectionCredentials collectionCredentials(CollectionSettings settings) {
        return CollectionCredentials.load(settings.credentialsFile());
    }

    @Bean
    HttpClient collectionHttpClient() {
        return HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    @Bean
    FogoCruzadoClient fogoCruzadoClient(HttpClient collectionHttpClient, CollectionSettings settings,
            CollectionCredentials collectionCredentials, Clock clock) {
        return new FogoCruzadoClient(collectionHttpClient, settings, collectionCredentials, clock);
    }

    @Bean
    CollectionStore collectionStore(JdbcTemplate jdbc) {
        return new CollectionStore(jdbc);
    }

    /** Executor dedicado e serial: uma execução por vez, sem paralelizar páginas da mesma fonte. */
    @Bean(destroyMethod = "shutdownNow")
    ExecutorService collectionExecutor() {
        return Executors.newSingleThreadExecutor(task -> {
            Thread thread = new Thread(task);
            thread.setName("vetor-collection");
            thread.setDaemon(true);
            return thread;
        });
    }

    @Bean
    CollectionService collectionService(CollectionSettings settings, CollectionCredentials credentials,
            FogoCruzadoClient client, CollectionStore store, Clock clock, ExecutorService collectionExecutor) {
        return new CollectionService(settings, credentials, client, store, clock, collectionExecutor);
    }
}
