package br.com.vetorurbano.api.collection;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Cadência da coleta recente. A primeira execução espera um intervalo completo — o agendador não
 * dispara no startup nem compete com a subida da aplicação. Sem SLA e sem promessa de
 * instantaneidade: a fonte é de terceiros.
 */
@Component
@Profile("local")
@ConditionalOnProperty(name = "vetor.collection.enabled", havingValue = "true")
public class CollectionScheduler {
    private final CollectionService service;
    private final boolean schedulerEnabled;

    public CollectionScheduler(
            CollectionService service,
            @Value("${vetor.collection.scheduler.enabled:true}") boolean schedulerEnabled) {
        this.service = service;
        this.schedulerEnabled = schedulerEnabled;
    }

    @Scheduled(initialDelayString = "${vetor.collection.poll-seconds:60}000",
            fixedDelayString = "${vetor.collection.poll-seconds:60}000")
    void poll() {
        if (schedulerEnabled) service.poll();
    }
}
