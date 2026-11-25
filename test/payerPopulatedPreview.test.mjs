import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('populated preview loads linked CRM-shaped records and preserves edits and deletions', async () => {
  const previousWindow = globalThis.window;
  const storage = new Map();
  globalThis.window = {
    location: { search: '?preview=ipad-11', hostname: 'localhost' },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) },
  };
  let server;
  try {
    server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
    const load = (name) => server.ssrLoadModule(`/src/lib/dataservice/accountPlan/${name}.js`);
    const hierarchy = await load('payerHierarchy');
    const barriers = await load('payerBarriersOpportunities');
    const summary = await load('payerExecutiveSummary');
    const original = await hierarchy.loadPayerHierarchy();
    assert.equal(original.hierarchy.length, 3);
    const objectives = new Map(original.hierarchy.map((objective) => [objective.id, objective]));
    assert.ok(original.hierarchy.every((objective) => objective.strategies.length && objective.strategies.every((strategy) => strategy.tactics.length)));
    const records = (await barriers.loadPayerBarriersOpportunities()).records;
    assert.equal(records.length, 8);
    for (const record of records) {
      assert.ok(objectives.get(record.objectiveId)?.strategies.some((strategy) => strategy.id === record.strategyId));
    }
    const executive = await summary.loadPayerExecutiveSummary();
    assert.equal(executive.keyWins.length, 2);
    assert.equal(executive.customerAsks.length, 2);
    assert.match(executive.accountDetails.geographicFootprint.value, /Regional payer/);
    assert.equal((await (await load('payerMilestones')).loadPayerMilestones()).milestones.length, 3);
    assert.equal((await (await load('payerCriticalActions')).loadPayerCriticalActions()).actions.length, 2);
    assert.equal((await (await load('payerStakeholders')).loadPayerStakeholders()).stakeholders.length, 3);
    assert.match((await (await load('payerAccountLandscape')).loadPayerAccountLandscape()).decisionMakingBodies, /P&T/);
    assert.ok((await (await load('payerLaunchReadiness')).loadPayerLaunchReadiness()).form.driversForAdoption);
    assert.equal((await (await load('payerAccess')).loadPayerAccountPlanAccess()).canEdit, true);

    const draft = structuredClone(original.hierarchy);
    draft[0].strategies[0].strategy = 'Edited sample strategy';
    await hierarchy.savePayerHierarchy(original.hierarchy, draft);
    assert.equal((await hierarchy.loadPayerHierarchy()).hierarchy[0].strategies[0].strategy, 'Edited sample strategy');
    await barriers.deletePayerBarrierOpportunity(records[0].id);
    assert.equal((await barriers.loadPayerBarriersOpportunities()).records.length, 7);
    await summary.updatePayerSummaryPlanField(executive.planId, 'KPH_Geographic_Footprint__c', 'KPH_Geographic_Footprint_updated_date__c', 'Edited preview region');
    assert.equal((await summary.loadPayerExecutiveSummary()).accountDetails.geographicFootprint.value, 'Edited preview region');
    const overrides = JSON.parse(storage.get('medicalv1:mock-record-overrides'));
    assert.ok(Object.keys(overrides).every((key) => key.includes('::payer-preview-v1::')));
  } finally {
    await server?.close();
    globalThis.window = previousWindow;
  }
});
