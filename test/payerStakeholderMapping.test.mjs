import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('payer stakeholder CRM mappings round-trip and preserve assessment fields', async () => {
  const values = new Map();
  const oldWindow = globalThis.window;
  globalThis.window = { location: { search: '', hostname: 'localhost' }, localStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) } };
  let server;
  try {
    server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
    const service = await server.ssrLoadModule('/src/lib/dataservice/accountPlan/payerStakeholders.js');
    const query = await server.ssrLoadModule('/src/lib/dataservice/query.js');
    const { planId } = await service.loadPayerStakeholders();
    const input = { name: 'Mapped stakeholder', roleFunction: 'Medical Director', contactInformation: 'person@example.org', decisionAreas: 'Coverage', influence: 'High', relationshipStrength: 'Strong', topicsEvidence: 'Outcomes' };
    assert.deepEqual({ ...service.toPayerStakeholderFields(input) }, {
      KPH_Name__c: input.name,
      KPH_Stakeholder_Role__c: input.roleFunction,
      KPH_Stakeholder_Email__c: input.contactInformation,
      KPH_Stakeholder_Decision_Areas__c: input.decisionAreas,
      KPH_Decision_Areas_Stakeholder_Influence__c: input.influence,
      KPH_Stakeholder_Relationship_Strength__c: input.relationshipStrength,
      KPH_Topics_Evidence_of_Interest_Notes__c: input.topicsEvidence,
    });
    await service.savePayerStakeholder(input);
    let saved = (await service.loadPayerStakeholders()).stakeholders.find((row) => row.name === input.name);
    assert.ok(saved?.id);
    assert.ok(saved.createdDate);
    assert.ok(saved.updatedDate);
    for (const key of Object.keys(input)) assert.equal(saved[key], input[key]);
    await query.updateRecord(service.PAYER_STAKEHOLDER_OBJECT, saved.id, { KPH_Payers_Position_on_CAR_T_dropdown__c: 'High' });
    await service.savePayerStakeholder({ ...saved, topicsEvidence: 'Updated evidence' });
    assert.equal((await service.loadPayerStakeholders()).stakeholders.find((row) => row.id === saved.id).topicsEvidence, 'Updated evidence');
    await assert.rejects(service.savePayerStakeholder({ ...input, id: 'another-plan-record' }), /no longer available/);
    await service.deletePayerStakeholder(saved.id);
    assert.equal((await service.loadPayerStakeholders()).stakeholders.some((row) => row.id === saved.id), false);
    const rows = await query.runQuery({ object: service.PAYER_STAKEHOLDER_OBJECT, fields: ['Id', 'KPH_Payers_Position_on_CAR_T_dropdown__c', 'KPH_Is_Deleted__c', 'KPH_Name__c'], where: query.buildIdMatchWhere('KPH_Account_Plan__c', planId) });
    const deleted = rows.map(query.unwrap).find((row) => row.Id === saved.id);
    assert.equal(deleted.KPH_Is_Deleted__c, true);
    assert.equal(deleted.KPH_Name__c, input.name);
    assert.equal(deleted.KPH_Payers_Position_on_CAR_T_dropdown__c, 'High');
  } finally {
    await server?.close();
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
  }
});
