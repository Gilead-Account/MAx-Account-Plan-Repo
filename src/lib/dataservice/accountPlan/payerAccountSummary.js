import { payerQueryFields, PAYER_ACTIVE_WHERE, isPayerDeleted } from '@/lib/dataservice/accountPlan/payerMappedFields';
import { hasVeevaRuntime } from '@/lib/dataservice/client';
import {
  buildIdMatchWhere,
  runCrmQuery,
  runQuery,
  unwrap,
} from '@/lib/dataservice/query';
import {
  buildPayerAccountPlanWhere,
  resolvePayerAccountPlanId,
} from '@/lib/dataservice/accountPlan/payerAccountPlan';

export const PAYER_ACCOUNT_PLAN_FIELDS = [
  'Id',
  'Name',
  'RecordTypeId',
  'Account_vod__c',
  'LastModifiedDate',
  'KPH_ATC_EID__c',
  'KPH_Territory_Description__c',
  'OwnerId',
];

const EMPTY_VALUE = 'Not available';

const readRows = (params) => (hasVeevaRuntime() ? runCrmQuery(params) : runQuery(params));

const fetchLookupName = async (object, recordId) => {
  const where = buildIdMatchWhere('Id', recordId);
  if (!where) return null;
  const rows = await readRows({
    object,
    fields: ['Id', 'Name'],
    where,
    limit: 1,
  });
  return unwrap(rows[0])?.Name || null;
};

const fetchOwnerName = async (ownerId) => {
  if (!ownerId) return null;
  const object = String(ownerId).startsWith('00G') ? 'Group' : 'User';
  return fetchLookupName(object, ownerId);
};

export const fetchPayerAccountSummary = async () => {
  const planId = await resolvePayerAccountPlanId();
  const where = await buildPayerAccountPlanWhere(planId);
  if (!where) {
    throw new Error('No Account Plan is available in the current Veeva context.');
  }

  const planRows = await readRows({
    object: 'Account_Plan_vod__c',
    fields: payerQueryFields('Account_Plan_vod__c', PAYER_ACCOUNT_PLAN_FIELDS),
    where,
    limit: 1,
  });
  const plan = unwrap(planRows[0]);
  if (!plan) throw new Error(`Payer Account Plan ${planId} was not found for the configured record type.`);

  const [accountName, ownerName] = await Promise.all([
    fetchLookupName('Account', plan.Account_vod__c).catch(() => null),
    fetchOwnerName(plan.OwnerId).catch(() => null),
  ]);

  return {
    planName: plan.Name || '',
    accountName: accountName || plan.Name || EMPTY_VALUE,
    lastModifiedDate: plan.LastModifiedDate || null,
    eid: plan.KPH_ATC_EID__c || EMPTY_VALUE,
    marketplace: plan.KPH_Territory_Description__c || EMPTY_VALUE,
    kadOwner: ownerName || EMPTY_VALUE,
  };
};
