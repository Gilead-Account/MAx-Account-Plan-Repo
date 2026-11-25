import { sameCrmId } from '../src/lib/helper/barrierRecords.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = await readFile(new URL('../src/pages/ActionPlan/index.jsx', import.meta.url), 'utf8');
const handlers = source.slice(source.indexOf('  const affectedItemList ='), source.indexOf('  const deleteTactic ='));
function setup(answers) {
  const objective = { id: 'o1', objective: 'Improve access', strategies: [{ id: 's1', strategy: 'Engage', tactics: [{ id: 't1', value: 'Review', status: 'Completed' }] }] };
  const prompts = [];
  const context = {
    sameCrmId,
    hierarchy: [objective, { id: 'o2', strategies: [] }],
    issues: [{ id: 'b1', type: 'Barrier', strategyId: 's1', name: 'Barrier' }, { id: 'p1', type: 'Opportunity', objectiveId: 'o1', name: 'Opportunity' }, { id: 'b2', type: 'Barrier', strategyId: 's2' }],
    criticalActions: [{ id: 'a1', linkedStrategyId: 's1', action: 'Call' }, { id: 'a2', linkedStrategyId: 's2' }],
    selectedObjectiveId: 'o1', selectedStrategyId: 's1', selectedTacticId: 't1', viewScope: 'all-objectives',
    strategyLetter: () => 'A',
    confirmDeletion: async (message) => { prompts.push(message); return answers.shift(); },
  };
  for (const [setter, key] of Object.entries({ setHierarchy: 'hierarchy', setIssues: 'issues', setSelectedObjectiveId: 'selectedObjectiveId', setSelectedStrategyId: 'selectedStrategyId', setSelectedTacticId: 'selectedTacticId', setViewScope: 'viewScope' })) {
    context[setter] = (value) => { context[key] = typeof value === 'function' ? value(context[key]) : value; };
  }
  context.onDeleteStrategyIds = (ids) => { context.criticalActions = context.criticalActions.filter((action) => !ids.includes(action.linkedStrategyId)); };
  vm.createContext(context);
  vm.runInContext(`${handlers}\nthis.removeObjective = deleteObjective;\nthis.removeStrategy = deleteStrategy;`, context);
  return { context, prompts, objective };
}

for (const answers of [[false], [true, false]]) {
  test(`cancel at confirmation ${answers.length} leaves all records unchanged`, async () => {
    const { context, prompts, objective } = setup([...answers]);
    const before = JSON.stringify([context.hierarchy, context.issues, context.criticalActions]);
    await context.removeObjective(objective);
    assert.equal(prompts.length, answers.length);
    assert.equal(JSON.stringify([context.hierarchy, context.issues, context.criticalActions]), before);
    assert.equal(context.selectedObjectiveId, 'o1');
  });
}

test('both confirmations delete all descendants and linked records while preserving unrelated records', async () => {
  const { context, prompts, objective } = setup([true, true]);
  await context.removeObjective(objective);
  assert.equal(prompts.length, 2);
  for (const prompt of prompts) assert.doesNotMatch(prompt, /actions \/ critical next steps/);
  assert.match(prompts[0], /Everything below this objective will also be deleted/);
  assert.match(prompts[0], /Barrier: Barrier/);
  assert.match(prompts[1], /hidden by the current filters/);
  assert.deepEqual(Array.from(context.hierarchy, (item) => item.id), ['o2']);
  assert.deepEqual(Array.from(context.issues, (item) => item.id), ['b2']);
  assert.deepEqual(Array.from(context.criticalActions, (item) => item.id), ['a1', 'a2']);
  assert.equal(context.selectedObjectiveId, '');
  assert.equal(context.selectedTacticId, null);
});

for (const answers of [[false], [true, false]]) {
  test(`cancel strategy deletion at confirmation ${answers.length} preserves all records`, async () => {
    const { context, prompts, objective } = setup([...answers]);
    const before = JSON.stringify([context.hierarchy, context.issues, context.criticalActions]);
    await context.removeStrategy(objective, objective.strategies[0]);
    assert.equal(prompts.length, answers.length);
    assert.equal(JSON.stringify([context.hierarchy, context.issues, context.criticalActions]), before);
    assert.equal(context.selectedStrategyId, 's1');
  });
}

test('confirmed strategy deletion removes its descendants and barriers but preserves actions but preserves its objective and siblings', async () => {
  const { context, prompts, objective } = setup([true, true]);
  objective.strategies.push({ id: 's2', strategy: 'Sibling', tactics: [{ id: 't2', value: 'Keep' }] });
  await context.removeStrategy(objective, objective.strategies[0]);
  assert.equal(prompts.length, 2);
  for (const prompt of prompts) assert.doesNotMatch(prompt, /actions \/ critical next steps/);
  assert.match(prompts[0], /Everything below this strategy will also be deleted/);
  assert.match(prompts[0], /linked barriers/);
  assert.match(prompts[1], /hidden by the current filters/);
  assert.deepEqual(Array.from(context.hierarchy, (item) => item.id), ['o1', 'o2']);
  assert.deepEqual(Array.from(context.hierarchy[0].strategies, (item) => item.id), ['s2']);
  assert.equal(context.hierarchy[0].strategies[0].tactics[0].id, 't2');
  assert.deepEqual(Array.from(context.issues, (item) => item.id), ['p1', 'b2']);
  assert.deepEqual(Array.from(context.criticalActions, (item) => item.id), ['a1', 'a2']);
  assert.equal(context.selectedObjectiveId, 'o1');
  assert.equal(context.selectedStrategyId, 's2');
  assert.equal(context.selectedTacticId, null);
});
