import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { installRecordTypes } from './support/crmRecordTypes.mjs';

const sandboxId = '012VE0000081kx3YAA';
const productionId = '012000000000001AAA';
function setup(options = {}, metadata = () => []) {
  const queries = [];
  const context = vm.createContext({
    hasVeevaRuntime: () => true,
    unwrap: row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v?.value ?? v])),
    runCrmQuery: async params => { queries.push(params); return metadata(params); },
  });
  installRecordTypes(context, options);
  return { context, queries };
}

for (const isSandbox of [true, 'true', false, 'false', null]) {
  test(`org IsSandbox=${isSandbox} selects the environment with sandbox fallback`, async () => {
    const { context } = setup({ isSandbox });
    const result = await context.resolveCrmEnvironment();
    assert.equal(result.environment, isSandbox === false || isSandbox === 'false' ? 'production' : 'sandbox');
    assert.equal(result.source, isSandbox === null ? 'sandbox-default' : 'Organization.IsSandbox');
  });
}
for (const configured of ['sandbox', 'production']) {
  test(`explicit ${configured} supports offline detection`, async () => {
    const { context } = setup({ configured, isSandbox: null });
    assert.equal((await context.resolveCrmEnvironment()).environment, configured);
  });
  test(`explicit ${configured} mismatch prevents record type queries`, async () => {
    const { context, queries } = setup({ configured, isSandbox: configured === 'production' });
    await assert.rejects(context.resolveRecordTypeId('payerObjective'), /environment mismatch/);
    assert.equal(queries.length, 0);
  });
}
test('invalid environment configuration rejects instead of defaulting', async () => {
  const { context } = setup({ configured: 'prodution' });
  await assert.rejects(context.resolveCrmEnvironment(), /must be sandbox or production/);
});
test('sandbox uses the workbook ID even when names match another ID', async () => {
  const { context } = setup({}, () => [
    { Id: sandboxId, Name: 'Payer Account Objective' },
    { Id: productionId, Name: 'Payer Account Objective' },
  ]);
  assert.equal(await context.resolveRecordTypeId('payerObjective'), sandboxId);
});
test('production resolves the org ID rather than using workbook IDs', async () => {
  const { context } = setup({ isSandbox: false }, () => [
    { Id: productionId, DeveloperName: 'KPH_Payer_Account_Objective' },
    { Id: sandboxId, Name: 'Network Account Objective' },
  ]);
  assert.equal(await context.resolveRecordTypeId('payerObjective'), productionId);
});
test('sandbox metadata without the supplied ID fails and can retry', async () => {
  let ready = false;
  const { context } = setup({}, () => [{ Id: ready ? sandboxId : productionId, Name: 'Payer Account Objective' }]);
  await assert.rejects(context.resolveRecordTypeId('payerObjective'), /unique sandbox record type/);
  ready = true;
  assert.equal(await context.resolveRecordTypeId('payerObjective'), sandboxId);
});
test('Payer barriers exclude Network record types and metadata requests are coalesced', async () => {
  const { context, queries } = setup({}, () => [
    { Id: productionId, DeveloperName: 'KPH_Payer_Barriers' },
    { Id: '012000000000002AAA', DeveloperName: 'KPH_Payer_Opportunities' },
    { Id: '012VE0000081kNZYAY', Name: 'Network Barrier' },
    { Id: '012VE0000081kaTYAQ', Name: 'Network Opportunities' },
  ]);
  const results = await Promise.all(['payerBarrier', 'payerOpportunity', 'payerBarrier'].map(key => context.resolveRecordTypeId(key)));
  assert.deepEqual(results, [productionId, '012000000000002AAA', productionId]);
  assert.equal(queries.length, 1);
});
test('unconfirmed landscape object mapping stops before any org query', async () => {
  const { context, queries } = setup();
  await assert.rejects(context.resolveRecordTypeId('networkLandscape'), /confirmed CRM object mapping/);
  assert.equal(queries.length, 0);
});

test('all workbook Payer entries resolve their supplied sandbox IDs including the 15-character stakeholder ID', async () => {
  const entries = {
    payerObjective: ['KPH_Account_Objective__c', '012VE0000081kx3YAA'],
    payerStrategy: ['KPH_Strategy__c', '012VE0000081l0HYAQ'],
    payerTactic: ['KPH_Tactics_Resource__c', '012VE0000081kdhYAA'],
    payerStakeholder: ['KPH_Stakeholder_Map__c', '012VE0000084tFq'],
    payerAction: ['KPH_Actions_and_Critical_Next_Steps__c', '012VE0000081kLxYAI'],
    payerMilestone: ['KPH_Milestones_and_Engagements__c', '012VE0000081k93YAA'],
  };
  const { context } = setup({}, params => Object.values(entries).filter(([object]) => params.where.includes(`'${object}'`)).map(([, Id]) => ({ Id })));
  for (const [key, [, id]] of Object.entries(entries)) {
    assert.equal(await context.resolveRecordTypeId(key), id);
    assert.equal((await context.payerRecordTypeFields(key)).RecordTypeId, id);
    assert.ok((await context.payerRecordTypeWhere(key)).includes(id));
  }
});

