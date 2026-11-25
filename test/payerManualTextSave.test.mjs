import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { transform } from 'esbuild';

const source = await readFile(new URL('../src/pages/ExecutiveSummary/index.jsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../src/lib/dataservice/accountPlan/payerExecutiveSummary.js', import.meta.url), 'utf8');
const configs = vm.runInNewContext(service.match(/export const ACCOUNT_DETAIL_FIELD_CONFIG = (\[[\s\S]*?\]);/)[1]);
const { code } = await transform(source.replace(/^import[\s\S]*?from ['"][^'"]+['"];?\n/gm, '').replace('export default function', 'function'), { loader: 'jsx', jsxFactory: 'h' });
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function harness(save = async () => {}) {
  const cells = [], effects = [], cleanup = [], writes = [], queued = [], notices = [];
  const listeners = {};
  let cursor = 0, tree;
  const events = {
    addEventListener: (name, callback) => { listeners[name] = callback; },
    removeEventListener: (name) => { delete listeners[name]; },
  };
  const context = {
    React: { Fragment: 'fragment' },
    h: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState(initial) { const i = cursor++; if (!(i in cells)) cells[i] = initial; return [cells[i], (next) => { cells[i] = typeof next === 'function' ? next(cells[i]) : next; }]; },
    useRef(initial) { const i = cursor++; return cells[i] ||= { current: initial }; },
    useMemo: (callback) => callback(),
    useEffect(callback, deps) { const i = cursor++; if (!cells[i] || deps.some((value, key) => value !== cells[i][key])) { effects.push(() => { cleanup[i]?.(); cleanup[i] = callback(); }); cells[i] = deps; } },
    window: events, document: { ...events, visibilityState: 'hidden' },
    ACCOUNT_DETAIL_FIELD_CONFIG: configs, ANITO_LAUNCH_CONFIG: [],
    loadPayerExecutiveSummary: async () => ({ planId: 'plan-1', accountDetails: Object.fromEntries(configs.map(({ key }) => [key, { value: 'Original', updatedDate: '2026-01-01' }])), payerRestrictiveness: { options: [] }, anitoCelLaunch: {}, keyWins: [], customerAsks: [] }),
    updatePayerSummaryPlanField: (...args) => { writes.push(args); return save(...args); },
    createFieldQueue: () => ({ change: (...args) => queued.push(args), flush() {} }),
    notifySaved: () => notices.push('saved'), stableSortRows: (rows) => rows,
    formatDate: (value) => value || '', formatKeyWinDate: () => '',
    AutoSizeTextarea: 'textarea', CharacterUsage: 'counter', ModalForm: 'form',
    Icon: 'icon', FieldHelpButton: 'help', Payer360Badge: 'badge', TableSortButton: 'sort',
  };
  vm.createContext(context);
  vm.runInContext(code + '\nthis.Page = ExecutiveSummaryPage;', context);
  const nodes = (node) => !node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(nodes)];
  const render = () => { cursor = 0; tree = context.Page(); while (effects.length) effects.shift()(); };
  const find = (predicate) => nodes(tree).find(predicate);
  const field = (label) => find((node) => node.type === 'textarea' && node.props['aria-label'] === label);
  const button = (label) => find((node) => node.type === 'button' && node.props['aria-label'] === `Save ${label}`);
  render(); await tick(); render();
  return { render, field, button, find, writes, queued, notices, listeners, dispose: () => cleanup.forEach((callback) => callback?.()) };
}

test('all four fields require their own Save; typing, blur and page exit never save drafts', async () => {
  const page = await harness();
  for (const { label } of configs) {
    assert.equal(page.button(label).props.disabled, true);
    page.field(label).props.onChange({ target: { value: `Edited ${label}` } });
    page.render();
    assert.equal(page.button(label).props.disabled, false);
    page.field(label).props.onBlur?.();
  }
  page.listeners.pagehide();
  page.listeners.visibilitychange();
  assert.equal(page.writes.length, 0);
  assert.equal(page.queued.length, 0);
  await page.button(configs[0].label).props.onClick();
  page.render();
  assert.deepEqual(page.writes[0], ['plan-1', configs[0].field, configs[0].updatedField, `Edited ${configs[0].label}`]);
  assert.equal(page.button(configs[0].label).props.disabled, true);
  assert.equal(page.button(configs[1].label).props.disabled, false);
  assert.equal(page.notices.length, 1);
  page.dispose();
  assert.equal(page.writes.length, 1);
});

test('failed saves preserve drafts for retry and duplicate clicks cannot write twice', async () => {
  let reject;
  let pending = new Promise((yes, no) => { reject = no; });
  const page = await harness(() => pending);
  const label = configs[0].label;
  page.field(label).props.onChange({ target: { value: 'Draft' } });
  page.render();
  const click = page.button(label).props.onClick;
  const first = click();
  await click();
  page.render();
  assert.equal(page.writes.length, 1);
  assert.equal(page.field(label).props.disabled, true);
  reject(new Error('CRM unavailable'));
  await first;
  page.render();
  assert.equal(page.field(label).props.value, 'Draft');
  assert.equal(page.button(label).props.disabled, false);
  assert.equal(page.find((node) => node.props.role === 'alert').children[0], 'CRM unavailable');
  assert.equal(page.notices.length, 0);
  pending = Promise.resolve();
  await page.button(label).props.onClick();
  page.render();
  assert.equal(page.button(label).props.disabled, true);
  assert.equal(page.writes.length, 2);
  assert.equal(page.notices.length, 1);
  page.dispose();
});
