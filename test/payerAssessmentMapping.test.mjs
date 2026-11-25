import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('payer assessments share one plan record, preserve stakeholder records, and update only changed timestamps', async () => {
  const values = new Map();
  const oldWindow = globalThis.window;
  globalThis.window = { location: { search: '', hostname: 'localhost' }, localStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) } };
  let server;
  try {
    server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
    const service = await server.ssrLoadModule('/src/lib/dataservice/accountPlan/payerAssessments.js');
    const stakeholders = await server.ssrLoadModule('/src/lib/dataservice/accountPlan/payerStakeholders.js');
    const query = await server.ssrLoadModule('/src/lib/dataservice/query.js');
    const config = service.PAYER_ASSESSMENT_CONFIG.kite;
    const split = service.resolvePayerAssessmentRows([
      { Id: 'a', [config.position]: 'Low', [config.positionUpdated]: '2026-01-01', [config.comments]: 'Earlier comment', [config.commentsUpdated]: '2026-01-01' },
      { Id: 'b', [config.position]: 'High', [config.positionUpdated]: '2026-02-01' },
      { Id: 'c', [config.comments]: '', [config.commentsUpdated]: '2026-03-01' },
    ]);
    assert.equal(split.row[config.position], 'High');
    assert.equal(split.row[config.comments], '', 'dated clear must not resurrect an old comment');
    assert.equal(split.sources[config.position], 'b');
    assert.equal(split.sources[config.comments], 'c');
    assert.deepEqual(service.resolvePayerAssessmentRows([
      { Id: 'b', [config.position]: 'High' }, { Id: 'a', [config.position]: 'Low' },
    ]), service.resolvePayerAssessmentRows([
      { Id: 'a', [config.position]: 'Low' }, { Id: 'b', [config.position]: 'High' },
    ]), 'selection must not depend on query order');
    const initial = await service.loadPayerAssessments();
    assert.equal(Object.keys(initial.assessments).length, 3);
    assert.equal(initial.assessments.cart.position, '');
    assert.equal(service.PAYER_ASSESSMENT_CONFIG.kite.positionUpdated, 'KPH_Willing_to_Partner_with_Kite_Upt__c');
    await stakeholders.savePayerStakeholder({ name: 'Keep stakeholder', roleFunction: 'Director' });
    await Promise.all([
      service.savePayerAssessment('cart', { ...initial.assessments.cart, position: 'High', comments: 'CAR T expertise' }),
      service.savePayerAssessment('kite', { ...initial.assessments.kite, position: 'Medium', comments: 'Partnership' }),
      service.savePayerAssessment('communityExpansion', { ...initial.assessments.communityExpansion, position: 'Controlled', comments: 'Community notes' }),
    ]);
    const loaded = await service.loadPayerAssessments();
    assert.ok(loaded.assessmentId);
    assert.equal(loaded.assessments.cart.position, 'High');
    assert.equal(loaded.assessments.kite.position, 'Medium');
    assert.equal(loaded.assessments.communityExpansion.comments, 'Community notes');
    const rows = (await query.runQuery({ object: 'KPH_Account_Landscape__c', fields: ['Id', 'KPH_Name__c', 'KPH_Level_of_CAR_T_Focus_Expertise_Level__c'], where: query.buildIdMatchWhere('KPH_Account_Plan__c', loaded.planId) })).map(query.unwrap);
    assert.equal(rows.filter((row) => row.KPH_Level_of_CAR_T_Focus_Expertise_Level__c).length, 1);
    assert.equal((await stakeholders.loadPayerStakeholders()).stakeholders.filter((row) => row.name === 'Keep stakeholder').length, 1);
    assert.equal((await stakeholders.loadPayerStakeholders()).stakeholders.some((row) => row.id === loaded.assessmentId), false);
    await query.updateRecord('KPH_Account_Landscape__c', loaded.assessmentId, { KPH_CAR_T_Focus_Expertise_Level_Upd_Date__c: '2025-01-01', KPH_CAR_T_Focus_Expertise_Comm_Upd_Date__c: '2025-02-01', KPH_Community_Expansion_Comment_upd_Date__c: '2025-03-01' });
    await service.savePayerAssessment('cart', { ...loaded.assessments.cart, comments: 'Changed comments' });
    const changed = await service.loadPayerAssessments();
    assert.equal(changed.assessments.cart.positionUpdated, '2025-01-01');
    assert.match(changed.assessments.cart.commentsUpdated, /^\d{4}-\d{2}-\d{2}$/);
    assert.notEqual(changed.assessments.cart.commentsUpdated, '2025-02-01');
    assert.equal(changed.assessments.communityExpansion.commentsUpdated, '2025-03-01');
    assert.equal(changed.assessments.kite.comments, 'Partnership');
    await service.savePayerAssessment('cart', { ...changed.assessments.cart, position: '', comments: '' });
    assert.equal((await service.loadPayerAssessments()).assessmentId, loaded.assessmentId);
    await query.createRecord('KPH_Account_Landscape__c', { KPH_Account_Plan__c: loaded.planId, KPH_Willingness_to_Partner_with_Kite__c: 'Low' });
    const duplicates = await service.loadPayerAssessments();
    assert.equal(duplicates.assessments.kite.position, 'Medium', 'dated assessment wins over an undated duplicate');
    await service.savePayerAssessment('kite', { ...duplicates.assessments.kite, comments: 'Works with duplicates' });
    assert.equal((await service.loadPayerAssessments()).assessments.kite.comments, 'Works with duplicates');
    const kite = service.PAYER_ASSESSMENT_CONFIG.kite;
    const allRows = (await query.runQuery({ object: 'KPH_Account_Landscape__c', fields: ['Id', kite.position], where: query.buildIdMatchWhere('KPH_Account_Plan__c', loaded.planId) })).map(query.unwrap);
    const duplicate = allRows.find((row) => row[kite.position] === 'Low');
    await query.updateRecord('KPH_Account_Landscape__c', loaded.assessmentId, { [kite.commentsUpdated]: '2020-01-01' });
    await query.updateRecord('KPH_Account_Landscape__c', duplicate.Id, { [kite.comments]: 'Separate comment', [kite.commentsUpdated]: '2021-01-01' });
    const beforeSplitSave = await service.loadPayerAssessments();
    assert.equal(beforeSplitSave.assessments.kite.position, 'Medium');
    assert.equal(beforeSplitSave.assessments.kite.comments, 'Separate comment');
    await service.savePayerAssessment('kite', { ...beforeSplitSave.assessments.kite, position: 'High', comments: 'Updated separately' });
    const finalRows = (await query.runQuery({ object: 'KPH_Account_Landscape__c', fields: ['Id', kite.position, kite.comments], where: query.buildIdMatchWhere('KPH_Account_Plan__c', loaded.planId) })).map(query.unwrap);
    assert.equal(finalRows.find((row) => row.Id === loaded.assessmentId)[kite.position], 'High');
    assert.equal(finalRows.find((row) => row.Id === loaded.assessmentId)[kite.comments], 'Works with duplicates');
    assert.equal(finalRows.find((row) => row.Id === duplicate.Id)[kite.position], 'Low');
    assert.equal(finalRows.find((row) => row.Id === duplicate.Id)[kite.comments], 'Updated separately');

  } finally {
    await server?.close();
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
  }
});
