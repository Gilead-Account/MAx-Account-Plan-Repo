import { payerRecordTypeFields, payerRecordTypeWhere } from '@/lib/dataservice/accountPlan/recordTypes';
import { assertPayerAccountPlanEditable } from '@/lib/dataservice/accountPlan/payerAccess';
import { crmDateToday } from '@/lib/helper/payerDates';
import { payerQueryFields, PAYER_ACTIVE_WHERE, isPayerDeleted } from '@/lib/dataservice/accountPlan/payerMappedFields';
import { hasVeevaRuntime } from '@/lib/dataservice/client';
import { buildIdMatchWhere, createCrmRecord, createRecord, getCrmPicklistValueLabels, getPicklistValueLabels, runCrmQuery, runQuery, unwrap, updateRecord } from '@/lib/dataservice/query';
import { resolvePayerAccountPlanId } from '@/lib/dataservice/accountPlan/payerAccountPlan';
import { ACCOUNT_LANDSCAPE_OBJECT, ACCOUNT_LANDSCAPE_PLAN_FIELD } from '@/lib/dataservice/accountPlan/payerAccountLandscape';

export const PAYER_ASSESSMENT_CONFIG = {
  cart: {
    title: 'Level of CAR T Focus/Expertise',
    position: 'KPH_Level_of_CAR_T_Focus_Expertise_Level__c',
    positionUpdated: 'KPH_CAR_T_Focus_Expertise_Level_Upd_Date__c',
    comments: 'KPH_Lev_of_CAR_T_Focus_Expertise_Comment__c',
    commentsUpdated: 'KPH_CAR_T_Focus_Expertise_Comm_Upd_Date__c',
  },
  kite: {
    title: 'Willingness to Partner with Kite',
    position: 'KPH_Willingness_to_Partner_with_Kite__c',
    positionUpdated: 'KPH_Willing_to_Partner_with_Kite_Upt__c',
    comments: 'KPH_Willing_to_Partner_with_Kite_notes__c',
    commentsUpdated: 'KPH_Willing_to_Ptr_with_Kite_notes_upd_d__c',
  },
  communityExpansion: {
    title: 'Community Expansion Position',
    position: 'KPH_Community_Expansion_Position__c',
    positionUpdated: 'KPH_Community_Expansion_Position_Upt_dte__c',
    comments: 'KPH_Community_Expansion_Comments__c',
    commentsUpdated: 'KPH_Community_Expansion_Comment_upd_Date__c',
  },
};
export const emptyPayerAssessments = () => Object.fromEntries(Object.entries(PAYER_ASSESSMENT_CONFIG).map(([key, config]) => [key, {
  title: config.title, position: '', comments: '', positionUpdated: null, commentsUpdated: null,
  options: [],
}]));
const assessmentFields = Object.values(PAYER_ASSESSMENT_CONFIG).flatMap(({ position, positionUpdated, comments, commentsUpdated }) => [position, positionUpdated, comments, commentsUpdated]);
const dateValue = (value) => {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : 0;
};
const newestFirst = (updatedField) => (a, b) =>
  dateValue(b[updatedField]) - dateValue(a[updatedField]) ||
  dateValue(b.LastModifiedDate) - dateValue(a.LastModifiedDate) ||
  dateValue(b.CreatedDate) - dateValue(a.CreatedDate) ||
  String(a.Id).localeCompare(String(b.Id));

export const resolvePayerAssessmentRows = (rows) => {
  const matches = rows;
  const fallback = [...matches].sort(newestFirst('LastModifiedDate'))[0] || null;
  const row = fallback ? { Id: fallback.Id } : null;
  const sources = {};
  for (const config of Object.values(PAYER_ASSESSMENT_CONFIG)) {
    for (const part of ['position', 'comments']) {
      const field = config[part];
      const updatedField = config[`${part}Updated`];
      // A dated blank is an intentional clear, not a missing value.
      const source = matches.filter((item) => item[field] || item[updatedField]).sort(newestFirst(updatedField))[0] || fallback;
      sources[field] = source?.Id || null;
      if (row) {
        row[field] = source?.[field] || '';
        row[updatedField] = source?.[updatedField] || null;
      }
    }
  }
  return { row, sources };
};

