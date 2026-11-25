// Confirmed CRM field mappings; Additional Notes is shared across the plan’s milestones.
import { payerDateInputValue, formatPayerDate } from '../../helper/payerDates.js';
export const PAYER_MILESTONE_OBJECT = 'KPH_Milestones_and_Engagements__c';
export const PAYER_MILESTONE_FIELD_MAP = {
  milestone: 'KPH_Milestones_Engagements__c',
  updatedDate: 'LastModifiedDate',
  createdDate: 'CreatedDate',
  customerStakeholderName: 'KPH_Customer_Stakeholder_Name__c',
  customerStakeholderRole: 'KPH_Customer_Stakeholder_Role__c',
  kiteOwnerName: 'KPH_Kite_Owner_DRI_Name__c',
  kiteOwnerRole: 'KPH_Kite_Owner_DRI_Role__c',
  kiteCollaboratorName: 'KPH_Kite_Collaborator_Name__c',
  kiteCollaboratorRole: 'KPH_Kite_Collaborator_Role__c',
  timing: 'KPH_Timing__c',
  status: 'KPH_Status__c',
  nextSteps: 'KPH_Next_Steps__c',
  additionalNotes: 'KPH_Additional_Notes__c',
  additionalNotesUpdatedDate: 'KPH_Additional_Notes_updated_date__c',
};
export const PAYER_MILESTONE_LIMITS = {
  milestone: 500,
  customerStakeholderName: 250,
  customerStakeholderRole: 250,
  kiteOwnerName: 250,
  kiteOwnerRole: 250,
  kiteCollaboratorName: 250,
  kiteCollaboratorRole: 250,
  nextSteps: 5000,
  additionalNotes: 5000,
};
export const payerMilestoneFromRow = (row) => ({
  id: row.Id,
  ...Object.fromEntries(Object.entries(PAYER_MILESTONE_FIELD_MAP).map(([key, field]) => [key, row[field] ?? ''])),
});

export const milestoneTimingInputValue = (value) => payerDateInputValue(
  Object.prototype.toString.call(value) === '[object Date]' && Number.isFinite(value.getTime())
    ? value.toISOString() : value
);
export const milestoneTimingCrmValue = (value) => {
  if (!value) return null;
  // Timing is a CRM DateTime field. Encode new calendar dates at UTC midnight
  // and read their calendar portion so devices do not shift the chosen day.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const day = milestoneTimingInputValue(value);
    if (!day) throw new Error('Enter a valid milestone date.');
    return `${day}T00:00:00.000Z`;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Enter a valid milestone date.');
  return date.toISOString();
};
export const formatMilestoneTiming = (value) => formatPayerDate(milestoneTimingInputValue(value));
// Changing another field must not rewrite an existing record's hidden time.
export const milestoneTimingSaveValue = (value, previous) => milestoneTimingCrmValue(
  previous && value === milestoneTimingInputValue(previous) ? previous : value
);

// Only maps explicitly provided fields; missing notes never clear existing
// notes. CRM manages the read-only creation and modification timestamps.
export const payerMilestoneWriteFields = (record) => Object.fromEntries(
  Object.entries(PAYER_MILESTONE_FIELD_MAP).filter(([key]) => !['createdDate', 'updatedDate'].includes(key) && Object.hasOwn(record, key)).map(([key, field]) => {
    const value = record[key];
    const limit = PAYER_MILESTONE_LIMITS[key];
    if (limit && String(value || '').length > limit) throw new Error(`${key} exceeds ${limit} characters.`);
    return [field, key === 'timing' ? milestoneTimingCrmValue(value) : value ?? ''];
  })
);
