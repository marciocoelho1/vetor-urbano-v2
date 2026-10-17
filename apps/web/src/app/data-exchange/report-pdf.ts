import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { DemoRecord, LocalFilters } from '../domain/occurrences';
import { summarizeReport } from '../domain/report-summary';

export interface PdfReportSnapshot {
  generatedAt: string;
  filters: LocalFilters;
  items: DemoRecord[];
  counts: {
    occurrences: number;
    happenings: number;
    mappedOccurrences: number;
    listOnlyOccurrences: number;
  };
}

function utcInstant(value?: Date): string {
  return value ? value.toISOString() : 'não definido';
}

export async function createReportPdf(
  snapshot: PdfReportSnapshot,
  filterSummary: string,
): Promise<Uint8Array> {
  let fontBytes: ArrayBuffer;
  try {
    const response = await fetch('/fonts/manrope-pdf-regular.ttf', { cache: 'no-store' });
    if (!response.ok) throw new Error('resposta não concluída');
    fontBytes = await response.arrayBuffer();
  } catch {
    throw new Error('A fonte local do PDF está indisponível. Tente novamente.');
  }
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, {
    subset: true,
    // Preserve individual letters in extracted text; PDF uses the locally derived static TTF.
    features: { liga: false },
  });
  const supported = new Set(font.getCharacterSet());
  const ink = rgb(0.15, 0.17, 0.21);
  const green = rgb(0.14, 0.46, 0.36);
  const muted = rgb(0.34, 0.38, 0.44);
  const margin = 44;
  const width = 595.28 - 2 * margin;
  const generated = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(snapshot.generatedAt));
  doc.setTitle('Vetor Urbano - Relatório de ocorrências');
  doc.setAuthor('Vetor Urbano');
  doc.setCreationDate(new Date(snapshot.generatedAt));
  doc.setModificationDate(new Date(snapshot.generatedAt));

  function safe(text: string): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    if ([...clean].some((character) => !supported.has(character.codePointAt(0)!)))
      throw new Error(
        'O recorte contém caracteres que a fonte do PDF não representa. Nenhum arquivo foi baixado.',
      );
    return clean;
  }
  function lines(text: string, size: number, available = width): string[] {
    const result: string[] = [];
    let line = '';
    for (const word of safe(text).split(' ')) {
      if (line && font.widthOfTextAtSize(`${line} ${word}`, size) <= available) {
        line += ` ${word}`;
        continue;
      }
      if (line) {
        result.push(line);
        line = '';
      }
      for (const character of word) {
        if (line && font.widthOfTextAtSize(line + character, size) > available) {
          result.push(line);
          line = '';
        }
        line += character;
      }
    }
    if (line) result.push(line);
    return result;
  }
  function newPage() {
    const page = doc.addPage([595.28, 841.89]);
    page.drawText('Vetor Urbano', { x: margin, y: 803, font, size: 14, color: green });
    page.drawLine({
      start: { x: margin, y: 790 },
      end: { x: margin + width, y: 790 },
      thickness: 1,
      color: green,
    });
    return page;
  }
  let page = newPage();
  let y = 766;
  function ensure(height: number): void {
    if (y - height < 52) {
      page = newPage();
      y = 766;
    }
  }
  function paragraph(text: string, size = 10, color = ink): void {
    for (const line of lines(text, size)) {
      ensure(size + 5);
      page.drawText(line, { x: margin, y, font, size, color });
      y -= size + 5;
    }
    y -= 7;
  }
  function heading(text: string): void {
    ensure(60);
    paragraph(text, 13, green);
  }
  const summary = summarizeReport(snapshot.items, snapshot.filters);
  paragraph('Relatório de ocorrências', 21);
  paragraph(`Gerado em ${generated} (America/Sao_Paulo)`, 10, muted);
  paragraph(`Momento original UTC: ${snapshot.generatedAt}`, 9, muted);
  paragraph(
    `${snapshot.counts.occurrences} ocorrências · ${snapshot.counts.happenings} acontecimentos`,
    14,
    green,
  );
  paragraph(
    `${snapshot.counts.mappedOccurrences} mapeadas · ${snapshot.counts.listOnlyOccurrences} apenas em lista`,
  );
  heading('Recorte gerado');
  paragraph(filterSummary);
  paragraph(`Período inicial UTC: ${utcInstant(snapshot.filters.start)}`, 9, muted);
  paragraph(`Período final exclusivo UTC: ${utcInstant(snapshot.filters.end)}`, 9, muted);
  paragraph('Fuso de apresentação: America/Sao_Paulo', 9, muted);
  heading('Precisão e interpretação');
  paragraph(
    `${summary.certain} certamente · ${summary.possible} possivelmente dentro do período · ${summary.unknown} sem classificação temporal suficiente.`,
  );
  paragraph(
    'Tempo agrupado por mês de Brasília, sem atribuir dia ou hora a intervalos. Categorias podem se sobrepor: não some categorias para inferir o total distinto. Referências e relacionados externos não aumentam os totais.',
  );
  paragraph(
    'Cobertura não aferida. Ausência de registros não comprova ausência de fatos. Dados sintéticos; nenhuma base estatística externa incluída.',
  );
  if (!snapshot.items.length)
    paragraph(
      'Recorte vazio: nenhum registro neste relatório gerado. Isso não comprova ausência de fatos ou de cobertura.',
    );
  for (const table of summary.tables) {
    heading(table.title);
    if (!table.rows.length) {
      paragraph('Nenhum registro neste recorte.');
      continue;
    }
    paragraph('Ocorrências distintas; escala relativa ao maior grupo deste gráfico.', 9, muted);
    const maximum = table.rows.reduce((largest, row) => Math.max(largest, row.count), 0);
    for (const row of table.rows) {
      const height = lines(row.label, 10).length * 15 + 30;
      ensure(Math.min(height, 700));
      paragraph(row.label);
      ensure(24);
      const barWidth = ((width - 48) * row.count) / maximum;
      page.drawRectangle({ x: margin, y: y - 6, width: barWidth, height: 7, color: green });
      const label = String(row.count);
      page.drawText(label, {
        x: margin + width - font.widthOfTextAtSize(label, 10),
        y: y - 6,
        font,
        size: 10,
        color: ink,
      });
      y -= 25;
    }
  }
  heading('Fontes');
  const sources = [
    ...new Set(
      snapshot.items.flatMap((item) =>
        (item.references ?? []).map((reference) => reference.sourceName),
      ),
    ),
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  if (!sources.length) paragraph('Sem fontes identificadas nas referências deste recorte.');
  for (const source of sources) paragraph(source);
  heading('Limitações');
  paragraph(
    'Documento do recorte completo disponível no momento original da geração. Não incorpora publicações posteriores sem atualização explícita. Dados e geometrias sintéticos do ambiente local; não usar para decisões operacionais.',
  );
  paragraph(
    'Intervalos aproximados preservam incerteza. Registros sem coordenada sustentada permanecem na alternativa em lista. Notas de fontes, fatores internos e dados administrativos não integram este documento.',
  );
  const pages = doc.getPages();
  pages.forEach((item, index) =>
    item.drawText(`Página ${index + 1} de ${pages.length}`, {
      x: margin,
      y: 27,
      font,
      size: 9,
      color: muted,
    }),
  );
  return doc.save();
}
