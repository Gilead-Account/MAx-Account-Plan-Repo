import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { createServer } from 'vite';
import { buildPayerAccountPlanSlides, paginatePayerBoxes } from '../src/lib/export/payerAccountPlanPptSections.js';
import { createAccountPlanPresentation } from '../src/lib/export/accountPlanPptRenderer.js';

const sample = () => ({
  account: { planName: 'Example Payer Plan', accountName: 'Example Payer', kadOwner: 'Owner', marketplace: 'National', eid: '123' },
  summary: { accountDetails: { geographicFootprint: { value: 'National footprint' } }, payerRestrictiveness: { value: 'follower', definition: 'Definition supplied by CRM formula', options: [{ value: 'follower', label: 'CAR T Follower' }] }, anitoCelLaunch: { options: {} }, keyWins: [{ description: 'Payer key win', impact: 'Improved access' }], customerAsks: [{ stakeholderName: 'Payer contact', description: 'Payer request' }] },
  landscape: { networkDetails: {}, policyDetails: { Reimbursement: { 'CAR T (Class)': { value: 'Medical benefit' } } } },
  assessments: { assessments: { kite: { title: 'Willingness to Partner with Kite', position: 'High', comments: 'Partner comment' } } },
  stakeholders: { stakeholders: [{ name: 'Stakeholder name', topicsEvidence: 'Evidence topic' }] },
  launch: { form: { policyContextNotes: 'Launch policy notes' }, options: {} },
  hierarchy: { hierarchy: [{ id: 'o1', objective: 'Completed objective', status: 'Completed', strategies: Array.from({ length: 6 }, (_, index) => ({ id: `s${index}`, strategy: `Strategy ${index + 1}`, status: 'Open', tactics: [{ value: `Tactic ${index + 1}`, status: 'Open' }] })) }] },
  actions: { actions: [{ action: 'Critical action', linkedStrategyId: 's5', nextSteps: 'Action next steps', timing: '2026-10-22T15:31:45.000Z' }], statusOptions: [] },
  milestones: { milestones: [{ milestone: 'Payer engagement', nextSteps: 'Engagement next steps' }], additionalNotes: { value: 'Shared milestone note' }, statusOptions: [] },
  issues: { records: [{ type: 'Barrier', name: 'Payer barrier', objectiveId: 'o1', strategyId: 's5', details: 'Barrier details' }, { type: 'Opportunity', name: 'Payer opportunity', objectiveId: 'o1', details: 'Opportunity details' }] },
});

test('payer export includes every section, completed objectives, and strategies beyond three', async () => {
  const data = sample();
  const slides = buildPayerAccountPlanSlides(data);
  const executiveSlides = slides.filter((slide) => slide.title === 'Executive Summary');
  assert.equal(executiveSlides.length, 1);
  assert.equal(executiveSlides[0].boxes.length, 8);
  for (const title of ['Key Wins', 'Key Payer Asks', 'Stakeholder Map', 'Objectives, Strategies & Tactics / Resources', 'Action & Critical Next Steps', 'Milestones & Engagements']) {
    assert.ok(slides.some((slide) => slide.title === title && slide.type === 'payer-table'), title);
  }
  const text = JSON.stringify(slides);
  for (const expected of ['National footprint', 'Payer key win', 'Payer request', 'Medical benefit', 'Partner comment', 'Evidence topic', 'Launch policy notes', 'Completed objective', 'Strategy 6', 'Tactic 6', 'Action next steps', 'Engagement next steps', 'Shared milestone note', 'Barrier details', 'Opportunity details', 'Definition supplied by CRM formula']) assert.ok(text.includes(expected), expected);
  const presentation = createAccountPlanPresentation(slides, { title: data.account.planName });
  const blob = await presentation.write({ outputType: 'blob' });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  assert.ok(zip.file('[Content_Types].xml'));
  const slideFiles = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  assert.equal(slideFiles.length, slides.length);
  const xml = (await Promise.all(slideFiles.map((name) => zip.file(name).async('string')))).join('\n');
  assert.match(xml, /Example Payer Plan/);
  assert.match(xml, /Critical action/);
  assert.match(xml, /Opportunity details/);
  assert.match(xml, /Oct 22, 2026/);
  assert.doesNotMatch(xml, /15:31:45|T15:31/);
});

