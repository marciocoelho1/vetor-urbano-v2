package br.com.vetorurbano.api.collection;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import org.junit.jupiter.api.Test;

class CollectionSchedulerTest {
    @Test
    void disabledSchedulerDoesNotStartAnAutomaticRun() {
        CollectionService service = mock(CollectionService.class);

        new CollectionScheduler(service, false).poll();

        verifyNoInteractions(service);
    }

    @Test
    void enabledSchedulerDelegatesToCollectionService() {
        CollectionService service = mock(CollectionService.class);

        new CollectionScheduler(service, true).poll();

        verify(service).poll();
    }
}
