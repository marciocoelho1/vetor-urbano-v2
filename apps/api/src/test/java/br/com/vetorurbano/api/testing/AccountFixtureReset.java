package br.com.vetorurbano.api.testing;

/** SQL compartilhado para limpar fixtures de conta e os dados que dependem delas. */
public final class AccountFixtureReset {
    public static final String SQL = """
            TRUNCATE collection_backfill_windows, collection_run_events, collection_items,
                collection_runs, collection_sources, occurrence_verifications, occurrence_reliability_evaluations,
                territorial_audit_events,
                territorial_approvals, territorial_versions, territorial_identities, correction_editor_audit,
                occurrence_editor_preparations, clipping_review_decisions, publication_versions, clipping_reviews,
                correction_decisions, correction_requests, correction_area_targets, auth_audit_events, local_sessions,
                auth_request_limits, account_email_change_tokens, account_recovery_tokens, account_audit_events,
                account_confirmation_tokens, account_request_limits, source_audit_events, source_versions,
                source_access_configurations, historical_actors, local_accounts RESTART IDENTITY
            """;

    private AccountFixtureReset() {}
}
