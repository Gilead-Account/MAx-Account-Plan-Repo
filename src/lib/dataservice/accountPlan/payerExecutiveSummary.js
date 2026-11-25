import { resolveRecordTypeId } from '@/lib/dataservice/accountPlan/recordTypes';
import { assertPayerAccountPlanEditable } from '@/lib/dataservice/accountPlan/payerAccess';
import { crmDateToday } from '@/lib/helper/payerDates';
import { crmWriteError } from '@/lib/helper/crmWriteError';
import { payerQueryFields, PAYER_ACTIVE_WHERE, isPayerDeleted } from '@/lib/dataservice/accountPlan/payerMappedFields';
import { hasVeevaRuntime, isOnline } from '@/lib/dataservice/client';
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
  toCanonicalSalesforceId,
} from '@/lib/dataservice/query';
import {
  buildPayerAccountPlanWhere,
  resolvePayerAccountPlanId,
} from '@/lib/dataservice/accountPlan/payerAccountPlan';

export const ANITO_LAUNCH_CONFIG = [
  { key: 'meetingRequestSent', field: 'KPH_AE_Value_Prop_Meeting_Request_Sent__c', updatedField: 'KPH_Anito_Cel_Update_date__c' },
  { key: 'valuePropDelivered', field: 'KPH_ValueProp_Delivered_Within_90_Days__c', updatedField: 'KPH_Anito_Cel_Update_date__c' },
];

export const PAYER_SUMMARY_PLAN_FIELDS = [
  'Id',
  'RecordTypeId',
  'KPH_Payer_Restrictiveness__c',
  'KPH_Payer_Archetype_Definition__c',
  'KPH_Payer_Restrictiveness_updated_date__c',
  'KPH_Geographic_Footprint__c',
  'KPH_Geographic_Footprint_updated_date__c',
  'KPH_Ownership_Affiliation__c',
  'KPH_Ownership_Affiliation_updated_date__c',
  'KPH_Covered_Lives__c',
  'KPH_Covered_Lives_updated_date__c',
  'KPH_Lines_of_Business__c',
  'KPH_Lines_of_Business_updated_date__c',
];

export const PAYER_SUMMARY_CHILD_OBJECT = 'KPH_Key_Wins_Key_Customer_Asks__c';
export const KEY_WINS_RECORD_TYPE_ID = '012VI00000GP7JeYAL';
export const KEY_CUSTOMER_ASK_RECORD_TYPE_ID = '012VI00000GP7JdYAL';
const summaryType = (key) => hasVeevaRuntime() ? resolveRecordTypeId(key) : Promise.resolve(key === 'keyWin' ? KEY_WINS_RECORD_TYPE_ID : KEY_CUSTOMER_ASK_RECORD_TYPE_ID);
export const PAYER_SUMMARY_CHILD_FIELDS = [
  'Id',
  'KPH_Is_Deleted__c',
  'RecordTypeId',
  'CreatedDate',
  'LastModifiedDate',
  'KPH_Key_Wins_Date__c',
  'KPH_Key_Wins_Description__c',
  'KPH_Key_Wins_Impact__c',
  'KPH_Key_Customer_Asks_Stakeholder_Name__c',
  'KPH_Key_Customer_Asks_Role__c',
  'KPH_Account_Plan__c',
  'KPH_Key_Customer_Asks_Description__c',
];

export const ACCOUNT_DETAIL_FIELD_CONFIG = [
  {
    key: 'geographicFootprint',
    label: 'Geographic Footprint',
    field: 'KPH_Geographic_Footprint__c',
    updatedField: 'KPH_Geographic_Footprint_updated_date__c',
  },
  {
    key: 'coveredLives',
    label: 'Covered Lives',
    field: 'KPH_Covered_Lives__c',
    updatedField: 'KPH_Covered_Lives_updated_date__c',
  },
  {
    key: 'ownershipAffiliation',
    label: 'Ownership & Affiliation',
    field: 'KPH_Ownership_Affiliation__c',
    updatedField: 'KPH_Ownership_Affiliation_updated_date__c',
  },
  {
    key: 'linesOfBusiness',
    label: 'Lines of Business',
    field: 'KPH_Lines_of_Business__c',
    updatedField: 'KPH_Lines_of_Business_updated_date__c',
  },
];

const readRows = (params) => (hasVeevaRuntime() ? runCrmQuery(params) : runQuery(params));
const readPicklist = (object, field) => (hasVeevaRuntime()
  ? getCrmPicklistValueLabels(object, field)
  : getPicklistValueLabels(object, field));

const today = () => crmDateToday();

const picklistOptions = (labels) => {
  if (Array.isArray(labels)) {
    return labels.map((entry) => {
      if (typeof entry === 'string') return { value: entry, label: entry };
      const value = entry?.value || entry?.apiValue || entry?.apiName || entry?.name || entry?.label;
      return value ? { value: String(value), label: String(entry?.label || entry?.displayLabel || value) } : null;
    }).filter(Boolean);
  }
  return Object.entries(labels || {}).map(([value, label]) => ({
    value,
    label: String(label || value),
  }));
};

