export const navigationItems = [
  { key: 'executive-summary', label: 'Executive Summary', icon: 'spark' },
  { key: 'account-landscape', label: 'Account Landscape', icon: 'building' },
  { key: 'stakeholder-map', label: 'Stakeholder Map', icon: 'people' },
  { key: 'action-plan', label: 'Action Plan & Objectives', icon: 'target' },
  { key: 'barriers-risks', label: 'Barriers & Opportunities', icon: 'signal' },
];

export const accessRows = [
  ['Commercial', '642K', 'Preferred', 'PA only', 'up'],
  ['Medicare', '318K', 'Covered', 'PA + step edit', 'flat'],
  ['Medicaid', '186K', 'Non-preferred', 'Step edit', 'down'],
  ['Exchange', '94K', 'Covered', 'PA only', 'up'],
];

export const stakeholders = [
  { initials: 'AM', name: 'Alex Morgan', role: 'VP, Pharmacy', influence: 'High', support: 'Champion', engagement: 'Monthly', quadrant: 'partner', color: 'blue' },
  { initials: 'JL', name: 'Jordan Lee', role: 'Medical Director', influence: 'High', support: 'Supportive', engagement: 'Quarterly', quadrant: 'partner', color: 'purple' },
  { initials: 'RK', name: 'Riley Kim', role: 'P&T Committee Chair', influence: 'High', support: 'Neutral', engagement: 'Build trust', quadrant: 'involve', color: 'orange' },
  { initials: 'TS', name: 'Taylor Smith', role: 'Director, Contracting', influence: 'Medium', support: 'Supportive', engagement: 'As needed', quadrant: 'involve', color: 'green' },
  { initials: 'CP', name: 'Casey Patel', role: 'Clinical Pharmacist', influence: 'Medium', support: 'Champion', engagement: 'Quarterly', quadrant: 'consult', color: 'teal' },
  { initials: 'MW', name: 'Morgan Williams', role: 'Finance Partner', influence: 'Low', support: 'Neutral', engagement: 'Monitor', quadrant: 'inform', color: 'slate' },
];

export const issues = [
  { id: 'barrier-1', type: 'Barrier', name: 'Medicaid step-edit requirement', objectiveId: 'commercial-objective-1', strategyId: 'commercial-strategy-1a', impact: 'High', status: 'Open', details: 'Two prior therapies are required before access, creating treatment delays.' },
  { id: 'barrier-2', type: 'Barrier', name: 'Limited outcomes-data awareness', objectiveId: 'commercial-objective-2', strategyId: 'commercial-strategy-2a', impact: 'Medium', status: 'Open', details: 'Key economic evidence has not reached the full P&T committee.' },
  { id: 'barrier-3', type: 'Barrier', name: 'Competitor net-cost proposal', objectiveId: 'commercial-objective-3', strategyId: 'commercial-strategy-3c', impact: 'High', status: 'Closed', details: 'A competing net-cost proposal made executive alignment more difficult.' },
  { id: 'barrier-4', type: 'Barrier', name: 'Policy review timing uncertainty', objectiveId: 'commercial-objective-1', strategyId: 'commercial-strategy-1a', impact: 'Medium', status: 'Open', details: 'The account has not confirmed when revised access criteria will enter formal policy review.' },
  { id: 'opportunity-1', type: 'Opportunity', name: '2027 formulary review window', objectiveId: 'commercial-objective-2', impact: 'High', status: 'Open', details: 'The account has opened an evidence review ahead of its annual formulary cycle.' },
  { id: 'opportunity-2', type: 'Opportunity', name: 'Value-based agreement interest', objectiveId: 'commercial-objective-3', impact: 'High', status: 'Closed', details: 'Finance leadership is open to a pilot tied to measurable outcomes.' },
  { id: 'opportunity-3', type: 'Opportunity', name: 'New policy review', objectiveId: 'commercial-objective-1', impact: 'Medium', status: 'Open', details: 'A new policy review creates an opening to discuss revised access criteria.' },
  { id: 'opportunity-4', type: 'Opportunity', name: 'Medical policy stakeholder access', objectiveId: 'commercial-objective-1', impact: 'High', status: 'Open', details: 'The medical policy team has offered time for an evidence-focused working session.' },
];

