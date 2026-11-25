export const PAYER_CONTENT = { x: 0.58, y: 1.45, width: 12.16, height: 5.22, gap: 0.16 };
const FONT_SIZE = 9;
const LINE_HEIGHT = FONT_SIZE * 1.35 / 72;
const valueText = (value) => value === null || value === undefined || value === '' ? 'Not entered' : String(value);

// Conservative wrapping estimates reserve room for wide letters and explicit
// line breaks. Keep every character when splitting content over slides.
export function payerTextLines(value, capacity) {
  const source = String(value);
  const lines = [];
  let start = 0;
  while (start < source.length) {
    let end = Math.min(start + Math.max(2, capacity), source.length);
    const newline = source.indexOf('\n', start);
    if (newline >= start && newline < end) end = newline + 1;
    else if (end < source.length) {
      const space = source.lastIndexOf(' ', end - 1);
      if (space > start) end = space + 1;
      if (/[\uD800-\uDBFF]/.test(source[end - 1])) end -= 1;
    }
    lines.push(source.slice(start, end));
    start = end;
  }
  return lines.length ? lines : [''];
}

const charactersPerLine = (width, fontSize = FONT_SIZE) => Math.max(4, Math.floor((width - 0.22) * 72 / (fontSize * 0.7)));
const partText = (body, capacity, maxLines) => {
  const lines = payerTextLines(body, capacity);
  const parts = [];
  for (let index = 0; index < lines.length; index += maxLines) parts.push(lines.slice(index, index + maxLines).join(''));
  return parts;
};

export function layoutPayerFields(title, boxes, { executive = false } = {}) {
  const area = PAYER_CONTENT;
  const unit = (area.width - area.gap * 3) / 4;
  if (executive) {
    return [{ type: 'boxes', layout: 'payer', title, label: 'Payer Account Plan', boxes: boxes.map((box, index) => ({
      ...box, body: valueText(box.body), x: area.x + (index % 4) * (unit + area.gap), y: area.y + Math.floor(index / 4) * 2.54,
      w: unit, h: 2.38, fontSize: 9, titleFontSize: 9,
    })) }];
  }
  const source = boxes.length ? boxes : [{ title: 'Records', body: 'No records available.', compact: true }];
  const expanded = source.flatMap((box) => {
    const body = valueText(box.body);
    const span = box.compact ? 1 : body.length > 700 ? 4 : 2;
    const w = unit * span + area.gap * (span - 1);
    const maxLines = Math.floor((area.height - 1.2) / LINE_HEIGHT);
    return partText(body, charactersPerLine(w), maxLines).map((part, index) => {
      const heading = `${box.title}${index ? ' (continued)' : ''}`;
      const titleHeight = Math.max(0.2, payerTextLines(heading, charactersPerLine(w, 9)).length * 0.17);
      const bodyHeight = payerTextLines(part, charactersPerLine(w)).length * LINE_HEIGHT;
      return { ...box, title: heading, body: part, span, w, titleHeight, h: Math.min(area.height, Math.max(0.72, 0.36 + titleHeight + bodyHeight)), fontSize: box.compact ? 10 : FONT_SIZE, titleFontSize: 9 };
    });
  });
  const pages = [];
  let boxesOnPage = [], column = 0, y = area.y, rowHeight = 0;
  const finish = () => {
    if (boxesOnPage.length) pages.push({ type: 'boxes', layout: 'payer', title, label: 'Payer Account Plan', boxes: boxesOnPage });
    boxesOnPage = []; column = 0; y = area.y; rowHeight = 0;
  };
  for (const box of expanded) {
    if (column + box.span > 4) { y += rowHeight + area.gap; column = 0; rowHeight = 0; }
    if (y + box.h > area.y + area.height) finish();
    boxesOnPage.push({ ...box, x: area.x + column * (unit + area.gap), y });
    column += box.span;
    rowHeight = Math.max(rowHeight, box.h);
  }
  finish();
  return pages.map((page, index) => ({ ...page, chunkLabel: pages.length > 1 ? `${index + 1} / ${pages.length}` : '' }));
}

export function layoutPayerTable(title, columns, records, { preferredRowsPerSlide = 1, minimumFontSize = 8 } = {}) {
  const totalWeight = columns.reduce((sum, column) => sum + column.width, 0);
  const colWidths = columns.map((column) => column.width / totalWeight * PAYER_CONTENT.width);
  const headerHeight = Math.max(0.42, ...columns.map((column, index) => payerTextLines(column.label, charactersPerLine(colWidths[index], 8)).length * 0.15 + 0.14));
  let fontSize = 8;
  // Stakeholder tables aim for at least two complete records per slide. Use
  // smaller type only as needed; unusually long notes still paginate intact.
  if (preferredRowsPerSlide > 1 && records.length >= preferredRowsPerSlide) {
    const fits = () => {
      const heights = records.map((record) => Math.max(0.34, ...columns.map((column, index) =>
        payerTextLines(valueText(record[column.key]), charactersPerLine(colWidths[index], fontSize)).length * fontSize * 1.4 / 72 + 0.14
      ))).sort((first, second) => second - first);
      return headerHeight + heights.slice(0, preferredRowsPerSlide).reduce((sum, height) => sum + height, 0) <= PAYER_CONTENT.height;
    };
    while (fontSize > minimumFontSize && !fits()) fontSize = Math.max(minimumFontSize, fontSize - 0.25);
  }
  const lineHeight = fontSize * 1.4 / 72;
  const maxLines = Math.floor((PAYER_CONTENT.height - headerHeight - 0.24) / lineHeight);
  const expanded = records.flatMap((record, recordIndex) => {
    const cells = columns.map((column) => valueText(record[column.key]));
    const parts = cells.map((cell, index) => partText(cell, charactersPerLine(colWidths[index], fontSize), maxLines));
    return Array.from({ length: Math.max(...parts.map((cell) => cell.length)) }, (_, partIndex) => {
      const values = cells.map((cell, index) => parts[index][partIndex] ?? (parts[index].length === 1 && cell.length < 160 ? cell : ''));
      const height = Math.max(0.34, ...values.map((cell, index) => payerTextLines(cell, charactersPerLine(colWidths[index], fontSize)).length * lineHeight + 0.14));
      return { cells: values, height, recordIndex, continued: partIndex > 0 };
    });
  });
  const pages = [];
  let rows = [], height = headerHeight;
  const finish = () => { pages.push({ type: 'payer-table', title, label: 'Payer Account Plan', headers: columns.map((column) => column.label), colWidths, headerHeight, fontSize, rows }); rows = []; height = headerHeight; };
  for (const row of expanded) {
    if (rows.length && height + row.height > PAYER_CONTENT.height) finish();
    rows.push(row); height += row.height;
  }
  if (rows.length || !pages.length) finish();
  return pages.map((page, index) => ({ ...page, chunkLabel: pages.length > 1 ? `${index + 1} / ${pages.length}` : '' }));
}
