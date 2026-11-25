import { payerRecordTypeFields, payerRecordTypeWhere } from '@/lib/dataservice/accountPlan/recordTypes';
import { assertPayerAccountPlanEditable } from '@/lib/dataservice/accountPlan/payerAccess';
import { sameCrmId } from '@/lib/helper/barrierRecords';
import { validateObjectiveLimit } from '@/lib/helper/payerObjectiveLimit';
import { crmWriteError } from '@/lib/helper/crmWriteError';
import { hasVeevaRuntime, isOnline } from '@/lib/dataservice/client';
import { runCrmQuery, runQuery, createCrmRecord, createRecord, updateRecord, unwrap, buildIdMatchWhere, toCanonicalSalesforceId } from '@/lib/dataservice/query';
import { resolvePayerAccountPlanId } from '@/lib/dataservice/accountPlan/payerAccountPlan';
import { payerQueryFields, PAYER_ACTIVE_WHERE, isPayerDeleted } from '@/lib/dataservice/accountPlan/payerMappedFields';
import { PAYER_OBJECTIVE_OBJECT as OBJECTIVE, PAYER_OBJECTIVE_TEXT_FIELDS as TEXT, PAYER_STRATEGY_OBJECT as STRATEGY, PAYER_TACTIC_OBJECT as TACTIC } from '@/lib/dataservice/accountPlan/payerHierarchyFields';

const recordTypeKeys = { [OBJECTIVE]: 'payerObjective', [STRATEGY]: 'payerStrategy', [TACTIC]: 'payerTactic' };