export const objectives = [
  { id: 'OBJ-01', title: 'Improve Medicaid access position', outcome: 'Remove the second step edit for eligible patients by Q1 2027.', owner: 'Maya Chen', progress: 68, status: 'On track', due: 'Mar 31, 2027', tone: 'green' },
  { id: 'OBJ-02', title: 'Strengthen clinical value recognition', outcome: 'Secure a favorable P&T re-review based on updated outcomes evidence.', owner: 'James Rivera', progress: 42, status: 'At risk', due: 'Dec 15, 2026', tone: 'amber' },
  { id: 'OBJ-03', title: 'Develop a value-based partnership', outcome: 'Align on pilot measures, eligible population and implementation plan.', owner: 'Avery Brooks', progress: 25, status: 'On track', due: 'Jun 30, 2027', tone: 'blue' },
];

export const activities = [
  ['Share updated budget-impact model', 'OBJ-02', 'James Rivera', 'Sep 18', 'In progress'],
  ['Confirm data requirements for VBC pilot', 'OBJ-03', 'Avery Brooks', 'Sep 25', 'Not started'],
  ['Conduct Medicaid policy working session', 'OBJ-01', 'Maya Chen', 'Oct 02', 'Scheduled'],
  ['Prepare P&T evidence-response brief', 'OBJ-02', 'Jordan Lee', 'Oct 12', 'Not started'],
];

export const initialCommercialHierarchy = [
  {
    id: 'commercial-objective-1',
    objective: 'Improve Medicaid access position',
    strategies: [
      {
        id: 'commercial-strategy-1a',
        strategy: 'Build the policy evidence case',
        status: 'Open',
        tactics: [
          { id: 'commercial-tactic-1a1', value: 'Share updated policy and outcomes evidence' },
          { id: 'commercial-tactic-1a2', value: 'Prepare a payer-specific evidence brief' },
        ],
      },
      {
        id: 'commercial-strategy-1b',
        strategy: 'Align priority access stakeholders',
        status: 'Open',
        tactics: [
          { id: 'commercial-tactic-1b1', value: 'Conduct a Medicaid policy working session' },
        ],
      },
      {
        id: 'commercial-strategy-1c',
        strategy: 'Advance the formulary pathway',
        status: 'Closed',
        tactics: [{ id: 'commercial-tactic-1c1', value: 'Confirm the next policy review window' }],
      },
    ],
  },
  {
    id: 'commercial-objective-2',
    objective: 'Strengthen clinical value recognition',
    strategies: [
      { id: 'commercial-strategy-2a', strategy: 'Expand evidence exchange', status: 'Open', tactics: [{ id: 'commercial-tactic-2a1', value: 'Share updated outcomes evidence' }] },
      { id: 'commercial-strategy-2b', strategy: 'Strengthen medical education', status: 'Open', tactics: [{ id: 'commercial-tactic-2b1', value: 'Plan a medical education session' }] },
      { id: 'commercial-strategy-2c', strategy: 'Develop clinical champions', status: 'Closed', tactics: [{ id: 'commercial-tactic-2c1', value: 'Identify priority clinical advocates' }] },
    ],
  },
  {
    id: 'commercial-objective-3',
    objective: 'Develop a value-based partnership',
    strategies: [
      { id: 'commercial-strategy-3a', strategy: 'Build the account value story', status: 'Open', tactics: [{ id: 'commercial-tactic-3a1', value: 'Tailor the value narrative' }] },
      { id: 'commercial-strategy-3b', strategy: 'Define the pilot design', status: 'Open', tactics: [{ id: 'commercial-tactic-3b1', value: 'Confirm pilot measures and population' }] },
      { id: 'commercial-strategy-3c', strategy: 'Secure executive alignment', status: 'Closed', tactics: [{ id: 'commercial-tactic-3c1', value: 'Review the proposal with finance leadership' }] },
    ],
  },
];

