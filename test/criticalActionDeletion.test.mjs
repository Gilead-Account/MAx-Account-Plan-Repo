import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { sameCrmId } from '../src/lib/helper/barrierRecords.js';
const source = fs.readFileSync('src/lib/dataservice/accountPlan/payerCriticalActions.js', 'utf8');
const handler = source.slice(source.indexOf('export const deletePayerCriticalAction')).replace('export const', 'const');
function setup({ after = false, alreadyDeleted = false, missing = false, online = true, reject = true, moved = false, verificationFails = false, errorMessage = 'The requested resource does not exist · NOT_FOUND' } = {}) {
  const id = 'a0CVE00009N3IzR';
  const writes = [], queries = [];
  const failure = new Error(errorMessage);
  const context = {
    sameCrmId, resolvePayerAccountPlanId: async () => 'current-plan',
    PAYER_ACTION_OBJECT: 'KPH_Actions_and_Critical_Next_Steps__c', PAYER_ACTION_PLAN_FIELD: 'KPH_Account_Plan__c',
    buildIdMatchWhere: (field, value) => `${field}=${value}`,
    unwrap: row => row, isPayerDeleted: row => row.KPH_Is_Deleted__c === true,
    isOnline: () => online, toCanonicalSalesforceId: value => value + '2AV', hasVeevaRuntime: () => true,
    crmWriteError: error => error,
    runCrmQuery: async params => {
      queries.push(params);
      if (queries.length === 3 && verificationFails) throw new Error('Verification failed');
      if (queries.length === 3 && moved) return [{ Id: id }];
      if (queries.length > 1 && after === 'error') throw new Error('Read failed');
      if (missing || (queries.length > 1 && after === 'missing')) return [];
      return [{ Id: id, KPH_Is_Deleted__c: alreadyDeleted || (queries.length > 1 && after === true) }];
    },
    updateRecord: async (...args) => { writes.push(args); if (reject) throw failure; },
  };
  context.assertPayerAccountPlanEditable = async () => {};
  context.payerRecordTypeWhere = async () => " AND RecordTypeId = 'resolved-type'";
  context.payerRecordTypeFields = async () => ({ RecordTypeId: 'resolved-type' });
  context.resolvePayerBarrierOpportunityRecordTypeIds = async () => ({ Barrier: 'barrier-type', Opportunity: 'opportunity-type' });
  vm.createContext(context);
  vm.runInContext(handler + '\nthis.remove = deletePayerCriticalAction;', context);
  return { run: () => context.remove(id), writes, queries, failure, id };
}
test('desktop deletion accepts a failed response only when scoped reread confirms flag', async () => {
  const h = setup({ after: true });
  await h.run();
  assert.equal(h.writes[0][1], h.id + '2AV');
  assert.deepEqual({ ...h.writes[0][2] }, { KPH_Is_Deleted__c: true });
  assert.equal(h.queries.length, 2);
  for (const q of h.queries) {
    assert.match(q.where, /KPH_Account_Plan__c=current-plan/);
    assert.ok(q.where.includes('Id=' + h.id));
    assert.doesNotMatch(q.where, /KPH_Is_Deleted__c/);
    assert.match(q.where, /RecordTypeId/);
  }
});
for (const after of [false, 'error']) test(`unconfirmed delete preserves error: ${after}`, async () => {
  const h = setup({ after });
  await assert.rejects(h.run(), error => error === h.failure);
});
test('NOT_FOUND after removal is reconciled with an ID-only read', async () => {
  const h = setup({ after: 'missing' });
  assert.equal((await h.run()).outcome, 'no-longer-available');
  assert.equal(h.queries.length, 3);
  assert.equal(h.queries[2].where, 'Id=' + h.id);
});
for (const scenario of [{ moved: true }, { verificationFails: true }, { errorMessage: 'Permission denied' }]) {
  test(`missing scoped row preserves genuine failure: ${JSON.stringify(scenario)}`, async () => {
    const h = setup({ after: 'missing', ...scenario });
    await assert.rejects(h.run(), error => error === h.failure);
  });
}
test('already deleted record is a successful no-op', async () => {
  const h = setup({ alreadyDeleted: true });
  await h.run();
  assert.equal(h.writes.length, 0);
});
test('missing scoped record is never written', async () => {
  const h = setup({ missing: true });
  await assert.rejects(h.run(), /no longer available/);
  assert.equal(h.writes.length, 0);
});
test('iPad retains local ID and needs no verification after acknowledged write', async () => {
  const h = setup({ online: false, reject: false });
  await h.run();
  assert.equal(h.writes[0][1], h.id);
  assert.equal(h.queries.length, 1);
});