test('hierarchy tables retain each objective, strategy, tactic, and status, including empty branches', async () => {
  const data = sample();
  data.hierarchy.hierarchy.push({ id: 'o2', objective: 'Objective without strategies', status: 'Open', strategies: [] });
  data.hierarchy.hierarchy.push({ id: 'o3', objective: 'Objective with empty strategy', status: 'Open', strategies: [{ id: 'empty-strategy', strategy: 'Strategy without tactics', status: 'Completed', tactics: [] }] });
  const pages = buildPayerAccountPlanSlides(data).filter((slide) => slide.title === 'Objectives, Strategies & Tactics / Resources');
  assert.ok(pages.every((page) => page.type === 'payer-table'));
  assert.deepEqual(pages[0].headers, ['Objective', 'Objective Status', 'Strategy', 'Strategy Status', 'Tactic / Resource', 'Tactic / Resource Status']);
  const rows = pages.flatMap((page) => page.rows);
  assert.equal(rows.length, 8);
  for (let index = 0; index < 6; index++) {
    assert.match(rows[index].cells[0], /Completed objective/);
    assert.equal(rows[index].cells[1], 'Completed');
    assert.ok(rows[index].cells[2].includes(`Strategy ${index + 1}`));
    assert.equal(rows[index].cells[3], 'Open');
    assert.ok(rows[index].cells[4].includes(`Tactic ${index + 1}`));
    assert.equal(rows[index].cells[5], 'Open');
  }
  assert.match(rows[6].cells[0], /Objective without strategies/);
  assert.equal(rows[6].cells[2], 'No strategies');
  assert.match(rows[7].cells[2], /Strategy without tactics/);
  assert.equal(rows[7].cells[3], 'Completed');
  assert.equal(rows[7].cells[4], 'No tactics / resources');
  const blob = await createAccountPlanPresentation(pages).write({ outputType: 'blob' });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  for (let index = 0; index < pages.length; index++) {
    const xml = await zip.file(`ppt/slides/slide${index + 1}.xml`).async('string');
    assert.match(xml, /<a:tbl>/);
    assert.equal([...xml.matchAll(/<a:gridCol /g)].length, 6);
    assert.match(xml, /Objective Status/);
    assert.match(xml, /Tactic \/ Resource Status/);
  }
});

test('long notes are paginated without dropping characters and empty sections are explicit', () => {
  const note = 'Start ' + 'Long payer note. '.repeat(350) + 'Unique final sentence';
  const slides = paginatePayerBoxes('Notes', [{ title: 'Details', body: note }]);
  assert.ok(slides.length > 1);
  assert.equal(slides.flatMap((slide) => slide.boxes).map((box) => box.body).join(''), note);
  assert.equal(paginatePayerBoxes('Empty', [])[0].boxes[0].body, 'No records available.');
});

test('Stakeholder Map fits two records per slide even with full-length notes', async () => {
  const data = sample();
  const fill = (value, length) => value.repeat(Math.ceil(length / value.length)).slice(0, length);
  data.stakeholders.stakeholders = Array.from({ length: 4 }, (_, index) => ({
    name: `Stakeholder ${index + 1} ` + fill('Name ', 80), roleFunction: fill('Director ', 100), contactInformation: fill('contact@example.com ', 100),
    decisionAreas: fill('Decision area ', 250), influence: fill('Influence notes ', 250), relationshipStrength: 'Strong', topicsEvidence: fill(`Evidence topic ${index + 1}. `, 1000),
  }));
  const pages = buildPayerAccountPlanSlides(data).filter((slide) => slide.title === 'Stakeholder Map');
  assert.equal(pages.length, 2);
  for (const page of pages) {
    assert.equal(new Set(page.rows.map((row) => row.recordIndex)).size, 2);
    assert.ok(page.fontSize >= 7);
    assert.ok(page.rows.every((row) => !row.continued));
    assert.ok(page.headerHeight + page.rows.reduce((sum, row) => sum + row.height, 0) <= 5.22);
  }
  const presentation = createAccountPlanPresentation(pages, { title: data.account.planName });
  const zip = await JSZip.loadAsync(await (await presentation.write({ outputType: 'blob' })).arrayBuffer());
  for (let index = 0; index < pages.length; index++) {
    const xml = await zip.file(`ppt/slides/slide${index + 1}.xml`).async('string');
    assert.match(xml, /<a:tbl>/);
    const tableHeight = [...xml.matchAll(/<a:tr h="(\d+)"/g)].reduce((sum, match) => sum + Number(match[1]) / 914400, 0);
    assert.ok(tableHeight <= 5.23);
  }
});

test('export preparation reads the selected payer plan and reflects newly saved CRM content', async () => {
  const previousWindow = globalThis.window;
  const storage = new Map();
  globalThis.window = { location: { search: '', hostname: 'localhost' }, localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) } };
  let server;
  try {
    server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
    const service = await server.ssrLoadModule('/src/lib/export/payerAccountPlanPpt.js');
    const summaryService = await server.ssrLoadModule('/src/lib/dataservice/accountPlan/payerExecutiveSummary.js');
    const { planId } = await summaryService.loadPayerExecutiveSummary();
    await summaryService.updatePayerSummaryPlanField(planId, 'KPH_Geographic_Footprint__c', 'KPH_Geographic_Footprint_updated_date__c', 'Freshly saved payer geography');
    const prepared = await service.preparePayerAccountPlanPpt(planId);
    assert.ok(prepared.blob.size > 1000);
    assert.match(prepared.fileName, /\.pptx$/);
    const zip = await JSZip.loadAsync(await prepared.blob.arrayBuffer());
    const xml = (await Promise.all(Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).map((name) => zip.file(name).async('string')))).join('\n');
    assert.match(xml, /Freshly saved payer geography/);
    await assert.rejects(service.loadPayerExportData('wrong-plan'), /selected Account Plan changed/);
    await assert.rejects(service.loadPayerExportData(null), /Select a Payer Account Plan/);
  } finally {
    await server?.close();
    globalThis.window = previousWindow;
  }
});
