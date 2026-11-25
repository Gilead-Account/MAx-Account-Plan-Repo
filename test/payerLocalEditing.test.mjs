import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('local Payer summary loads and key wins survive save, reload, edit, and delete', async () => {
  const values = new Map();
  const previousWindow = globalThis.window;
  globalThis.window = {
    location: { search: '', hostname: 'localhost' },
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
    },
  };
  let server;
  try {
    server = await createServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'custom',
    });
    const summary = await server.ssrLoadModule('/src/lib/dataservice/accountPlan/payerExecutiveSummary.js');
    const catalog = await server.ssrLoadModule('/src/lib/dataservice/accountPlan/payerMappedFields.js');
    assert.equal(catalog.payerQueryFields(summary.PAYER_SUMMARY_CHILD_OBJECT, summary.PAYER_SUMMARY_CHILD_FIELDS).includes('KPH_Is_Deleted__c'), true);
    const initial = await summary.loadPayerExecutiveSummary();
    assert.ok(initial.planId);
    for (const config of summary.ANITO_LAUNCH_CONFIG) {
      await summary.updatePayerSummaryPlanField(initial.planId, config.field, config.updatedField, 'Backend API value');
      const reloaded = await summary.loadPayerExecutiveSummary();
      assert.equal(reloaded.anitoCelLaunch[config.key], 'Backend API value');
      assert.match(reloaded.anitoCelLaunch.updatedDate, /^\d{4}-\d{2}-\d{2}$/);
    }
    assert.equal((await summary.loadPayerExecutiveSummary()).anitoCelLaunch.meetingRequestSent, 'Backend API value');
    await summary.savePayerKeyWin(initial.planId, {
      date: '2026-10-01', description: 'Local key win', impact: 'Improved access',
    });
    const saved = (await summary.loadPayerExecutiveSummary()).keyWins.find((row) => row.description === 'Local key win');
    assert.ok(saved, 'new key win must be returned after reloading the summary');
    assert.equal(saved.impact, 'Improved access');
    assert.equal(saved.date, '2026-10-01');
    assert.ok(saved.createdDate);
    await summary.savePayerKeyWin(initial.planId, { ...saved, impact: 'Updated impact' });
    assert.equal((await summary.loadPayerExecutiveSummary()).keyWins.find((row) => row.id === saved.id).impact, 'Updated impact');
    await summary.deletePayerSummaryRecord(saved.id, initial.planId, 'keyWin');
    const query = await server.ssrLoadModule('/src/lib/dataservice/query.js');
    const rows = await query.runQuery({ object: summary.PAYER_SUMMARY_CHILD_OBJECT, fields: summary.PAYER_SUMMARY_CHILD_FIELDS, where: `Id = '${saved.id}'` });
    const deleted = query.unwrap(rows[0]);
    assert.equal(deleted.KPH_Is_Deleted__c, true);
    assert.equal(deleted.KPH_Key_Wins_Description__c, 'Local key win');
    assert.equal(deleted.KPH_Key_Wins_Impact__c, 'Updated impact');
    assert.equal((await summary.loadPayerExecutiveSummary()).keyWins.some((row) => row.id === saved.id), false);
    await summary.savePayerCustomerAsk(initial.planId, { stakeholderName: 'Customer', stakeholderRole: 'Director', description: 'Follow up' });
    const ask = (await summary.loadPayerExecutiveSummary()).customerAsks.find((row) => row.description === 'Follow up');
    assert.ok(ask);
    await summary.deletePayerSummaryRecord(ask.id, initial.planId, 'customerAsk');
    assert.equal((await summary.loadPayerExecutiveSummary()).customerAsks.some((row) => row.id === ask.id), false);
  } finally {
    await server?.close();
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
