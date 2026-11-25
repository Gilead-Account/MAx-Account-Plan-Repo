import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('objective add control stays below the cards with independent header filters and no View All buttons', async () => {
  const server = await createServer({
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
  });
  try {
    const { CommercialHierarchy } = await server.ssrLoadModule('/src/pages/ActionPlan/index.jsx');
    const render = (statuses, strategyCount = 0) => renderToStaticMarkup(createElement(CommercialHierarchy, {
      hierarchy: statuses.map((status, index) => ({ id: `objective-${index}`, objective: `Objective ${index + 1}`, status, strategies: Array.from({ length: strategyCount }, (_, strategyIndex) => ({ id: `strategy-${index}-${strategyIndex}`, strategy: `Strategy name ${strategyIndex + 1}`, status: 'Open', tactics: [] })) })),
      selectedObjectiveId: '', selectedStrategyId: '', viewScope: 'all-objectives', issues: [],
    }));
    const objectiveHeader = (markup) => markup.match(/class="panel commercial-hierarchy-column objective-column"><header>([\s\S]*?)<\/header>/)[1];
    const available = render(['Open', 'Open', 'Completed']);
    assert.doesNotMatch(available, /hierarchy-status-tabs/);
    for (const [column, label] of [['objective', 'Account Objectives'], ['strategy', 'Strategies'], ['tactic', 'Tactics and Resources']]) {
      const header = available.match(new RegExp(`class="panel commercial-hierarchy-column ${column}-column"><header>([\\s\\S]*?)<\\/header>`))[1];
      assert.match(header, new RegExp(`aria-label="${label} status filter"`));
      assert.match(header, /<option value="All" selected="">All<\/option>/);
      assert.match(header, /<option value="Open">Open<\/option>/);
      assert.match(header, /<option value="Completed">Completed<\/option>/);
    }
    const availableHeader = objectiveHeader(available);
    assert.doesNotMatch(availableHeader, /Add Objective/);
    assert.doesNotMatch(available, /View All/);
    assert.match(available, /commercial-objective-empty/);
    assert.ok(available.indexOf('commercial-objective-empty') > available.indexOf('Objective 3 description'));
    assert.match(available, /Objective 3/);
    assert.match(available, /Completed/);
    assert.doesNotMatch(render(['Open', 'Open', 'Open']), /commercial-objective-empty/);
    assert.match(render(['Completed', 'Open', 'Completed', 'Open']), /commercial-objective-empty/);
    const full = render(['Open', 'Open', 'Completed', 'Open']);
    assert.match(full, /Objective 4/);
    assert.doesNotMatch(full, /commercial-objective-empty/);
    const manyStrategies = render(['Open'], 28);
    assert.match(manyStrategies, /Strategy AA/);
    assert.match(manyStrategies, /Strategy AB/);
    assert.match(manyStrategies, /<button type="button" class="commercial-hierarchy-add">[\s\S]*?Add Strategy<\/button>/);
    assert.doesNotMatch(manyStrategies, /3 Strategy Maximum/);
  } finally {
    await server.close();
  }
});
