package br.com.vetorurbano.api.collection;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

/** Estados distintos, nunca fundidos: falha não vira zero, vazio não vira falha. */
class CollectionRunOutcomeTest {
    @Test
    void completedRunWithoutNewItemsIsNoChanges() {
        assertEquals(CollectionRunState.SUCCEEDED_NO_CHANGES, CollectionRunOutcome.decide(3, 0, null));
    }

    @Test
    void completedRunWithNewItemsIsNewItems() {
        assertEquals(CollectionRunState.SUCCEEDED_NEW_ITEMS, CollectionRunOutcome.decide(1, 7, null));
    }

    @Test
    void failureAfterSomePagesIsPartialAndPreservesTheCursor() {
        assertEquals(CollectionRunState.PARTIAL,
                CollectionRunOutcome.decide(2, 5, CollectionErrorClass.RATE_LIMITED));
        assertEquals(CollectionRunState.PARTIAL,
                CollectionRunOutcome.decide(1, 0, CollectionErrorClass.UPSTREAM_UNAVAILABLE));
    }

    @Test
    void failureBeforeAnyCompletedPageIsFailed() {
        assertEquals(CollectionRunState.FAILED, CollectionRunOutcome.decide(0, 0, CollectionErrorClass.AUTH_FAILED));
        assertEquals(CollectionRunState.FAILED, CollectionRunOutcome.decide(0, 0, CollectionErrorClass.INVALID_RESPONSE));
    }

    @Test
    void failureIsNeverConfusedWithAnEmptySuccess() {
        for (CollectionErrorClass errorClass : CollectionErrorClass.values()) {
            assertEquals(CollectionRunState.FAILED, CollectionRunOutcome.decide(0, 0, errorClass));
            assertEquals(CollectionRunState.PARTIAL, CollectionRunOutcome.decide(1, 0, errorClass));
        }
    }
}
