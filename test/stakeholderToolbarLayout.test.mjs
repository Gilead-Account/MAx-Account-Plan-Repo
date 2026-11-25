import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const stakeholdersCss = await readFile(
  new URL('../src/pages/Stakeholders/Stakeholders.css', import.meta.url),
  'utf8'
);

test('Stakeholder count and Add Stakeholder action stay on the right', () => {
  assert.match(
    stakeholdersCss,
    /Keep stakeholder count and add action on the right[\s\S]*?grid-template-columns:\s*max-content minmax\(0, 1fr\) !important;/
  );
  assert.match(
    stakeholdersCss,
    /Keep stakeholder count and add action on the right[\s\S]*?\.stakeholder-toolbar-actions\s*\{[\s\S]*?justify-self:\s*end;/
  );
});