const hasAnyValue = (row, fields) => fields.some((field) => row[field] !== null && row[field] !== undefined && row[field] !== '');

const toKeyWin = (row) => ({
  id: row.Id,
  createdDate: row.CreatedDate || null,
  lastModifiedDate: row.LastModifiedDate || null,
  date: row.KPH_Key_Wins_Date__c || '',
  description: row.KPH_Key_Wins_Description__c || '',
  impact: row.KPH_Key_Wins_Impact__c || '',
});

const toCustomerAsk = (row) => ({
  id: row.Id,
  dateCreated: row.CreatedDate || '',
  lastModifiedDate: row.LastModifiedDate || null,
  stakeholderName: row.KPH_Key_Customer_Asks_Stakeholder_Name__c || '',
  stakeholderRole: row.KPH_Key_Customer_Asks_Role__c || '',
  description: row.KPH_Key_Customer_Asks_Description__c || '',
});

export const loadPayerExecutiveSummary = async () => {
  const planId = await resolvePayerAccountPlanId();
  const planWhere = await buildPayerAccountPlanWhere(planId);
  const planChildWhere = buildIdMatchWhere('KPH_Account_Plan__c', planId);
  const childWhere = planChildWhere ? `(${planChildWhere}) AND ${PAYER_ACTIVE_WHERE}` : null;
  if (!planWhere || !childWhere) throw new Error('No Account Plan is available in the current Veeva context.');
  const keyWinsWhere = `${childWhere} AND RecordTypeId = '${await summaryType('keyWin')}'`;
  const customerAsksWhere = `${childWhere} AND RecordTypeId = '${await summaryType('customerAsk')}'`;

  const [planRows, keyWinRows, customerAskRows, restrictivenessLabels, launchOptions] = await Promise.all([
    readRows({
      object: 'Account_Plan_vod__c',
      fields: payerQueryFields('Account_Plan_vod__c', PAYER_SUMMARY_PLAN_FIELDS),
      where: planWhere,
      limit: 1,
    }),
    readRows({
      object: PAYER_SUMMARY_CHILD_OBJECT,
      fields: payerQueryFields(PAYER_SUMMARY_CHILD_OBJECT, PAYER_SUMMARY_CHILD_FIELDS),
      where: keyWinsWhere,
      sort: ['CreatedDate DESC'],
    }),
    readRows({
      object: PAYER_SUMMARY_CHILD_OBJECT,
      fields: payerQueryFields(PAYER_SUMMARY_CHILD_OBJECT, PAYER_SUMMARY_CHILD_FIELDS),
      where: customerAsksWhere,
      sort: ['CreatedDate DESC'],
    }),
    readPicklist('Account_Plan_vod__c', 'KPH_Payer_Restrictiveness__c').catch(() => ({})),
    Promise.all(ANITO_LAUNCH_CONFIG.map(async (config) => [config.key, picklistOptions(await readPicklist('Account_Plan_vod__c', config.field))])),
  ]);
  const plan = unwrap(planRows[0]);
  if (!plan) throw new Error(`Payer Account Plan ${planId} was not found for the configured record type.`);
  const keyWinChildren = keyWinRows.map(unwrap).filter((row) => row && !isPayerDeleted(row));
  const customerAskChildren = customerAskRows.map(unwrap).filter((row) => row && !isPayerDeleted(row));

  const accountDetails = Object.fromEntries(ACCOUNT_DETAIL_FIELD_CONFIG.map((config) => [
    config.key,
    {
      value: plan[config.field] || '',
      updatedDate: plan[config.updatedField] || null,
    },
  ]));
  const keyWinFields = ['KPH_Key_Wins_Date__c', 'KPH_Key_Wins_Description__c', 'KPH_Key_Wins_Impact__c'];
  const askFields = [
    'KPH_Key_Customer_Asks_Stakeholder_Name__c',
    'KPH_Key_Customer_Asks_Role__c',
    'KPH_Key_Customer_Asks_Description__c',
  ];

  return {
    planId,
    accountDetails,
    anitoCelLaunch: {
      ...Object.fromEntries(ANITO_LAUNCH_CONFIG.map((config) => [config.key, plan[config.field] || ''])),
      updatedDate: plan.KPH_Anito_Cel_Update_date__c || null,
      options: Object.fromEntries(launchOptions),
    },
    payerRestrictiveness: {
      value: plan.KPH_Payer_Restrictiveness__c || '',
      definition: plan.KPH_Payer_Archetype_Definition__c || '',
      updatedDate: plan.KPH_Payer_Restrictiveness_updated_date__c || null,
      options: picklistOptions(restrictivenessLabels),
    },
    keyWins: keyWinChildren.filter((row) => hasAnyValue(row, keyWinFields)).map(toKeyWin),
    customerAsks: customerAskChildren.filter((row) => hasAnyValue(row, askFields)).map(toCustomerAsk),
  };
};

