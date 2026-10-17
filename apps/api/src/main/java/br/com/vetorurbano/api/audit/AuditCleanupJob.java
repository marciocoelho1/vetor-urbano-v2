package br.com.vetorurbano.api.audit;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("local")
@ConditionalOnProperty(name = "vetor.accounts.enabled", havingValue = "true")
public class AuditCleanupJob {
    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(AuditCleanupJob.class);
    private final AuditService service;
    public AuditCleanupJob(AuditService service) { this.service = service; }
    @Scheduled(initialDelayString = "${vetor.audit.cleanup-initial-delay:60000}", fixedDelayString = "${vetor.audit.cleanup-delay:60000}")
    public void execute() {
        try { service.cleanup(null); }
        catch (RuntimeException failure) {
            service.cleanupFailed();
            LOG.error("Expurgo de logs indisponível; eventos vencidos continuam fora da consulta. A rotina tentará novamente.");
        }
    }
}
