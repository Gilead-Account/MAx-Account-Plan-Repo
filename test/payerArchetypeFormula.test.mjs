import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createServer } from 'vite';

const source = await readFile(new URL('../src/lib/dataservice/accountPlan/payerExecutiveSummary.js', import.meta.url), 'utf8');
const saveFunction = source.match(/export const savePayerArchetype = async[\s\S]*?\n};/)[0].replace('export const', 'const');

test('archetype saves write only the picklist and timestamp, then query the read-only CRM formula', async () => {
  const calls = [];
  const context = {
    updatePayerSummaryPlanField: async (...args) => calls.push({ write: args }),
    buildPayerAccountPlanWhere: (id) => `Id = '${id}'`, unwrap: (row) => row,
    readRows: async (query) => {
      calls.push({ query });
      return [{ KPH_Payer_Restrictiveness__c: 'New CRM Archetype', KPH_Payer_Archetype_Definition__c: 'A new definition maintained only in Salesforce.' }];
    },
  };
  vm.createContext(context);
  vm.runInContext(saveFunction + '\nthis.save = savePayerArchetype;', context);
  assert.equal(await context.save('plan-id', 'New CRM Archetype'), 'A new definition maintained only in Salesforce.');
  assert.deepEqual(calls[0].write, ['plan-id', 'KPH_Payer_Restrictiveness__c', 'KPH_Payer_Restrictiveness_updated_date__c', 'New CRM Archetype']);
  assert.equal(calls[1].query.object, 'Account_Plan_vod__c');
  assert.equal(calls[1].query.where, "Id = 'plan-id'");
  assert.ok(calls[1].query.fields.includes('KPH_Payer_Archetype_Definition__c'));
});

test('empty formulas remain empty and stale CRM selections request a retry', async () => {
  let row = { KPH_Payer_Restrictiveness__c: 'CAR T Follower', KPH_Payer_Archetype_Definition__c: '' };
  const context = { updatePayerSummaryPlanField: async () => {}, buildPayerAccountPlanWhere: () => 'plan', unwrap: (value) => value, readRows: async () => row ? [row] : [] };
  vm.createContext(context);
  vm.runInContext(saveFunction + '\nthis.save = savePayerArchetype;', context);
  assert.equal(await context.save('plan', 'CAR T Follower'), '');
  row = { KPH_Payer_Restrictiveness__c: 'Previous selection', KPH_Payer_Archetype_Definition__c: 'Previous formula' };
  await assert.rejects(context.save('plan', 'CAR T Follower'), /Retry saving/);
  row = null;
  await assert.rejects(context.save('plan', 'CAR T Follower'), /Retry saving/);
});

test('summary loading reads the mapped formula verbatim with no hardcoded fallback', async () => {
  const previousWindow = globalThis.window;
  const storage = new Map();
  globalThis.window = { location: { search: '', hostname: 'localhost' }, localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) } };
  let server;
  try {
    server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
    const service = await server.ssrLoadModule('/src/lib/dataservice/accountPlan/payerExecutiveSummary.js');
    const query = await server.ssrLoadModule('/src/lib/dataservice/query.js');
    const catalog = await server.ssrLoadModule('/src/lib/dataservice/accountPlan/payerMappedFields.js');
    assert.ok(catalog.payerQueryFields('Account_Plan_vod__c', service.PAYER_SUMMARY_PLAN_FIELDS).includes('KPH_Payer_Archetype_Definition__c'));
    const { planId } = await service.loadPayerExecutiveSummary();
    await query.updateRecord('Account_Plan_vod__c', planId, { KPH_Payer_Restrictiveness__c: 'CAR T Follower', KPH_Payer_Archetype_Definition__c: 'Salesforce wording with a changed definition.' });
    assert.equal((await service.loadPayerExecutiveSummary()).payerRestrictiveness.definition, 'Salesforce wording with a changed definition.');
    await query.updateRecord('Account_Plan_vod__c', planId, { KPH_Payer_Archetype_Definition__c: '' });
    assert.equal((await service.loadPayerExecutiveSummary()).payerRestrictiveness.definition, '');
    const page = await readFile(new URL('../src/pages/ExecutiveSummary/index.jsx', import.meta.url), 'utf8');
    assert.match(page, /value=\{payerRestrictiveness\.definition \|\| ''\}/);
    assert.match(page, /current\.value === value/);
    assert.doesNotMatch(page, /getPayerArchetypeDefinition|PAYER_ARCHETYPES/);
  } finally {
    await server?.close();
    globalThis.window = previousWindow;
  }
});
