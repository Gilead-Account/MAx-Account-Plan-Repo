// Production-safe replacements for the local Payer prototype fixtures.
// Packaged MyInsights builds must render empty states until CRM data loads.
export const navigationItems = [
  { key: 'executive-summary', label: 'Executive Summary', icon: 'spark' },
  { key: 'account-landscape', label: 'Account Landscape', icon: 'building' },
  { key: 'stakeholder-map', label: 'Stakeholder Map', icon: 'people' },
  { key: 'action-plan', label: 'Action Plan & Objectives', icon: 'target' },
  { key: 'barriers-risks', label: 'Barriers & Opportunities', icon: 'signal' },
];

export const accessRows = [];
export const stakeholders = [];
export const issues = [];
export const objectives = [];
export const activities = [];
export const initialCommercialHierarchy = [];
export const initialCriticalActions = [];
export const milestonesAndEngagements = [];
export const initialMilestoneNotes = '';
export const initialLaunchReadiness = {
  medicalPolicyPublished: '',
  payerValuePropDelivery: '',
  anticipatedMedicalPolicyPublication: '',
  pieDeliveryStatus: '',
  riskAssessment: '',
  policyContextNotes: '',
  driversForAdoption: '',
  anticipatedBarriers: '',
  evidenceForPillarDecision: '',
};
export const actionPlanTabs = [
  'Launch Readiness Plan',
  'Objectives, Strategies & Critical Actions',
  'Milestones & Engagements',
];