export const initialCriticalActions = [
  {
    id: 'critical-action-1',
    action: 'Share updated policy and outcomes evidence',
    linkedStrategyId: 'commercial-strategy-1a',
    customerStakeholderName: 'Jordan Lee',
    customerStakeholderRole: 'Medical Director',
    kiteOwnerName: 'Maya Chen',
    kiteOwnerRole: 'KAD',
    kiteCollaboratorName: 'James Rivera',
    kiteCollaboratorRole: 'Medical Affairs Director',
    timing: 'Oct 15, 2026',
    status: 'In Progress',
    nextSteps: 'Finalize the evidence package and confirm review timing',
  },
  {
    id: 'critical-action-2',
    action: 'Conduct a Medicaid policy working session',
    linkedStrategyId: 'commercial-strategy-1b',
    customerStakeholderName: 'Alex Morgan',
    customerStakeholderRole: 'VP Pharmacy',
    kiteOwnerName: 'Avery Brooks',
    kiteOwnerRole: 'Market Access Director',
    kiteCollaboratorName: 'Maya Chen',
    kiteCollaboratorRole: 'KAD',
    timing: 'Nov 2, 2026',
    status: 'Not Started',
    nextSteps: 'Confirm attendees and circulate proposed discussion topics',
  },
];

export const milestonesAndEngagements = [
  {
    id: 'milestone-01',
    milestone: 'Present community-delivery evidence to Medical Policy',
    customerStakeholderName: 'Jordan Lee',
    customerStakeholderRole: 'Medical Director',
    kiteOwnerName: 'Maya Chen',
    kiteOwnerRole: 'KAD',
    kiteCollaboratorName: 'James Rivera',
    kiteCollaboratorRole: 'Medical Affairs Director',
    timing: 'Oct 15, 2026',
    status: 'In Progress',
    nextSteps: 'Finalize the agenda and confirm attendees',
  },
  {
    id: 'milestone-02',
    milestone: 'Host a P&T evidence-exchange workshop',
    customerStakeholderName: 'Alex Morgan',
    customerStakeholderRole: 'VP Pharmacy',
    kiteOwnerName: 'James Rivera',
    kiteOwnerRole: 'Medical Affairs Director',
    kiteCollaboratorName: 'Avery Brooks',
    kiteCollaboratorRole: 'Market Access Director',
    timing: 'Nov 3, 2026',
    status: 'Not Started',
    nextSteps: 'Complete outreach and prepare workshop materials',
  },
  {
    id: 'milestone-03',
    milestone: 'Conduct a value-based partnership scoping session',
    customerStakeholderName: 'Taylor Smith',
    customerStakeholderRole: 'Director Contracting',
    kiteOwnerName: 'Avery Brooks',
    kiteOwnerRole: 'Market Access Director',
    kiteCollaboratorName: 'Maya Chen',
    kiteCollaboratorRole: 'KAD',
    timing: 'Nov 21, 2026',
    status: 'Deprioritized',
    nextSteps: 'Confirm data requirements and attendees',
  },
];

export const initialMilestoneNotes = 'Coordinate timing across Medical, Market Access, and field teams before confirming customer-facing dates.';

export const initialLaunchReadiness = {
  medicalPolicyPublished: 'No',
  payerValuePropDelivery: 'Outreach',
  anticipatedMedicalPolicyPublication: '30-90 days',
  pieDeliveryStatus: 'Scheduled',
  riskAssessment: 'Medium',
  policyContextNotes: 'The payer is developing its medical policy ahead of launch and is evaluating evidence needs, implementation timing, and site-of-care considerations.',
  driversForAdoption: 'The account is seeking a clear clinical and economic rationale for adopting the new treatment pathway.',
  anticipatedBarriers: 'Medical policy timing and competing formulary priorities may delay launch readiness.',
  evidenceForPillarDecision: 'Updated outcomes evidence and the payer-specific budget impact analysis support the recommended pillar decision.',
};

export const actionPlanTabs = [
  'Launch Readiness Plan',
  'Objectives, Strategies & Critical Actions',
  'Milestones & Engagements',
];
