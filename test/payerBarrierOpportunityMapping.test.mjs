import { installRecordTypes } from './support/crmRecordTypes.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import { payerQueryFields, PAYER_ACTIVE_WHERE, isPayerDeleted } from '../src/lib/dataservice/accountPlan/payerMappedFields.js';

const source = await readFile(new URL('../src/lib/dataservice/accountPlan/payerBarriersOpportunities.js', import.meta.url), 'utf8');
const names = [...source.matchAll(/export const (\w+)/g)].map((match) => match[1]);
function setup(rows = [], { live = true, isSandbox = true, metadata = () => [{ Id: '012000000000001AAA', DeveloperName: 'Payer_Barrier' }, { Id: '012000000000002AAA', DeveloperName: 'Payer_Opportunity' }] } = {}) {
  const calls = [];
  const metadataCalls = [];
  const context = {
    payerQueryFields, PAYER_ACTIVE_WHERE, isPayerDeleted,
    hasVeevaRuntime: () => live,
    buildIdMatchWhere: (field, value) => `${field} = '${value}'`,
    resolvePayerAccountPlanId: async () => 'plan-1',
    unwrap: (row) => Object.fromEntries(Object.entries(row).map(([key, cell]) => [key, cell?.value ?? cell])),
    runCrmQuery: async (query) => {
      if (query.object === 'RecordType') { metadataCalls.push(query); return metadata(); }
      calls.push({ query }); return rows;
    },
    runQuery: () => { throw new Error('Live reads must not use mock adapter'); },
    createCrmRecord: async (object, fields) => calls.push({ object, fields }),
    createRecord: () => { throw new Error('Live writes must not use mock adapter'); },
    updateRecord: async (object, id, fields, options) => calls.push({ object, id, fields, options }),
  };
  context.assertPayerAccountPlanEditable = async () => {};
  vm.createContext(context);
  installRecordTypes(context, { isSandbox });
  vm.runInContext(source.replace(/^import .*;\n/gm, '').replace(/export const /g, 'const ') + `\nthis.api = { ${names.join(', ')} };`, context);
  return { api: context.api, calls, metadataCalls };
}

for (const environment of ['sandbox', 'production']) {
  test(`${environment} Payer creates and updates use that org's Barrier and Opportunity IDs`, async () => {
    const ids = { Barrier: environment === 'sandbox' ? '012000000000001AAA' : '012000000000003AAA', Opportunity: environment === 'sandbox' ? '012000000000002AAA' : '012000000000004AAA' };
    const { api, calls, metadataCalls } = setup([
      { Id: 'existing-barrier', KPH_Barrier_Title__c: 'Existing' },
      { Id: 'existing-opportunity', KPH_Opportunities_Title__c: 'Existing' },
    ], {
      isSandbox: environment === 'sandbox',
      metadata: () => [
        { Id: { value: ids.Barrier }, DeveloperName: { value: 'KPH_Payer_Barriers' } },
        { Id: { value: ids.Opportunity }, DeveloperName: { value: 'KPH_Payer_Opportunities' } },
        { Id: { value: 'unrelated' }, DeveloperName: { value: 'Other' } },
      ],
    });
    for (const type of ['Barrier', 'Opportunity']) {
      await api.savePayerBarrierOpportunity({ type, name: 'New' });
      await api.savePayerBarrierOpportunity({ type, id: `existing-${type.toLowerCase()}`, name: 'Edited' });
    }
    assert.equal(metadataCalls.length, 1);
    assert.match(metadataCalls[0].where, /SobjectType = 'KPH_Payers_Barrier_Opportunities__c' AND IsActive = true/);
    for (const saved of calls.filter((call) => call.fields)) {
      assert.equal(saved.fields.RecordTypeId, saved.fields.KPH_Barrier_Title__c ? ids.Barrier : ids.Opportunity);
    }
  });
}

test('metadata resolution shares concurrent requests and retries missing, ambiguous, or denied metadata without writing', async () => {
  for (const failure of [
    () => [],
    () => [{ Id: '012000000000001AAA', DeveloperName: 'Payer_Barrier' }, { Id: '012000000000002AAA', DeveloperName: 'Payer_Barrier' }, { Id: '012000000000003AAA', DeveloperName: 'Payer_Opportunity' }],
    () => { throw new Error('RecordType denied'); },
  ]) {
    let fail = true;
    const { api, calls, metadataCalls } = setup([], { metadata: () => fail ? failure() : [
      { Id: '012000000000001AAA', DeveloperName: 'Payer_Barrier' }, { Id: '012000000000003AAA', Name: 'Payer Opportunity' },
    ] });
    await assert.rejects(api.savePayerBarrierOpportunity({ type: 'Barrier' }), /record type|RecordType/i);
    assert.equal(calls.some((call) => call.fields), false);
    fail = false;
    const [first, second] = await Promise.all([
      api.resolvePayerBarrierOpportunityRecordTypeIds(), api.resolvePayerBarrierOpportunityRecordTypeIds(),
    ]);
    assert.deepEqual(first, second);
    assert.equal(first.Opportunity, '012000000000003AAA');
    assert.equal(metadataCalls.length, 2);
  }
});

