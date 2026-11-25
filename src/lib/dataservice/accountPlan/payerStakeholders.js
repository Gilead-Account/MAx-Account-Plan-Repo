import { payerRecordTypeFields, payerRecordTypeWhere } from '@/lib/dataservice/accountPlan/recordTypes';
import { assertPayerAccountPlanEditable } from '@/lib/dataservice/accountPlan/payerAccess';
import { sameCrmId } from '@/lib/helper/barrierRecords';
import { crmWriteError } from '@/lib/helper/crmWriteError';
import { payerQueryFields, PAYER_ACTIVE_WHERE, isPayerDeleted } from '@/lib/dataservice/accountPlan/payerMappedFields';
import { hasVeevaRuntime, isOnline } from '@/lib/dataservice/client';
import { buildIdMatchWhere, createCrmRecord, createRecord, runCrmQuery, runQuery, unwrap, updateRecord, toCanonicalSalesforceId } from '@/lib/dataservice/query';
import { resolvePayerAccountPlanId } from '@/lib/dataservice/accountPlan/payerAccountPlan';

export const PAYER_STAKEHOLDER_OBJECT = 'KPH_Stakeholder_Map__c';
export const PAYER_STAKEHOLDER_PLAN_FIELD = 'KPH_Account_Plan__c';
export const PAYER_STAKEHOLDER_FIELD_MAP = {
  name: 'KPH_Name__c',
  roleFunction: 'KPH_Stakeholder_Role__c',
  contactInformation: 'KPH_Stakeholder_Email__c',
  decisionAreas: 'KPH_Stakeholder_Decision_Areas__c',
  influence: 'KPH_Decision_Areas_Stakeholder_Influence__c',
  relationshipStrength: 'KPH_Stakeholder_Relationship_Strength__c',
  topicsEvidence: 'KPH_Topics_Evidence_of_Interest_Notes__c',
};
export const PAYER_STAKEHOLDER_FIELDS = ['Id', 'Mobile_ID_vod__c', PAYER_STAKEHOLDER_PLAN_FIELD, 'CreatedDate', 'LastModifiedDate', ...Object.values(PAYER_STAKEHOLDER_FIELD_MAP)];

const readRows = (params) => hasVeevaRuntime() ? runCrmQuery(params) : runQuery(params);
const requirePlan = async () => {
  const planId = await resolvePayerAccountPlanId();
  if (!planId) throw new Error('No Payer Account Plan is available.');
  return planId;
};
const readForPlan = async (planId) => {
  const rows = await readRows({
    object: PAYER_STAKEHOLDER_OBJECT,
    fields: payerQueryFields(PAYER_STAKEHOLDER_OBJECT, PAYER_STAKEHOLDER_FIELDS),
    where: `(${buildIdMatchWhere(PAYER_STAKEHOLDER_PLAN_FIELD, planId)}) AND ${PAYER_ACTIVE_WHERE}${await payerRecordTypeWhere('payerStakeholder')}`,
    sort: ['CreatedDate ASC'],
  });
  return rows.map(unwrap).filter((row) => row && !isPayerDeleted(row));
};
export const toPayerStakeholder = (row) => ({
  id: row.Id,
  mobileId: row.Mobile_ID_vod__c || null,
  planId: row[PAYER_STAKEHOLDER_PLAN_FIELD] || null,
  createdDate: row.CreatedDate || null,
  updatedDate: row.LastModifiedDate || null,
  ...Object.fromEntries(Object.entries(PAYER_STAKEHOLDER_FIELD_MAP).map(([key, field]) => [key, row[field] || ''])),
});
export const toPayerStakeholderFields = (record) => Object.fromEntries(
  Object.entries(PAYER_STAKEHOLDER_FIELD_MAP).map(([key, field]) => [field, record[key] || ''])
);

export const loadPayerStakeholders = async () => {
  const planId = await requirePlan();
  const rows = await readForPlan(planId);
  // Payer assessment-only rows on this shared object are not stakeholders.
  return { planId, stakeholders: rows.filter((row) => Object.values(PAYER_STAKEHOLDER_FIELD_MAP).some((field) => row[field])).map(toPayerStakeholder) };
};

