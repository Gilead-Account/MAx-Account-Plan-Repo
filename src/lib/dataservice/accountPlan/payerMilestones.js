import { payerRecordTypeFields, payerRecordTypeWhere } from '@/lib/dataservice/accountPlan/recordTypes';
import { assertPayerAccountPlanEditable } from '@/lib/dataservice/accountPlan/payerAccess';
import { crmDateToday, payerDateInputValue } from '@/lib/helper/payerDates';
import { payerQueryFields, PAYER_ACTIVE_WHERE, isPayerDeleted } from '@/lib/dataservice/accountPlan/payerMappedFields';
import { sameCrmId } from '@/lib/helper/barrierRecords';
import { crmWriteError } from '@/lib/helper/crmWriteError';
import { hasVeevaRuntime, isOnline } from '@/lib/dataservice/client';
import { buildIdMatchWhere, createCrmRecord, createRecord, getCrmPicklistValueLabels, getPicklistValueLabels, runCrmQuery, runQuery, unwrap, updateRecord, toCanonicalSalesforceId } from '@/lib/dataservice/query';
import { resolvePayerAccountPlanId } from '@/lib/dataservice/accountPlan/payerAccountPlan';
import { PAYER_MILESTONE_OBJECT, PAYER_MILESTONE_FIELD_MAP, payerMilestoneFromRow, payerMilestoneWriteFields } from '@/lib/dataservice/accountPlan/payerMilestoneFields';

export const PAYER_MILESTONE_PLAN_FIELD = 'KPH_Account_Plan__c';
const editableKeys = Object.keys(PAYER_MILESTONE_FIELD_MAP).filter((key) => !['createdDate', 'updatedDate', 'additionalNotes', 'additionalNotesUpdatedDate'].includes(key));
const localDate = crmDateToday;
const readPlanRows = async () => {
  const planId = await resolvePayerAccountPlanId();
  if (!planId) throw new Error('No Payer Account Plan is available.');
  const query = hasVeevaRuntime() ? runCrmQuery : runQuery;
  const rows = (await query({
    object: PAYER_MILESTONE_OBJECT,
    fields: payerQueryFields(PAYER_MILESTONE_OBJECT, ['LastModifiedDate', PAYER_MILESTONE_PLAN_FIELD]),
    where: `(${buildIdMatchWhere(PAYER_MILESTONE_PLAN_FIELD, planId)}) AND ${PAYER_ACTIVE_WHERE}${await payerRecordTypeWhere('payerMilestone')}`,
    sort: [`${PAYER_MILESTONE_FIELD_MAP.createdDate} DESC`],
  })).map(unwrap).filter((row) => row && !isPayerDeleted(row));
  return { planId, rows };
};
const toOptions = (labels) => Array.isArray(labels)
  ? labels.map((entry) => typeof entry === 'string' ? { value: entry, label: entry } : { value: entry.value || entry.apiValue || entry.apiName || entry.name || entry.label, label: entry.label || entry.displayLabel || entry.value }).filter((entry) => entry.value)
  : Object.entries(labels || {}).map(([value, label]) => ({ value, label: String(label || value) }));
const modifiedTime = (value) => {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};
export const sharedNotesRow = (rows) => rows.filter((row) => row[PAYER_MILESTONE_FIELD_MAP.additionalNotes] || row[PAYER_MILESTONE_FIELD_MAP.additionalNotesUpdatedDate]).sort((a, b) =>
  payerDateInputValue(b[PAYER_MILESTONE_FIELD_MAP.additionalNotesUpdatedDate]).localeCompare(payerDateInputValue(a[PAYER_MILESTONE_FIELD_MAP.additionalNotesUpdatedDate])) ||
  modifiedTime(b.LastModifiedDate) - modifiedTime(a.LastModifiedDate) || String(a.Id).localeCompare(String(b.Id))
)[0];
export const savePayerMilestoneNotes = async (notes) => {
  const { planId, rows } = await readPlanRows();
  await assertPayerAccountPlanEditable(planId);
  const existing = sharedNotesRow(rows);
  if ((existing?.[PAYER_MILESTONE_FIELD_MAP.additionalNotes] || '') === notes) return { value: notes, updatedDate: existing?.[PAYER_MILESTONE_FIELD_MAP.additionalNotesUpdatedDate] || null };
  const updatedDate = localDate();
  const fields = payerMilestoneWriteFields({ additionalNotes: notes, additionalNotesUpdatedDate: updatedDate });
  if (existing) await updateRecord(PAYER_MILESTONE_OBJECT, existing.Id, fields, { crm: hasVeevaRuntime() });
  else {
    const create = hasVeevaRuntime() ? createCrmRecord : createRecord;
    await create(PAYER_MILESTONE_OBJECT, { ...await payerRecordTypeFields('payerMilestone'), ...fields, [PAYER_MILESTONE_PLAN_FIELD]: planId });
  }
  const reloaded = sharedNotesRow((await readPlanRows()).rows);
  if ((reloaded?.[PAYER_MILESTONE_FIELD_MAP.additionalNotes] || '') !== notes) {
    throw new Error('CRM has not confirmed the Additional Notes save. Your text is retained here; retry saving before leaving this page.');
  }
  return { value: reloaded[PAYER_MILESTONE_FIELD_MAP.additionalNotes] || '', updatedDate: reloaded[PAYER_MILESTONE_FIELD_MAP.additionalNotesUpdatedDate] || null };
};

