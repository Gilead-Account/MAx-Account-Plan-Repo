import test from 'node:test';
import assert from 'node:assert/strict';
import { completionDependencies, completeDependencies } from '../src/lib/helper/hierarchyCompletion.js';
const options = { strategy: [{ value: 'Completed', label: 'Completed' }], tactic: [{ value: 'Completed', label: 'Completed' }], Barrier: [{ value: 'Closed', label: 'Closed' }], Opportunity: [{ value: 'Closed', label: 'Closed' }] };
const hierarchy = [{ id: 'o1', status: 'Open', strategies: [
  { id: 's1', status: 'Open', tactics: [{ id: 't1', status: 'Pending' }, { id: 't2', status: 'Completed' }] },
  { id: 's2', status: 'Completed', tactics: [] },
] }, { id: 'o2', strategies: [{ id: 's3', status: 'Open', tactics: [] }] }];
const records = [
  { id: 'b1', type: 'Barrier', strategyId: 's1', status: 'Open' },
  { id: 'b2', type: 'Barrier', strategyId: 's2', status: 'Pending' },
  { id: 'p1', type: 'Opportunity', objectiveId: 'o1', status: 'Open' },
  { id: 'p2', type: 'Opportunity', objectiveId: 'o2', status: 'Open' },
];
const objective = { kind: 'objective', id: 'o1', status: 'Completed' };
const strategy = { kind: 'strategy', id: 's1', objectiveId: 'o1', status: 'Completed' };

test('objective checks all descendants, including barriers under completed strategies', () => {
  assert.deepEqual(completionDependencies(hierarchy, records, objective).map((x) => x.id), ['s1', 't1', 'b1', 'b2', 'p1']);
});
test('strategy checks only its barriers and tactics, not objective opportunities or siblings', () => {
  assert.deepEqual(completionDependencies(hierarchy, records, strategy).map((x) => x.id), ['t1', 'b1']);
  const result = completeDependencies(hierarchy, records, strategy, options);
  assert.equal(result.records.find((x) => x.id === 'p1').status, 'Open');
  assert.equal(result.records.find((x) => x.id === 'b2').status, 'Pending');
  assert.deepEqual(completionDependencies(result.hierarchy, result.records, strategy), []);
});
test('confirmed objective cascade completes descendants without mutating input or other objectives', () => {
  const before = JSON.stringify({ hierarchy, records });
  const result = completeDependencies(hierarchy, records, objective, options);
  assert.deepEqual(completionDependencies(result.hierarchy, result.records, objective), []);
  assert.equal(result.hierarchy[1], hierarchy[1]);
  assert.equal(result.records[3], records[3]);
  assert.equal(JSON.stringify({ hierarchy, records }), before);
});
test('open edits, new items and tactics need no completion confirmation', () => {
  for (const draft of [{ ...objective, status: 'Open' }, { kind: 'objective', status: 'Completed' }, { kind: 'tactic', id: 't1', status: 'Completed' }]) {
    assert.deepEqual(completionDependencies(hierarchy, records, draft), []);
  }
});

test('completing either objective leaves the other objective and its entire subtree unchanged', () => {
  for (const id of ['o1', 'o2']) {
    const draft = { kind: 'objective', id, status: 'Completed' };
    const other = hierarchy.find((item) => item.id !== id);
    const result = completeDependencies(hierarchy, records, draft, options);
    assert.deepEqual(result.hierarchy.find((item) => item.id === other.id), other);
    const otherStrategyIds = new Set(other.strategies.map((item) => item.id));
    for (const record of records.filter((item) => item.objectiveId === other.id || otherStrategyIds.has(item.strategyId))) {
      assert.deepEqual(result.records.find((item) => item.id === record.id), record);
      assert.ok(!completionDependencies(hierarchy, records, draft).some((item) => item.id === record.id));
    }
  }
});

test('strategy completion never changes a sibling strategy, its tactics, or its barriers', () => {
  const input = structuredClone(hierarchy);
  input[0].strategies[1] = { id: 's2', status: 'Open', tactics: [{ id: 'sibling-tactic', status: 'Pending' }] };
  const result = completeDependencies(input, records, strategy, options);
  assert.deepEqual(result.hierarchy[0].strategies[1], input[0].strategies[1]);
  assert.equal(result.hierarchy[0].status, 'Open');
  assert.deepEqual(result.hierarchy[1], input[1]);
  assert.deepEqual(result.records.find((item) => item.id === 'b2'), records.find((item) => item.id === 'b2'));
  assert.deepEqual(completionDependencies(input, records, strategy).map((item) => item.id), ['t1', 'b1']);
});


test('completion uses backend API values and rejects missing metadata', () => {
 const remote = { strategy: [{ value: 'strategy_done', label: 'Completed' }], tactic: [{ value: 'tactic_done', label: 'Completed' }], Barrier: [{ value: 'barrier_done', label: 'Completed' }], Opportunity: [{ value: 'opp_done', label: 'Completed' }] };
 const result = completeDependencies(hierarchy, records, { kind: 'objective', id: hierarchy[0].id }, remote);
 assert.equal(result.hierarchy[0].strategies[0].status, 'strategy_done');
 assert.throws(() => completeDependencies(hierarchy, records, { kind: 'objective', id: hierarchy[0].id }, {}), /CRM must provide/);
});
