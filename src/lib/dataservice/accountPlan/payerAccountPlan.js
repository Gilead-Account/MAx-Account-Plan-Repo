import { resolveRecordTypeId } from '@/lib/dataservice/accountPlan/recordTypes';
import { payerQueryFields, PAYER_ACTIVE_WHERE, isPayerDeleted } from '@/lib/dataservice/accountPlan/payerMappedFields';
import { hasVeevaRuntime } from '@/lib/dataservice/client';
import {
  buildIdMatchWhere,
  inClause,
  runCrmQuery,
  runQuery,
  unwrap,
} from '@/lib/dataservice/query';
import { getCurrentAccountPlanId } from '@/lib/dataservice/accountPlan/shared';

// Local fixtures retain their original ID; live IDs belong to the connected org.
export const resolvePayerAccountPlanRecordTypeId = () => hasVeevaRuntime()
  ? resolveRecordTypeId('payerPlan')
  : Promise.resolve('012VI00000GP0YHYA1');

export const buildPayerAccountPlanWhere = async (planId) => {
  const idWhere = buildIdMatchWhere('Id', planId);
  if (!idWhere) return null;
  return `(${idWhere}) AND RecordTypeId = '${await resolvePayerAccountPlanRecordTypeId()}'`;
};

const payerRecordTypeWhere = async () => `RecordTypeId = '${await resolvePayerAccountPlanRecordTypeId()}'`;
let payerAccountPlanIdInFlight = null;

const readPlans = (params) => (hasVeevaRuntime() ? runCrmQuery(params) : runQuery(params));

export const resolveContextualPayerAccountPlanId = async () => {
  const contextualPlanId = await getCurrentAccountPlanId();

  // Local development uses fixture IDs and should keep the fixture context.
  if (!hasVeevaRuntime()) return contextualPlanId;

  // A record-page launch should win, but only when the contextual record is a
  // Payer Account Plan. A standalone Lightning tab does not provide this ID.
  if (contextualPlanId) {
    const contextualRows = await readPlans({
      object: 'Account_Plan_vod__c',
      fields: payerQueryFields('Account_Plan_vod__c'),
      where: await buildPayerAccountPlanWhere(contextualPlanId),
      limit: 1,
    });
    const contextualPlan = unwrap(contextualRows[0]);
    if (contextualPlan?.Id) return contextualPlan.Id;
  }

  return null;
};

const resolvePayerAccountPlanIdUncached = async () => {
  const contextualPlanId = await resolveContextualPayerAccountPlanId();
  if (contextualPlanId) return contextualPlanId;

  // The Max Payer AP Lightning tab has no current-object context. Select the
  // most recently modified payer plan visible to the logged-in CRM user.
  const payerRows = await readPlans({
    object: 'Account_Plan_vod__c',
    fields: payerQueryFields('Account_Plan_vod__c'),
    where: await payerRecordTypeWhere(),
    sort: ['LastModifiedDate DESC'],
    limit: 1,
  });
  return unwrap(payerRows[0])?.Id || null;
};

export const resolvePayerAccountPlanId = () => {
  if (payerAccountPlanIdInFlight) return payerAccountPlanIdInFlight;
  payerAccountPlanIdInFlight = resolvePayerAccountPlanIdUncached().catch((error) => {
    payerAccountPlanIdInFlight = null;
    throw error;
  });
  return payerAccountPlanIdInFlight;
};

export const resetPayerAccountPlanResolution = () => {
  payerAccountPlanIdInFlight = null;
};

const uniqueIds = (values) => Array.from(new Set((values || []).filter(Boolean).map(String)));

const fetchNamesById = async (object, ids) => {
  const recordIds = uniqueIds(ids);
  if (!recordIds.length) return new Map();
  try {
    const rows = await readPlans({
      object,
      fields: ['Id', 'Name'],
      where: `Id IN ${inClause(recordIds)}`,
      limit: recordIds.length,
    });
    return new Map(rows.map(unwrap).filter((row) => row?.Id).map((row) => [String(row.Id), row.Name || '-']));
  } catch {
    return new Map();
  }
};

export const fetchAccessiblePayerAccountPlans = async () => {
  const rows = await readPlans({
    object: 'Account_Plan_vod__c',
    fields: [
      'Id',
      'Name',
      'Account_vod__c',
      'OwnerId',
      'LastModifiedDate',
      'KPH_ATC_EID__c',
      'KPH_Territory_Description__c',
    ],
    where: await payerRecordTypeWhere(),
    sort: ['Name ASC'],
  });
  const plans = rows.map(unwrap).filter((row) => row?.Id);
  const userOwnerIds = plans.map((row) => row.OwnerId).filter((id) => id && !String(id).startsWith('00G'));
  const groupOwnerIds = plans.map((row) => row.OwnerId).filter((id) => String(id || '').startsWith('00G'));
  const [accountNames, userNames, groupNames] = await Promise.all([
    fetchNamesById('Account', plans.map((row) => row.Account_vod__c)),
    fetchNamesById('User', userOwnerIds),
    fetchNamesById('Group', groupOwnerIds),
  ]);

  return plans.map((row) => ({
    id: row.Id,
    name: row.Name || 'Unnamed Payer Account Plan',
    accountName: accountNames.get(String(row.Account_vod__c || '')) || '-',
    eid: row.KPH_ATC_EID__c || '-',
    marketplace: row.KPH_Territory_Description__c || '-',
    ownerName: userNames.get(String(row.OwnerId || '')) || groupNames.get(String(row.OwnerId || '')) || '-',
    lastModifiedDate: row.LastModifiedDate || null,
  }));
};
