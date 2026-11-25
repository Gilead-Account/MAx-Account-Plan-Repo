// One CRM record per objective, linked to Account Plan through KPH_Account_Plan__c.
export const PAYER_OBJECTIVE_OBJECT = 'KPH_Account_Objective__c';
export const PAYER_OBJECTIVE_PLAN_FIELD = 'KPH_Account_Plan__c';
export const PAYER_OBJECTIVE_TEXT_FIELDS = ['KPH_Objective_1__c', 'KPH_Objective_2__c', 'KPH_Objective_3__c'];
export const PAYER_OBJECTIVE_STATUS_FIELD = 'KPH_Status__c';
export const PAYER_STRATEGY_OBJECT = 'KPH_Strategy__c';
export const PAYER_STRATEGY_FIELD_MAP = {
  strategy: 'KPH_Strategy_Title__c',
  objectiveId: 'KPH_Account_Objective__c',
  status: 'KPH_Strategy_Status__c',
  planId: 'KPH_Account_Plan__c',
};
export const PAYER_TACTIC_OBJECT = 'KPH_Tactics_Resource__c';
export const PAYER_TACTIC_FIELD_MAP = {
  value: 'KPH_Tactics_and_Resources_Title__c',
  planId: 'KPH_Account_Plan__c',
  objectiveId: 'KPH_Account_Objective__c',
  strategyId: 'KPH_Strategy__c',
  status: 'KPH_Tactic_Status__c',
};
export const PAYER_HIERARCHY_DATE_FIELDS = { createdDate: 'CreatedDate', updatedDate: 'LastModifiedDate' };
