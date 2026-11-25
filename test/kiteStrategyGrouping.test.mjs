import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const kiteStrategySource = await readFile(
  new URL('../src/pages/Overview/KiteStrategy.jsx', import.meta.url),
  'utf8'
);
const overviewCss = await readFile(
  new URL('../src/pages/Overview/Overview.css', import.meta.url),
  'utf8'
);

test('Home Medical Strategy groups repeated strategy prefixes into columns', () => {
  assert.match(kiteStrategySource, />Medical Strategy</);
  assert.doesNotMatch(kiteStrategySource, />Kite Strategy</);
  assert.match(kiteStrategySource, /const splitStrategy = \(value\) =>/);
  assert.match(kiteStrategySource, /const groupStrategies = \(items\) =>/);
  assert.match(kiteStrategySource, /const StrategyColumns = \(\{ items \}\) =>/);
  assert.match(kiteStrategySource, /const divider = text\.indexOf\('\|'\)/);
  assert.match(kiteStrategySource, /strategy-column-grid/);
  assert.match(kiteStrategySource, /strategy-column-list/);
  assert.match(kiteStrategySource, /strategy-column-item/);
  assert.doesNotMatch(kiteStrategySource, /group\.values\.join\('; '\)/);
  assert.doesNotMatch(kiteStrategySource, /DLBCL Strategy/);
  // Two indication sections (MM above DLBCL), each driven by its own strategy list.
  assert.match(kiteStrategySource, /export default function KiteStrategy\(\{ dlbcl, mm \}\)/);
  assert.match(kiteStrategySource, /home-strategy-indication-label/);
  assert.match(kiteStrategySource, /home-mm-strategy-panel/);
  assert.match(kiteStrategySource, /items=\{mm\}/);
  assert.ok(
    kiteStrategySource.indexOf('home-mm-strategy-panel') <
      kiteStrategySource.indexOf('home-dlbcl-strategy-panel'),
    'MM strategy panel should render before DLBCL'
  );
  // The card grows to fit both sections instead of the old fixed 118px cap.
  assert.match(overviewCss, /home-kite-strategy-card[\s\S]*?min-height:\s*118px\s*!important/);
  assert.match(overviewCss, /home-kite-strategy-card[\s\S]*?height:\s*auto\s*!important/);
  assert.match(overviewCss, /home-mm-strategy-panel/);
  assert.match(overviewCss, /home-strategy-indication-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(overviewCss, /strategy-column \+ \.strategy-column/);
  assert.match(overviewCss, /strategy-column-item::before/);
  assert.match(overviewCss, /strategy-column-item[\s\S]*?font-size:\s*10\.2px/);
  assert.match(overviewCss, /strategy-column-item[\s\S]*?overflow-wrap:\s*anywhere/);
});