test('local preview does not query live RecordType metadata', async () => {
  const { api, metadataCalls } = setup([], { live: false });
  assert.deepEqual({ ...await api.resolvePayerBarrierOpportunityRecordTypeIds() }, {});
  assert.equal(metadataCalls.length, 0);
});

test('barrier write uses the confirmed Account Plan lookup and includes mapped status and excludes system dates', async () => {
  const { api, calls } = setup();
  await api.savePayerBarrierOpportunity({ type: 'Barrier', objectiveId: 'o1', strategyId: 's1', name: 'Access', impact: 'High', details: 'Details', status: 'Closed', createdDate: 'invalid' });
  assert.match(calls[0].query.where, /KPH_Account_Plan__c = 'plan-1'/);
  assert.equal(calls[1].object, 'KPH_Payers_Barrier_Opportunities__c');
  assert.deepEqual({ ...calls[1].fields }, { RecordTypeId: '012000000000001AAA', KPH_Account_Plan__c: 'plan-1', KPH_Account_Objective_Barrier__c: 'o1', KPH_Strategy__c: 's1', KPH_Barrier_Title__c: 'Access', KPH_Barrier_Impact__c: 'High', KPH_Barriers_Details__c: 'Details', KPH_Barrier_Status__c: 'Closed' });
});

test('opportunity mapping uses standard dates and rejects records from another plan', async () => {
  const row = { Id: 'p1', CreatedDate: '2026-01-01', LastModifiedDate: '2026-02-01', KPH_Opportunities_Title__c: 'Opportunity', KPH_Account_Objective_Barrier__c: 'o1', KPH_Strategy__c: 's2' };
  const { api, calls } = setup([row]);
  const loaded = await api.loadPayerBarriersOpportunities();
  assert.equal(loaded.records[0].type, 'Opportunity');
  assert.equal(loaded.records[0].objectiveId, 'o1');
  assert.equal(loaded.records[0].strategyId, 's2');
  assert.ok(calls[0].query.fields.includes('KPH_Strategy__c'));
  assert.equal(loaded.records[0].createdDate, row.CreatedDate);
  assert.equal(loaded.records[0].updatedDate, row.LastModifiedDate);
  assert.equal(loaded.records[0].status, '');
  await api.savePayerBarrierOpportunity({ ...loaded.records[0], details: 'Updated', status: 'Open' });
  const saved = calls.find((call) => call.id === 'p1');
  assert.equal(saved.fields.KPH_Opportunities_Details__c, 'Updated');
  assert.equal(saved.fields.RecordTypeId, '012000000000002AAA');
  assert.equal(saved.options.crm, true);
  assert.equal(saved.fields.KPH_Strategy__c, 's2');
  assert.equal(saved.fields.KPH_Account_Objective_Barrier__c, 'o1');
  assert.equal(saved.fields.KPH_Opportunities_Objective__c, undefined);
  assert.equal(api.payerBarrierOpportunityFromRow({ Id: 'link-only', KPH_Strategy__c: 's2' }), null);
  assert.equal(api.payerBarrierOpportunityFromRow({ Id: 'b1', KPH_Barrier_Title__c: 'Barrier', KPH_Strategy__c: 's1' }).strategyId, 's1');
  await assert.rejects(api.savePayerBarrierOpportunity({ ...loaded.records[0], id: 'other-plan' }), /does not belong/);
  assert.throws(() => api.payerBarrierOpportunityFromRow({ ...row, KPH_Barrier_Title__c: 'Conflicting type' }), /both barrier and opportunity/);
});

test('barrier reload and update keep objective and plan lookup fields separate', async () => {
  const row = { Id: 'b1', KPH_Account_Plan__c: 'plan-1', KPH_Account_Objective_Barrier__c: 'o1', KPH_Barrier_Title__c: 'Access', KPH_Strategy__c: 's1' };
  const { api, calls } = setup([row]);
  const loaded = await api.loadPayerBarriersOpportunities();
  assert.equal(loaded.records[0].objectiveId, 'o1');
  assert.ok(calls[0].query.fields.includes('KPH_Account_Plan__c'));
  assert.ok(calls[0].query.fields.includes('KPH_Account_Objective_Barrier__c'));
  assert.ok(!calls[0].query.fields.includes('KPH_Barrier_Objective__c'));
  await api.savePayerBarrierOpportunity({ ...loaded.records[0], objectiveId: 'o2' });
  const update = calls.find((call) => call.id === 'b1');
  assert.equal(update.fields.KPH_Account_Objective_Barrier__c, 'o2');
  assert.equal(update.fields.KPH_Account_Plan__c, undefined);
});

 test('opportunity creation uses shared objective lookup without the old picklist', async () => {
  const { api, calls } = setup();
  await api.savePayerBarrierOpportunity({ type: 'Opportunity', objectiveId: 'o1', name: 'Access', details: 'Details', status: 'Open' });
  const saved = calls.find(call => call.fields);
  assert.equal(saved.fields.KPH_Account_Objective_Barrier__c, 'o1');
  assert.equal(saved.fields.KPH_Opportunities_Objective__c, undefined);
  assert.equal(api.payerBarrierOpportunityFromRow({ Id: 'link', KPH_Account_Objective_Barrier__c: 'o1' }), null);
 });
