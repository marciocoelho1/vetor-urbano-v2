import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkPersistedQueryUpdates, recordPersistedPdfExport } from './persisted-query';

afterEach(() => vi.unstubAllGlobals());
describe('sondagem da consulta aplicada', () => {
  it('retirada bloqueia PDF e orienta atualizar explicitamente sem prometer arquivo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'SNAPSHOT_UNAVAILABLE' } }), {
          status: 409,
        }),
      ),
    );
    await expect(
      recordPersistedPdfExport(
        {},
        {
          generatedAt: '2026-10-15T15:00:00Z',
          counts: {
            occurrences: 1,
            happenings: 1,
            mappedOccurrences: 1,
            listOnlyOccurrences: 0,
            temporallyCertain: 1,
            temporallyPossible: 0,
          },
          outcome: 'SUCCEEDED',
        },
        'csrf',
      ),
    ).rejects.toThrow('Atualize explicitamente o relatório');
  });
  it('sonda o mesmo recorte sem alterar parâmetros e sem cache, sem baixar ocorrências', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ checkedAt: '2026-10-19T15:00:00Z', revision: 'opaque-b' })),
      );
    vi.stubGlobal('fetch', fetcher);
    const params = new URLSearchParams('periodEnd=2026-10-15T15%3A00%3A00Z&category=TRANSITO');
    const result = await checkPersistedQueryUpdates(
      'occurrences',
      params,
      new AbortController().signal,
    );
    expect(result.revision).toBe('opaque-b');
    const [url, options] = fetcher.mock.calls[0];
    expect(new URL(url).searchParams.get('periodEnd')).toBe('2026-10-15T15:00:00Z');
    expect(new URL(url).searchParams.get('checkUpdates')).toBe('true');
    expect(params.has('checkUpdates')).toBe(false);
    expect(options.cache).toBe('no-store');
    expect(options.credentials).toBe('include');
  });
});
