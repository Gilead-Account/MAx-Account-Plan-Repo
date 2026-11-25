import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const crossFunctionalModulePath = new URL('../src/lib/dataservice/accountPlan/crossFunctionalPlan.js', import.meta.url);
const sharedModulePath = new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url);

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const loadCrossFunctionalModule = async () => {
  globalThis.__poaDataCalls = [];

  const sharedStubUrl = dataModule(`
    export const createSalesforceIdLookup = (rows) => new Map((rows || []).map((row) => [row.id, row]));
    export const fetchBarriersAndDrivers = () => Promise.resolve({ rows: [], access: {} });
    export const fetchCriticalActivities = () => Promise.resolve([]);
    export const fetchTeamMembersByPlan = () => Promise.resolve([]);
    export const getSalesforceIdLookupEntry = (lookup, id) => lookup.get(id);
    export const getCurrentUserId = () => Promise.resolve(null);
    export const getCurrentUserProfileName = () => Promise.resolve(null);
    export const POA_CONTEXT_FIELDS = ['Id', 'LastModifiedDate', 'KPH_Customer_Engagement_DLBCL_POA__c'];
    export const isOpenBarrierDriverStatus = (status) => status !== 'Closed';
    export const requireCurrentAccountPlanId = () => Promise.resolve('plan-001');
    export const resolveShellContextForPlanId = (planId, options) => {
      globalThis.__poaDataCalls.push({ fn: 'resolveShellContextForPlanId', planId, options });
      return Promise.resolve({
        planId,
        plan: { id: planId },
        account: { id: 'account-001' },
        planRow: {
          Id: planId,
          LastModifiedDate: '2026-06-19T10:00:00Z',
          KPH_Customer_Engagement_DLBCL_POA__c: 'Customer engagement plan',
        },
      });
    };
    export const toPoaBlocks = (row) => {
      globalThis.__poaDataCalls.push({ fn: 'toPoaBlocks', row });
      return {
        lastModifiedDate: row.LastModifiedDate,
        blocks: [{ key: 'dlbcl-customer-engagement', content: row.KPH_Customer_Engagement_DLBCL_POA__c }],
      };
    };
    export const toBarrierDriver = (row) => row;
    export const updatePoaField = (planId, field, value) => {
      globalThis.__poaDataCalls.push({ fn: 'updatePoaField', planId, field, value });
      return Promise.resolve({});
    };
  `);

  const source = (await readFile(crossFunctionalModulePath, 'utf8'))
    .replace(/from ['"]@\/lib\/dataservice\/accountPlan\/shared['"]/g, `from '${sharedStubUrl}'`);

  const mod = await import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
  return { mod, calls: globalThis.__poaDataCalls };
};

test('loadCrossFunctionalPlan reads POA blocks from the shell-context plan row', async () => {
  const { mod, calls } = await loadCrossFunctionalModule();

  const data = await mod.loadCrossFunctionalPlan();

  const contextCall = calls.find((call) => call.fn === 'resolveShellContextForPlanId');
  assert.deepEqual(contextCall, {
    fn: 'resolveShellContextForPlanId',
    planId: 'plan-001',
    options: { planFields: ['Id', 'LastModifiedDate', 'KPH_Customer_Engagement_DLBCL_POA__c'] },
  });
  assert.equal(calls.filter((call) => call.fn === 'toPoaBlocks').length, 1);
  assert.equal(data.poaLastModifiedDate, '2026-06-19T10:00:00Z');
  assert.deepEqual(data.blocks, [
    { key: 'dlbcl-customer-engagement', content: 'Customer engagement plan' },
  ]);
  assert.deepEqual(data.medicalPoaOpportunities, []);
});

test('savePoaBlock updates the plan target field', async () => {
  const { mod, calls } = await loadCrossFunctionalModule();

  await mod.savePoaBlock(
    'plan-001',
    { field: 'KPH_Medical_Affairs_DLBCL_POA__c' },
    'Updated medical plan'
  );

  assert.deepEqual(calls.find((call) => call.fn === 'updatePoaField'), {
    fn: 'updatePoaField',
    planId: 'plan-001',
    field: 'KPH_Medical_Affairs_DLBCL_POA__c',
    value: 'Updated medical plan',
  });
});

test('Medical POA contains only open opportunities and their open tactics', async () => {
  const { mod } = await loadCrossFunctionalModule();
  const opportunities = mod.buildMedicalPoaOpportunities({
    access: {},
    rows: [
      { id: 'opp-open', type: 'Driver', name: 'Open opportunity', status: 'Open', indication: 'DLBCL' },
      { id: 'opp-closed', type: 'Driver', name: 'Closed opportunity', status: 'Closed', indication: 'DLBCL' },
      { id: 'barrier-open', type: 'Barrier', name: 'Open barrier', status: 'Open', indication: 'DLBCL' },
    ],
  }, [
    { id: 'tactic-open', name: 'Open tactic', status: 'In Progress', barrierDriverId: 'opp-open' },
    { id: 'tactic-closed', name: 'Closed tactic', status: 'Complete', barrierDriverId: 'opp-open' },
  ]);

  assert.deepEqual(opportunities, [{
    id: 'opp-open',
    name: 'Open opportunity',
    status: 'Open',
    indication: 'DLBCL',
    medicalTactics: [{
      id: 'tactic-open',
      name: 'Open tactic',
      status: 'In Progress',
      dueDate: null,
    }],
  }]);
});

test('active POA query fields are DLBCL-only Account Plan fields', async () => {
  const source = await readFile(sharedModulePath, 'utf8');
  const poaFields = source.match(/export const POA_FIELDS = \[[\s\S]*?\];/)?.[0] || '';
  const poaBlocks = source.match(/export const POA_BLOCK_DEFS = \[[\s\S]*?\];/)?.[0] || '';
  const fetchPoaBlocks = source.match(/export const fetchPoaBlocks = \(planId\) => \{[\s\S]*?\n\};/)?.[0] || '';

  assert.match(poaFields, /KPH_Customer_Engagement_DLBCL_POA__c/);
  assert.match(poaFields, /KPH_Market_Access_DLBCL_POA__c/);
  assert.match(poaFields, /KPH_Medical_Affairs_DLBCL_POA__c/);
  assert.doesNotMatch(poaFields, /_MM_POA__c/);
  assert.doesNotMatch(poaBlocks, /indication: 'MM'|MM .*Plan of Action|_MM_POA__c/);
  assert.match(fetchPoaBlocks, /object:\s*'Account_Plan_vod__c'/);
  assert.doesNotMatch(fetchPoaBlocks, /KPH_Ecosystem_Plan__c/);
});
