import { payerRecordTypeFields, payerRecordTypeWhere } from '@/lib/dataservice/accountPlan/recordTypes';
import { assertPayerAccountPlanEditable } from '@/lib/dataservice/accountPlan/payerAccess';
import { crmDateToday } from '@/lib/helper/payerDates';
import { payerQueryFields, PAYER_ACTIVE_WHERE, isPayerDeleted } from '@/lib/dataservice/accountPlan/payerMappedFields';
import { hasVeevaRuntime } from '@/lib/dataservice/client';
import {
  buildIdMatchWhere,
  createCrmRecord,
  createRecord,
  getCrmPicklistValueLabels,
  getPicklistValueLabels,
  runCrmQuery,
  runQuery,
  unwrap,
  updateRecord,
} from '@/lib/dataservice/query';
import { resolvePayerAccountPlanId } from '@/lib/dataservice/accountPlan/payerAccountPlan';

export const ACCOUNT_LANDSCAPE_OBJECT = 'KPH_Account_Landscape__c';
export const ACCOUNT_LANDSCAPE_PLAN_FIELD = 'KPH_Account_Plan__c';
export const LANDSCAPE_OVERVIEW_TEXT_LIMIT = 1000;

const overviewTextFields = {
  KPH_Site_Inclusion_Criteria_Notes__c: 'Network Approach / Site Inclusion Criteria',
  KPH_Decision_making_bodies_Notes__c: 'Decision Making Bodies',
  KPH_Review_Process_CG_T_Notes__c: 'Review Process, Timelines & Pre-Policy Approach to CG&T',
};

export const ACCOUNT_LANDSCAPE_FIELDS = [
  'Id',
  ACCOUNT_LANDSCAPE_PLAN_FIELD,
  'KPH_Network_Size__c',
  'KPH_Network_Porosity__c',
  'KPH_Site_Inclusion_Criteria_Notes__c',
  'KPH_Decision_making_bodies_Notes__c',
  'KPH_CAR_T_Reimbursement_notes__c',
  'KPH_CAR_T_Reimbursement_notes_updt_date__c',
  'KPH_CAR_T_Pathway_notes__c',
  'KPH_CAR_T_Pathway_notes_updated_date__c',
  'KPH_Kite_s_Products_Reimbursement_notes__c',
  'KPH_Competitors_Reimbursement_notes__c',
  'KPH_Competitors_Pathway_notes__c',
  'KPH_Competitors_Path_notes_update_date__c',
];

export const NETWORK_LANDSCAPE_CONFIG = [
  {
    key: 'networkModel',
    title: 'Network Model and Covered Sites',
    categoryLabel: 'Network Model and Covered Sites',
    categoryField: 'KPH_Network_Size__c',
    notesLabel: 'Network Size',
    notesField: 'KPH_Network_Size__c',
  },
  {
    key: 'siteInclusionCriteria',
    title: 'Site Inclusion Criteria',
    categoryLabel: 'Site Inclusion Criteria',
    notesLabel: 'Network Approach/Site Inclusion Criteria',
    notesField: 'KPH_Site_Inclusion_Criteria_Notes__c',
  },
];

export const LANDSCAPE_POLICY_FIELD_CONFIG = {
  "Coverage Policy & Management": {"CAR T (Class)": {"label": "CAR T (Class)", "field": "KPH_CAR_T_Coverage_Policy_Mgmt_Notes__c", "updatedField": "KPH_CAR_T_Covrge_Po_Mgmt_Notes_Updt_date__c"}, "Kite's Products": {"label": "Kite's Products", "field": "KPH_Kite_Products_Cov_Mgmt_Notes__c", "updatedField": "KPH_Kite_Products_Cov_Mgmt_Updt_date__c"}, "Competitors (BCMA/CPRC5D bispecifics; competitor CAR T)": {"label": "Competitors (BCMA/CPRC5D bispecifics; competitor CAR T)", "field": "KPH_Competitor_Cov_Policy_Mgmt_Notes__c", "updatedField": "KPH_Copetitor_Cov_Policy_Mgt_nts_Udt_dat__c"}},
  Reimbursement: {
    'CAR T (Class)': {
      label: 'CAR T Reimbursement notes',
      field: 'KPH_CAR_T_Reimbursement_notes__c',
      updatedField: 'KPH_CAR_T_Reimbursement_notes_updt_date__c',
      updatedLabel: 'Updated',
    },
    "Kite's Products": {
      label: "Kite's Products Reimbursement notes",
      field: 'KPH_Kite_s_Products_Reimbursement_notes__c',
    },
    'Competitors (BCMA/CPRC5D bispecifics; competitor CAR T)': {
      label: 'Competitors Reimbursement notes',
      field: 'KPH_Competitors_Reimbursement_notes__c',
    },
  },
  Pathway: {
    "Kite's Products": { label: "Kite's Products Pathway notes", field: "KPH_Kite_s_products_Pathway_notes__c", updatedField: "KPH_Kite_Products_Pathway_Updt_date__c" },
    'CAR T (Class)': {
      label: 'CAR T Pathway notes',
      field: 'KPH_CAR_T_Pathway_notes__c',
      updatedField: 'KPH_CAR_T_Pathway_notes_updated_date__c',
      updatedLabel: 'Updated',
    },
    'Competitors (BCMA/CPRC5D bispecifics; competitor CAR T)': {
      label: 'Competitors Pathway notes',
      field: 'KPH_Competitors_Pathway_notes__c',
      updatedField: 'KPH_Competitors_Path_notes_update_date__c',
      updatedLabel: 'Updated',
    },
  },
};

