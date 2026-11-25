import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parse } from '@babel/parser';
import { transformSync } from 'esbuild';
import { missingRequiredFields } from '../src/lib/helper/modalRequiredFields.js';

// Exercise the actual form initializers and rendered controls without loading
// unrelated CRM services or requiring a browser environment.
async function loadDeclarations(path, names, dependencies = {}) {
  const source = await readFile(new URL(`../src/pages/${path}`, import.meta.url), 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const declarations = ast.program.body.filter((node) =>
    names.includes(node.id?.name) || node.declarations?.some((item) => names.includes(item.id.name))
  );
  assert.equal(declarations.length, names.length);
  const code = declarations.map((node) => source.slice(node.start, node.end)).join('\n');
  const { code: compiled } = transformSync(`${code}\nresult = { ${names.join(', ')} };`, {
    loader: 'jsx', jsxFactory: 'React.createElement',
  });
  const context = vm.createContext({ React, ...React, ...dependencies });
  vm.runInContext(compiled, context);
  return context.result;
}

test('new forms do not select the first status, objective or strategy', async () => {
  const { buildInitialForm: newTactic } = await loadDeclarations(
    'CriticalActivities/CriticalActivityNewModal.jsx', ['buildInitialForm']
  );
  assert.equal(newTactic(['In Progress', 'Complete']).status, '');
  assert.equal(newTactic([]).status, '');

  const { buildInitialForm: barrier, buildInitialTacticForm: linkedTactic } = await loadDeclarations(
    'BarriersDrivers/BarrierDriverEditModal.jsx', ['buildInitialForm', 'buildInitialTacticForm'],
    { barrierDriverUsesStrategy: () => false }
  );
  assert.equal(barrier(null, 'Barrier').status, '');
  assert.equal(barrier({ id: 'existing', status: 'In Progress' }).status, 'In Progress');
  assert.equal(linkedTactic(['In Progress', 'Complete']).status, '');

  const { newDraft } = await loadDeclarations('BarriersRisks/index.jsx', ['newDraft']);
  for (const type of ['Barrier', 'Opportunity']) {
    const draft = newDraft(type, [{ id: 'first', strategies: [{ id: 'first-strategy' }] }]);
    for (const field of ['objectiveId', 'strategyId', 'impact', 'status']) {
      assert.equal(draft[field], '');
    }
  }
});

test('editing a medical tactic preserves saved status and keeps missing status blank', async () => {
  const { buildInitialForm } = await loadDeclarations(
    'CriticalActivities/CriticalActivityEditModal.jsx',
    ['toDateInputValue', 'displayStatus', 'buildInitialForm']
  );
  assert.equal(buildInitialForm({ status: 'Complete' }).status, 'Complete');
  assert.equal(buildInitialForm({ status: null }).status, '');
});

test('Profile dropdown renders a selectable placeholder with CRM options and preserves saved values', async () => {
  const { ProfileQuestionRow } = await loadDeclarations('AccountProfile/ProfileTab.jsx', [
    'EMPTY_OPTION', 'editValue', 'MULTI_PICKLIST_SEPARATOR', 'parseMultiPicklistValue',
    'serializeMultiPicklistValue', 'ProfileQuestionRow',
  ]);
  const props = {
    item: { label: 'Status', options: [{ value: 'active-api', label: 'Active' }] },
    draftValue: '', onDraftChange() {},
  };
  const empty = renderToStaticMarkup(React.createElement(ProfileQuestionRow, props));
  assert.match(empty, /<option value="" selected="">Select status<\/option>/);
  assert.doesNotMatch(empty, /<option[^>]*(?:disabled|hidden)[^>]*>Select status/);
  const saved = renderToStaticMarkup(React.createElement(ProfileQuestionRow, {
    ...props, draftValue: 'active-api',
  }));
  assert.match(saved, /<option value="active-api" selected="">Active<\/option>/);
  assert.match(saved, /<option value="">Select status<\/option>/);
});

for (const path of ['AccountProfile/AccountIntelligenceTab.jsx', 'AccountProfile/CommercialMmProfileTab.jsx']) {
  test(`${path}: blank selection is available exactly once and false remains a real value`, async () => {
    const { AccountIntelligenceControl } = await loadDeclarations(path, ['editValue', 'AccountIntelligenceControl']);
    const props = {
      item: { key: 'status', label: 'Status', inputType: 'select', options: [
        { value: '', label: '-' }, { value: 'true', label: 'Yes' }, { value: 'false', label: 'No' },
      ] }, value: '', onChange() {},
    };
    const empty = renderToStaticMarkup(React.createElement(AccountIntelligenceControl, props));
    assert.equal((empty.match(/<option value=""/g) || []).length, 1);
    assert.match(empty, /<option value="" selected="">Select status<\/option>/);
    const saved = renderToStaticMarkup(React.createElement(AccountIntelligenceControl, { ...props, value: false }));
    assert.match(saved, /<option value="false" selected="">No<\/option>/);
  });
}

test('referral priority distinguishes an unanswered new field from an existing false value', async () => {
  const { buildInitialForm } = await loadDeclarations(
    'AccountProfile/ReferralAccountEditModal.jsx', ['toBoolean', 'buildInitialForm']
  );
  assert.equal(buildInitialForm().referralPriority, '');
  assert.equal(buildInitialForm({ referralPriority: false }).referralPriority, false);
  assert.equal(buildInitialForm({ referralPriority: true }).referralPriority, true);
});

test('resetting a required dropdown to its placeholder blocks save; optional dropdowns may stay blank', () => {
  const select = { required: true, willValidate: true, type: 'select-one', value: 'In Progress', validity: {} };
  const form = { elements: [select] };
  assert.equal(missingRequiredFields(form).length, 0);
  select.value = '';
  assert.equal(missingRequiredFields(form).length, 1);
  select.required = false;
  assert.equal(missingRequiredFields(form).length, 0);
});

test('every form placeholder remains visible and selectable after choosing a picklist value', async () => {
  let checked = 0;
  function inspect(node, path) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXOpeningElement' && node.name.name === 'option') {
      const value = node.attributes.find((attribute) => attribute.name?.name === 'value');
      if (value?.value?.value === '') {
        checked++;
        assert.ok(!node.attributes.some((attribute) => ['disabled', 'hidden'].includes(attribute.name?.name)), path);
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach((child) => inspect(child, path));
      else if (value && typeof value === 'object') inspect(value, path);
    }
  }
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) await visit(new URL(`${entry.name}/`, directory));
      else if (entry.name.endsWith('.jsx')) {
        const path = new URL(entry.name, directory);
        inspect(parse(await readFile(path, 'utf8'), { sourceType: 'module', plugins: ['jsx'] }), path.pathname);
      }
    }
  }
  await visit(new URL('../src/pages/', import.meta.url));
  assert.ok(checked > 20, 'inspect form placeholders throughout the application');
});
