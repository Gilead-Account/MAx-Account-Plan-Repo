import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
test('actions persist strategy title, reload, update, and soft-delete within their plan', async () => {
 const old = globalThis.window;
 const storage = new Map();
 globalThis.window = { location: { search: '', hostname: 'localhost' }, localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,String(v)) } };
 const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
 try {
  const service = await server.ssrLoadModule('/src/lib/dataservice/accountPlan/payerCriticalActions.js');
  const draft = { action: 'Schedule meeting', linkedStrategyText: 'Improve access', timing: '2026-10-15', status: 'In Progress', nextSteps: 'Send agenda' };
  await service.savePayerCriticalAction(draft);
  const saved = (await service.loadPayerCriticalActions()).actions.find((row) => row.action === draft.action);
  assert.ok(saved.id);
  assert.equal(saved.linkedStrategyText, 'Improve access');
  assert.equal(saved.timing, '2026-10-15T00:00:00.000Z');
  assert.ok(saved.createdDate);
  await service.savePayerCriticalAction({ ...saved, nextSteps: 'Updated agenda' });
  assert.equal((await service.loadPayerCriticalActions()).actions.find((row) => row.id === saved.id).nextSteps, 'Updated agenda');
  await assert.rejects(service.savePayerCriticalAction({ ...saved, id: 'other-plan' }), /does not belong/);
  await service.deletePayerCriticalAction(saved.id);
  assert.equal((await service.loadPayerCriticalActions()).actions.some((row) => row.id === saved.id), false);
 } finally { await server.close(); globalThis.window = old; }
});