const requirePlanRecord = async (planId, id, mobileId) => {
  const rows = await readForPlan(planId);
  // After mobile sync, Id can change from a local ID to a Salesforce ID.
  // Match only immutable identifiers within the active plan, never names/email.
  const matches = rows.filter((row) => sameCrmId(row.Id, id) ||
    (row.Mobile_ID_vod__c && (row.Mobile_ID_vod__c === mobileId || row.Mobile_ID_vod__c === id)));
  if (matches.length > 1) throw new Error('Multiple stakeholders match this record identity. Refresh the list before saving.');
  const row = matches[0];
  if (!row) throw new Error('Stakeholder is no longer available in the current Account Plan. Reopen the stakeholder list to refresh its record ID before retrying.');
  return isOnline() ? (toCanonicalSalesforceId(row.Id) || row.Id) : row.Id;
};
const persistPayerStakeholder = async (record) => {
  const planId = await requirePlan();
  await assertPayerAccountPlanEditable(planId);
  if (record.planId && !sameCrmId(record.planId, planId)) throw new Error('The Account Plan changed while editing. Reopen the stakeholder from the current plan.');
  const fields = toPayerStakeholderFields(record);
  if (record.id) {
    const id = await requirePlanRecord(planId, record.id, record.mobileId);
    return updateRecord(PAYER_STAKEHOLDER_OBJECT, id, fields, { crm: hasVeevaRuntime() });
  }
  const create = hasVeevaRuntime() ? createCrmRecord : createRecord;
  return create(PAYER_STAKEHOLDER_OBJECT, { ...await payerRecordTypeFields('payerStakeholder'), ...fields, [PAYER_STAKEHOLDER_PLAN_FIELD]: planId });
};
export const savePayerStakeholder = async (record) => {
  try {
    return await persistPayerStakeholder(record);
  } catch (error) {
    throw crmWriteError(error, `${record.id ? 'Update' : 'Create'} stakeholder (${PAYER_STAKEHOLDER_OBJECT})`);
  }
};
export const deletePayerStakeholder = async (id) => {
  try {
    const planId = await requirePlan();
    await assertPayerAccountPlanEditable(planId);
    // Include deleted records so a retry can recognize an already saved flag.
    const readTarget = async () => (await readRows({
      object: PAYER_STAKEHOLDER_OBJECT,
      fields: ['Id', PAYER_STAKEHOLDER_PLAN_FIELD, 'KPH_Is_Deleted__c'],
      where: `(${buildIdMatchWhere(PAYER_STAKEHOLDER_PLAN_FIELD, planId)}) AND (${buildIdMatchWhere('Id', id)})${await payerRecordTypeWhere('payerStakeholder')}`,
    })).map(unwrap).find((row) => row && sameCrmId(row.Id, id));
    const row = await readTarget();
    if (!row) throw new Error('Stakeholder is no longer available in the current Account Plan. Reopen the stakeholder list before retrying.');
    if (isPayerDeleted(row)) return;
    const currentId = isOnline() ? (toCanonicalSalesforceId(row.Id) || row.Id) : row.Id;
    try {
      return await updateRecord(PAYER_STAKEHOLDER_OBJECT, currentId, { KPH_Is_Deleted__c: true }, { crm: hasVeevaRuntime() });
    } catch (error) {
      // Desktop can report NOT_FOUND after CRM automation removes the row.
      // Check its flag first, then verify absence by ID without plan filters.
      try {
        const saved = await readTarget();
        if (saved && isPayerDeleted(saved)) return;
        if (!saved && /\bNOT_FOUND\b/.test(crmWriteError(error).message)) {
          const remaining = (await readRows({
            object: PAYER_STAKEHOLDER_OBJECT,
            fields: ['Id'],
            where: buildIdMatchWhere('Id', id),
          })).map(unwrap).filter(Boolean);
          if (!remaining.length) return { outcome: 'no-longer-available' };
        }
      } catch { /* Retain the original write error. */ }
      throw error;
    }
  } catch (error) {
    throw crmWriteError(error, 'Delete stakeholder (' + PAYER_STAKEHOLDER_OBJECT + ')');
  }
};
