import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import { payerAccountPlanAccess } from '../src/lib/payerAccountPlanAccess.js';

const plan = { KPH_Territory_Description__c: 'North Region' };
const access = (Department, territory = 'North Region', target = plan) => payerAccountPlanAccess({ Department, KPH_Primary_Territory_Description__c: territory }, target).canEdit;

test('Home Office and System Administrator profiles override all department and territory restrictions', () => {
  for (const profile of ['KPH-Home Office', 'System Administrator', ' kph-home  office ', ' SYSTEM ADMINISTRATOR ']) {
    for (const Department of ['KAD', 'NAD', 'RAD', 'Unknown', '', null]) {
      for (const territory of ['Other Region', '', null]) {
        assert.deepEqual(payerAccountPlanAccess({ Department, KPH_Primary_Territory_Description__c: territory }, plan, profile), { canEdit: true, reason: '' });
      }
    }
  }
});

test('profile matching requires the full name and preserves existing department access', () => {
  for (const profile of ['', null, undefined, 'Home Office', 'KPH-Home Office Assistant', 'System Administrator Read Only', 'Former System Administrator']) {
    assert.equal(payerAccountPlanAccess({ Department: 'NAD' }, plan, profile).canEdit, false);
    assert.equal(payerAccountPlanAccess({ Department: 'KAD', KPH_Primary_Territory_Description__c: 'Other Region' }, plan, profile).canEdit, false);
    assert.equal(payerAccountPlanAccess({ Department: 'NPAD' }, plan, profile).canEdit, true);
  }
  for (const Department of ['KPH-Home Office', 'System Administrator']) {
    assert.equal(payerAccountPlanAccess({ Department }, plan).canEdit, false);
  }
});

test('KAD edits only a full, nonempty primary territory match', () => {
  for (const department of ['KAD', 'Key Account Director', ' key  account director ']) {
    assert.equal(access(department), true);
    assert.equal(access(department, ' north REGION '), true);
    for (const territory of ['', null, 'North', 'South Region']) assert.equal(access(department, territory), false);
    assert.equal(access(department, '', { KPH_Territory_Description__c: '' }), false);
    assert.equal(access(department, 'North Region', {}), false);
  }
});

test('NAD and RAD remain read-only in every territory', () => {
  for (const department of ['NAD', 'National Account Director', 'RAD', 'Regional Account Director']) {
    assert.equal(access(department), false);
    assert.equal(access(department, 'Other Region'), false);
  }
});

test('formatted KAD department labels and Mid Central territory spelling match safely', () => {
  const target = { KPH_Territory_Description__c: 'MID-CENTRAL' };
  for (const department of ['KAD', 'Key Account Director', 'KPH-Key Account Director', 'Key Account Director (KAD)', 'KAD - Key Account Director', 'KAD / Key Account Director']) {
    assert.equal(access(department, 'Mid Central', target), true, department);
    assert.equal(access(department, 'MID\u2013CENTRAL', target), true, department);
    for (const territory of ['Central', 'Mid Central East', 'Other Region', '', null]) {
      assert.equal(access(department, territory, target), false, `${department}: ${territory}`);
    }
  }
  for (const department of ['Former KAD', 'Assistant Key Account Director', 'NAD / KAD', 'Market Access']) {
    assert.equal(access(department, 'Mid Central', target), false, department);
  }
  assert.equal(access('KPH-NAD', 'Mid Central', target), false);
  assert.equal(access('Regional Account Director (RAD)', 'Mid Central', target), false);
});

test('unrecognized or unavailable departments explain the denied access', () => {
  assert.match(payerAccountPlanAccess({ Department: 'Market Access' }, plan).reason, /Department received: "Market Access"/);
  assert.match(payerAccountPlanAccess({}, plan).reason, /User.Department is blank or unavailable/);
});

test('NPAD and designated leadership edit all territories; unknown departments cannot edit', () => {
  for (const department of ['NPAD', 'National Payer Account Director', 'Senior Director, Key Accounts', 'Strategic Engagement Head']) {
    assert.equal(access(department), true);
    assert.equal(access(department, 'Other Region'), true);
    assert.equal(access(department, null, {}), true);
  }
  for (const department of ['', null, 'Director', 'Unrecognized']) assert.equal(access(department), false);
  assert.equal(payerAccountPlanAccess(null, plan).canEdit, false);
});

