import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('payer note limits accept the boundary and reject longer saves without changing stored notes', async () => {
  const previousWindow = globalThis.window;
  const storage = new Map();
  globalThis.window = {
    location: { search: '', hostname: 'localhost' },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
  };
  const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
  try {
    const landscape = await server.ssrLoadModule('/src/lib/dataservice/accountPlan/payerAccountLandscape.js');
    const initial = await landscape.loadPayerAccountLandscape();
    const fields = [
      ['KPH_Site_Inclusion_Criteria_Notes__c', (data) => data.networkDetails.siteInclusionCriteria.narrative],
      ['KPH_Decision_making_bodies_Notes__c', (data) => data.decisionMakingBodies],
      ['KPH_Review_Process_CG_T_Notes__c', (data) => data.reviewProcess],
    ];
    for (const [field, readValue] of fields) {
      const args = { landscapeId: (await landscape.loadPayerAccountLandscape()).landscapeId, planId: initial.planId };
      await landscape.savePayerAccountLandscapeFields({ ...args, fields: { [field]: 'a'.repeat(1000) } });
      args.landscapeId = (await landscape.loadPayerAccountLandscape()).landscapeId;
      assert.equal(readValue(await landscape.loadPayerAccountLandscape()), 'a'.repeat(1000));
      for (const landscapeId of [args.landscapeId, null]) {
        await assert.rejects(
          landscape.savePayerAccountLandscapeFields({ ...args, landscapeId, fields: { [field]: 'b'.repeat(1001) } }),
          /exceeds 1000 characters/,
        );
      }
      assert.equal(readValue(await landscape.loadPayerAccountLandscape()), 'a'.repeat(1000));
      await landscape.savePayerAccountLandscapeFields({ ...args, fields: { [field]: '' } });
      assert.equal(readValue(await landscape.loadPayerAccountLandscape()), '');
    }

    const launch = await server.ssrLoadModule('/src/lib/dataservice/accountPlan/payerLaunchReadiness.js');
    await launch.savePayerLaunchReadiness({ policyContextNotes: 'a'.repeat(500) }, ['policyContextNotes']);
    assert.equal((await launch.loadPayerLaunchReadiness()).form.policyContextNotes, 'a'.repeat(500));
    await assert.rejects(
      launch.savePayerLaunchReadiness({ policyContextNotes: 'b'.repeat(501) }, ['policyContextNotes']),
      /exceeds 500 characters/,
    );
    assert.equal((await launch.loadPayerLaunchReadiness()).form.policyContextNotes, 'a'.repeat(500));
  } finally {
    await server.close();
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
