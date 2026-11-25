// Cross-Functional Plan of Action page composer.
//
// Display of the active DLBCL POA long-text fields living directly on
// Account_Plan_vod__c. MM POA fields are not queried while their cards are
// hidden from the view.

import {
  createSalesforceIdLookup,
  fetchBarriersAndDrivers,
  fetchCriticalActivities,
  fetchTeamMembersByPlan,
  getSalesforceIdLookupEntry,
  getCurrentUserId,
  getCurrentUserProfileName,
  isOpenBarrierDriverStatus,
  POA_CONTEXT_FIELDS,
  requireCurrentAccountPlanId,
  resolveShellContextForPlanId,
  toBarrierDriver,
  toPoaBlocks,
  updatePoaField,
} from '@/lib/dataservice/accountPlan/shared';

const idsMatch = (a, b) => {
  const left = String(a || '').trim();
  const right = String(b || '').trim();
  if (!left || !right) return false;
  return left === right || left.slice(0, 15) === right.slice(0, 15);
};

const OPEN_MEDICAL_TACTIC_STATUSES = new Set(['Open', 'Planned', 'In Progress']);

export const buildMedicalPoaOpportunities = (barrierResult, activities = []) => {
  const rows = barrierResult?.rows || [];
  const access = barrierResult?.access;
  const opportunities = rows
    .map((row) => toBarrierDriver(row, access))
    .filter(Boolean)
    .filter((record) => record.type === 'Driver' && isOpenBarrierDriverStatus(record.status));
  const opportunityById = createSalesforceIdLookup(opportunities);
  const tacticsByOpportunityId = new Map();

  for (const tactic of activities || []) {
    if (
      !tactic ||
      tactic.isDeactivated === true ||
      !OPEN_MEDICAL_TACTIC_STATUSES.has(tactic.status)
    ) continue;
    const parent = getSalesforceIdLookupEntry(opportunityById, tactic.barrierDriverId);
    if (!parent) continue;
    const current = tacticsByOpportunityId.get(parent.id) || [];
    current.push({
      id: tactic.id,
      name: tactic.name || 'Untitled Medical Tactic',
      status: tactic.status || 'Planned',
      dueDate: tactic.dueDate || null,
    });
    tacticsByOpportunityId.set(parent.id, current);
  }

  return opportunities.map((opportunity) => ({
    id: opportunity.id,
    name: opportunity.name || 'Untitled Opportunity',
    status: opportunity.status || 'Open',
    indication: opportunity.indication || '',
    medicalTactics: tacticsByOpportunityId.get(opportunity.id) || [],
  }));
};

const loadCurrentPoaUser = async (planId) => {
  const [currentUserId, profileName] = await Promise.all([
    getCurrentUserId(),
    getCurrentUserProfileName(),
  ]);
  if (!currentUserId && !profileName) return null;

  const teamMembers = currentUserId ? await fetchTeamMembersByPlan(planId) : [];
  const teamMember =
    teamMembers.find((member) => member.isPrimary && idsMatch(member.userId, currentUserId)) ||
    teamMembers.find((member) => idsMatch(member.userId, currentUserId));

  return {
    id: currentUserId,
    teamMemberId: teamMember ? teamMember.id : null,
    name: teamMember ? teamMember.name : null,
    role: teamMember ? teamMember.role : null,
    functionName: teamMember ? teamMember.functionName : null,
    profileName,
    participation: teamMember ? teamMember.participation : null,
  };
};

export const loadCrossFunctionalPlan = async () => {
  const planContextId = await requireCurrentAccountPlanId();
  const [shellContext, currentUser, barrierResult, activities] = await Promise.all([
    resolveShellContextForPlanId(planContextId, { planFields: POA_CONTEXT_FIELDS }),
    loadCurrentPoaUser(planContextId),
    fetchBarriersAndDrivers(planContextId),
    fetchCriticalActivities(planContextId),
  ]);
  const { planId, plan, account } = shellContext;
  const { lastModifiedDate, blocks } = toPoaBlocks(shellContext.planRow);

  return {
    planId,
    plan,
    account,
    poaLastModifiedDate: lastModifiedDate,
    blocks,
    currentUser,
    medicalPoaOpportunities: buildMedicalPoaOpportunities(barrierResult, activities),
  };
};

export const savePoaBlock = (planId, block, value) =>
  updatePoaField(planId, block && block.field, value);
