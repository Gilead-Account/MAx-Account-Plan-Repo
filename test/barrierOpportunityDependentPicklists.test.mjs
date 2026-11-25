import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  BARRIER_OPPORTUNITY_INDICATIONS,
  BARRIER_TITLE_LABELS_BY_INDICATION,
  MEDICAL_STRATEGY_LABELS_BY_INDICATION,
  OPPORTUNITY_TITLE_LABELS_BY_INDICATION,
  configuredPicklistOptions,
  configuredPicklistOptionsByIndication,
} from '../src/lib/dataservice/accountPlan/barrierOpportunityPicklists.js';
import {
  buildMedicalTacticOptionsByParentTitle,
  medicalTacticOptionsForParent,
  picklistInfoFromLabels,
} from '../src/lib/dataservice/accountPlan/titlePicklistMappings.js';

const modalPath = new URL(
  '../src/pages/BarriersDrivers/BarrierDriverEditModal.jsx',
  import.meta.url
);
const barriersDataPath = new URL(
  '../src/lib/dataservice/accountPlan/barriersDrivers.js',
  import.meta.url
);
const homeDataPath = new URL(
  '../src/lib/dataservice/accountPlan/home.js',
  import.meta.url
);
const overviewPagePath = new URL('../src/pages/Overview/index.jsx', import.meta.url);

const apiPicklist = (configuredGroups) => {
  const labels = {};
  const values = [];
  for (const label of new Set(Object.values(configuredGroups).flat())) {
    const value = `api-${values.length + 1}`;
    values.push(value);
    labels[value] = label;
  }
  values.push('api-unapproved');
  labels['api-unapproved'] = 'Unapproved option';
  return { values, labels };
};

test('the Barrier and Opportunity workflow supports only DLBCL and MM', () => {
  assert.deepEqual(BARRIER_OPPORTUNITY_INDICATIONS, ['DLBCL', 'MM']);
});

test('Medical Tactic metadata preserves exact restricted-picklist API values', () => {
  const exactApiValue = 'Identify patient  navigator at institution | DLBCL ';
  const info = picklistInfoFromLabels({
    [exactApiValue]: 'Identify patient navigator at institution',
  });

  assert.deepEqual(info.values, [exactApiValue]);
  assert.equal(info.labels[exactApiValue], 'Identify patient navigator at institution');
  assert.deepEqual(
    configuredPicklistOptions(
      info.values,
      info.labels,
      ['Identify patient navigator at institution'],
      'DLBCL'
    ),
    [exactApiValue]
  );
});

test('Medical Tactic metadata excludes values explicitly marked inactive by CRM', () => {
  const info = picklistInfoFromLabels([
    { name: 'active-api-value', label: 'Active tactic', isActive: true },
    { name: 'inactive-api-value', label: 'Inactive tactic', isActive: false },
  ]);

  assert.deepEqual(info.values, ['active-api-value']);
  assert.deepEqual(info.labels, { 'active-api-value': 'Active tactic' });
});

test('Medical Tactic metadata prefers the CRM API name over a display value', () => {
  const info = picklistInfoFromLabels([
    {
      apiName: 'Assess_opportunities_to_present_data',
      value: 'Assess opportunities to present data/clinical updates to CAR T department',
      label: 'Assess opportunities to present data/clinical updates to CAR T department',
      isActive: true,
    },
  ]);

  assert.deepEqual(info.values, ['Assess_opportunities_to_present_data']);
  assert.equal(
    info.labels.Assess_opportunities_to_present_data,
    'Assess opportunities to present data/clinical updates to CAR T department'
  );
});

test('DLBCL and MM strategies match the approved ordered business lists', () => {
  assert.deepEqual(MEDICAL_STRATEGY_LABELS_BY_INDICATION, {
    DLBCL: [
      'Win the CAR T Treatment Decision',
      'Drive earlier referral and CAR T Action',
      'Community Expansion',
      'Maximize Opportunities in Lymphoma and Leukemia pipeline',
    ],
    MM: [
      'Establish anito-cel as leading treatment option for patients with multiple myeloma',
      'MM Launch Preparedness',
      'Win the CAR T Treatment Decision',
      'Drive earlier referral and CAR T Action',
      'Community Expansion',
    ],
  });

  const { values, labels } = apiPicklist(MEDICAL_STRATEGY_LABELS_BY_INDICATION);
  const options = configuredPicklistOptionsByIndication(
    values,
    labels,
    MEDICAL_STRATEGY_LABELS_BY_INDICATION
  );

  assert.deepEqual(
    options.DLBCL.map((value) => labels[value]),
    MEDICAL_STRATEGY_LABELS_BY_INDICATION.DLBCL
  );
  assert.deepEqual(
    options.MM.map((value) => labels[value]),
    MEDICAL_STRATEGY_LABELS_BY_INDICATION.MM
  );
  assert.ok(!options.DLBCL.includes('api-unapproved'));
  assert.ok(!options.MM.includes('api-unapproved'));
  assert.deepEqual(
    configuredPicklistOptions(
      ['Win the CAR T Treatment Decision | DLBCL,MM'],
      {},
      ['Win the CAR T Treatment Decision']
    ),
    ['Win the CAR T Treatment Decision | DLBCL,MM']
  );

  const indicationSpecificApiValues = configuredPicklistOptionsByIndication(
    [
      'Win the CAR T Treatment Decision | DLBCL',
      'Win the CAR T Treatment Decision | MM',
    ],
    {
      'Win the CAR T Treatment Decision | DLBCL': 'Win the CAR T Treatment Decision',
      'Win the CAR T Treatment Decision | MM': 'Win the CAR T Treatment Decision',
    },
    {
      DLBCL: ['Win the CAR T Treatment Decision'],
      MM: ['Win the CAR T Treatment Decision'],
    }
  );
  assert.deepEqual(indicationSpecificApiValues.DLBCL, [
    'Win the CAR T Treatment Decision | DLBCL',
  ]);
  assert.deepEqual(indicationSpecificApiValues.MM, [
    'Win the CAR T Treatment Decision | MM',
  ]);
});

