import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { installRecordTypes } from './support/crmRecordTypes.mjs';

for (const assessment of [false, true]) {
 test(`live ${assessment ? 'assessment' : 'landscape'} reads and creates use Payer Account Landscape`, async () => {
  const queries = [], creates = [];
  const recordTypeId = '012000000000001AAA';
  const context = vm.createContext({
   hasVeevaRuntime: () => true,
   assertPayerAccountPlanEditable: async () => {},
   resolvePayerAccountPlanId: async () => 'plan',
   buildIdMatchWhere: (field, id) => `${field} = '${id}'`,
   payerQueryFields: () => ['Id'], unwrap: row => row,
   crmDateToday: () => '2026-11-16',
   getCrmPicklistValueLabels: async () => ({}),
   runCrmQuery: async params => {
    queries.push(params);
    return params.object === 'RecordType' ? [
     { Id: recordTypeId, Name: 'Payer Account Landscape' },
     { Id: '012000000000002AAA', Name: 'Network Account Landscape' },
    ] : [];
   },
   createCrmRecord: async (object, fields) => { creates.push({ object, fields }); },
   ...(assessment ? { ACCOUNT_LANDSCAPE_OBJECT: 'KPH_Account_Landscape__c', ACCOUNT_LANDSCAPE_PLAN_FIELD: 'KPH_Account_Plan__c' } : {}),
  });
  installRecordTypes(context);
  const source = readFileSync(`src/lib/dataservice/accountPlan/${assessment ? 'payerAssessments' : 'payerAccountLandscape'}.js`, 'utf8')
   .replace(/import[\s\S]*?from\s+'[^']+';/g, '').replace(/export const /g, 'const ');
  vm.runInContext(source + (assessment
   ? '\nthis.load = loadPayerAssessments; this.save = savePayerAssessment;'
   : '\nthis.load = loadPayerAccountLandscape; this.save = savePayerAccountLandscapeFields;'), context);
  await context.load();
  if (assessment) await context.save('cart', { position: 'High', comments: 'Evidence' });
  else await context.save({ planId: 'plan', fields: { KPH_Decision_making_bodies_Notes__c: 'Committee' } });
  assert.equal(creates.length, 1);
  assert.equal(creates[0].object, 'KPH_Account_Landscape__c');
  assert.equal(creates[0].fields.RecordTypeId, recordTypeId);
  assert.equal(creates[0].fields.KPH_Account_Plan__c, 'plan');
  for (const query of queries.filter(item => item.object === 'KPH_Account_Landscape__c')) {
   assert.match(query.where, /KPH_Account_Plan__c = 'plan'/);
   assert.ok(query.where.includes(`RecordTypeId = '${recordTypeId}'`));
  }
 });
}