const readRows = (params) => hasVeevaRuntime() ? runCrmQuery(params) : runQuery(params);
const readPlanAssessment = async () => {
  const planId = await resolvePayerAccountPlanId();
  if (!planId) throw new Error('No Payer Account Plan is available.');
  const rows = (await readRows({
    object: ACCOUNT_LANDSCAPE_OBJECT,
    fields: payerQueryFields(ACCOUNT_LANDSCAPE_OBJECT, ['CreatedDate', 'LastModifiedDate', ACCOUNT_LANDSCAPE_PLAN_FIELD]),
    where: `(${buildIdMatchWhere(ACCOUNT_LANDSCAPE_PLAN_FIELD, planId)})${await payerRecordTypeWhere('payerLandscape')}`,
  })).map(unwrap).filter(Boolean);
  return { planId, ...resolvePayerAssessmentRows(rows) };
};
const picklistOptions = (labels) => Array.isArray(labels)
  ? labels.map((entry) => typeof entry === 'string' ? { value: entry, label: entry } : { value: entry.value || entry.apiValue || entry.apiName || entry.name || entry.label, label: entry.label || entry.displayLabel || entry.value }).filter((entry) => entry.value)
  : Object.entries(labels || {}).map(([value, label]) => ({ value, label: String(label || value) }));

export const loadPayerAssessments = async () => {
  const { planId, row } = await readPlanAssessment();
  const readPicklist = hasVeevaRuntime() ? getCrmPicklistValueLabels : getPicklistValueLabels;
  const entries = await Promise.all(Object.entries(PAYER_ASSESSMENT_CONFIG).map(async ([key, config]) => {
    const metadata = picklistOptions(await readPicklist(ACCOUNT_LANDSCAPE_OBJECT, config.position));
    const options = metadata;
    const position = row?.[config.position] || '';
    if (position && !options.some((option) => option.value === position)) options.unshift({ value: position, label: position });
    return [key, { title: config.title, position, comments: row?.[config.comments] || '', positionUpdated: row?.[config.positionUpdated] || null, commentsUpdated: row?.[config.commentsUpdated] || null, options }];
  }));
  return { planId, assessmentId: row?.Id || null, assessments: Object.fromEntries(entries) };
};

let saveQueue = Promise.resolve();
export const savePayerAssessment = (key, draft) => {
  const save = async () => {
    const config = PAYER_ASSESSMENT_CONFIG[key];
    if (!config) throw new Error('Unknown payer assessment.');
    const { planId, row, sources } = await readPlanAssessment();
    await assertPayerAccountPlanEditable(planId);
    const fields = {};
    const updated = crmDateToday();
    for (const part of ['position', 'comments']) {
      if ((row?.[config[part]] || '') !== (draft[part] || '')) {
        fields[config[part]] = draft[part] || '';
        fields[config[`${part}Updated`]] = updated;
      }
    }
    if (Object.keys(fields).length) {
      if (row) {
        const writes = new Map();
        for (const part of ['position', 'comments']) {
          const field = config[part];
          if (!Object.hasOwn(fields, field)) continue;
          const id = sources[field];
          const payload = writes.get(id) || {};
          payload[field] = fields[field];
          if (Object.hasOwn(fields, config[`${part}Updated`])) payload[config[`${part}Updated`]] = fields[config[`${part}Updated`]];
          writes.set(id, payload);
        }
        for (const [id, payload] of writes) {
          await updateRecord(ACCOUNT_LANDSCAPE_OBJECT, id, payload, { crm: hasVeevaRuntime() });
        }
      }
      else {
        const create = hasVeevaRuntime() ? createCrmRecord : createRecord;
        await create(ACCOUNT_LANDSCAPE_OBJECT, { ...await payerRecordTypeFields('payerLandscape'), ...fields, [ACCOUNT_LANDSCAPE_PLAN_FIELD]: planId });
      }
    }
    return {
      ...draft,
      positionUpdated: fields[config.positionUpdated] || row?.[config.positionUpdated] || null,
      commentsUpdated: fields[config.commentsUpdated] || row?.[config.commentsUpdated] || null,
    };
  };
  const result = saveQueue.then(save);
  saveQueue = result.catch(() => {});
  return result;
};
