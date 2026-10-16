import { afterEach, describe, expect, it, vi } from 'vitest';
import { createManagedSource, fetchPublicSources, updateManagedSource } from './source-api';

afterEach(() => vi.unstubAllGlobals());

describe('source API boundary', () => {
  it('loads the public projection without requesting administrative fields', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ name: 'Fonte sintética', url: null }],
      }),
    });
    vi.stubGlobal('fetch', fetch);

    const items = await fetchPublicSources();

    expect(items).toEqual([{ name: 'Fonte sintética', url: null }]);
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:8080/api/v1/sources', {
      signal: undefined,
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  });

  it('sends the server CSRF token and expected version for administrative writes', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ id: 'synthetic-id', version: 2 }) });
    vi.stubGlobal('fetch', fetch);
    const draft = {
      name: 'Fonte sintética',
      channel: 'Canal concreto',
      url: null,
      territories: ['Rio de Janeiro'],
      pillars: ['TRANSITO' as const],
      accessMethod: 'MANUAL' as const,
      rating: 4,
      ratingJustification: 'Avaliação fictícia.',
    };

    await createManagedSource(draft, 'csrf-sintético');
    await updateManagedSource('synthetic-id', draft, 1, 'csrf-sintético');

    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': 'csrf-sintético' },
      body: JSON.stringify(draft),
    });
    expect(fetch.mock.calls[1][1]).toMatchObject({
      method: 'PUT',
      headers: { 'X-CSRF-Token': 'csrf-sintético' },
      body: JSON.stringify({ ...draft, expectedVersion: 1 }),
    });
  });
});