export const loadPayerMilestones = async () => {
  const readPicklist = hasVeevaRuntime() ? getCrmPicklistValueLabels : getPicklistValueLabels;
  const [{ planId, rows }, labels] = await Promise.all([
    readPlanRows(), readPicklist(PAYER_MILESTONE_OBJECT, PAYER_MILESTONE_FIELD_MAP.status),
  ]);
  return {
    planId,
    milestones: rows.filter((row) => row[PAYER_MILESTONE_FIELD_MAP.milestone]).map(payerMilestoneFromRow),
    statusOptions: toOptions(labels),
    additionalNotes: {
      value: sharedNotesRow(rows)?.[PAYER_MILESTONE_FIELD_MAP.additionalNotes] || '',
      updatedDate: sharedNotesRow(rows)?.[PAYER_MILESTONE_FIELD_MAP.additionalNotesUpdatedDate] || null,
    },
  };
};
export const savePayerMilestone = async (record) => {
  if (!String(record.milestone || '').trim()) throw new Error('Milestone / Engagement is required.');
  const { planId, rows } = await readPlanRows();
  await assertPayerAccountPlanEditable(planId);
  const existing = record.id ? rows.find((row) => row.Id === record.id) : null;
  if (record.id && !existing) throw new Error('Milestone does not belong to the current Account Plan.');
  const proposed = payerMilestoneWriteFields(Object.fromEntries(editableKeys.filter((key) => Object.hasOwn(record, key)).map((key) => [key, record[key]])));
  const fields = Object.fromEntries(Object.entries(proposed).filter(([field, value]) => (existing?.[field] ?? '') !== (value ?? '')));
  if (!Object.keys(fields).length) return;
  if (existing) return updateRecord(PAYER_MILESTONE_OBJECT, existing.Id, fields, { crm: hasVeevaRuntime() });
  const create = hasVeevaRuntime() ? createCrmRecord : createRecord;
  return create(PAYER_MILESTONE_OBJECT, { ...await payerRecordTypeFields('payerMilestone'), ...fields, [PAYER_MILESTONE_PLAN_FIELD]: planId });
};
export const deletePayerMilestone = async (id) => {
  try {
    const planId = await resolvePayerAccountPlanId();
    await assertPayerAccountPlanEditable(planId);
    if (!planId) throw new Error('No Payer Account Plan is available.');
    const readRows = hasVeevaRuntime() ? runCrmQuery : runQuery;
    // Include deleted records so a retry can recognize an already saved flag.
    const readTarget = async () => (await readRows({
      object: PAYER_MILESTONE_OBJECT,
      fields: ['Id', PAYER_MILESTONE_PLAN_FIELD, 'KPH_Is_Deleted__c', PAYER_MILESTONE_FIELD_MAP.additionalNotes, PAYER_MILESTONE_FIELD_MAP.additionalNotesUpdatedDate],
      where: `(${buildIdMatchWhere(PAYER_MILESTONE_PLAN_FIELD, planId)}) AND (${buildIdMatchWhere('Id', id)})${await payerRecordTypeWhere('payerMilestone')}`,
    })).map(unwrap).find((row) => row && sameCrmId(row.Id, id));
    const row = await readTarget();
    if (!row) throw new Error('Milestone is no longer available in the current Account Plan. Reopen the milestone list before retrying.');
    if (isPayerDeleted(row)) return;
    const { rows } = await readPlanRows();
    const notes = sharedNotesRow(rows);
    if (sameCrmId(notes?.Id, id) && (row[PAYER_MILESTONE_FIELD_MAP.additionalNotes] || row[PAYER_MILESTONE_FIELD_MAP.additionalNotesUpdatedDate])) {
      const planId = row[PAYER_MILESTONE_PLAN_FIELD];
      const create = hasVeevaRuntime() ? createCrmRecord : createRecord;
      await create(PAYER_MILESTONE_OBJECT, {
        ...await payerRecordTypeFields('payerMilestone'),
        [PAYER_MILESTONE_PLAN_FIELD]: planId,
        [PAYER_MILESTONE_FIELD_MAP.additionalNotes]: row[PAYER_MILESTONE_FIELD_MAP.additionalNotes] || '',
        [PAYER_MILESTONE_FIELD_MAP.additionalNotesUpdatedDate]: row[PAYER_MILESTONE_FIELD_MAP.additionalNotesUpdatedDate] || localDate(),
      });
    }
    const currentId = isOnline() ? (toCanonicalSalesforceId(row.Id) || row.Id) : row.Id;
    try {
      return await updateRecord(PAYER_MILESTONE_OBJECT, currentId, { KPH_Is_Deleted__c: true }, { crm: hasVeevaRuntime() });
    } catch (error) {
      // Desktop can report NOT_FOUND after CRM automation removes the row.
      // Check its flag first, then verify absence by ID without plan filters.
      try {
        const saved = await readTarget();
        if (saved && isPayerDeleted(saved)) return;
        if (!saved && /\bNOT_FOUND\b/.test(crmWriteError(error).message)) {
          const remaining = (await readRows({
            object: PAYER_MILESTONE_OBJECT,
            fields: ['Id'],
            where: buildIdMatchWhere('Id', id),
          })).map(unwrap).filter(Boolean);
          if (!remaining.length) return { outcome: 'no-longer-available' };
        }
      } catch { /* Retain the original write error. */ }
      throw error;
    }
  } catch (error) {
    throw crmWriteError(error, 'Delete milestone (' + PAYER_MILESTONE_OBJECT + ')');
  }
};
