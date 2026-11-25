import { assertPayerAccountPlanEditable } from '@/lib/dataservice/accountPlan/payerAccess';
import { crmDateToday } from '@/lib/helper/payerDates';
import { hasVeevaRuntime } from '@/lib/dataservice/client';
import { runCrmQuery, runQuery, getCrmPicklistValueLabels, getPicklistValueLabels, unwrap, updateRecord } from '@/lib/dataservice/query';
import { resolvePayerAccountPlanId, buildPayerAccountPlanWhere } from '@/lib/dataservice/accountPlan/payerAccountPlan';
import { payerQueryFields } from '@/lib/dataservice/accountPlan/payerMappedFields';

export const PAYER_LAUNCH_CONFIG = {
  payerValuePropDelivery: { field: 'KPH_Payer_Value_Prop_Delivery__c', updated: 'KPH_Payer_Value_Prop_Del_updated_date__c', group: 'metrics', picklist: true },
  medicalPolicyPublished: { field: 'KPH_Medical_Policy_Published__c', updated: 'KPH_Medi_Policy_Published_updated_date__c', group: 'metrics', picklist: true },
  riskAssessment: { field: 'KPH_Risk_Assessment_for_Delayed_Coverage__c', updated: 'KPH_Risk_Assessment_updated_date__c', group: 'metrics', picklist: true },
  anticipatedMedicalPolicyPublication: { field: 'KPH_Anticipated_Publish_Medical_Policy__c', updated: 'Anticipate_to_Published_Medi_Policy_Date__c', group: 'metrics', picklist: true },
  pieDeliveryStatus: { field: 'KPH_PIE_Delivery_Status__c', updated: 'KPH_PIE_Delivery_Status_updated_date__c', group: 'metrics', picklist: true },
  policyContextNotes: { field: 'KPH_Policy_Context_Launch_Insights__c', updated: 'KPH_Policy_Notes_updated_date__c', group: 'metrics', maxLength: 500 },
  driversForAdoption: { field: 'KPH_Drivers_for_Anito_cel_Adoption__c', updated: 'KPH_Drivers_for_Anito_cel_Adoption_Date__c', group: 'commentary', maxLength: 1000 },
  anticipatedBarriers: { field: 'KPH_Anticipated_Barriers_at_Launch__c', updated: 'KPH_Anticipated_Barriers_at_Launch_Date__c', group: 'commentary', maxLength: 1000 },
  evidenceForPillarDecision: { field: 'KPH_Evidence_to_Support_Payer_Decision__c', updated: 'KPH_Evidence_to_Supp_Payer_Decision_Date__c', group: 'commentary', maxLength: 1000 },
};
export const emptyPayerLaunch = () => Object.fromEntries(Object.keys(PAYER_LAUNCH_CONFIG).map((key) => [key, '']));
export const payerPicklistOptions = (labels) => Array.isArray(labels)
  ? labels.filter((entry) => entry && entry.active !== false && entry.isActive !== false).map((entry) => typeof entry === 'string' ? { value: entry, label: entry } : { value: entry.value || entry.apiValue || entry.apiName || entry.name || entry.label, label: entry.label || entry.displayLabel || entry.value }).filter((entry) => entry.value)
  : Object.entries(labels || {}).map(([value, label]) => ({ value, label: String(label || value) }));
export const loadPayerLaunchReadiness = async () => {
  const planId = await resolvePayerAccountPlanId();
  const where = await buildPayerAccountPlanWhere(planId);
  if (!where) throw new Error('No Payer Account Plan is available.');
  const query = hasVeevaRuntime() ? runCrmQuery : runQuery;
  const readPicklist = hasVeevaRuntime() ? getCrmPicklistValueLabels : getPicklistValueLabels;
  const [rows, picklists] = await Promise.all([
    query({ object: 'Account_Plan_vod__c', fields: payerQueryFields('Account_Plan_vod__c'), where, limit: 1 }),
    Promise.all(Object.entries(PAYER_LAUNCH_CONFIG).filter(([, config]) => config.picklist).map(async ([key, config]) => [key, payerPicklistOptions(await readPicklist('Account_Plan_vod__c', config.field))])),
  ]);
  const row = unwrap(rows[0]);
  if (!row) throw new Error('Payer Account Plan was not found.');
  const form = Object.fromEntries(Object.entries(PAYER_LAUNCH_CONFIG).map(([key, config]) => [key, row[config.field] || '']));
  const dates = Object.fromEntries(Object.entries(PAYER_LAUNCH_CONFIG).map(([key, config]) => [key, row[config.updated] || null]));
  const options = Object.fromEntries(picklists);
  for (const [key, items] of Object.entries(options)) if (form[key] && !items.some((option) => option.value === form[key])) items.unshift({ value: form[key], label: form[key] });
  return { planId, form, dates, options };
};
export const savePayerLaunchReadiness = async (form, keys) => {
  const planId = await resolvePayerAccountPlanId();
  await assertPayerAccountPlanEditable(planId);
  if (!planId) throw new Error('No Payer Account Plan is available.');
  const fields = {};
  const date = crmDateToday();
  for (const key of keys) {
    const config = PAYER_LAUNCH_CONFIG[key];
    if (!config) throw new Error('Unknown launch readiness field.');
    const value = form[key] || '';
    if (config.maxLength && value.length > config.maxLength) throw new Error(`${key} exceeds ${config.maxLength} characters.`);
    fields[config.field] = value;
    fields[config.updated] = date;
  }
  if (Object.keys(fields).length) await updateRecord('Account_Plan_vod__c', planId, fields, { crm: hasVeevaRuntime() });
  return date;
};
