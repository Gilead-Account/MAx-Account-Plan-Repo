import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { payerAccountPlanAccess } from '../src/lib/payerAccountPlanAccess.js';

const source = (await readFile(new URL('../src/lib/dataservice/accountPlan/payerAccess.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '').replace(/export const /g, 'const ');
function setup(query, userId = 'logged-in-user') {
  const calls = [];
  const context = {
    hasVeevaRuntime: () => true,
    getCrmDataForCurrentObject: async (object, field) => {
      calls.push({ object, field });
      assert.equal(object, 'User');
      assert.equal(field, 'Id');
      return userId;
    },
    getDataForCurrentObject: () => { throw new Error('Must use real CRM identity'); },
    runCrmQuery: (params) => { calls.push(params); return query(params); },
    runQuery: () => { throw new Error('Must use real CRM permissions'); },
    resolvePayerAccountPlanId: async () => 'context-plan',
    buildIdMatchWhere: (field, value) => value ? `${field} = '${value}'` : null,
    buildPayerAccountPlanWhere: (value) => value ? `Id = '${value}' AND RecordTypeId = 'payer'` : null,
    unwrap: (row) => row, payerAccountPlanAccess,
  };
  vm.createContext(context);
  vm.runInContext(source + '\nthis.load = loadPayerAccountPlanAccess; this.guard = assertPayerAccountPlanEditable;', context);
  return { ...context, calls };
}

test('hosted checks read CRM User fields and the explicit target plan marketplace', async () => {
  const api = setup(async ({ object }) => object === 'User'
    ? [{ Department: 'KPH-Key Account Director', KPH_Primary_Territory_Description__c: 'Mid Central' }]
    : [{ KPH_Territory_Description__c: 'MID-CENTRAL' }]);
  assert.equal((await api.load('target-plan')).canEdit, true);
  const user = api.calls.find((call) => call.object === 'User' && call.where);
  assert.equal(user.where, "Id = 'logged-in-user'");
  assert.deepEqual(Array.from(user.fields), ['Id', 'Profile_Name_vod__c', 'Department', 'KPH_Primary_Territory_Description__c']);
  assert.equal(api.calls.find((call) => call.object === 'Account_Plan_vod__c').where, "Id = 'target-plan' AND RecordTypeId = 'payer'");
  assert.equal(api.calls.some((call) => call.object === 'Profile'), false);
});

const profileQuery = (profile, Department = 'RAD') => async ({ object }) => {
  if (object === 'User') return [{ Profile_Name_vod__c: profile, Department, KPH_Primary_Territory_Description__c: 'Other Region' }];
  assert.equal(object, 'Account_Plan_vod__c');
  return [{ KPH_Territory_Description__c: 'MID-CENTRAL' }];
};

test('User.Profile_Name_vod__c grants cross-territory edits through the service guard', async () => {
  for (const profile of ['KPH-Home Office', 'System Administrator']) {
    for (const Department of ['NAD', 'RAD', 'KAD', null]) {
      const api = setup(profileQuery(profile, Department));
      assert.equal((await api.load('target-plan')).canEdit, true);
      await assert.doesNotReject(api.guard('target-plan'));
      assert.equal(api.calls.some((call) => call.object === 'Profile'), false);
    }
  }
});

test('nonprivileged and unavailable CRM profiles retain read-only restrictions', async () => {
  for (const profile of [null, '', 'KPH-Home Office Assistant', 'System Administrator Read Only']) {
    const api = setup(profileQuery(profile));
    assert.equal((await api.load('target-plan')).canEdit, false);
    await assert.rejects(api.guard('target-plan'), /read-only/);
  }
});

test('profile changes are rechecked on the next write', async () => {
  let profile = 'System Administrator';
  const api = setup((params) => profileQuery(profile)(params));
  await assert.doesNotReject(api.guard('target-plan'));
  profile = 'Standard User';
  await assert.rejects(api.guard('target-plan'), /read-only/);
});

test('User profile field query failures prevent writes even for department editors', async () => {
  const api = setup((params) => {
    if (params.object === 'User' && params.fields.includes('Profile_Name_vod__c')) throw new Error('Profile field unavailable');
    return profileQuery('System Administrator', 'NPAD')(params);
  });
  await assert.rejects(api.guard('target-plan'), /Profile field unavailable/);
});

test('other profile fields do not grant profile edit access', async () => {
  const api = setup(async ({ object }) => object === 'User'
    ? [{ Department: 'RAD', ProfileId: 'System Administrator', Profile_Name_vod_c: 'KPH-Home Office' }]
    : [{ KPH_Territory_Description__c: 'MID-CENTRAL' }]);
  await assert.rejects(api.guard('target-plan'), /read-only/);
});

test('missing identity, inaccessible fields, or absent plan cannot grant edits', async () => {
  await assert.rejects(setup(async () => [], null).guard('plan'), /Unable to verify/);
  await assert.rejects(setup(async () => { throw new Error('User fields unavailable'); }).guard('plan'), /User fields unavailable/);
  await assert.rejects(setup(async ({ object }) => object === 'User' ? [{ Department: 'NPAD' }] : []).guard('plan'), /Unable to verify/);
  await assert.rejects(setup(async (params) => params.object === 'Account_Plan_vod__c' ? [] : profileQuery('System Administrator')(params)).guard('plan'), /Unable to verify/);
});