export const updatePayerSummaryPlanField = async (planId, field, updatedField, value) => {
  await assertPayerAccountPlanEditable(planId);
  return updateRecord('Account_Plan_vod__c', planId, {
    [field]: value || '',
    [updatedField]: today(),
  }, { crm: hasVeevaRuntime() });
};

export const savePayerArchetype = async (planId, value) => {
  await updatePayerSummaryPlanField(planId, 'KPH_Payer_Restrictiveness__c', 'KPH_Payer_Restrictiveness_updated_date__c', value);
  // This is a read-only Salesforce formula. Read its authoritative value after
  // the picklist write instead of duplicating the CASE expression in the app.
  const rows = await readRows({
    object: 'Account_Plan_vod__c',
    fields: ['Id', 'KPH_Payer_Restrictiveness__c', 'KPH_Payer_Archetype_Definition__c'],
    where: await buildPayerAccountPlanWhere(planId),
    limit: 1,
  });
  const plan = unwrap(rows[0]);
  if (!plan || (plan.KPH_Payer_Restrictiveness__c || '') !== value) {
    throw new Error('CRM has not refreshed the selected Payer Archetype yet. Retry saving to refresh its definition.');
  }
  return plan.KPH_Payer_Archetype_Definition__c || '';
};

const saveChildRecord = async (planId, id, fields) => {
  await assertPayerAccountPlanEditable(planId);
  if (id) return updateRecord(PAYER_SUMMARY_CHILD_OBJECT, id, fields, { crm: hasVeevaRuntime() });
  const create = hasVeevaRuntime() ? createCrmRecord : createRecord;
  return create(PAYER_SUMMARY_CHILD_OBJECT, { KPH_Account_Plan__c: planId, ...fields });
};

export const savePayerKeyWin = async (planId, record) => saveChildRecord(planId, record.id, {
  RecordTypeId: await summaryType('keyWin'),
  KPH_Key_Wins_Date__c: record.date || null,
  KPH_Key_Wins_Description__c: record.description || '',
  KPH_Key_Wins_Impact__c: record.impact || '',
});

export const savePayerCustomerAsk = async (planId, record) => saveChildRecord(planId, record.id, {
  RecordTypeId: await summaryType('customerAsk'),
  KPH_Key_Customer_Asks_Stakeholder_Name__c: record.stakeholderName || '',
  KPH_Key_Customer_Asks_Role__c: record.stakeholderRole || '',
  KPH_Key_Customer_Asks_Description__c: record.description || '',
});

// Preserve record content; the mapped deletion flag excludes it from future reads.
export const deletePayerSummaryRecord = async (recordId, planId, kind) => {
  await assertPayerAccountPlanEditable(planId);
  const recordType = ['keyWin', 'customerAsk'].includes(kind) ? await summaryType(kind) : null;
  if (!planId || !recordType) throw new Error('Account Plan and record type are required to delete this record.');
  const query = hasVeevaRuntime() ? runCrmQuery : runQuery;
  const params = {
    object: PAYER_SUMMARY_CHILD_OBJECT,
    fields: ['Id', 'RecordTypeId', 'KPH_Account_Plan__c', 'KPH_Is_Deleted__c'],
    where: '(' + buildIdMatchWhere('Id', recordId) + ') AND (' + buildIdMatchWhere('KPH_Account_Plan__c', planId) + ') AND (' + buildIdMatchWhere('RecordTypeId', recordType) + ')',
  };
  const rows = (await query(params)).map(unwrap);
  const row = rows[0];
  if (!row?.Id) throw new Error('Record does not belong to this Account Plan and record type.');
  if (isPayerDeleted(row)) return;
  // Use the validated CRM ID, retaining local mobile IDs on iPad.
  const id = isOnline() ? (toCanonicalSalesforceId(row.Id) || row.Id) : row.Id;
  try {
    return await updateRecord(PAYER_SUMMARY_CHILD_OBJECT, id, { KPH_Is_Deleted__c: true }, { crm: hasVeevaRuntime() });
  } catch (error) {
    // A failed response does not necessarily mean the write failed.
    try {
      const confirmed = (await query(params)).map(unwrap);
      if (confirmed.length === 1 && isPayerDeleted(confirmed[0])) return;
      if (!confirmed.length && /\bNOT_FOUND\b/.test(crmWriteError(error, '').message)) {
        // The record existed in this plan immediately before the flag update.
        // CRM automation may remove it during that update. Check by ID alone
        // so a changed plan/record type cannot be mistaken for removal.
        const remaining = await query({ ...params, where: buildIdMatchWhere('Id', id) });
        if (!remaining.length) return { outcome: 'no-longer-available' };
      }
    } catch { /* Preserve the original write error. */ }
    throw crmWriteError(error, `Delete ${kind === 'keyWin' ? 'Key Win' : 'Payer Ask'} (${PAYER_SUMMARY_CHILD_OBJECT}, record ${id})`);
  }
};