test('every Payer mutation rejects read-only users, reads still work, and changed access is rechecked', async () => {
  const previousWindow = globalThis.window;
  const storage = new Map();
  globalThis.window = {
    location: { search: '', hostname: 'localhost' },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) },
  };
  const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
  try {
    const load = (name) => server.ssrLoadModule(`/src/lib/dataservice/accountPlan/${name}.js`);
    const query = await server.ssrLoadModule('/src/lib/dataservice/query.js');
    const { PLAN_ID } = await server.ssrLoadModule('/src/lib/mockData/fixtures.js');
    const services = Object.fromEntries(await Promise.all(['payerExecutiveSummary', 'payerAccountLandscape', 'payerHierarchy', 'payerAssessments', 'payerLaunchReadiness', 'payerCriticalActions', 'payerMilestones', 'payerStakeholders', 'payerBarriersOpportunities', 'payerAccountPlan', 'payerAccess'].map(async (name) => [name, await load(name)])));
    const summary = services.payerExecutiveSummary;
    const setUser = (Department, territory = 'US - North Region 4') => query.updateRecord('User', '0058C00000MockUser2', { Department, KPH_Primary_Territory_Description__c: territory });
    const mutations = [
      () => summary.updatePayerSummaryPlanField(PLAN_ID, 'KPH_Geographic_Footprint__c', 'KPH_Geographic_Footprint_updated_date__c', 'Forbidden'),
      () => summary.savePayerArchetype(PLAN_ID, ''),
      () => summary.savePayerKeyWin(PLAN_ID, {}),
      () => summary.savePayerCustomerAsk(PLAN_ID, {}),
      () => summary.deletePayerSummaryRecord('record', PLAN_ID, 'keyWin'),
      () => services.payerAccountLandscape.savePayerAccountLandscapeFields({ planId: PLAN_ID, fields: {} }),
      () => services.payerHierarchy.savePayerHierarchy([], []),
      () => services.payerAssessments.savePayerAssessment('cart', {}),
      () => services.payerLaunchReadiness.savePayerLaunchReadiness({}, []),
      () => services.payerCriticalActions.savePayerCriticalAction({}),
      () => services.payerCriticalActions.deletePayerCriticalAction('record'),
      () => services.payerMilestones.savePayerMilestoneNotes('Forbidden'),
      () => services.payerMilestones.savePayerMilestone({ milestone: 'Forbidden' }),
      () => services.payerMilestones.deletePayerMilestone('record'),
      () => services.payerStakeholders.savePayerStakeholder({}),
      () => services.payerStakeholders.deletePayerStakeholder('record'),
      () => services.payerBarriersOpportunities.savePayerBarrierOpportunity({}),
      () => services.payerBarriersOpportunities.deletePayerBarrierOpportunity('record'),
    ];
    for (const department of ['NAD', 'RAD', 'Unknown']) {
      await setUser(department);
      const before = JSON.stringify(await summary.loadPayerExecutiveSummary());
      const plansBefore = JSON.stringify(await services.payerAccountPlan.fetchAccessiblePayerAccountPlans());
      for (const mutate of mutations) await assert.rejects(mutate(), /read-only|does not have edit access/);
      assert.equal(JSON.stringify(await summary.loadPayerExecutiveSummary()), before);
      assert.equal(JSON.stringify(await services.payerAccountPlan.fetchAccessiblePayerAccountPlans()), plansBefore);
    }
    await setUser('KAD', 'Other Region');
    await assert.rejects(mutations[0](), /primary territory/);
    await setUser('KAD');
    assert.equal((await services.payerAccess.loadPayerAccountPlanAccess(PLAN_ID)).canEdit, true);
    await summary.updatePayerSummaryPlanField(PLAN_ID, 'KPH_Geographic_Footprint__c', 'KPH_Geographic_Footprint_updated_date__c', 'Allowed');
    await setUser('RAD');
    await assert.rejects(mutations[0](), /read-only/);
    assert.equal((await summary.loadPayerExecutiveSummary()).accountDetails.geographicFootprint.value, 'Allowed');
    for (const department of ['NPAD', 'Senior Director, Key Accounts', 'Strategic Engagement Head']) {
      await setUser(department, 'Other Region');
      await summary.updatePayerSummaryPlanField(PLAN_ID, 'KPH_Geographic_Footprint__c', 'KPH_Geographic_Footprint_updated_date__c', department);
    }
  } finally {
    await server.close();
    globalThis.window = previousWindow;
  }
});