export async function loadPayerHierarchy() {
  const planId = await resolvePayerAccountPlanId();
  if (!planId) throw new Error('No Account Plan is available.');
  const query = hasVeevaRuntime() ? runCrmQuery : runQuery;
  const [objectives, strategies, tactics] = await Promise.all([OBJECTIVE, STRATEGY, TACTIC].map(async (object) => (await query({ object, fields: payerQueryFields(object, ['KPH_Account_Plan__c', 'CreatedDate', 'LastModifiedDate']), where: `(${buildIdMatchWhere('KPH_Account_Plan__c', planId)}) AND ${PAYER_ACTIVE_WHERE}${await payerRecordTypeWhere(recordTypeKeys[object])}`, sort: ['CreatedDate ASC'] })).map(unwrap).filter((row) => row && !isPayerDeleted(row))));
  const hierarchy = objectives.filter((row) => TEXT.some((field) => row[field])).map((row) => {
    const populated = TEXT.filter((field) => row[field]);
    if (populated.length !== 1) throw new Error(`Objective ${row.Id} has multiple objective text fields populated. Each objective must have its own record.`);
    return { id: row.Id, textField: populated[0], objective: row[populated[0]], status: row.KPH_Status__c || '', strategies: strategies.filter((item) => !isPayerDeleted(item) && sameCrmId(item.KPH_Account_Objective__c, row.Id)).map((item) => ({ id: item.Id, strategy: item.KPH_Strategy_Title__c || '', status: item.KPH_Strategy_Status__c || '', tactics: tactics.filter((tactic) => sameCrmId(tactic.KPH_Strategy__c, item.Id) && tactic.KPH_Tactics_and_Resources_Title__c).map((tactic) => ({ id: tactic.Id, value: tactic.KPH_Tactics_and_Resources_Title__c, status: tactic.KPH_Tactic_Status__c || '' })) })) };
  });
  return { planId, hierarchy };
}
const flat = (hierarchy) => hierarchy.flatMap((objective) => [{ ...objective, kind: 'objective' }, ...objective.strategies.flatMap((strategy) => [{ ...strategy, kind: 'strategy', objectiveId: objective.id }, ...strategy.tactics.map((tactic) => ({ ...tactic, kind: 'tactic', objectiveId: objective.id, strategyId: strategy.id }))])]);
const objects = { objective: OBJECTIVE, strategy: STRATEGY, tactic: TACTIC };
export async function savePayerHierarchy(previous, proposed) {
  const { planId, hierarchy: stored } = await loadPayerHierarchy();
  await assertPayerAccountPlanEditable(planId);
  validateObjectiveLimit(stored, proposed);
  const existing = new Map(flat(stored).map((row) => [row.id, row]));
  const prior = new Map(flat(previous).map((row) => [row.id, row]));
  const ids = {};
  const next = structuredClone(proposed);
  let completedWrites = 0;
  const update = async (object, id, fields) => {
    const result = await updateRecord(object, isOnline() ? (toCanonicalSalesforceId(id) || id) : id, fields, { crm: hasVeevaRuntime() });
    completedWrites++;
    return result;
  };
  const create = async (object, fields) => {
    try {
      const result = await (hasVeevaRuntime() ? createCrmRecord : createRecord)(object, { ...fields, ...await payerRecordTypeFields(recordTypeKeys[object]) });
      completedWrites++;
      return result;
    } catch (error) {
      const failure = crmWriteError(error, `Create record (${object})`);
      const recordTypeRejected = /\bINVALID_CROSS_REFERENCE_KEY\b/.test(failure.message)
        && /Record\s*Type(?:\s*ID|Id)?/i.test(failure.message);
      if (recordTypeRejected) {
        failure.message = `CRM rejected the configured Payer record type for ${object}. Ask your Salesforce administrator to verify that the record type is active and available to your user, and that you have Create access to this object. ${failure.message}`;
      }
      // A rejected first write has not partially changed the hierarchy.
      // Keep the editor open for correction; uncertain/partial writes still reload.
      failure.canCorrectDraft = completedWrites === 0
        && (recordTypeRejected || /\bFIELD_CUSTOM_VALIDATION_EXCEPTION\b/.test(failure.message));
      throw failure;
    }
  };
  for (const row of flat(next)) {
    const old = prior.get(row.id);
    if (old && !existing.has(row.id)) throw new Error('A linked record is no longer available in this Account Plan. Reload before editing.');
    const text = row.kind === 'objective' ? row.objective : row.kind === 'strategy' ? row.strategy : row.value;
    if (!text?.trim() || text.length > 200) throw new Error('Objective, strategy and tactic titles must contain 1–200 characters.');
    const textField = row.kind === 'objective' ? (existing.get(row.id)?.textField || row.textField || TEXT[Math.min(next.findIndex((item) => item.id === row.id), 2)]) : row.kind === 'strategy' ? 'KPH_Strategy_Title__c' : 'KPH_Tactics_and_Resources_Title__c';
    if (row.kind === 'objective') next.find((item) => item.id === row.id).textField = textField;
    const fields = { [textField]: text, [row.kind === 'objective' ? 'KPH_Status__c' : row.kind === 'strategy' ? 'KPH_Strategy_Status__c' : 'KPH_Tactic_Status__c']: row.status || '' };
    if (row.kind !== 'objective') fields.KPH_Account_Objective__c = ids[row.objectiveId] || row.objectiveId;
    if (row.kind === 'tactic') fields.KPH_Strategy__c = ids[row.strategyId] || row.strategyId;
    if (old) {
      if (text !== (old.objective ?? old.strategy ?? old.value) || row.status !== old.status) await update(objects[row.kind], row.id, fields);
    } else {
      const result = await create(objects[row.kind], { ...fields, KPH_Account_Plan__c: planId });
      const rawId = result?.data?.id || result?.data?.Id || result?.id || result?.Id || result?.recordId;
      const id = rawId?.value || rawId;
      if (!id) throw new Error('CRM created a record without returning its ID. Reload before continuing.');
      ids[row.id] = id;
    }
  }
  const retained = new Set(flat(next).map((row) => row.id));
  for (const row of [...prior.values()].reverse()) if (!retained.has(row.id)) {
    if (!existing.has(row.id)) continue;
    const fields = { KPH_Is_Deleted__c: true };
    try {
      await update(objects[row.kind], row.id, fields);
    } catch (error) {
      // Verify a failed response against CRM before treating deletion as saved.
      let confirmed = false;
      try {
        const query = hasVeevaRuntime() ? runCrmQuery : runQuery;
        const rows = (await query({
          object: objects[row.kind],
          fields: ['Id', 'KPH_Is_Deleted__c'],
          where: '(' + buildIdMatchWhere('Id', row.id) + ') AND (' + buildIdMatchWhere('KPH_Account_Plan__c', planId) + ')',
        })).map(unwrap);
        confirmed = rows.some((item) => sameCrmId(item?.Id, row.id) && isPayerDeleted(item));
        if (!rows.filter(Boolean).length && /\bNOT_FOUND\b/.test(crmWriteError(error).message)) {
          // A missing scoped row could have moved plans. Check by ID alone
          // before accepting that it is no longer available.
          const remaining = (await query({
            object: objects[row.kind], fields: ['Id'],
            where: buildIdMatchWhere('Id', row.id),
          })).map(unwrap).filter(Boolean);
          confirmed = remaining.length === 0;
        }
      } catch { /* Keep the original write error when verification fails. */ }
      if (!confirmed) throw error;
      completedWrites++;
    }
  }
  // Successful writes are authoritative for this session. A separate immediate
  // mobile query can lag behind createRecord or fail after the write succeeded.
  // Retain acknowledged IDs instead of replacing saved rows with a stale read.
  const hierarchy = next.map((objective) => ({
    ...objective, id: ids[objective.id] || objective.id,
    strategies: objective.strategies.map((strategy) => ({
      ...strategy, id: ids[strategy.id] || strategy.id,
      tactics: strategy.tactics.map((tactic) => ({ ...tactic, id: ids[tactic.id] || tactic.id })),
    })),
  }));
  return { ids, hierarchy };
}
