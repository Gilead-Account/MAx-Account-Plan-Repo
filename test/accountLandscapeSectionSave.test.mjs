import { crmDateToday } from '../src/lib/helper/payerDates.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const page = await readFile(new URL('../src/pages/AccountLandscape/index.jsx', import.meta.url), 'utf8');
const handler = page.slice(page.indexOf('  const toggleSectionEditing ='), page.indexOf('  const sectionEditButton ='));

function setup({ fail = false, landscapeId = 'existing' } = {}) {
  const writes = [];
  const context = {
    notifySaved() {},
    crmDateToday,
    savingSection: null, landscapeId, planId: 'plan',
    editingSections: { network: true, decision: true, quality: true },
    dirtyMappedFields: new Set(['size', 'criteria', 'policy', 'KPH_Network_Porosity__c']),
    NETWORK_LANDSCAPE_CONFIG: [{ key: 'networkModel', notesField: 'size' }, { key: 'siteInclusionCriteria', notesField: 'criteria' }],
    networkDetails: { networkModel: { narrative: '30–80' }, siteInclusionCriteria: { narrative: 'Draft criteria' } },
    networkPorosity: '40–59%',
    decisionDetails: {},
    LANDSCAPE_POLICY_FIELD_CONFIG: { Reimbursement: { CAR: { field: 'policy', updatedField: 'policyDate' } } },
    policyDetails: { Reimbursement: { CAR: { value: 'Unsaved policy', updatedDate: null } } },
    console: { error() {} },
    savePayerAccountLandscapeFields: async (args) => { writes.push(args); if (fail) throw new Error('Save failed'); },
    loadPayerAccountLandscape: async () => ({ landscapeId: 'new-record' }),
  };
  for (const [setter, key] of Object.entries({ setEditingSections: 'editingSections', setSavingSection: 'savingSection', setDataError: 'dataError', setDirtyMappedFields: 'dirtyMappedFields', setPolicyDetails: 'policyDetails', setLandscapeId: 'landscapeId' })) {
    context[setter] = (value) => { context[key] = typeof value === 'function' ? value(context[key]) : value; };
  }
  vm.createContext(context);
  vm.runInContext(`${handler}\nthis.saveSection = toggleSectionEditing;`, context);
  return { context, writes };
}

test('network save batches its changes and preserves other section drafts on creation', async () => {
  const { context, writes } = setup({ landscapeId: null });
  await context.saveSection('network');
  assert.equal(writes.length, 1);
  assert.deepEqual({ ...writes[0].fields }, { size: '30–80', criteria: 'Draft criteria', KPH_Network_Porosity__c: '40–59%' });
  assert.equal(context.landscapeId, 'new-record');
  assert.equal(context.editingSections.network, false);
  assert.equal(context.editingSections.quality, true);
  assert.deepEqual([...context.dirtyMappedFields], ['policy']);
  assert.equal(context.policyDetails.Reimbursement.CAR.value, 'Unsaved policy');
});

test('quality save batches policy values and timestamps', async () => {
  const { context, writes } = setup();
  await context.saveSection('quality');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].fields.policy, 'Unsaved policy');
  assert.match(writes[0].fields.policyDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(context.policyDetails.Reimbursement.CAR.updatedDate, writes[0].fields.policyDate);
  assert.equal(context.editingSections.quality, false);
  assert.equal(context.dirtyMappedFields.has('size'), true);
});

test('failed save keeps section editable and changes dirty', async () => {
  const { context } = setup({ fail: true });
  await context.saveSection('network');
  assert.equal(context.editingSections.network, true);
  assert.equal(context.dirtyMappedFields.has('size'), true);
  assert.equal(context.dataError, 'Save failed');
  assert.equal(context.savingSection, null);
});
