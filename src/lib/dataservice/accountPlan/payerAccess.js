import { hasVeevaRuntime } from '@/lib/dataservice/client';
import { buildIdMatchWhere, getCrmDataForCurrentObject, getDataForCurrentObject, runCrmQuery, runQuery, unwrap } from '@/lib/dataservice/query';
import { buildPayerAccountPlanWhere, resolvePayerAccountPlanId } from '@/lib/dataservice/accountPlan/payerAccountPlan';
import { payerAccountPlanAccess } from '@/lib/payerAccountPlanAccess';

export const loadPayerAccountPlanAccess = async (requestedPlanId) => {
  const currentObject = hasVeevaRuntime() ? getCrmDataForCurrentObject : getDataForCurrentObject;
  const query = hasVeevaRuntime() ? runCrmQuery : runQuery;
  const [userId, planId] = await Promise.all([
    currentObject('User', 'Id'),
    requestedPlanId || resolvePayerAccountPlanId(),
  ]);
  const userWhere = buildIdMatchWhere('Id', userId);
  const planWhere = await buildPayerAccountPlanWhere(planId);
  if (!userWhere || !planWhere) throw new Error('Unable to verify Account Plan edit access.');
  const [users, plans] = await Promise.all([
    query({ object: 'User', fields: ['Id', 'Profile_Name_vod__c', 'Department', 'KPH_Primary_Territory_Description__c'], where: userWhere, limit: 1 }),
    query({ object: 'Account_Plan_vod__c', fields: ['Id', 'KPH_Territory_Description__c'], where: planWhere, limit: 1 }),
  ]);
  const user = unwrap(users[0]);
  const plan = unwrap(plans[0]);
  if (!user || !plan) throw new Error('Unable to verify Account Plan edit access.');
  return payerAccountPlanAccess(user, plan, user.Profile_Name_vod__c);
};

// Check at each service mutation as well as in the UI, including queued saves.
// Salesforce sharing, CRUD and field permissions remain authoritative in CRM.
export const assertPayerAccountPlanEditable = async (planId) => {
  const access = await loadPayerAccountPlanAccess(planId);
  if (!access.canEdit) throw new Error(access.reason);
};
