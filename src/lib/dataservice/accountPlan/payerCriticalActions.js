import { payerRecordTypeFields, payerRecordTypeWhere } from '@/lib/dataservice/accountPlan/recordTypes';
import { assertPayerAccountPlanEditable } from '@/lib/dataservice/accountPlan/payerAccess';
import { sameCrmId } from '@/lib/helper/barrierRecords';
import { crmWriteError } from '@/lib/helper/crmWriteError';
import { hasVeevaRuntime, isOnline } from '@/lib/dataservice/client';
import { buildIdMatchWhere, createCrmRecord, createRecord, getCrmPicklistValueLabels, getPicklistValueLabels, runCrmQuery, runQuery, unwrap, updateRecord, toCanonicalSalesforceId } from '@/lib/dataservice/query';
import { resolvePayerAccountPlanId } from '@/lib/dataservice/accountPlan/payerAccountPlan';
import { payerQueryFields, PAYER_ACTIVE_WHERE, isPayerDeleted } from '@/lib/dataservice/accountPlan/payerMappedFields';
import { milestoneTimingCrmValue } from '@/lib/dataservice/accountPlan/payerMilestoneFields';
import { payerPicklistOptions } from '@/lib/dataservice/accountPlan/payerLaunchReadiness';

export const PAYER_ACTION_OBJECT = 'KPH_Actions_and_Critical_Next_Steps__c';
export const PAYER_ACTION_PLAN_FIELD = 'KPH_Account_Plan__c';
export const PAYER_ACTION_FIELD_MAP = {
  action: 'KPH_Action_Critical_Next_Steps__c',
  linkedStrategyText: 'KPH_Linked_Strategy__c',
  customerStakeholderName: 'KPH_Customer_Stakeholder__c',
  customerStakeholderRole: 'KPH_Role__c',
  kiteOwnerName: 'KPH_Kite_Owner_DRI_Name__c',
  kiteOwnerRole: 'KPH_Kite_Owner_DRI_Role__c',
  kiteCollaboratorName: 'KPH_Kite_Collaborator_Name__c',
  kiteCollaboratorRole: 'KPH_Kite_Collaborator_Role__c',
  timing: 'KPH_Timing__c',
  status: 'KPH_Status__c',
  nextSteps: 'KPH_Next_Steps__c',
};
const readPlanActions = async () => {
  const planId = await resolvePayerAccountPlanId();
  if (!planId) throw new Error('No Payer Account Plan is available.');
  const query = hasVeevaRuntime() ? runCrmQuery : runQuery;
  const rows = (await query({ object: PAYER_ACTION_OBJECT, fields: payerQueryFields(PAYER_ACTION_OBJECT), where: `(${buildIdMatchWhere(PAYER_ACTION_PLAN_FIELD, planId)}) AND ${PAYER_ACTIVE_WHERE}${await payerRecordTypeWhere('payerAction')}`, sort: ['CreatedDate DESC'] })).map(unwrap).filter((row) => row && !isPayerDeleted(row));
  return { planId, rows };
};
export const loadPayerCriticalActions = async () => {
  const readPicklist = hasVeevaRuntime() ? getCrmPicklistValueLabels : getPicklistValueLabels;
  const [{ planId, rows }, labels] = await Promise.all([readPlanActions(), readPicklist(PAYER_ACTION_OBJECT, 'KPH_Status__c')]);
  return { planId, statusOptions: payerPicklistOptions(labels), actions: rows.map((row) => ({
    id: row.Id, createdDate: row.CreatedDate || null, updatedDate: row.LastModifiedDate || null,
    ...Object.fromEntries(Object.entries(PAYER_ACTION_FIELD_MAP).map(([key, field]) => [key, row[field] || ''])),
  })) };
};
export const savePayerCriticalAction = async (record) => {
  const { planId, rows } = await readPlanActions();
  await assertPayerAccountPlanEditable(planId);
  if (record.id && !rows.some((row) => row.Id === record.id)) throw new Error('Action does not belong to the current Account Plan.');
  const fields = Object.fromEntries(Object.entries(PAYER_ACTION_FIELD_MAP).map(([key, field]) => {
    const value = record[key] || '';
    const limit = key === 'action' ? 500 : key === 'nextSteps' ? 5000 : !['status', 'timing'].includes(key) ? 250 : null;
    if (limit && value.length > limit) throw new Error(`${key} exceeds ${limit} characters.`);
    return [field, key === 'timing' ? milestoneTimingCrmValue(value) : value];
  }));
  if (record.id) return updateRecord(PAYER_ACTION_OBJECT, record.id, fields, { crm: hasVeevaRuntime() });
  const create = hasVeevaRuntime() ? createCrmRecord : createRecord;
  return create(PAYER_ACTION_OBJECT, { ...await payerRecordTypeFields('payerAction'), ...fields, [PAYER_ACTION_PLAN_FIELD]: planId });
};
export const deletePayerCriticalAction = async (id) => {
  try {
    const planId = await resolvePayerAccountPlanId();
    await assertPayerAccountPlanEditable(planId);
    if (!planId) throw new Error('No Payer Account Plan is available.');
    const readRows = hasVeevaRuntime() ? runCrmQuery : runQuery;
    // Include deleted records so a retry can recognize an already saved flag.
    const readTarget = async () => (await readRows({
      object: PAYER_ACTION_OBJECT,
      fields: ['Id', PAYER_ACTION_PLAN_FIELD, 'KPH_Is_Deleted__c'],
      where: `(${buildIdMatchWhere(PAYER_ACTION_PLAN_FIELD, planId)}) AND (${buildIdMatchWhere('Id', id)})${await payerRecordTypeWhere('payerAction')}`,
    })).map(unwrap).find((row) => row && sameCrmId(row.Id, id));
    const row = await readTarget();
    if (!row) throw new Error('Action is no longer available in the current Account Plan. Reopen the action list before retrying.');
    if (isPayerDeleted(row)) return;
    const currentId = isOnline() ? (toCanonicalSalesforceId(row.Id) || row.Id) : row.Id;
    try {
      return await updateRecord(PAYER_ACTION_OBJECT, currentId, { KPH_Is_Deleted__c: true }, { crm: hasVeevaRuntime() });
    } catch (error) {
      // Desktop can report NOT_FOUND after CRM automation removes the row.
      // Check its flag first, then verify absence by ID without plan filters.
      try {
        const saved = await readTarget();
        if (saved && isPayerDeleted(saved)) return;
        if (!saved && /\bNOT_FOUND\b/.test(crmWriteError(error).message)) {
          const remaining = (await readRows({
            object: PAYER_ACTION_OBJECT,
            fields: ['Id'],
            where: buildIdMatchWhere('Id', id),
          })).map(unwrap).filter(Boolean);
          if (!remaining.length) return { outcome: 'no-longer-available' };
        }
      } catch { /* Retain the original write error. */ }
      throw error;
    }
  } catch (error) {
    throw crmWriteError(error, 'Delete action (' + PAYER_ACTION_OBJECT + ')');
  }
};
