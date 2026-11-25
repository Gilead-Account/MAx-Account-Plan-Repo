import { resolveRecordTypeId } from '@/lib/dataservice/accountPlan/recordTypes';
import { assertPayerAccountPlanEditable } from '@/lib/dataservice/accountPlan/payerAccess';
import { payerQueryFields, PAYER_ACTIVE_WHERE, isPayerDeleted } from '@/lib/dataservice/accountPlan/payerMappedFields';
import { sameCrmId } from '@/lib/helper/barrierRecords';
import { crmWriteError } from '@/lib/helper/crmWriteError';
import { hasVeevaRuntime, isOnline } from '@/lib/dataservice/client';
import { buildIdMatchWhere, createCrmRecord, createRecord, runCrmQuery, runQuery, unwrap, updateRecord, toCanonicalSalesforceId } from '@/lib/dataservice/query';
import { resolvePayerAccountPlanId } from '@/lib/dataservice/accountPlan/payerAccountPlan';

export const PAYER_BARRIER_OPPORTUNITY_OBJECT = 'KPH_Payers_Barrier_Opportunities__c';
export const PAYER_BARRIER_OPPORTUNITY_PLAN_FIELD = 'KPH_Account_Plan__c';
export const resolvePayerBarrierOpportunityRecordTypeIds = async () => {
  if (!hasVeevaRuntime()) return {};
  const [Barrier, Opportunity] = await Promise.all([
    resolveRecordTypeId('payerBarrier'), resolveRecordTypeId('payerOpportunity'),
  ]);
  return { Barrier, Opportunity };
};
export const PAYER_BARRIER_OPPORTUNITY_FIELDS = {
  Barrier: {
    objectiveId: 'KPH_Account_Objective_Barrier__c',
    strategyId: 'KPH_Strategy__c',
    impact: 'KPH_Barrier_Impact__c',
    name: 'KPH_Barrier_Title__c',
    details: 'KPH_Barriers_Details__c',
    status: 'KPH_Barrier_Status__c',
  },
  Opportunity: {
    objectiveId: 'KPH_Account_Objective_Barrier__c',
    strategyId: 'KPH_Strategy__c',
    impact: 'KPH_Opportunities_Impact__c',
    name: 'KPH_Opportunities_Title__c',
    details: 'KPH_Opportunities_Details__c',
    status: 'KPH_Opportunities_Status__c',
  },
};
// Status fields confirmed in the complete October 9 mapping.
export const payerBarrierOpportunityWriteFields = (record) => {
  const mapping = PAYER_BARRIER_OPPORTUNITY_FIELDS[record.type];
  if (!mapping) throw new Error('Unknown barrier/opportunity type.');
  return Object.fromEntries(Object.entries(mapping).map(([key, api]) => [api, record[key] || (key.endsWith('Id') ? null : '')]));
};
export const payerBarrierOpportunityFromRow = (row) => {
  const types = Object.entries(PAYER_BARRIER_OPPORTUNITY_FIELDS).filter(([, fields]) => Object.entries(fields).some(([key, field]) => !['strategyId', 'objectiveId'].includes(key) && row[field])).map(([type]) => type);
  if (!types.length) return null;
  if (types.length !== 1) throw new Error(`Record ${row.Id} contains both barrier and opportunity fields; its type must be resolved in CRM.`);
  const type = types[0];
  return {
    id: row.Id, type, createdDate: row.CreatedDate || null, updatedDate: row.LastModifiedDate || null,
    ...Object.fromEntries(Object.entries(PAYER_BARRIER_OPPORTUNITY_FIELDS[type]).map(([key, field]) => [key, row[field] || ''])),
  };
};
const readPlanRecords = async () => {
  const planId = await resolvePayerAccountPlanId();
  if (!planId) throw new Error('No Payer Account Plan is available.');
  const query = hasVeevaRuntime() ? runCrmQuery : runQuery;
  const recordTypes = await resolvePayerBarrierOpportunityRecordTypeIds();
  const typeWhere = hasVeevaRuntime() ? ` AND (RecordTypeId = '${recordTypes.Barrier}' OR RecordTypeId = '${recordTypes.Opportunity}')` : '';
  const rows = (await query({
    object: PAYER_BARRIER_OPPORTUNITY_OBJECT,
    fields: payerQueryFields(PAYER_BARRIER_OPPORTUNITY_OBJECT, [PAYER_BARRIER_OPPORTUNITY_PLAN_FIELD]),
    where: `(${buildIdMatchWhere(PAYER_BARRIER_OPPORTUNITY_PLAN_FIELD, planId)}) AND ${PAYER_ACTIVE_WHERE}${typeWhere}`,
    sort: ['CreatedDate DESC'],
  })).map(unwrap).filter((row) => row && !isPayerDeleted(row));
  return { planId, rows };
};
export const loadPayerBarriersOpportunities = async () => {
  const { planId, rows } = await readPlanRecords();
  return { planId, records: rows.map(payerBarrierOpportunityFromRow).filter(Boolean) };
};
export const savePayerBarrierOpportunity = async (record) => {
  const { planId, rows } = await readPlanRecords();
  await assertPayerAccountPlanEditable(planId);
  const fields = payerBarrierOpportunityWriteFields(record);
  const recordTypes = await resolvePayerBarrierOpportunityRecordTypeIds();
  if (recordTypes[record.type]) fields.RecordTypeId = recordTypes[record.type];
  if (record.id) {
    const existing = rows.find((row) => row.Id === record.id);
    if (!existing) throw new Error('Barrier/opportunity does not belong to the current Account Plan.');
    if (payerBarrierOpportunityFromRow(existing)?.type !== record.type) throw new Error('An existing barrier/opportunity cannot change type.');
    return updateRecord(PAYER_BARRIER_OPPORTUNITY_OBJECT, record.id, fields, { crm: hasVeevaRuntime() });
  }
  const create = hasVeevaRuntime() ? createCrmRecord : createRecord;
  return create(PAYER_BARRIER_OPPORTUNITY_OBJECT, { ...fields, [PAYER_BARRIER_OPPORTUNITY_PLAN_FIELD]: planId });
};
export const deletePayerBarrierOpportunity = async (id) => {
  try {
    const planId = await resolvePayerAccountPlanId();
    await assertPayerAccountPlanEditable(planId);
    if (!planId) throw new Error('No Payer Account Plan is available.');
    const readRows = hasVeevaRuntime() ? runCrmQuery : runQuery;
    const recordTypes = await resolvePayerBarrierOpportunityRecordTypeIds();
    const typeWhere = hasVeevaRuntime() ? ` AND (RecordTypeId = '${recordTypes.Barrier}' OR RecordTypeId = '${recordTypes.Opportunity}')` : '';
    // Include deleted records so a retry can recognize an already saved flag.
    const readTarget = async () => (await readRows({
      object: PAYER_BARRIER_OPPORTUNITY_OBJECT,
      fields: ['Id', PAYER_BARRIER_OPPORTUNITY_PLAN_FIELD, 'KPH_Is_Deleted__c'],
      where: `(${buildIdMatchWhere(PAYER_BARRIER_OPPORTUNITY_PLAN_FIELD, planId)}) AND (${buildIdMatchWhere('Id', id)})${typeWhere}`,
    })).map(unwrap).find((row) => row && sameCrmId(row.Id, id));
    const row = await readTarget();
    if (!row) throw new Error('Barrier/opportunity is no longer available in the current Account Plan. Reopen the barrier/opportunity list before retrying.');
    if (isPayerDeleted(row)) return;
    const currentId = isOnline() ? (toCanonicalSalesforceId(row.Id) || row.Id) : row.Id;
    try {
      return await updateRecord(PAYER_BARRIER_OPPORTUNITY_OBJECT, currentId, { KPH_Is_Deleted__c: true }, { crm: hasVeevaRuntime() });
    } catch (error) {
      // Desktop can report NOT_FOUND after CRM automation removes the row.
      // Check its flag first, then verify absence by ID without plan filters.
      try {
        const saved = await readTarget();
        if (saved && isPayerDeleted(saved)) return;
        if (!saved && /\bNOT_FOUND\b/.test(crmWriteError(error).message)) {
          const remaining = (await readRows({
            object: PAYER_BARRIER_OPPORTUNITY_OBJECT,
            fields: ['Id'],
            where: buildIdMatchWhere('Id', id),
          })).map(unwrap).filter(Boolean);
          if (!remaining.length) return { outcome: 'no-longer-available' };
        }
      } catch { /* Retain the original write error. */ }
      throw error;
    }
  } catch (error) {
    throw crmWriteError(error, 'Delete barrier/opportunity (' + PAYER_BARRIER_OPPORTUNITY_OBJECT + ')');
  }
};
