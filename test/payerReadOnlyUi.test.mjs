import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { availableObjectiveSlots } from '../src/lib/helper/payerObjectiveLimit.js';
import { matchesHierarchyStatus } from '../src/lib/helper/hierarchyStatusFilter.js';

const source = await readFile(new URL('../src/pages/ActionPlan/index.jsx', import.meta.url), 'utf8');
const { code } = await transform(source.replace(/^import[\s\S]*?from ['"][^'"]+['"];?\n/gm, '').replace(/export (?:default )?/g, ''), { loader: 'jsx', jsxFactory: 'h' });
const nodes = (node) => !node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(nodes)];

test('read-only hierarchy keeps selection and status filters active while disabling every mutation', () => {
  const selection = [];
  const context = {
    h: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState: (value) => [value, () => {}], useRef: () => ({ current: null }), useLayoutEffect: () => {},
    useCrmPicklist: () => [], availableObjectiveSlots, matchesHierarchyStatus,
    Icon: 'icon', Pill: 'pill',
  };
  vm.createContext(context);
  vm.runInContext(code + '\nthis.hierarchy = CommercialHierarchy;', context);
  const props = {
    hierarchy: [{ id: 'obj', objective: 'Objective', status: 'Open', strategies: [{ id: 'str', strategy: 'Strategy', status: 'Open', tactics: [{ id: 'tac', value: 'Tactic', status: 'Open' }] }] }],
    selectedObjectiveId: 'obj', selectedStrategyId: 'str', viewScope: 'all-objectives', issues: [],
    setViewScope: () => {}, setSelectedObjectiveId: (id) => selection.push(id), setSelectedStrategyId: () => {},
  };
  const readonly = nodes(context.hierarchy({ ...props, canEdit: false }));
  const mutationClasses = ['commercial-field-edit', 'commercial-field-delete', 'commercial-objective-empty', 'commercial-hierarchy-add'];
  const edits = readonly.filter((node) => mutationClasses.includes(node.props.className));
  assert.equal(edits.length, 10);
  assert.ok(edits.every((node) => node.props.disabled));
  const selectors = readonly.filter((node) => node.props.className === 'commercial-node-selector');
  assert.equal(selectors.length, 2);
  assert.ok(selectors.every((node) => !node.props.disabled));
  selectors[0].props.onClick();
  assert.deepEqual(selection, ['obj']);
  assert.equal(readonly.filter((node) => typeof node.type === 'function' && node.type.name === 'HierarchyStatusFilter').length, 3);
  const editable = nodes(context.hierarchy({ ...props, canEdit: true }));
  assert.ok(editable.filter((node) => mutationClasses.includes(node.props.className)).every((node) => !node.props.disabled));
});
