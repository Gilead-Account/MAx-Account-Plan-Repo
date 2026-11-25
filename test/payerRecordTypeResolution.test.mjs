import { installRecordTypes } from './support/crmRecordTypes.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = (await readFile(new URL('../src/lib/dataservice/accountPlan/payerAccountPlan.js', import.meta.url), 'utf8'))
  .replace(/import[\s\S]*?from\s+'[^']+';/g, '')
  .replace(/export const /g, 'const ');
const ids = ['012VE000007r16nYAA', '012VI00000GP0YHYA1'];

function setup(metadata, live = true) {
  const calls = [];
  const context = {
    hasVeevaRuntime: () => live,
    inClause: (values) => `(${values.map((id) => `'${id}'`).join(',')})`,
    unwrap: (row) => Object.fromEntries(Object.entries(row).map(([key, cell]) => [key, cell?.value ?? cell])),
    buildIdMatchWhere: (field, id) => id ? `${field} = '${id}'` : null,
    getCurrentAccountPlanId: async () => 'plan-context',
    payerQueryFields: () => ['Id'],
    runQuery: () => { throw new Error('Unexpected fixture query'); },
    runCrmQuery: async (params) => {
      calls.push(params);
      if (params.object === 'RecordType') return metadata().map((row) => ({ Name: 'Payer Account Plan', ...row }));
      return [{ Id: 'plan-context' }];
    },
  };
  vm.createContext(context);
  installRecordTypes(context);
  vm.runInContext(source + '\nthis.api = { resolvePayerAccountPlanRecordTypeId, buildPayerAccountPlanWhere, fetchAccessiblePayerAccountPlans, resolveContextualPayerAccountPlanId, resolvePayerAccountPlanId };', context);
  return { ...context.api, calls };
}

for (const id of ids) {
  test(`connected org uses ${id} for listing, contextual reads, and access predicates`, async () => {
    const api = setup(() => [{ Id: { value: id } }]);
    const [first, second] = await Promise.all([
      api.resolvePayerAccountPlanRecordTypeId(), api.resolvePayerAccountPlanRecordTypeId(),
    ]);
    assert.equal(first, id);
    assert.equal(second, id);
    assert.equal(await api.buildPayerAccountPlanWhere('plan-context'), ` (Id = 'plan-context') AND RecordTypeId = '${id}'`.trim());
    await api.fetchAccessiblePayerAccountPlans();
    assert.equal(await api.resolveContextualPayerAccountPlanId(), 'plan-context');
    assert.equal(api.calls.filter((call) => call.object === 'RecordType').length, 1);
    const metadata = api.calls[0];
    assert.match(metadata.where, /SobjectType = 'Account_Plan_vod__c'/);
    assert.match(metadata.where, /IsActive = true/);
    for (const known of ids) assert.ok(!metadata.where.includes(known));
    for (const query of api.calls.filter((call) => call.object === 'Account_Plan_vod__c')) {
      assert.ok(query.where.includes(`RecordTypeId = '${id}'`));
      assert.equal(typeof query.where, 'string');
    }
  });
}

test('missing, ambiguous, and denied metadata prevent plan queries and allow retry', async () => {
  for (const failure of [() => [], () => ids.map((Id) => ({ Id })), () => { throw new Error('RecordType access denied'); }]) {
    let fail = true;
    const api = setup(() => fail ? failure() : [{ Id: ids[0] }]);
    await assert.rejects(api.fetchAccessiblePayerAccountPlans(), /record type|RecordType/i);
    assert.equal(api.calls.some((call) => call.object === 'Account_Plan_vod__c'), false);
    fail = false;
    await api.fetchAccessiblePayerAccountPlans();
    assert.equal(api.calls.filter((call) => call.object === 'RecordType').length, 2);
  }
});

test('local preview uses its fixture ID without querying org metadata', async () => {
  const api = setup(() => { throw new Error('Unexpected metadata query'); }, false);
  assert.equal(await api.resolvePayerAccountPlanRecordTypeId(), ids[1]);
  assert.equal(await api.buildPayerAccountPlanWhere(null), null);
  assert.equal(api.calls.length, 0);
});
