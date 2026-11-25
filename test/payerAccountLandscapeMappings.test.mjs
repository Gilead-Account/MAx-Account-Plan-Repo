import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('payer Account Landscape uses the supplied object and field APIs', async () => {
  const source = await read('../src/lib/dataservice/accountPlan/payerAccountLandscape.js');

  assert.match(source, /KPH_Account_Landscape__c/);
  for (const field of [
    'KPH_Network_Size__c',
    'KPH_Network_Size__c',
    'KPH_Site_Inclusion_Criteria_Notes__c',
    'KPH_Decision_making_bodies_Notes__c',
    'KPH_CAR_T_Reimbursement_notes__c',
    'KPH_CAR_T_Reimbursement_notes_updt_date__c',
    'KPH_CAR_T_Pathway_notes__c',
    'KPH_CAR_T_Pathway_notes_updated_date__c',
    'KPH_Kite_s_Products_Reimbursement_notes__c',
    'KPH_Competitors_Reimbursement_notes__c',
    'KPH_Competitors_Pathway_notes__c',
    'KPH_Competitors_Path_notes_update_date__c',
  ]) {
    assert.match(source, new RegExp(`['"]${field}['"]`));
  }

  assert.match(source, /readPicklist\(ACCOUNT_LANDSCAPE_OBJECT, 'KPH_Network_Size__c'\)/);
  assert.doesNotMatch(source, /KPH_Site_Inclusion_Criteria_Category__c/);
  assert.match(source, /updateRecord\(ACCOUNT_LANDSCAPE_OBJECT/);
  assert.match(source, /createCrmRecord/);
  assert.match(source, /resolvePayerAccountPlanId\(\)/);
});

test('Account Landscape controls load and persist through the Veeva mapping', async () => {
  const page = await read('../src/pages/AccountLandscape/index.jsx');

  assert.match(page, /loadPayerAccountLandscape\(\)/);
  assert.match(page, /savePayerAccountLandscapeFields/);
  assert.match(page, /config\.notesLabel/);
  assert.match(page, /config\?\.updatedLabel/);
  assert.doesNotMatch(page, /Open network|Limited network|Defined but not published/);
});