test('Barrier and Opportunity titles match the indication-specific business lists', () => {
  assert.deepEqual(BARRIER_TITLE_LABELS_BY_INDICATION.DLBCL, [
    'Yescarta AE profile is elevated compared to in- and out-of-class competitors',
    'Confidence/experience with AE management limited',
    'BsAbs are increasingly used in community practices delaying referral for CAR T',
    'Low volume of patient referrals for CAR T',
    'Low awareness of Tecartus 5-YR MCL survival data and optimal patient selection',
    'Limited knowledge on the Kite pipeline and emerging data with next generation constructs',
  ]);
  assert.deepEqual(BARRIER_TITLE_LABELS_BY_INDICATION.MM, [
    'Highly competitive treatment landscape with many treatment options',
    'Confidence in AE management with community ATCs',
    'Limited clinical and patient management experience outside of clinical trials',
    'Decline in Referrals for CAR T due to increased treatment options (ex CELMoDs)',
    'BsAbs are increasingly used in community practices delaying referral for CAR T',
    'Potential gap in community patients awareness of CAR T as a treatment option for MM',
  ]);
  assert.deepEqual(OPPORTUNITY_TITLE_LABELS_BY_INDICATION.DLBCL, [
    'Potential Kite Clinical Trial Site',
    'Robust Internal Referrals',
    'Strong Community Network',
    'Interest to collaborate with Kite',
  ]);
  assert.deepEqual(
    OPPORTUNITY_TITLE_LABELS_BY_INDICATION.MM,
    OPPORTUNITY_TITLE_LABELS_BY_INDICATION.DLBCL
  );

  const barrierPicklist = apiPicklist(BARRIER_TITLE_LABELS_BY_INDICATION);
  const barrierOptions = configuredPicklistOptionsByIndication(
    barrierPicklist.values,
    barrierPicklist.labels,
    BARRIER_TITLE_LABELS_BY_INDICATION
  );
  assert.deepEqual(
    barrierOptions.DLBCL.map((value) => barrierPicklist.labels[value]),
    BARRIER_TITLE_LABELS_BY_INDICATION.DLBCL
  );
  assert.deepEqual(
    barrierOptions.MM.map((value) => barrierPicklist.labels[value]),
    BARRIER_TITLE_LABELS_BY_INDICATION.MM
  );
});

test('medical tactics are filtered by the linked parent record type', () => {
  const values = ['crm-api-1', 'crm-api-2'];
  const labels = {
    'crm-api-1': 'C4/C6, Z24 and RWE data review combined with staff training on AE Management',
    'crm-api-2': 'Assess opportunities to present data/clinical updates to CAR T department',
  };
  const mapping = buildMedicalTacticOptionsByParentTitle(values, labels);
  assert.deepEqual(
    medicalTacticOptionsForParent({ name: 'Any Barrier', indication: 'DLBCL', type: 'Barrier' }, mapping),
    ['crm-api-1']
  );
  assert.deepEqual(
    medicalTacticOptionsForParent({ name: 'Any Opportunity', indication: 'MM', type: 'Driver' }, mapping),
    ['crm-api-2']
  );
});

test('both data composers expose the same strategy and title dependency maps', async () => {
  const [barriersData, homeData] = await Promise.all([
    readFile(barriersDataPath, 'utf8'),
    readFile(homeDataPath, 'utf8'),
  ]);

  for (const source of [barriersData, homeData]) {
    assert.match(source, /MEDICAL_STRATEGY_LABELS_BY_INDICATION/);
    assert.match(source, /BARRIER_TITLE_LABELS_BY_INDICATION/);
    assert.match(source, /OPPORTUNITY_TITLE_LABELS_BY_INDICATION/);
    assert.match(source, /barrierTitleOptionsByIndication/);
    assert.match(source, /driverTitleOptionsByIndication/);
  }
});

test('the modal recomputes titles by indication and clears stale dependent values', async () => {
  const source = await readFile(modalPath, 'utf8');

  assert.match(source, /picklists\?\.barrierTitleOptionsByIndication/);
  assert.match(source, /picklists\?\.driverTitleOptionsByIndication/);
  assert.match(source, /optionsForControllerValue\(\s*titleOptionsByIndication,\s*form\.indication/);
  assert.match(source, /if \(key === 'indication'\) \{[\s\S]*?next\.strategy = '';[\s\S]*?next\.name = '';/);
  assert.match(source, /key === 'name' \|\| key === 'type' \|\| key === 'indication'/);
});

test('Home indication edits cascade to linked medical tactics like the main page', async () => {
  const source = await readFile(overviewPagePath, 'utf8');

  assert.match(source, /previousIndication = bdEditState\.record\.indication \|\| ''/);
  assert.match(source, /saveBarrierDriver\(bdEditState\.record\.id, \{[\s\S]*?previousIndication/);
  assert.match(source, /recordIdMatches\(activity\.barrierDriverId, updated\.id\)/);
  assert.match(source, /criticalActivities: \(current\.criticalActivities \|\| \[\]\)\.map\(updateLinkedIndication\)/);
});