const readRows = (params) => (hasVeevaRuntime() ? runCrmQuery(params) : runQuery(params));
const readPicklist = (object, field) => (hasVeevaRuntime()
  ? getCrmPicklistValueLabels(object, field)
  : getPicklistValueLabels(object, field));
const today = () => crmDateToday();

const toPicklistOptions = (labels) => {
  if (Array.isArray(labels)) {
    return labels.map((entry) => {
      if (typeof entry === 'string') return { value: entry, label: entry };
      const value = entry?.value || entry?.apiValue || entry?.apiName || entry?.name || entry?.label;
      return value ? { value: String(value), label: String(entry?.label || entry?.displayLabel || value) } : null;
    }).filter(Boolean);
  }
  return Object.entries(labels || {}).map(([value, label]) => ({ value, label: String(label || value) }));
};

const includeCurrentPicklistValue = (options, currentValue) => {
  if (!currentValue || options.some((option) => option.value === currentValue)) return options;
  return [{ value: currentValue, label: currentValue }, ...options];
};

const emptyPolicyDetails = () => Object.fromEntries(
  Object.entries(LANDSCAPE_POLICY_FIELD_CONFIG).map(([section, fields]) => [
    section,
    Object.fromEntries(Object.keys(fields).map((subsection) => [subsection, { value: '', updatedDate: null }])),
  ])
);

export const loadPayerAccountLandscape = async () => {
  const planId = await resolvePayerAccountPlanId();
  const where = buildIdMatchWhere(ACCOUNT_LANDSCAPE_PLAN_FIELD, planId);
  if (!where) throw new Error('No Account Plan is available in the current Veeva context.');

  const [rows, networkLabels, porosityLabels] = await Promise.all([
    readRows({
      object: ACCOUNT_LANDSCAPE_OBJECT,
      fields: payerQueryFields(ACCOUNT_LANDSCAPE_OBJECT, ACCOUNT_LANDSCAPE_FIELDS),
      where: `(${where})${await payerRecordTypeWhere('payerLandscape')}`,
      // Desktop and the offline database may return rows in different orders.
      // Use the same newest-record rule on both, including a stable tie-breaker.
      sort: ['LastModifiedDate DESC', 'CreatedDate DESC', 'Id ASC'],
      limit: 1,
    }),
    readPicklist(ACCOUNT_LANDSCAPE_OBJECT, 'KPH_Network_Size__c').catch(() => ({})),
    readPicklist(ACCOUNT_LANDSCAPE_OBJECT, 'KPH_Network_Porosity__c'),
  ]);
  const row = unwrap(rows[0]) || {};
  const picklists = {
    networkModel: includeCurrentPicklistValue(
      toPicklistOptions(networkLabels),
      row.KPH_Network_Size__c
    ),
    siteInclusionCriteria: [],
  };
  const networkDetails = Object.fromEntries(NETWORK_LANDSCAPE_CONFIG.map((config) => [
    config.key,
    {
      selection: row[config.categoryField] || '',
      narrative: row[config.notesField] || '',
      options: picklists[config.key],
    },
  ]));
  const policyDetails = emptyPolicyDetails();
  for (const [section, fields] of Object.entries(LANDSCAPE_POLICY_FIELD_CONFIG)) {
    for (const [subsection, config] of Object.entries(fields)) {
      policyDetails[section][subsection] = {
        value: row[config.field] || '',
        updatedDate: config.updatedField ? row[config.updatedField] || null : null,
      };
    }
  }

  return {
    planId,
    landscapeId: row.Id || null,
    networkDetails,
    reviewProcess: row.KPH_Review_Process_CG_T_Notes__c || '',
    reviewProcessUpdatedDate: row.KPH_Review_Process_CG_T_Notes_Updt_date__c || null,
    networkPorosity: row.KPH_Network_Porosity__c || '',
    networkPorosityOptions: includeCurrentPicklistValue(toPicklistOptions(porosityLabels), row.KPH_Network_Porosity__c),
    decisionMakingBodies: row.KPH_Decision_making_bodies_Notes__c || '',
    policyDetails,
    qualityOfAccessScore: row.KPH_Quality_of_Access_Score__c || '',
  };
};

export const savePayerAccountLandscapeFields = async ({ landscapeId, planId, fields, updatedField }) => {
  await assertPayerAccountPlanEditable(planId);
  for (const [field, label] of Object.entries(overviewTextFields)) {
    if (fields[field]?.length > LANDSCAPE_OVERVIEW_TEXT_LIMIT) {
      throw new Error(`${label} exceeds ${LANDSCAPE_OVERVIEW_TEXT_LIMIT} characters.`);
    }
  }
  const writeFields = { ...fields };
  if (Object.hasOwn(fields, 'KPH_Review_Process_CG_T_Notes__c')) writeFields.KPH_Review_Process_CG_T_Notes_Updt_date__c = today();
  for (const configs of Object.values(LANDSCAPE_POLICY_FIELD_CONFIG)) {
    for (const config of Object.values(configs)) {
      if (config.updatedField && Object.hasOwn(fields, config.field)) writeFields[config.updatedField] = today();
    }
  }
  if (updatedField) writeFields[updatedField] = today();
  if (landscapeId) {
    await updateRecord(ACCOUNT_LANDSCAPE_OBJECT, landscapeId, writeFields, { crm: hasVeevaRuntime() });
    return landscapeId;
  }

  const create = hasVeevaRuntime() ? createCrmRecord : createRecord;
  await create(ACCOUNT_LANDSCAPE_OBJECT, {
    ...await payerRecordTypeFields('payerLandscape'),
    [ACCOUNT_LANDSCAPE_PLAN_FIELD]: planId,
    ...writeFields,
  });
  return null;
};
