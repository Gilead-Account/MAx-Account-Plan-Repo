import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import { availableObjectiveSlots, openObjectiveCount, validateObjectiveLimit } from '../src/lib/helper/payerObjectiveLimit.js';

const objective = (id, status = 'Open') => ({ id, objective: `Objective ${id}`, status, strategies: [] });

test('only unfinished objectives consume the three available slots', () => {
  const open = [objective('1'), objective('2'), objective('3')];
  assert.equal(availableObjectiveSlots(open), 0);
  assert.throws(() => validateObjectiveLimit(open, [...open, objective('4')]), /Only 3 open objectives/);
  assert.throws(() => validateObjectiveLimit(open, [...open, objective('4')]), { canCorrectDraft: true });
  for (const status of ['Completed', 'Complete', 'Closed']) {
    const completed = [...open.slice(0, 2), objective('3', status)];
    assert.equal(availableObjectiveSlots(completed), 1);
    const replaced = [...completed, objective('4')];
    assert.doesNotThrow(() => validateObjectiveLimit(completed, replaced));
    assert.equal(openObjectiveCount(replaced), 3);
    assert.equal(availableObjectiveSlots(replaced), 0);
    assert.throws(() => validateObjectiveLimit(replaced, replaced.map((item) => item.id === '3' ? { ...item, status: 'Open' } : item)), /Only 3 open objectives/);
  }
  assert.equal(openObjectiveCount([objective('blank', ''), objective('pending', 'Pending')]), 2);
});

test('a replacement objective survives reload alongside the completed objective and its linked records', async () => {
  const previousWindow = globalThis.window;
  const storage = new Map();
  globalThis.window = {
    location: { search: '', hostname: 'localhost' },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) },
  };
  let server;
  try {
    server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
    const service = await server.ssrLoadModule('/src/lib/dataservice/accountPlan/payerHierarchy.js');
    const draft = [objective('1'), objective('2'), {
      ...objective('3'),
      strategies: [{ id: 'strategy-3', strategy: 'Retained strategy', status: 'Completed', tactics: [{ id: 'tactic-3', value: 'Retained tactic', status: 'Completed' }] }],
    }];
    const initial = await service.savePayerHierarchy([], draft);
    const completed = await service.savePayerHierarchy(initial.hierarchy, initial.hierarchy.map((item, index) => index === 2 ? { ...item, status: 'Completed' } : item));
    const retained = structuredClone(completed.hierarchy[2]);
    const replacementDraft = {
      ...objective('4'),
      strategies: Array.from({ length: 28 }, (_, index) => ({ id: `new-strategy-${index}`, strategy: `Strategy ${index + 1}`, status: 'Open', tactics: [] })),
    };
    const replacement = await service.savePayerHierarchy(completed.hierarchy, [...completed.hierarchy, replacementDraft]);
    const reloaded = (await service.loadPayerHierarchy()).hierarchy;
    assert.equal(reloaded.length, 4);
    assert.equal(openObjectiveCount(reloaded), 3);
    assert.deepEqual(reloaded.find((item) => item.id === retained.id), retained);
    assert.deepEqual(reloaded.find((item) => item.id === replacement.ids['4']), replacement.hierarchy[3]);
    assert.equal(reloaded.find((item) => item.id === replacement.ids['4']).strategies.length, 28);
    await assert.rejects(service.savePayerHierarchy(reloaded, [...reloaded, objective('5')]), /Only 3 open objectives/);
    await assert.rejects(service.savePayerHierarchy(reloaded, reloaded.map((item) => item.id === retained.id ? { ...item, status: 'Open' } : item)), /Only 3 open objectives/);
    assert.deepEqual((await service.loadPayerHierarchy()).hierarchy, reloaded);
  } finally {
    await server?.close();
    globalThis.window = previousWindow;
  }
});
