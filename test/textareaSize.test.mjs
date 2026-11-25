import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { resizeTextareaToContent } from '../src/lib/helper/textareaSize.js';

test('text boxes fit loaded text, grow while typing, and shrink when content is removed', () => {
  const previous = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({ boxSizing: 'border-box', borderTopWidth: '1px', borderBottomWidth: '1px', paddingTop: '7px', paddingBottom: '7px' });
  try {
    const textarea = { clientWidth: 300, style: {}, scrollHeight: 80 };
    resizeTextareaToContent(textarea);
    assert.equal(textarea.style.height, '82px');
    textarea.scrollHeight = 140;
    resizeTextareaToContent(textarea);
    assert.equal(textarea.style.height, '142px');
    textarea.scrollHeight = 32;
    resizeTextareaToContent(textarea);
    assert.equal(textarea.style.height, '34px');
    textarea.clientWidth = 0;
    textarea.scrollHeight = 0;
    resizeTextareaToContent(textarea);
    assert.equal(textarea.style.height, '34px', 'hidden fields retain their height until they can be measured');
  } finally { globalThis.getComputedStyle = previous; }
});

test('automatic fields refit for new values, layout width changes, and font loading', async () => {
  const source = await readFile(new URL('../src/components/AutoSizeTextarea.jsx', import.meta.url), 'utf8');
  const { code } = await transform(source.replace(/^import .*;\n/gm, '').replace('export default function', 'function'), { loader: 'jsx', jsxFactory: 'h' });
  const element = { clientWidth: 300 };
  let fitted = 0, resizeCallback, windowResize, disconnected = false;
  const effects = [], cleanups = [];
  const context = {
    h: (tag, props) => ({ tag, props }), useRef: () => ({ current: element }),
    useLayoutEffect: (callback) => effects.push(callback),
    resizeTextareaToContent: (target) => { assert.equal(target, element); fitted++; },
    ResizeObserver: class {
      constructor(callback) { resizeCallback = callback; }
      observe(target) { assert.equal(target, element); }
      disconnect() { disconnected = true; }
    },
    window: { addEventListener: (name, callback) => { windowResize = callback; }, removeEventListener: () => {} },
    document: { fonts: { ready: Promise.resolve() } },
  };
  vm.createContext(context);
  vm.runInContext(code + '\nthis.Field = AutoSizeTextarea;', context);
  const rendered = context.Field({ value: 'Loaded text', maxLength: 250, readOnly: true, 'aria-label': 'Payer Archetype Definition' });
  assert.equal(rendered.tag, 'textarea');
  assert.equal(rendered.props.readOnly, true);
  for (const effect of effects.splice(0)) cleanups.push(effect());
  assert.equal(fitted, 1);
  resizeCallback();
  assert.equal(fitted, 1, 'height-only observer events must not loop');
  element.clientWidth = 180;
  resizeCallback();
  assert.equal(fitted, 2);
  windowResize();
  assert.equal(fitted, 3);
  await Promise.resolve();
  assert.equal(fitted, 4);
  context.Field({ value: 'Updated text' });
  effects[0]();
  assert.equal(fitted, 5);
  for (const cleanup of cleanups) cleanup?.();
  assert.equal(disconnected, true);
});
