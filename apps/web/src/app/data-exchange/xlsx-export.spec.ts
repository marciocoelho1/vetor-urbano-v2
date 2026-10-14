import { describe, expect, it } from 'vitest';
import { createXlsxWorkbook } from './xlsx-export';

function readStoredEntry(packageBytes: Uint8Array, requestedName: string): string {
  const view = new DataView(packageBytes.buffer, packageBytes.byteOffset, packageBytes.byteLength);
  let offset = 0;
  while (offset + 30 < packageBytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = new TextDecoder().decode(packageBytes.subarray(nameStart, nameStart + nameLength));
    const bodyStart = nameStart + nameLength + extraLength;
    if (name === requestedName) {
      return new TextDecoder().decode(packageBytes.subarray(bodyStart, bodyStart + compressedSize));
    }
    offset = bodyStart + compressedSize;
  }
  throw new Error(`Entrada XLSX não encontrada: ${requestedName}`);
}

describe('XLSX export', () => {
  it('creates a valid Open XML package with escaped text and spreadsheet values', async () => {
    const packageBytes = await createXlsxWorkbook([
      {
        name: 'Eventos',
        rows: [
          ['Nome', 'Quantidade'],
          ['Tiroteio & alerta', 4],
        ],
      },
      { name: 'Fontes', rows: [['Origem'], ['Fonte demonstrativa']] },
    ]);
    const packageText = new TextDecoder().decode(packageBytes);

    expect(new DataView(packageBytes.buffer).getUint32(0, true)).toBe(0x04034b50);
    expect(packageText).toContain('[Content_Types].xml');
    expect(packageText).toContain('xl/worksheets/sheet2.xml');
    expect(packageText).toContain('Tiroteio &amp; alerta');
    expect(packageText).toContain('<v>4</v>');
  });

  it('writes readable widths, frozen headers, filters, and styled cells', async () => {
    const packageBytes = await createXlsxWorkbook([
      {
        name: 'Registros',
        rows: [
          ['ID', 'Título do registro'],
          ['VU-1', 'Interdição demonstrativa'],
        ],
        columnWidths: [18, 42],
      },
    ]);
    const sheetXml = readStoredEntry(packageBytes, 'xl/worksheets/sheet1.xml');
    const stylesXml = readStoredEntry(packageBytes, 'xl/styles.xml');

    expect(sheetXml).toContain('ySplit="1"');
    expect(sheetXml).toContain('topLeftCell="A2"');
    expect(sheetXml).toContain('<col min="1" max="1" width="18" customWidth="1"/>');
    expect(sheetXml).toContain('<autoFilter ref="A1:B2"/>');
    expect(sheetXml).toContain('<c r="A1" s="1"');
    expect(sheetXml).toContain('fitToWidth="1"');
    expect(sheetXml).toContain('orientation="landscape"');
    expect(stylesXml).toContain('<cellXfs count="4">');
    expect(stylesXml).toContain('wrapText="1"');
  });

  it('rejects duplicate or invalid worksheet names instead of writing a corrupt workbook', async () => {
    await expect(
      createXlsxWorkbook([
        { name: 'Eventos', rows: [] },
        { name: 'Eventos', rows: [] },
      ]),
    ).rejects.toThrow(/nome da aba/i);
  });
});
