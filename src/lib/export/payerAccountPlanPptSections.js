import { formatMilestoneTiming } from '../dataservice/accountPlan/payerMilestoneFields.js';
import { formatPayerDate } from '../helper/payerDates.js';
import { layoutPayerFields, layoutPayerTable } from './payerAccountPlanPptLayout.js';

const text = (value) => value === null || value === undefined || value === '' ? 'Not entered' : String(value);
const field = (title, value) => ({ title, body: text(value) });
const labeled = (entries) => entries.map(([label, value]) => `${label}: ${text(value)}`).join('\n');
const picklistLabel = (value, options = []) => options.find((option) => option.value === value)?.label || value;

export const paginatePayerBoxes = layoutPayerFields;
const compactField = (title, value) => ({ ...field(title, value), compact: true });
const column = (key, label, width) => ({ key, label, width });

export function buildPayerAccountPlanSlides(data) {
  const { account, summary, landscape, assessments, stakeholders, launch, hierarchy, actions, milestones, issues } = data;
  const archetype = summary.payerRestrictiveness;
  const selectedArchetype = archetype.options.find((option) => option.value === archetype.value) || { value: archetype.value };
  const objectiveNames = new Map(hierarchy.hierarchy.map((objective) => [objective.id, objective.objective]));
  const strategyNames = new Map(hierarchy.hierarchy.flatMap((objective) => objective.strategies.map((strategy) => [strategy.id, strategy.strategy])));
  const slides = [{ type: 'title', label: 'Payer Account Plan', fields: [
    { label: 'KAD Owner', value: account.kadOwner },
    { label: 'Marketplace', value: account.marketplace },
    { label: 'Payer EID', value: account.eid },
  ] }];
  const add = (title, boxes) => slides.push(...paginatePayerBoxes(title, boxes));
  const table = (title, columns, records, options) => slides.push(...layoutPayerTable(title, columns, records, options));
  slides.push(...layoutPayerFields('Executive Summary', [
    ...Object.entries({ geographicFootprint: 'Geographic Footprint', coveredLives: 'Covered Lives', ownershipAffiliation: 'Ownership & Affiliation', linesOfBusiness: 'Lines of Business' }).map(([key, label]) => field(label, summary.accountDetails[key]?.value)),
    field('Payer Archetype', selectedArchetype.label || archetype.value),
    field('Payer Archetype Definition', archetype.definition),
    ...Object.entries({ meetingRequestSent: 'AE Value Prop Meeting Request Sent', valuePropDelivered: 'Value Prop Delivered Within 90 Days' }).map(([key, label]) => field(label, picklistLabel(summary.anitoCelLaunch[key], summary.anitoCelLaunch.options[key]))),
  ], { executive: true }));
  table('Key Wins', [column('createdDate', 'Created Date', 1), column('updatedDate', 'Updated Date', 1), column('date', 'Key Wins Date', 1), column('description', 'Description', 4.3), column('impact', 'Impact', 4.3)], summary.keyWins.map((record) => ({ ...record, createdDate: formatPayerDate(record.createdDate), updatedDate: formatPayerDate(record.lastModifiedDate), date: formatPayerDate(record.date) })));
  table('Key Payer Asks', [column('created', 'Date Created', 1), column('updated', 'Updated', 1), column('stakeholder', 'Stakeholder', 2.2), column('description', 'Description', 7.4)], summary.customerAsks.map((record) => ({ ...record, created: formatPayerDate(record.dateCreated), updated: formatPayerDate(record.lastModifiedDate), stakeholder: labeled([['Name', record.stakeholderName], ['Role', record.stakeholderRole]]) })));
  add('Account Landscape', [
    ...Object.entries(landscape.networkDetails).filter(([, detail]) => detail.selection).map(([key, detail]) => compactField(key === 'networkModel' ? 'Network Size' : 'Site Inclusion Criteria', picklistLabel(detail.selection, detail.options))),
    compactField('Network Porosity', picklistLabel(landscape.networkPorosity, landscape.networkPorosityOptions)),
    compactField('Quality of Access Score', landscape.qualityOfAccessScore),
    ...Object.values(assessments.assessments).map((assessment) => compactField(assessment.title, picklistLabel(assessment.position, assessment.options))),
    ...Object.entries(landscape.networkDetails).map(([key, detail]) => field(key === 'networkModel' ? 'Network Size Notes' : 'Site Inclusion Criteria', detail.narrative)),
    field('Decision-making Bodies', landscape.decisionMakingBodies),
    field('Review Process for Cell & Gene Therapy', landscape.reviewProcess),
    ...Object.values(assessments.assessments).map((assessment) => field(`${assessment.title} — Comments`, assessment.comments)),
  ]);
  for (const [section, details] of Object.entries(landscape.policyDetails)) add(section, Object.entries(details).map(([label, detail]) => field(label, detail.value)));
  table('Stakeholder Map', [column('nameRole', 'Name / Role', 2.3), column('decisionInfluence', 'Decision Areas / Influence', 3.1), column('relationshipStrength', 'Relationship Strength', 1), column('topicsEvidence', 'Topics & Evidence of Interest', 5.2)], stakeholders.stakeholders.map((record) => ({ ...record, nameRole: labeled([['Name', record.name], ['Role / Function', record.roleFunction], ['Email', record.contactInformation]]), decisionInfluence: labeled([['Decision Areas', record.decisionAreas], ['Influence', record.influence]]) })), { preferredRowsPerSlide: 2, minimumFontSize: 7 });
  add('Launch Readiness Plan', [
    ...Object.entries({ medicalPolicyPublished: 'Medical Policy Published', payerValuePropDelivery: 'Payer Value Prop Delivery', anticipatedMedicalPolicyPublication: 'Anticipated to Publish Medical Policy', pieDeliveryStatus: 'PIE Delivery Status', riskAssessment: 'Risk Assessment for Delayed Coverage' }).map(([key, label]) => compactField(label, picklistLabel(launch.form[key], launch.options[key]))),
    ...Object.entries({ policyContextNotes: 'Policy Notes', driversForAdoption: 'Drivers for Anito-cel Adoption', anticipatedBarriers: 'Anticipated Barriers at Launch', evidenceForPillarDecision: 'Evidence to Support Payer Decision Making' }).map(([key, label]) => field(label, launch.form[key])),
  ]);
  const hierarchyRows = hierarchy.hierarchy.flatMap((objective, objectiveIndex) => {
    const parent = { objective: `Objective ${objectiveIndex + 1}\n${text(objective.objective)}`, objectiveStatus: objective.status };
    if (!objective.strategies.length) return [{ ...parent, strategy: 'No strategies', strategyStatus: '-', tactic: 'No tactics / resources', tacticStatus: '-' }];
    return objective.strategies.flatMap((strategy, strategyIndex) => {
      const branch = { ...parent, strategy: `Strategy ${strategyIndex + 1}\n${text(strategy.strategy)}`, strategyStatus: strategy.status };
      return strategy.tactics.length
        ? strategy.tactics.map((tactic, tacticIndex) => ({ ...branch, tactic: `Tactic / Resource ${tacticIndex + 1}\n${text(tactic.value)}`, tacticStatus: tactic.status }))
        : [{ ...branch, tactic: 'No tactics / resources', tacticStatus: '-' }];
    });
  });
  table('Objectives, Strategies & Tactics / Resources', [
    column('objective', 'Objective', 3.1), column('objectiveStatus', 'Objective Status', 0.9),
    column('strategy', 'Strategy', 3.1), column('strategyStatus', 'Strategy Status', 0.9),
    column('tactic', 'Tactic / Resource', 3.1), column('tacticStatus', 'Tactic / Resource Status', 0.9),
  ], hierarchyRows);
  const engagementColumns = [column('customer', 'Customer Stakeholder', 1.35), column('owner', 'Kite Owner (DRI)', 1.35), column('collaborator', 'Kite Collaborator', 1.35), column('timing', 'Timing', 1), column('status', 'Status', 0.9), column('nextSteps', 'Next Steps', 3.3)];
  const engagement = (record, options) => ({ ...record,
    customer: labeled([['Name', record.customerStakeholderName], ['Role', record.customerStakeholderRole]]),
    owner: labeled([['Name', record.kiteOwnerName], ['Role', record.kiteOwnerRole]]),
    collaborator: labeled([['Name', record.kiteCollaboratorName], ['Role', record.kiteCollaboratorRole]]),
    timing: formatMilestoneTiming(record.timing), status: picklistLabel(record.status, options),
  });
  table('Action & Critical Next Steps', [column('action', 'Action & Critical Next Steps', 2.7), ...engagementColumns], actions.actions.map((record) => engagement({ ...record, action: `${text(record.action)}\nLinked Strategy: ${text(record.linkedStrategyText || strategyNames.get(record.linkedStrategyId))}` }, actions.statusOptions)));
  table('Milestones & Engagements', [column('milestone', 'Milestones & Engagements', 2.7), ...engagementColumns], milestones.milestones.map((record) => engagement({ ...record, milestone: `${text(record.milestone)}\nCreated: ${formatPayerDate(record.createdDate)}\nUpdated: ${formatPayerDate(record.updatedDate)}` }, milestones.statusOptions)));
  add('Milestones & Engagements — Additional Notes', [field('Additional Notes', milestones.additionalNotes.value)]);
  for (const type of ['Barrier', 'Opportunity']) add(type === 'Barrier' ? 'Barriers' : 'Opportunities', issues.records.filter((record) => record.type === type).map((record) => field(record.name, labeled([
    ['Objective', objectiveNames.get(record.objectiveId)], ['Strategy', strategyNames.get(record.strategyId)], ['Status', record.status], ['Impact', record.impact], ['Details', record.details],
  ]))));
  return slides;
}
