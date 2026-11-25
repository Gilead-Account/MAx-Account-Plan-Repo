import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { PAYER_CONTENT, layoutPayerFields, layoutPayerTable } from '../src/lib/export/payerAccountPlanPptLayout.js';
import { createAccountPlanPresentation } from '../src/lib/export/accountPlanPptRenderer.js';

const inside = (box) => {
  assert.ok(box.x >= PAYER_CONTENT.x);
  assert.ok(box.y >= PAYER_CONTENT.y);
  assert.ok(box.x + box.w <= PAYER_CONTENT.x + PAYER_CONTENT.width + 0.001);
  assert.ok(box.y + box.h <= PAYER_CONTENT.y + PAYER_CONTENT.height + 0.001);
};

test('eight Executive Summary sections share one slide with smaller fonts', () => {
  const fields = Array.from({ length: 8 }, (_, index) => ({ title: `Field ${index}`, body: 'Full account description '.repeat(10) }));
  const pages = layoutPayerFields('Executive Summary', fields, { executive: true });
  assert.equal(pages.length, 1);
  assert.equal(pages[0].boxes.length, 8);
  assert.deepEqual(pages[0].boxes.map((box) => box.body), fields.map((box) => box.body));
  for (const box of pages[0].boxes) { inside(box); assert.ok(box.fontSize <= 9); }
});

test('short dropdown values occupy small cards while notes receive more space', () => {
  const pages = layoutPayerFields('Landscape', [
    { title: 'Quality of Access Score', body: 'High', compact: true },
    { title: 'Medical Policy Published', body: 'Yes', compact: true },
    { title: 'Details', body: 'Full payer note. '.repeat(90) },
  ]);
  const boxes = pages.flatMap((page) => page.boxes);
  assert.ok(boxes[0].h < 1);
  assert.ok(boxes[0].w < PAYER_CONTENT.width / 3);
  assert.ok(boxes[2].w > boxes[0].w);
  for (const box of boxes) inside(box);
  for (const page of pages) {
    for (let index = 0; index < page.boxes.length; index++) {
      for (const second of page.boxes.slice(index + 1)) {
        const first = page.boxes[index];
        assert.ok(first.x + first.w <= second.x || second.x + second.w <= first.x || first.y + first.h <= second.y || second.y + second.h <= first.y);
      }
    }
  }
});

test('table slides repeat headers, preserve long cells, and stay above the footer', async () => {
  const note = ('Long payer notes with clear continuation. '.repeat(125)).slice(0, 5000);
  const columns = [{ key: 'name', label: 'Action', width: 2 }, { key: 'status', label: 'Status', width: 1 }, { key: 'notes', label: 'Next Steps', width: 5 }];
  const pages = layoutPayerTable('Actions', columns, [{ name: 'Action one', status: 'Open', notes: note }]);
  assert.ok(pages.length > 1);
  assert.equal(pages.flatMap((page) => page.rows).map((row) => row.cells[2]).join(''), note);
  assert.ok(pages.every((page) => page.rows.every((row) => row.cells[0] === 'Action one' && row.cells[1] === 'Open')));
  for (const page of pages) assert.ok(page.headerHeight + page.rows.reduce((sum, row) => sum + row.height, 0) <= PAYER_CONTENT.height);
  const presentation = createAccountPlanPresentation(pages, { title: 'Payer Plan' });
  const blob = await presentation.write({ outputType: 'blob' });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const files = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  assert.equal(files.length, pages.length);
  for (const file of files) {
    const xml = await zip.file(file).async('string');
    assert.match(xml, /<a:tbl>/);
    assert.match(xml, /Next Steps/);
    const rowHeight = [...xml.matchAll(/<a:tr h="(\d+)"/g)].reduce((sum, match) => sum + Number(match[1]) / 914400, 0);
    assert.ok(rowHeight <= PAYER_CONTENT.height + 0.01, `PowerPoint table height ${rowHeight} must fit the slide`);
  }
});

test('empty tables keep their column headers', async () => {
  const pages = layoutPayerTable('Empty', [{ key: 'name', label: 'Name', width: 1 }], []);
  const blob = await createAccountPlanPresentation(pages).write({ outputType: 'blob' });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file('ppt/slides/slide1.xml').async('string');
  assert.match(xml, /<a:tbl>/);
  assert.match(xml, /No records available/);
});
