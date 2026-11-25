import { PAYER_CONTENT } from './payerAccountPlanPptLayout.js';

const FONT = 'Trebuchet MS';
export function addPayerFieldsSlide(pres, slide, specification) {
  for (const box of specification.boxes) {
    slide.addShape(pres.ShapeType.roundRect, {
      x: box.x, y: box.y, w: box.w, h: box.h, rectRadius: 0.06,
      fill: { color: 'FFFFFF' }, line: { color: 'BFD6E6', width: 0.7 },
    });
    const titleHeight = box.titleHeight || 0.46;
    slide.addText(box.title, {
      x: box.x + 0.12, y: box.y + 0.12, w: box.w - 0.24, h: titleHeight,
      fontFace: FONT, fontSize: box.titleFontSize, bold: true, color: '004B7C',
      margin: 0, fit: 'shrink', valign: 'top',
    });
    slide.addText(box.body, {
      x: box.x + 0.12, y: box.y + titleHeight + 0.2, w: box.w - 0.24, h: Math.max(0.2, box.h - titleHeight - 0.3),
      fontFace: FONT, fontSize: box.fontSize, color: '233243', margin: 0,
      fit: 'shrink', valign: 'top', breakLine: false,
    });
  }
}

export function addPayerTableSlide(slide, specification) {
  const cell = (value, options = {}) => ({ text: String(value), options: { fontFace: FONT, fontSize: specification.fontSize, margin: 0.035, valign: 'top', color: '233243', ...options } });
  const rows = [
    specification.headers.map((header) => cell(header, { bold: true, color: 'FFFFFF', fill: { color: '0065A8' } })),
    ...specification.rows.map((row) => row.cells.map((value) => cell(value, { fill: { color: row.recordIndex % 2 ? 'F6FAFD' : 'FFFFFF' } }))),
  ];
  slide.addTable(rows, {
    x: PAYER_CONTENT.x, y: PAYER_CONTENT.y, w: PAYER_CONTENT.width,
    colW: specification.colWidths, rowH: [specification.headerHeight, ...specification.rows.map((row) => row.height)],
    border: { pt: 0.5, color: 'BFD6E6' }, autoPage: false, margin: 0.035, valign: 'top',
  });
  if (!specification.rows.length) {
    slide.addText('No records available.', { x: PAYER_CONTENT.x, y: PAYER_CONTENT.y + specification.headerHeight + 0.2, w: PAYER_CONTENT.width, h: 0.4, fontFace: FONT, fontSize: 11, color: '55565C', margin: 0 });
  }
}
