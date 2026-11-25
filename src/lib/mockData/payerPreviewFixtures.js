// Development-only records, loaded by mockAdapter for the populated preview.
import { initialCommercialHierarchy, initialCriticalActions, issues, milestonesAndEngagements, initialMilestoneNotes, initialLaunchReadiness } from './marketAccessFixtures.js';

const updated = '2026-10-28';
const stamp = '2026-10-28T14:00:00.000Z';
const mapped = (record, fields) => Object.fromEntries(Object.entries(fields).map(([key, field]) => [field, record[key] || '']));
const peopleFields = {
  customerStakeholderName: 'KPH_Customer_Stakeholder_Name__c', customerStakeholderRole: 'KPH_Customer_Stakeholder_Role__c',
  kiteOwnerName: 'KPH_Kite_Owner_DRI_Name__c', kiteOwnerRole: 'KPH_Kite_Owner_DRI_Role__c',
  kiteCollaboratorName: 'KPH_Kite_Collaborator_Name__c', kiteCollaboratorRole: 'KPH_Kite_Collaborator_Role__c',
  status: 'KPH_Status__c', nextSteps: 'KPH_Next_Steps__c',
};
const launchFields = {
  medicalPolicyPublished: 'KPH_Medical_Policy_Published__c', payerValuePropDelivery: 'KPH_Payer_Value_Prop_Delivery__c',
  anticipatedMedicalPolicyPublication: 'KPH_Anticipated_Publish_Medical_Policy__c', pieDeliveryStatus: 'KPH_PIE_Delivery_Status__c',
  riskAssessment: 'KPH_Risk_Assessment_for_Delayed_Coverage__c', policyContextNotes: 'KPH_Policy_Context_Launch_Insights__c',
  driversForAdoption: 'KPH_Drivers_for_Anito_cel_Adoption__c', anticipatedBarriers: 'KPH_Anticipated_Barriers_at_Launch__c',
  evidenceForPillarDecision: 'KPH_Evidence_to_Support_Payer_Decision__c',
};
const strategyById = new Map(initialCommercialHierarchy.flatMap((objective) => objective.strategies.map((strategy) => [strategy.id, strategy])));

