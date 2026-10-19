package br.com.vetorurbano.api.collection;

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

    public CollectionScheduler(CollectionService service) { this.service = service; }

    @Scheduled(initialDelayString = "${vetor.collection.poll-seconds:900}000",
            fixedDelayString = "${vetor.collection.poll-seconds:900}000")
    void poll() {
        service.poll();
    }
}