const summaryTypes = [
  ['customerAsk', 'Key Customer Ask', '012VE000007qhzJYAQ'],
  ['networkCustomerAsk', 'Key Customer Asks Network', '012VE000007zKk9YAE'],
  ['keyWin', 'Key Wins', '012VE000007qhxhYAA'],
  ['networkKeyWin', 'Key Wins Network', '012VE000007zKSPYA2'],
  ['kltAsk', 'KLT Asks', '012VE000007zKnNYAU'],
];

for (const isSandbox of [true, false]) {
  test(`${isSandbox ? 'sandbox' : 'production'} summary types keep Payer, Network, and KLT identities separate`, async () => {
    const rows = summaryTypes.map(([, Name, Id], index) => ({
      Name,
      Id: isSandbox ? Id : `01200000000000${index + 1}AAA`,
    }));
    const { context, queries } = setup({ isSandbox }, () => rows);
    const ids = await Promise.all(summaryTypes.map(([key]) => context.resolveRecordTypeId(key)));
    assert.deepEqual(ids, rows.map(row => row.Id));
    assert.equal(new Set(ids).size, 5);
    assert.equal(queries.length, 1);
    assert.match(queries[0].where, /SobjectType = 'KPH_Key_Wins_Key_Customer_Asks__c'/);
  });
}

test('sandbox summary types do not fall back to old or Network IDs', async () => {
  let ready = false;
  const { context } = setup({}, () => ready
    ? [{ Id: '012VE000007qhxhYAA', Name: 'Key Wins' }]
    : [
      { Id: '012VI00000GP7JeYAL', Name: 'Key Wins' },
      { Id: '012VE000007zKSPYA2', Name: 'Key Wins Network' },
    ]);
  await assert.rejects(context.resolveRecordTypeId('keyWin'), /unique sandbox record type/);
  ready = true;
  assert.equal(await context.resolveRecordTypeId('keyWin'), '012VE000007qhxhYAA');
});

for (const isSandbox of [true, false]) {
  test(`${isSandbox ? 'sandbox' : 'production'} uses Barrier and Opportunities assignment labels without selecting Network types`, async () => {
    const { context } = setup({ isSandbox }, () => [
      { Id: '012000000000001AAA', Name: 'Barrier', DeveloperName: 'Barrier' },
      { Id: '012000000000002AAA', Name: 'Opportunities', DeveloperName: 'Opportunities' },
      { Id: '012VE0000081kNZYAY', Name: 'Network Barrier' },
      { Id: '012VE0000081kaTYAQ', Name: 'Network Opportunities' },
    ]);
    assert.equal(await context.resolveRecordTypeId('payerBarrier'), '012000000000001AAA');
    assert.equal(await context.resolveRecordTypeId('payerOpportunity'), '012000000000002AAA');
  });
  test(`${isSandbox ? 'sandbox' : 'production'} resolves the assigned Payer Account Landscape independently of Network`, async () => {
    const { context, queries } = setup({ isSandbox }, () => [
      { Id: '012000000000001AAA', Name: 'Payer Account Landscape' },
      { Id: '012VE0000085KcbYAE', Name: 'Network Account Landscape' },
    ]);
    assert.equal(await context.resolveRecordTypeId('payerLandscape'), '012000000000001AAA');
    assert.match(queries[0].where, /SobjectType = 'KPH_Account_Landscape__c'/);
  });
}

test('a supplied sandbox ID must not resolve to a conflicting record type name', async () => {
  const { context } = setup({}, () => [
    { Id: '012VE0000081kx3YAA', Name: 'Network Account Objective', DeveloperName: 'Network_Account_Objective' },
    { Id: '012000000000001AAA', Name: 'Payer Account Objective' },
  ]);
  await assert.rejects(context.resolveRecordTypeId('payerObjective'), error => {
    assert.match(error.message, /Expected sandbox ID: 012VE0000081kx3YAA/);
    assert.match(error.message, /Active IDs matching this name: 012000000000001AAA/);
    return true;
  });
});
