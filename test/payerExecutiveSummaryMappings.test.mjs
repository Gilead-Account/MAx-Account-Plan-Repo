import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('payer Executive Summary uses the supplied Account Plan field APIs', async () => {
  const source = await read('../src/lib/dataservice/accountPlan/payerExecutiveSummary.js');

  for (const field of [
    'KPH_Payer_Restrictiveness__c',
    'KPH_Payer_Restrictiveness_updated_date__c',
    'KPH_Geographic_Footprint__c',
    'KPH_Geographic_Footprint_updated_date__c',
    'KPH_Ownership_Affiliation__c',
    'KPH_Ownership_Affiliation_updated_date__c',
    'KPH_Covered_Lives__c',
    'KPH_Covered_Lives_updated_date__c',
    'KPH_Lines_of_Business__c',
    'KPH_Lines_of_Business_updated_date__c',
  ]) {
    assert.match(source, new RegExp(`['"]${field}['"]`));
  }

  assert.match(source, /object:\s*'Account_Plan_vod__c'/);
  assert.match(source, /buildPayerAccountPlanWhere\(planId\)/);
  assert.match(source, /readPicklist\('Account_Plan_vod__c', 'KPH_Payer_Restrictiveness__c'\)/);
  assert.match(source, /updateRecord\('Account_Plan_vod__c'/);
  assert.match(source, /resolvePayerAccountPlanId\(\)/);
});

test('payer Key Wins and Customer Asks use the supplied child object field APIs', async () => {
  const source = await read('../src/lib/dataservice/accountPlan/payerExecutiveSummary.js');
  const page = await read('../src/pages/ExecutiveSummary/index.jsx');

  assert.match(source, /KPH_Key_Wins_Key_Customer_Asks__c/);
  assert.match(source, /KEY_WINS_RECORD_TYPE_ID\s*=\s*'012VI00000GP7JeYAL'/);
  assert.ok(source.includes("RecordTypeId = '${await summaryType('keyWin')}'"));
  assert.ok(source.includes("RecordTypeId: await summaryType('keyWin')"));
  assert.match(source, /KEY_CUSTOMER_ASK_RECORD_TYPE_ID\s*=\s*'012VI00000GP7JdYAL'/);
  assert.ok(source.includes("RecordTypeId = '${await summaryType('customerAsk')}'"));
  assert.ok(source.includes("RecordTypeId: await summaryType('customerAsk')"));
  for (const field of [
    'CreatedDate',
    'LastModifiedDate',
    'KPH_Key_Wins_Date__c',
    'KPH_Key_Wins_Description__c',
    'KPH_Key_Wins_Impact__c',
    'KPH_Key_Customer_Asks_Stakeholder_Name__c',
    'KPH_Key_Customer_Asks_Role__c',
    'KPH_Account_Plan__c',
    'KPH_Key_Customer_Asks_Description__c',
  ]) {
    assert.match(source, new RegExp(`['"]${field}['"]`));
  }

  assert.match(source, /createCrmRecord/);
  assert.doesNotMatch(source, /deleteRecord\(PAYER_SUMMARY_CHILD_OBJECT/);
  assert.match(source, /updateRecord\(PAYER_SUMMARY_CHILD_OBJECT, id/);
  assert.match(page, /disabled=\{!canEdit \|\| dataStatus !== 'ready'\}/);
  assert.match(page, /disabled=\{!canEdit \|\| dataStatus !== 'ready' \|\| customerAsks\.length >= 5\}/);
  assert.match(page, /loadPayerExecutiveSummary\(\)/);
  assert.match(page, /keyWin\.createdDate/);
  assert.match(page, /keyWin\.lastModifiedDate/);
  assert.match(page, /customerAsk\.dateCreated/);
  assert.match(page, /customerAsk\.lastModifiedDate/);
  assert.doesNotMatch(page, /initialKeyWins|initialCustomerAsks|payerRestrictivenessOptions/);
});
