import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('standalone payer entry point uses an explicit Account Plan selector', async () => {
  const app = await read('../src/App.jsx');
  const launcher = await read('../src/components/PayerAccountPlanLauncher.jsx');
  const data = await read('../src/lib/dataservice/accountPlan/payerAccountPlan.js');
  const sidebar = await read('../src/components/MarketAccessSidebar.jsx');

  assert.match(app, /PayerAccountPlanLauncher/);
  assert.match(app, /resolveContextualPayerAccountPlanId\(\)/);
  assert.match(app, /detectRuntimeViewMode\(\)\.viewMode === 'desktop'/);
  assert.match(app, /setEntryStatus\('selector'\)/);
  assert.match(app, /setCurrentAccountPlanIdOverride\(plan\.id\)/);
  assert.match(app, /entryStatus === 'selector'/);
  assert.match(app, /key=\{`\$\{selectedPlanId\}:\$\{activeKey\}`\}/);
  assert.match(sidebar, /Change Account Plan/);

  assert.match(data, /fetchAccessiblePayerAccountPlans/);
  assert.match(data, /where:\s*await payerRecordTypeWhere\(\)/);
  assert.match(data, /resolvePayerAccountPlanRecordTypeId/);
  assert.match(launcher, /Payer Account Plans/);
  assert.match(launcher, /PAYER-SELECTOR-20261001\.2/);
  assert.match(launcher, /Account Plan Name/);
  assert.match(launcher, /Account Name/);
  assert.match(launcher, /KAD Owner/);
  assert.match(launcher, /Marketplace/);
  assert.match(launcher, /Last Modified Date/);
  assert.match(launcher, />Open</);
});
