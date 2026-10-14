export type SpreadsheetCell = string | number | boolean | Date | null | undefined;

export interface SpreadsheetSheet {
  name: string;
  rows: SpreadsheetCell[][];
  titleRows?: number;
  headerRows?: number;
  labelColumns?: number[];
  columnWidths?: number[];
  autoFilter?: boolean;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const UTF8 = new TextEncoder();
const SHEET_NAME_INVALID = /[\\/?*:[\]]/;
const CRC32_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function xmlEscape(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function columnName(index: number): string {
  let current = index + 1;
  let result = '';
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

function cellXml(value: SpreadsheetCell, reference: string, styleId = 0): string {
  const style = ` s="${styleId}"`;
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return `<c r="${reference}"${style}><v>${value}</v></c>`;
  }
  if (typeof value === 'boolean') {
    return `<c r="${reference}"${style} t="b"><v>${value ? 1 : 0}</v></c>`;
  }
  const text = value instanceof Date ? value.toISOString() : value;
  return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(text)}</t></is></c>`;
}

function worksheetXml(sheet: SpreadsheetSheet): string {
  const rows = sheet.rows;
  const titleRows = Math.min(rows.length, Math.max(0, sheet.titleRows ?? 0));
  const headerRows = Math.min(rows.length - titleRows, Math.max(0, sheet.headerRows ?? 1));
  const frozenRows = titleRows + headerRows;
  const columnCount = Math.max(1, ...rows.map((row) => row.length));
  const columnsXml = Array.from({ length: columnCount }, (_, columnIndex) => {
    const contentWidth = Math.max(
      10,
      ...rows.map((row) => {
        const value = row[columnIndex];
        return value === null || value === undefined ? 0 : String(value).length;
      }),
    );
    const width = sheet.columnWidths?.[columnIndex] ?? Math.min(48, contentWidth + 2);
    return `<col min="${columnIndex + 1}" max="${columnIndex + 1}" width="${width}" customWidth="1"/>`;
  }).join('');
  const sheetViews =
    frozenRows > 0
      ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${frozenRows}" topLeftCell="A${frozenRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
      : '';
  const sheetProperties = '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>';
  const autoFilter =
    sheet.autoFilter !== false && headerRows > 0 && rows.length > 0
      ? `<autoFilter ref="A${titleRows + 1}:${columnName(columnCount - 1)}${rows.length}"/>`
      : '';
  const rowXml = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          let styleId = rowIndex < titleRows ? 2 : rowIndex < frozenRows ? 1 : 0;
          if (rowIndex >= frozenRows && sheet.labelColumns?.includes(columnIndex)) {
            styleId = 3;
          }
          return cellXml(value, `${columnName(columnIndex)}${rowIndex + 1}`, styleId);
        })
        .join('');
      const height =
        rowIndex < titleRows
          ? ' ht="30" customHeight="1"'
          : rowIndex < frozenRows
            ? ' ht="34" customHeight="1"'
            : '';
      return `<row r="${rowIndex + 1}"${height}>${cells}</row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${sheetProperties}${sheetViews}<sheetFormatPr defaultRowHeight="18"/><cols>${columnsXml}</cols><sheetData>${rowXml}</sheetData>${autoFilter}<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}

function buildPackageFiles(sheets: SpreadsheetSheet[]): ZipEntry[] {
  const sheetOverrides = sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('');
  const sheetNodes = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join('');
  const worksheetRelationships = sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join('');
  const styleRelationshipId = `rId${sheets.length + 1}`;

  return [
    {
      name: '[Content_Types].xml',
      data: UTF8.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetOverrides}</Types>`,
      ),
    },
    {
      name: '_rels/.rels',
      data: UTF8.encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      ),
    },
    {
      name: 'xl/workbook.xml',
      data: UTF8.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetNodes}</sheets></workbook>`,
      ),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: UTF8.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${worksheetRelationships}<Relationship Id="${styleRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      ),
    },
    {
      name: 'xl/styles.xml',
      data: UTF8.encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FF18181B"/><sz val="16"/><name val="Calibri"/></font><font><b/><color rgb="FF18181B"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD4D4D8"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
      ),
    },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: UTF8.encode(worksheetXml(sheet)),
    })),
  ];
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC32_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function write16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function write32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

function dosTimestamp(date: Date): { time: number; day: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day:
      ((Math.max(1980, date.getFullYear()) - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
  };
}

function concatenate(chunks: Uint8Array[], totalLength: number): Uint8Array {
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function zipStore(entries: ZipEntry[]): Uint8Array {
  if (entries.length > 65_535) throw new Error('A planilha excede o limite de arquivos XLSX.');
  const stamp = dosTimestamp(new Date());
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let localOffset = 0;
  let centralSize = 0;

  for (const entry of entries) {
    const name = UTF8.encode(entry.name);
    const checksum = crc32(entry.data);
    if (entry.data.length > 0xffffffff)
      throw new Error('A planilha excede o limite suportado pelo formato XLSX.');

    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    write32(localView, 0, 0x04034b50);
    write16(localView, 4, 20);
    write16(localView, 6, 0x0800);
    write16(localView, 8, 0);
    write16(localView, 10, stamp.time);
    write16(localView, 12, stamp.day);
    write32(localView, 14, checksum);
    write32(localView, 18, entry.data.length);
    write32(localView, 22, entry.data.length);
    write16(localView, 26, name.length);
    write16(localView, 28, 0);
    local.set(name, 30);
    localChunks.push(local, entry.data);
    localOffset += local.length + entry.data.length;

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    write32(centralView, 0, 0x02014b50);
    write16(centralView, 4, 20);
    write16(centralView, 6, 20);
    write16(centralView, 8, 0x0800);
    write16(centralView, 10, 0);
    write16(centralView, 12, stamp.time);
    write16(centralView, 14, stamp.day);
    write32(centralView, 16, checksum);
    write32(centralView, 20, entry.data.length);
    write32(centralView, 24, entry.data.length);
    write16(centralView, 28, name.length);
    write16(centralView, 30, 0);
    write16(centralView, 32, 0);
    write16(centralView, 34, 0);
    write16(centralView, 36, 0);
    write32(centralView, 38, 0);
    write32(centralView, 42, localOffset - local.length - entry.data.length);
    central.set(name, 46);
    centralChunks.push(central);
    centralSize += central.length;
  }

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  write32(endView, 0, 0x06054b50);
  write16(endView, 4, 0);
  write16(endView, 6, 0);
  write16(endView, 8, entries.length);
  write16(endView, 10, entries.length);
  write32(endView, 12, centralSize);
  write32(endView, 16, localOffset);
  write16(endView, 20, 0);

  return concatenate(
    [...localChunks, ...centralChunks, end],
    localOffset + centralSize + end.length,
  );
}

export async function createXlsxWorkbook(sheets: SpreadsheetSheet[]): Promise<Uint8Array> {
  if (!sheets.length) throw new Error('A planilha precisa ter ao menos uma aba.');
  const names = new Set<string>();
  for (const sheet of sheets) {
    if (!sheet.name.trim() || sheet.name.length > 31 || SHEET_NAME_INVALID.test(sheet.name)) {
      throw new Error('Cada aba precisa ter nome válido de até 31 caracteres.');
    }
    const normalizedName = sheet.name.toLocaleLowerCase('pt-BR');
    if (names.has(normalizedName)) throw new Error('Não repita o nome da aba na planilha.');
    names.add(normalizedName);
  }
  return zipStore(buildPackageFiles(sheets));
}
