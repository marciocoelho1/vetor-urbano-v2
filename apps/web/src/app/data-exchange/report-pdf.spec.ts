import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DemoRecord } from '../domain/occurrences';
import { createReportPdf, reportCredits, type PdfReportSnapshot } from './report-pdf';

/**
 * Unidade limitada às falhas de leitura da fonte: o ambiente de testes web não expõe
 * tipos do Node para ler o TTF versionado. Paginação, textos extraídos e páginas
 * renderizadas são conferidos no Playwright, com o documento real.
 */
const record: DemoRecord = {
  id: 'vu-unit-1',
  kind: 'occurrence',
  happeningId: 'event-1',
  name: 'Ocorrência sintética',
  description: 'Fato fictício sem dados pessoais.',
  municipality: 'Rio de Janeiro',
  neighborhood: 'Centro',
  locationPrecision: 'POINT',
  category: 'TRANSITO',
  occurrenceType: 'ACIDENTE',
  subtype: 'COLISAO',
  reliabilityScore: 3,
  publicationStatus: 'PUBLISHED',
  occurredAt: '2026-10-15T12:00:00Z',
  situation: 'UNKNOWN',
  coordinates: [-43.19, -22.9],
};

const snapshot: PdfReportSnapshot = {
  generatedAt: '2026-10-15T15:00:00Z',
  filters: { start: new Date('2026-10-14T15:00:00Z'), end: new Date('2026-10-15T15:00:00Z') },
  items: [record],
  counts: {
    occurrences: 1,
    happenings: 1,
    mappedOccurrences: 1,
    listOnlyOccurrences: 0,
  },
};

afterEach(() => vi.unstubAllGlobals());

describe('PDF do relatório gerado', () => {
  it('traduz falha de rede na fonte para mensagem segura em português', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    await expect(createReportPdf(snapshot, 'Pilar: Trânsito')).rejects.toThrow(
      'A fonte local do PDF está indisponível. Tente novamente.',
    );
  });

  it('trata resposta sem sucesso da fonte como indisponibilidade, sem arquivo parcial', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false })),
    );

    await expect(createReportPdf(snapshot, 'Pilar: Trânsito')).rejects.toThrow(
      'A fonte local do PDF está indisponível. Tente novamente.',
    );
  });

  it('lista o crédito da fonte autorizada uma única vez e sem entradas vazias', () => {
    expect(reportCredits()).toEqual([]);
    expect(reportCredits([])).toEqual([]);
    expect(reportCredits(['', '   '])).toEqual([]);
    expect(
      reportCredits([
        'Fonte: Instituto Fogo Cruzado',
        ' Fonte: Instituto Fogo Cruzado ',
        'Fonte: outra fonte autorizada',
      ]),
    ).toEqual(['Fonte: Instituto Fogo Cruzado', 'Fonte: outra fonte autorizada']);
  });
});
