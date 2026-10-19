import { describe, expect, it, vi, afterEach } from 'vitest';
import { QueryUpdateMonitor } from './query-update-monitor';

afterEach(() => vi.unstubAllGlobals());
describe('aviso persistente por revisão', () => {
  it('deduplica revisões, preserva aviso na falha e não troca o snapshot', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const changed = vi.fn();
    const monitor = new QueryUpdateMonitor(
      'occurrences',
      new URLSearchParams('radiusMeters=1000'),
      'a',
      changed,
    );
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify({ revision: 'b', checkedAt: '2026-10-19T15:00:00Z' })),
    );
    await monitor.check();
    expect(changed).toHaveBeenLastCalledWith({ revision: 'b', error: '' });
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify({ revision: 'b', checkedAt: '2026-10-19T15:00:05Z' })),
    );
    await monitor.check();
    expect(changed).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValueOnce(new Response('{}', { status: 503 }));
    await monitor.check();
    expect(changed).toHaveBeenLastCalledWith({
      revision: 'b',
      error: expect.stringContaining('Não foi possível verificar'),
    });
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify({ revision: 'c', checkedAt: '2026-10-19T15:00:15Z' })),
    );
    await monitor.check();
    expect(changed).toHaveBeenLastCalledWith({ revision: 'c', error: '' });
    monitor.destroy();
  });
  it('limpa o aviso quando o servidor retorna à revisão aplicada após uma falha', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const changed = vi.fn();
    const monitor = new QueryUpdateMonitor('occurrences', new URLSearchParams(), 'a', changed);
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ revision: 'b' })));
    await monitor.check();
    expect(changed).toHaveBeenLastCalledWith({ revision: 'b', error: '' });
    fetcher.mockRejectedValueOnce(new Error('offline'));
    await monitor.check();
    expect(changed).toHaveBeenLastCalledWith({ revision: 'b', error: expect.any(String) });
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ revision: 'a' })));
    await monitor.check();
    expect(changed).toHaveBeenLastCalledWith({ revision: '', error: '' });
    monitor.destroy();
  });
  it('descarta a resposta ao sair da consulta', async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      ),
    );
    const changed = vi.fn();
    const monitor = new QueryUpdateMonitor(
      'history/occurrences',
      new URLSearchParams(),
      'a',
      changed,
    );
    const pending = monitor.check();
    monitor.destroy();
    resolve(new Response(JSON.stringify({ revision: 'b' })));
    await pending;
    expect(changed).not.toHaveBeenCalled();
  });
});
