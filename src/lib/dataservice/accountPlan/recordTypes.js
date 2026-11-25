import { hasVeevaRuntime } from '@/lib/dataservice/client';
import { runCrmQuery, unwrap } from '@/lib/dataservice/query';
import { resolveCrmEnvironment } from '@/lib/dataservice/crmEnvironment';

// Sources: record types.xlsx and user-supplied Key Wins object mappings.
// IDs without an explicit production label are sandbox only.
// Account Landscape is preserved as the workbook labels it; its object is not assumed.
export const SANDBOX_RECORD_TYPES = Object.freeze({
  networkPlan: ['Account_Plan_vod__c', 'Network Account Plan', '012VE0000081nTVYAY'],
  networkLandscape: [null, 'Network Account Plan', '012VE0000085KcbYAE'],
  sitePerformance: ['KPH_Site_Performance_Participation__c', 'Site Performance', '012VE0000080E9dYAE'],
  studyParticipation: ['KPH_Site_Performance_Participation__c', 'Study Participation', '012VE0000080EG5YAM'],
  contractStatus: ['KPH_Site_Performance_Participation__c', 'Contract Status', '012VE0000080EHhYAM'],
  keyTrends: ['KPH_Site_Performance_Participation__c', 'Key Trends', '012VE0000080ECrYAM'],
  nearTermExpansion: ['KPH_Site_Activation_Expansion_Plan__c', 'Near-Term Expansion Candidates', '012VE0000080rJ3YAI'],
  longerTermExpansion: ['KPH_Site_Activation_Expansion_Plan__c', 'Longer-Term Expansion Opportunities', '012VE0000080rNtYAI'],
  expansionCriteria: ['KPH_Site_Activation_Expansion_Plan__c', 'Criteria & Dependecies', '012VE0000080rPVYAY'],
  atcStakeholder: ['KPH_Stakeholder_Map__c', 'ATC Stakeholder', '012VE0000084t69YAA'],
  networkStakeholder: ['KPH_Stakeholder_Map__c', 'Network Stakeholder', '012VE0000084t4XYAQ'],
  payerStakeholder: ['KPH_Stakeholder_Map__c', 'Payer Stakeholder', '012VE0000084tFq'],
  networkBarrier: ['KPH_Payers_Barrier_Opportunities__c', 'Network Barrier', '012VE0000081kNZYAY'],
  networkOpportunity: ['KPH_Payers_Barrier_Opportunities__c', 'Network Opportunities', '012VE0000081kaTYAQ'],
  payerObjective: ['KPH_Account_Objective__c', 'Payer Account Objective', '012VE0000081kx3YAA'],
  networkObjective: ['KPH_Account_Objective__c', 'Network Account Objective', '012VE0000081kyfYAA'],
  payerStrategy: ['KPH_Strategy__c', 'Payer Strategy', '012VE0000081l0HYAQ'],
  networkStrategy: ['KPH_Strategy__c', 'Network Strategy', '012VE0000081l1tYAA'],
  payerTactic: ['KPH_Tactics_Resource__c', 'Payer Tactics & Resource', '012VE0000081kdhYAA'],
  networkTactic: ['KPH_Tactics_Resource__c', 'Network Tactics & Resource', '012VE0000081kfJYAQ'],
  payerAction: ['KPH_Actions_and_Critical_Next_Steps__c', 'Payer Actions & Critical', '012VE0000081kLxYAI'],
  networkAction: ['KPH_Actions_and_Critical_Next_Steps__c', 'Network Actions & Critical', '012VE0000081kc5YAA'],
  payerMilestone: ['KPH_Milestones_and_Engagements__c', 'Payer Milestone Engagement', '012VE0000081k93YAA'],
  networkMilestone: ['KPH_Milestones_and_Engagements__c', 'Network Milestone Engagement', '012VE0000081kCHYAY'],
  customerAsk: ['KPH_Key_Wins_Key_Customer_Asks__c', 'Key Customer Ask', '012VE000007qhzJYAQ'],
  networkCustomerAsk: ['KPH_Key_Wins_Key_Customer_Asks__c', 'Key Customer Asks Network', '012VE000007zKk9YAE'],
  keyWin: ['KPH_Key_Wins_Key_Customer_Asks__c', 'Key Wins', '012VE000007qhxhYAA'],
  networkKeyWin: ['KPH_Key_Wins_Key_Customer_Asks__c', 'Key Wins Network', '012VE000007zKSPYA2'],
  kltAsk: ['KPH_Key_Wins_Key_Customer_Asks__c', 'KLT Asks', '012VE000007zKnNYAU'],
});
const definitions = {
  ...SANDBOX_RECORD_TYPES,
  // These types are absent from the workbook; resolve names in the connected org.
  payerPlan: ['Account_Plan_vod__c', 'Payer Account Plan'],
  payerLandscape: ['KPH_Account_Landscape__c', 'Payer Account Landscape'],
  // Assignment screenshots confirm the unprefixed labels. Retain legacy
  // Payer developer names as explicit aliases, never Network names.
  payerBarrier: ['KPH_Payers_Barrier_Opportunities__c', 'Barrier', null, ['Payer Barrier']],
  payerOpportunity: ['KPH_Payers_Barrier_Opportunities__c', 'Opportunities', null, ['Payer Opportunities']],
};
const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^kph/, '').replace(/opportunities/g, 'opportunity').replace(/barriers/g, 'barrier');
const requests = new Map();
const metadataInFlight = new Map();
const readRecordTypes = (object) => {
  if (metadataInFlight.has(object)) return metadataInFlight.get(object);
  const request = runCrmQuery({ object: 'RecordType', fields: ['Id', 'Name', 'DeveloperName'], where: `SobjectType = '${object}' AND IsActive = true` })
    .then((rows) => rows.map(unwrap))
    .finally(() => metadataInFlight.delete(object));
  metadataInFlight.set(object, request);
  return request;
};
export const resolveRecordTypeId = (key) => {
  if (requests.has(key)) return requests.get(key);
  const request = (async () => {
    const definition = definitions[key];
    if (!definition?.[0]) throw new Error(`Record type ${key} requires a confirmed CRM object mapping.`);
    const [object, name, sandboxId, aliases = []] = definition;
    const matchesName = (row) => [row.Name, row.DeveloperName].some((value) =>
      [name, ...aliases].some((expected) => normalize(value) === normalize(expected)));
    const { environment } = await resolveCrmEnvironment();
    const rows = await readRecordTypes(object);
    const matches = rows.filter((row) => {
      if (!/^012[a-zA-Z0-9]{12}(?:[a-zA-Z0-9]{3})?$/.test(row?.Id || '')) return false;
      if (environment === 'sandbox' && sandboxId) {
        return row.Id.slice(0, 15) === sandboxId.slice(0, 15)
          && (!(row.Name || row.DeveloperName) || matchesName(row));
      }
      return matchesName(row);
    });
    const ids = [...new Map(matches.map((row) => [row.Id.slice(0, 15), row.Id])).values()];
    if (ids.length !== 1) {
      const expectedId = environment === 'sandbox' && sandboxId ? ` Expected sandbox ID: ${sandboxId}.` : '';
      const namedIds = rows.filter(matchesName).map((row) => row.Id).filter(Boolean);
      throw new Error(`Unable to resolve unique ${environment} record type: ${object} / ${name}.${expectedId} Active IDs matching this name: ${namedIds.join(', ') || 'none'}. Check active RecordType metadata and access.`);
    }
    return ids[0];
  })().catch((error) => { requests.delete(key); throw error; });
  requests.set(key, request);
  return request;
};

// Preview fixtures keep their existing identities. Live operations always resolve org metadata.
export const payerRecordTypeFields = async (key) => hasVeevaRuntime() ? { RecordTypeId: await resolveRecordTypeId(key) } : {};
export const payerRecordTypeWhere = async (key) => hasVeevaRuntime() ? ` AND RecordTypeId = '${await resolveRecordTypeId(key)}'` : '';
