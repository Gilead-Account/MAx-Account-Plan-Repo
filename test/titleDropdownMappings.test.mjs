import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildMedicalTacticOptionsByParentTitle,
  medicalTacticOptionsForParent,
} from '../src/lib/dataservice/accountPlan/titlePicklistMappings.js';

const barrierModalPath = new URL(
  '../src/pages/BarriersDrivers/BarrierDriverEditModal.jsx',
  import.meta.url
);
const newTacticModalPath = new URL(
  '../src/pages/CriticalActivities/CriticalActivityNewModal.jsx',
  import.meta.url
);
const editTacticModalPath = new URL(
  '../src/pages/CriticalActivities/CriticalActivityEditModal.jsx',
  import.meta.url
);

test('barrier and opportunity titles are restricted to their title dropdowns', async () => {
  const source = await readFile(barrierModalPath, 'utf8');

  assert.match(source, /picklists\?\.barrierTitles/);
  assert.match(source, /picklists\?\.driverTitles/);
  assert.match(source, /<Field label=\{`\$\{typeLabel\} Title`\}[\s\S]*?<select/);
  assert.match(source, /hasIndication \? `Select \$\{typeLower\} title` : 'Select indication first'/);
  assert.match(source, /Select a valid \$\{typeLower\} title/);
});

test('medical tactic requires a linked record first and uses only CRM options', async () => {
  for (const path of [newTacticModalPath, editTacticModalPath]) {
    const source = await readFile(path, 'utf8');
    const linkedFieldIndex = source.indexOf('<Field label="Linked Barrier/Opportunity"');
    const tacticFieldIndex = source.indexOf('<Field label="Medical Tactic"');

    assert.ok(linkedFieldIndex >= 0);
    assert.ok(tacticFieldIndex > linkedFieldIndex);
    assert.match(source, /medicalTacticOptionsForParent/);
    assert.match(source, /Select linked barrier or opportunity first/);
    assert.match(source, /Select an active Medical Tactic value from CRM/);
    assert.match(source, /next\.title = ''/);
    assert.doesNotMatch(source, /Medical Tactic Title/);
  }

  const newSource = await readFile(newTacticModalPath, 'utf8');
  const editSource = await readFile(editTacticModalPath, 'utf8');
  assert.match(newSource, /disabled=\{!selectedParentOption\}/);
  assert.match(editSource, /disabled=\{!selectedParentOption \|\| remainingFieldsDisabled\}/);
});

test('medical tactic options use CRM values assigned to parent record type and indication', () => {
  const values = [
    'C4/C6, Z24 and RWE data review combined with staff training on AE Management',
    'Scientific engagement focus on efficacy, safety and manufacturing differentiation from in-class and out of class competitors',
    'Assess opportunities to present data/clinical updates to CAR T department',
  ];
  const mapping = buildMedicalTacticOptionsByParentTitle(
    values,
    Object.fromEntries(values.map((value) => [value, value]))
  );

  assert.deepEqual(
    medicalTacticOptionsForParent(
      { name: 'Barrier A', type: 'Barrier', indication: 'DLBCL' },
      mapping
    ),
    [values[0]]
  );
  assert.deepEqual(
    medicalTacticOptionsForParent(
      { name: 'Barrier B', type: 'Barrier', indication: 'MM' },
      mapping
    ),
    [values[1]]
  );
  assert.deepEqual(
    medicalTacticOptionsForParent(
      { name: 'Opportunity A', type: 'Driver', indication: 'DLBCL' },
      mapping
    ),
    [values[2]]
  );
});

test('CRM tactic API values remain exact while filtering by record type', () => {
  const value = 'api-opportunity-value ';
  const mapping = buildMedicalTacticOptionsByParentTitle(
    [value],
    { [value]: 'Assess opportunities to present data/clinical updates to CAR T department' }
  );

  assert.deepEqual(
    medicalTacticOptionsForParent({ name: 'Barrier A', type: 'Barrier', indication: 'DLBCL' }, mapping),
    []
  );
  assert.deepEqual(
    medicalTacticOptionsForParent({ name: 'Opportunity B', type: 'Driver', indication: 'DLBCL' }, mapping),
    [value]
  );
});

test('CRM indication dependency removes a record-type tactic that Salesforce will reject', () => {
  const value = 'crm-opportunity-api';
  const mapping = buildMedicalTacticOptionsByParentTitle(
    [value],
    { [value]: 'Assess opportunities to present data/clinical updates to CAR T department' },
    { DLBCL: [], MM: [value] }
  );

  assert.deepEqual(
    medicalTacticOptionsForParent(
      { name: 'DLBCL Opportunity', type: 'Driver', indication: 'DLBCL' },
      mapping
    ),
    []
  );
  assert.deepEqual(
    medicalTacticOptionsForParent(
      { name: 'MM Opportunity', type: 'Driver', indication: 'MM' },
      mapping
    ),
    [value]
  );
});

test('a partial CRM dependency matrix falls back only for the missing indication', () => {
  const dlbclValue = 'crm-dlbcl-barrier-api';
  const mmValue = 'crm-mm-barrier-api';
  const mapping = buildMedicalTacticOptionsByParentTitle(
    [dlbclValue, mmValue],
    {
      [dlbclValue]: 'C4/C6, Z24 and RWE data review combined with staff training on AE Management',
      [mmValue]: 'Scientific engagement focus on efficacy, safety and manufacturing differentiation from in-class and out of class competitors',
    },
    { MM: [mmValue] }
  );

  assert.deepEqual(
    medicalTacticOptionsForParent(
      { name: 'DLBCL Barrier', type: 'Barrier', indication: 'DLBCL' },
      mapping
    ),
    [dlbclValue]
  );
  assert.deepEqual(
    medicalTacticOptionsForParent(
      { name: 'MM Barrier', type: 'Barrier', indication: 'MM' },
      mapping
    ),
    [mmValue]
  );
});

test('a partial CRM dependency matrix does not blank Opportunity tactics', () => {
  const opportunityValue = 'crm-opportunity-api';
  const mapping = buildMedicalTacticOptionsByParentTitle(
    [opportunityValue],
    {
      [opportunityValue]: 'Assess opportunities to present data/clinical updates to CAR T department',
    },
    { Portfolio: [] }
  );

  for (const indication of ['DLBCL', 'MM']) {
    assert.deepEqual(
      medicalTacticOptionsForParent(
        { name: `${indication} Opportunity`, type: 'Driver', indication },
        mapping
      ),
      [opportunityValue]
    );
  }
});

test('an inactive existing value is not added back to the CRM option list', () => {
  const mapping = buildMedicalTacticOptionsByParentTitle(['Active API value'], {
    'Active API value': 'C4/C6, Z24 and RWE data review combined with staff training on AE Management',
  });

  assert.deepEqual(
    medicalTacticOptionsForParent(
      { name: 'Any parent', type: 'Barrier', indication: 'DLBCL' },
      mapping,
      'Inactive stored value'
    ),
    ['Active API value']
  );
});
