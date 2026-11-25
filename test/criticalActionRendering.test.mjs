import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('Action Plan renders saved actions with CRM Date objects and string timing values', async () => {
 const server = await createServer({ plugins: [{ name: 'loaded-actions-test', enforce: 'pre', transform(code, id) { if (id.endsWith('/pages/ActionPlan/index.jsx')) return code.replace('useState(actionPlanTabs[0])', "useState('Objectives, Strategies & Critical Actions')").replace('const [actionReady, setActionReady] = useState(false)', 'const [actionReady, setActionReady] = useState(true)'); } }], server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
 try {
  const { default: Page } = await server.ssrLoadModule('/src/pages/ActionPlan/index.jsx');
  for (const timing of [new Date('2026-10-15T14:00:00Z'), '2026-10-15T14:00:00Z', '', 'invalid-date']) {
   const html = renderToStaticMarkup(React.createElement(Page, {
    criticalActions: [{ id: 'action-1', action: 'Saved critical action', linkedStrategyText: 'Strategy', timing, status: 'In Progress', nextSteps: 'Call payer' }],
    commercialHierarchy: [], issues: [], setCriticalActions() {}, setCommercialHierarchy() {}, setIssues() {},
   }));
   assert.ok(html.includes('Saved critical action'));
   assert.ok(html.includes('Call payer'));
   if (timing && timing !== 'invalid-date') assert.ok(html.includes('2026'));
  }
 } finally { await server.close(); }
});
