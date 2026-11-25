import assert from 'node:assert/strict';
import test from 'node:test';
import { payerQueryFields } from '../src/lib/dataservice/accountPlan/payerMappedFields.js';

test('barrier queries use the confirmed strategy field and exclude the unused field', () => {
  const fields = payerQueryFields('KPH_Payers_Barrier_Opportunities__c');
  assert.ok(fields.includes('KPH_Strategy__c'));
  assert.ok(!fields.includes('KPH_Barrier_Strategy__c'));
});
