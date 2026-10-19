import { checkPersistedQueryUpdates } from './persisted-query';

/** Compara apenas o recorte aplicado; nunca substitui seu conteúdo. */
export class QueryUpdateMonitor {
  private readonly abort = new AbortController();
  private busy = false;
  private pendingRevision = '';
  private error = '';

  constructor(
    private readonly resource: 'occurrences' | 'history/occurrences',
    private readonly params: URLSearchParams,
    private readonly appliedRevision: string,
    private readonly changed: (state: { revision: string; error: string }) => void,
  ) {}

  async check(): Promise<void> {
    if (this.busy || this.abort.signal.aborted) return;
    this.busy = true;
    let revision = this.pendingRevision;
    let error = '';
    try {
      const result = await checkPersistedQueryUpdates(
        this.resource,
        this.params,
        this.abort.signal,
      );
      if (!result.revision) throw new Error('Revisão ausente.');
      revision = result.revision === this.appliedRevision ? '' : result.revision;
    } catch {
      error =
        'Não foi possível verificar atualizações. O último resultado foi preservado; a verificação será tentada novamente.';
    } finally {
      this.busy = false;
    }
    if (this.abort.signal.aborted) return;
    if (revision !== this.pendingRevision || error !== this.error) {
      this.pendingRevision = revision;
      this.error = error;
      this.changed({ revision, error });
    }
  }

  destroy(): void {
    this.abort.abort();
  }
}
