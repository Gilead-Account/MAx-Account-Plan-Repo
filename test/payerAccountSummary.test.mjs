import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { payerQueryFields } from '../src/lib/dataservice/accountPlan/payerMappedFields.js';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('sidebar summary retains the plan name when account lookup is missing or inaccessible', async () => {
  const source = (await read('../src/lib/dataservice/accountPlan/payerAccountSummary.js'))
    .replace(/import[\s\S]*?from\s+'[^']+';/g, '')
    .replace(/export const /g, 'const ');
  for (const accountMode of ['missing', 'inaccessible', 'available']) {
    const query = async ({ object, fields }) => {
      if (object === 'Account_Plan_vod__c') {
        assert.ok(fields.includes('Name'));
        return [{ Id: 'plan-1', Name: 'Humana Payer Account Plan', Account_vod__c: accountMode === 'missing' ? null : 'account-1', OwnerId: '005owner' }];
      }
      if (object === 'Account') {
        if (accountMode === 'inaccessible') throw new Error('Account lookup denied');
        return [{ Name: 'Humana' }];
      }
      return [{ Name: 'Test KAD' }];
    };
    const load = new Function('payerQueryFields', 'hasVeevaRuntime', 'buildIdMatchWhere', 'runCrmQuery', 'runQuery', 'unwrap', 'buildPayerAccountPlanWhere', 'resolvePayerAccountPlanId', `${source}\nreturn fetchPayerAccountSummary;`)(
      payerQueryFields, () => true, (_field, id) => id || null, query, query, (row) => row, (id) => id, async () => 'plan-1'
    );
    const summary = await load();
    assert.equal(summary.planName, 'Humana Payer Account Plan');
    assert.equal(summary.accountName, accountMode === 'available' ? 'Humana' : 'Humana Payer Account Plan');
    assert.equal(summary.kadOwner, 'Test KAD');
  }
  const sidebar = await read('../src/components/MarketAccessSidebar.jsx');
  assert.match(sidebar, /accountSummary\.planName \|\|/);
});

test('payer account summary uses the supplied Account Plan CRM field mappings', async () => {
  const source = await read('../src/lib/dataservice/accountPlan/payerAccountSummary.js');
  const sidebar = await read('../src/components/MarketAccessSidebar.jsx');
  const app = await read('../src/App.jsx');
  const payerPlan = await read('../src/lib/dataservice/accountPlan/payerAccountPlan.js');

  for (const field of [
    'Account_vod__c',
    'LastModifiedDate',
    'KPH_ATC_EID__c',
    'KPH_Territory_Description__c',
    'OwnerId',
  ]) {
    assert.match(source, new RegExp(`['"]${field}['"]`));
  }

  assert.match(source, /object:\s*'Account_Plan_vod__c'/);
  assert.match(source, /buildPayerAccountPlanWhere\(planId\)/);
  assert.match(payerPlan, /012VI00000GP0YHYA1/);
  assert.match(payerPlan, /RecordTypeId =/);
  assert.match(payerPlan, /object:\s*'Account_Plan_vod__c'/);
  assert.match(payerPlan, /sort:\s*\['LastModifiedDate DESC'\]/);
  assert.match(payerPlan, /resolvePayerAccountPlanId/);
  assert.match(source, /resolvePayerAccountPlanId\(\)/);
  assert.match(source, /fetchLookupName\('Account', plan\.Account_vod__c\)/);
  assert.match(source, /fetchOwnerName\(plan\.OwnerId\)/);
  assert.match(source, /startsWith\('00G'\) \? 'Group' : 'User'/);
  assert.doesNotMatch(source, /Account_vod__r\.|Owner\./);

  assert.match(sidebar, /Payer EID/);
  assert.match(sidebar, /accountSummary\.eid/);
  assert.match(sidebar, /accountSummary\.lastModifiedDate/);
  assert.match(sidebar, /accountSummary\.marketplace/);
  assert.match(sidebar, /accountSummary\.kadOwner/);
  assert.match(app, /fetchPayerAccountSummary\(\)/);
  assert.doesNotMatch(app, /import \{ accountSummary,/);
});
