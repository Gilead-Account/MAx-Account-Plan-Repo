import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
test('all coverage, pathway and review notes persist with their own dates', async () => {
  const oldWindow = globalThis.window;
  const storage = new Map();
  globalThis.window = { location: { search: '', hostname: 'localhost' }, localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) } };
  const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
  try {
    const service = await server.ssrLoadModule('/src/lib/dataservice/accountPlan/payerAccountLandscape.js');
    const initial = await service.loadPayerAccountLandscape();
    const configs = Object.values(service.LANDSCAPE_POLICY_FIELD_CONFIG['Coverage Policy & Management']).concat(service.LANDSCAPE_POLICY_FIELD_CONFIG.Pathway["Kite's Products"]);
    const fields = Object.fromEntries(configs.map((config) => [config.field, `Saved ${config.field}`]));
    fields.KPH_Review_Process_CG_T_Notes__c = 'Saved review';
    fields.KPH_Site_Inclusion_Criteria_Notes__c = 'Saved network approach';
    fields.KPH_Decision_making_bodies_Notes__c = 'Saved decision bodies';
    await service.savePayerAccountLandscapeFields({ planId: initial.planId, landscapeId: initial.landscapeId, fields });
    const loaded = await service.loadPayerAccountLandscape();
    assert.equal(loaded.reviewProcess, 'Saved review');
    assert.equal(loaded.networkDetails.siteInclusionCriteria.narrative, 'Saved network approach');
    assert.equal(loaded.decisionMakingBodies, 'Saved decision bodies');
    assert.match(loaded.reviewProcessUpdatedDate, /^\d{4}-\d{2}-\d{2}$/);
    for (const [section, configMap] of Object.entries(service.LANDSCAPE_POLICY_FIELD_CONFIG)) {
      for (const [key, config] of Object.entries(configMap)) if (fields[config.field]) {
        assert.equal(loaded.policyDetails[section][key].value, fields[config.field]);
        assert.match(loaded.policyDetails[section][key].updatedDate, /^\d{4}-\d{2}-\d{2}$/);
      }
    }
    await service.savePayerAccountLandscapeFields({ planId: loaded.planId, landscapeId: loaded.landscapeId, fields: { KPH_Review_Process_CG_T_Notes__c: '' } });
    const cleared = await service.loadPayerAccountLandscape();
    assert.equal(cleared.reviewProcess, '');
    assert.equal(cleared.policyDetails.Pathway["Kite's Products"].value, fields.KPH_Kite_s_products_Pathway_notes__c);
    const assessments = await server.ssrLoadModule('/src/lib/dataservice/accountPlan/payerAssessments.js');
    const before = await assessments.loadPayerAssessments();
    for (const key of Object.keys(assessments.PAYER_ASSESSMENT_CONFIG)) {
      await assessments.savePayerAssessment(key, { ...before.assessments[key], comments: `Saved ${key} comments` });
    }
    const after = await assessments.loadPayerAssessments();
    for (const key of Object.keys(assessments.PAYER_ASSESSMENT_CONFIG)) {
      assert.equal(after.assessments[key].comments, `Saved ${key} comments`);
      assert.match(after.assessments[key].commentsUpdated, /^\d{4}-\d{2}-\d{2}$/);
    }
    const afterComments = await service.loadPayerAccountLandscape();
    assert.equal(afterComments.networkDetails.siteInclusionCriteria.narrative, 'Saved network approach');
    assert.equal(afterComments.decisionMakingBodies, 'Saved decision bodies');
    assert.equal(afterComments.reviewProcess, '');
  } finally { await server.close(); globalThis.window = oldWindow; }
});
