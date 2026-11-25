import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createServer } from 'vite';

test('complete catalog covers every supplied field and launch changes persist independently', async () => {
  const previousWindow = globalThis.window;
  const storage = new Map();
  globalThis.window = { location: { search: '', hostname: 'localhost' }, localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) } };
  const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
  try {
    const catalog = await server.ssrLoadModule('/src/lib/dataservice/accountPlan/payerMappedFields.js');
    const rows = JSON.parse(fs.readFileSync(new URL('../docs/payer-complete-field-mapping.json', import.meta.url), 'utf8'));
    for (const row of rows) {
      assert.ok(catalog.PAYER_MAPPED_FIELDS[row.object].includes(row.field), `${row.object}.${row.field}`);
      assert.ok(catalog.payerQueryFields(row.object).includes(row.field));
    }
    const service = await server.ssrLoadModule('/src/lib/dataservice/accountPlan/payerLaunchReadiness.js');
    const initial = await service.loadPayerLaunchReadiness();
    await service.savePayerLaunchReadiness({ ...initial.form, medicalPolicyPublished: 'Yes', driversForAdoption: 'Not saved' }, ['medicalPolicyPublished']);
    const saved = await service.loadPayerLaunchReadiness();
    assert.equal(saved.form.medicalPolicyPublished, 'Yes');
    assert.equal(saved.form.driversForAdoption, initial.form.driversForAdoption);
    assert.match(saved.dates.medicalPolicyPublished, /^\d{4}-\d{2}-\d{2}$/);
    await assert.rejects(service.savePayerLaunchReadiness({ policyContextNotes: 'x'.repeat(501) }, ['policyContextNotes']), /exceeds/);
  } finally { await server.close(); globalThis.window = previousWindow; }
});