export const payerPreviewRows = (object, planId) => {
  const row = (id, fields) => ({ Id: id, KPH_Account_Plan__c: planId, CreatedDate: stamp, LastModifiedDate: stamp, KPH_Is_Deleted__c: false, ...fields });
  switch (object) {
    case 'Account_Plan_vod__c': return [{
      Id: planId,
      KPH_Geographic_Footprint__c: 'Regional payer serving Tennessee, Kentucky, and Ohio.',
      KPH_Covered_Lives__c: '1.24 million members',
      KPH_Ownership_Affiliation__c: 'Independent regional health plan with an integrated provider network.',
      KPH_Lines_of_Business__c: 'Commercial, Medicare Advantage, Medicaid, and Exchange.',
      KPH_Geographic_Footprint_updated_date__c: updated, KPH_Covered_Lives_updated_date__c: updated,
      KPH_Ownership_Affiliation_updated_date__c: updated, KPH_Lines_of_Business_updated_date__c: updated,
      KPH_Payer_Restrictiveness__c: 'CAR T Follower',
      KPH_Payer_Archetype_Definition__c: 'Sample payer that follows established coverage policies and reviews new clinical and economic evidence.',
      KPH_Payer_Restrictiveness_updated_date__c: updated,
      KPH_AE_Value_Prop_Meeting_Request_Sent__c: 'Yes', KPH_ValueProp_Delivered_Within_90_Days__c: 'No', KPH_Anito_Cel_Update_date__c: updated,
      ...mapped(initialLaunchReadiness, launchFields),
    }];
    case 'KPH_Account_Objective__c': return initialCommercialHierarchy.map((objective, index) => row(objective.id, {
      [`KPH_Objective_${index + 1}__c`]: objective.objective, KPH_Status__c: 'Open',
    }));
    case 'KPH_Strategy__c': return initialCommercialHierarchy.flatMap((objective) => objective.strategies.map((strategy) => row(strategy.id, {
      KPH_Account_Objective__c: objective.id, KPH_Strategy_Title__c: strategy.strategy, KPH_Strategy_Status__c: strategy.status,
    })));
    case 'KPH_Tactics_Resource__c': return initialCommercialHierarchy.flatMap((objective) => objective.strategies.flatMap((strategy) => strategy.tactics.map((tactic) => row(tactic.id, {
      KPH_Account_Objective__c: objective.id, KPH_Strategy__c: strategy.id,
      KPH_Tactics_and_Resources_Title__c: tactic.value, KPH_Tactic_Status__c: strategy.status === 'Closed' ? 'Completed' : 'Open',
    }))));
    case 'KPH_Payers_Barrier_Opportunities__c': return issues.map((issue) => {
      const prefix = issue.type === 'Barrier' ? 'Barrier' : 'Opportunities';
      return row(issue.id, {
        KPH_Account_Objective_Barrier__c: issue.objectiveId,
        KPH_Strategy__c: issue.strategyId || initialCommercialHierarchy.find((objective) => objective.id === issue.objectiveId)?.strategies[0].id,
        [`KPH_${prefix}_Title__c`]: issue.name,
        [`KPH_${prefix}_Impact__c`]: issue.impact,
        [`KPH_${prefix}_Status__c`]: issue.status,
        [issue.type === 'Barrier' ? 'KPH_Barriers_Details__c' : 'KPH_Opportunities_Details__c']: issue.details,
      });
    });
    case 'KPH_Actions_and_Critical_Next_Steps__c': return initialCriticalActions.map((action, index) => row(action.id, {
      ...mapped(action, { ...peopleFields, action: 'KPH_Action_Critical_Next_Steps__c', customerStakeholderName: 'KPH_Customer_Stakeholder__c', customerStakeholderRole: 'KPH_Role__c' }),
      KPH_Linked_Strategy__c: strategyById.get(action.linkedStrategyId)?.strategy || '',
      KPH_Timing__c: `2026-11-${String(5 + index * 7).padStart(2, '0')}T00:00:00.000Z`,
    }));
    case 'KPH_Milestones_and_Engagements__c': return milestonesAndEngagements.map((milestone, index) => row(milestone.id, {
      ...mapped(milestone, peopleFields), KPH_Milestones_Engagements__c: milestone.milestone,
      KPH_Timing__c: `2026-11-${String(7 + index * 7).padStart(2, '0')}T00:00:00.000Z`,
      CreatedDate: '2026-10-20T14:00:00.000Z', LastModifiedDate: stamp,
      ...(index === 0 ? { KPH_Additional_Notes__c: initialMilestoneNotes, KPH_Additional_Notes_updated_date__c: updated } : {}),
    }));
    case 'KPH_Key_Wins_Key_Customer_Asks__c': return [
      row('preview-win-1', { RecordTypeId: '012VI00000GP7JeYAL', KPH_Key_Wins_Date__c: '2026-10-15', KPH_Key_Wins_Description__c: 'Secured a medical policy evidence-review meeting.', KPH_Key_Wins_Impact__c: 'Established a clear route to discuss updated coverage criteria.' }),
      row('preview-win-2', { RecordTypeId: '012VI00000GP7JeYAL', KPH_Key_Wins_Date__c: '2026-10-22', KPH_Key_Wins_Description__c: 'Aligned pharmacy and medical stakeholders on priority evidence needs.', KPH_Key_Wins_Impact__c: 'Reduced uncertainty ahead of the next formulary review.' }),
      row('preview-ask-1', { RecordTypeId: '012VI00000GP7JdYAL', KPH_Key_Customer_Asks_Stakeholder_Name__c: 'Alex Morgan', KPH_Key_Customer_Asks_Role__c: 'VP Pharmacy', KPH_Key_Customer_Asks_Description__c: 'Provide an updated payer-specific budget impact analysis before the November review.' }),
      row('preview-ask-2', { RecordTypeId: '012VI00000GP7JdYAL', KPH_Key_Customer_Asks_Stakeholder_Name__c: 'Jordan Lee', KPH_Key_Customer_Asks_Role__c: 'Medical Director', KPH_Key_Customer_Asks_Description__c: 'Arrange an evidence exchange on patient selection and site-of-care pathways.' }),
    ];
    case 'KPH_Stakeholder_Map__c': return [
      ['Alex Morgan', 'VP Pharmacy', 'alex.morgan@example.com', 'Formulary and pharmacy benefits', 'High', 'Strong'],
      ['Jordan Lee', 'Medical Director', 'jordan.lee@example.com', 'Medical policy and clinical evidence', 'High', 'Developing'],
      ['Taylor Smith', 'Director, Contracting', 'taylor.smith@example.com', 'Contracting and value-based partnerships', 'Medium', 'Developing'],
    ].map(([name, role, email, areas, influence, relationship], index) => row(`preview-stakeholder-${index + 1}`, {
      KPH_Name__c: name, KPH_Stakeholder_Role__c: role, KPH_Stakeholder_Email__c: email,
      KPH_Stakeholder_Decision_Areas__c: areas, KPH_Decision_Areas_Stakeholder_Influence__c: influence,
      KPH_Stakeholder_Relationship_Strength__c: relationship,
      KPH_Topics_Evidence_of_Interest_Notes__c: 'Interested in outcomes evidence, treatment pathways, and payer-specific economic impact.',
    }));
    case 'KPH_Account_Landscape__c': return [row('preview-landscape-1', {
      KPH_Network_Size__c: '30–80', KPH_Network_Porosity__c: '40–59%',
      KPH_Site_Inclusion_Criteria_Notes__c: 'Accredited centers with established cellular therapy programs and coordinated referral pathways.',
      KPH_Decision_making_bodies_Notes__c: 'The P&T committee reviews evidence with Medical Policy, Pharmacy, and Contracting leadership.',
      KPH_Review_Process_CG_T_Notes__c: 'Quarterly evidence reviews; submit updated clinical and economic materials six weeks before the committee meeting.',
      KPH_CAR_T_Reimbursement_notes__c: 'Case agreements support eligible treatment at contracted centers.',
      KPH_CAR_T_Pathway_notes__c: 'Referral pathways prioritize eligible patients and timely specialist evaluation.',
      KPH_CAR_T_Coverage_Policy_Mgmt_Notes__c: 'Prior authorization follows published eligibility criteria; updated policy review is planned.',
      KPH_Level_of_CAR_T_Focus_Expertise_Level__c: 'High', KPH_Lev_of_CAR_T_Focus_Expertise_Comment__c: 'Dedicated clinical and pharmacy leads oversee cellular therapy coverage.',
      KPH_Willingness_to_Partner_with_Kite__c: 'Medium', KPH_Willing_to_Partner_with_Kite_notes__c: 'Open to scientific exchange and evidence-focused working sessions.',
      KPH_Community_Expansion_Position__c: 'Controlled', KPH_Community_Expansion_Comments__c: 'Evaluating additional community referral partnerships.',
    })];
    default: return [];
  }
};
