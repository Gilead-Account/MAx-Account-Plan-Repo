import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { transform } from 'esbuild';

const source = await readFile(new URL('../src/components/MarketAccessSidebar.jsx', import.meta.url), 'utf8');
const { code } = await transform(source.replace(/^import .*;\n/gm, '').replace('export default function', 'function'), { loader: 'jsx', jsxFactory: 'h' });
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

function menuHarness(prepare, deliver) {
  const cells = [];
  const effects = [];
  const cleanup = [];
  const revoked = [];
  let cursor = 0;
  let tree;
  const context = {
    h: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState(initial) { const index = cursor++; if (!(index in cells)) cells[index] = initial; return [cells[index], (next) => { cells[index] = typeof next === 'function' ? next(cells[index]) : next; }]; },
    useRef(initial) { const index = cursor++; return cells[index] ||= { current: initial }; },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!cells[index] || deps.some((dep, key) => dep !== cells[index][key])) {
        effects.push(() => { cleanup[index]?.(); cleanup[index] = callback(); });
        cells[index] = deps;
      }
    },
    preparePayerAccountPlanPpt: prepare,
    deliverPreparedPayerAccountPlanPpt: deliver,
    URL: { revokeObjectURL: (url) => revoked.push(url) },
    navigationItems: [], Icon: () => null, PayerUserGuideModal: 'user-guide-modal', formatDate: () => '', detectRuntimeViewMode: () => ({ viewMode: 'desktop' }),
  };
  vm.createContext(context);
  vm.runInContext(code + '\nthis.Sidebar = MarketAccessSidebar;', context);
  const nodes = (node) => !node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap((child) => nodes(child))];
  const label = (node) => (node.children || []).map((child) => typeof child === 'string' ? child : child && typeof child === 'object' ? label(child) : '').join('');
  const render = (planId = 'plan-1') => {
    cursor = 0;
    tree = context.Sidebar({ planId, accountSummary: { accountName: 'Payer' }, onNotify() {} });
    while (effects.length) effects.shift()();
    return tree;
  };
  return {
    render, revoked,
    button: (name) => nodes(tree).find((node) => node.type === 'button' && label(node) === name),
    find: (predicate) => nodes(tree).find(predicate),
    dispose: () => cleanup.forEach((callback) => callback?.()),
  };
}

test('User Guide opens in the app, closes the help menu, and can be dismissed', () => {
  const menu = menuHarness(() => { throw new Error('Must not export'); }, () => {});
  menu.render();
  menu.button('Help & Compliance Reminder').props.onClick();
  menu.render();
  menu.button('Open user guide').props.onClick();
  menu.render();
  assert.equal(menu.button('Open user guide'), undefined);
  const modal = menu.find((node) => node.type === 'user-guide-modal');
  assert.ok(modal);
  modal.props.onClose();
  menu.render();
  assert.equal(menu.find((node) => node.type === 'user-guide-modal'), undefined);
  menu.dispose();
});

test('export prepares on menu open, delivers on a fresh tap, and exposes fallback downloads', async () => {
  const pending = deferred();
  const calls = [];
  const prepared = { blob: {}, fileName: 'Payer.pptx' };
  const menu = menuHarness((id) => { calls.push(id); return pending.promise; }, (file, options) => {
    assert.equal(file, prepared);
    assert.equal(options.directShare, true);
    calls.push('deliver');
    return Promise.resolve({ mode: 'manual-open', manualUrl: 'blob:payer-export', fileName: prepared.fileName });
  });
  menu.render();
  menu.button('Export').props.onClick();
  menu.render();
  assert.deepEqual(calls, ['plan-1']);
  assert.equal(menu.button('Preparing PowerPoint…').props.disabled, true);
  pending.resolve(prepared);
  await tick();
  menu.render();
  const action = menu.button('Export to PPT');
  assert.equal(action.props.disabled, false);
  await action.props.onClick();
  menu.render();
  assert.deepEqual(calls, ['plan-1', 'deliver']);
  assert.equal(menu.find((node) => node.type === 'a').props.href, 'blob:payer-export');
  menu.dispose();
  assert.deepEqual(menu.revoked, ['blob:payer-export']);
});

test('preparation errors are retryable and old-plan preparation cannot enable export', async () => {
  const pending = deferred();
  let calls = 0;
  const menu = menuHarness(() => ++calls === 1 ? Promise.reject(new Error('CRM unavailable')) : pending.promise, () => { throw new Error('Must not deliver'); });
  menu.render();
  menu.button('Export').props.onClick();
  await tick();
  menu.render();
  assert.ok(menu.button('Retry export'));
  assert.ok(menu.find((node) => node.props.role === 'alert'));
  menu.button('Retry export').props.onClick();
  menu.render();
  assert.equal(menu.button('Preparing PowerPoint…').props.disabled, true);
  menu.render('plan-2');
  pending.resolve({ fileName: 'Old plan.pptx' });
  await tick();
  menu.render('plan-2');
  assert.equal(menu.button('Export to PPT'), undefined);
  menu.dispose();
});

test('synchronous file delivery failures remain visible and can be retried', async () => {
  const menu = menuHarness(() => Promise.resolve({ fileName: 'Payer.pptx' }), () => { throw new Error('Download blocked'); });
  menu.render();
  menu.button('Export').props.onClick();
  await tick();
  menu.render();
  await menu.button('Export to PPT').props.onClick();
  menu.render();
  assert.equal(menu.button('Export to PPT').props.disabled, false);
  assert.ok(menu.find((node) => node.props.role === 'alert'));
  menu.dispose();
});
