// Salesforce lookup values can use the 15-character form on mobile.
export const sameCrmId = (a, b) => Boolean(a && b) && (a === b || (/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(a) && /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(b) && a.slice(0, 15) === b.slice(0, 15)));
export const isCompletedRecord = (record) => ['completed', 'complete', 'closed'].includes(String(record.status || '').trim().toLowerCase());
export const activeRecordCount = (records, type) => records.filter((record) => record.type === type && !isCompletedRecord(record)).length;
export function groupBarrierRecords(hierarchy, records) {
  const groups = hierarchy.map((objective) => ({ ...objective,
    barriers: records.filter((record) => record.type === 'Barrier' && sameCrmId(record.objectiveId, objective.id)),
    opportunities: records.filter((record) => record.type === 'Opportunity' && sameCrmId(record.objectiveId, objective.id)),
  }));
  const unlinked = records.filter((record) => !hierarchy.some((objective) => sameCrmId(record.objectiveId, objective.id)));
  if (unlinked.length) groups.push({ id: 'unlinked-objective', objective: 'Objective link unavailable — edit to relink', strategies: [], barriers: unlinked.filter((r) => r.type === 'Barrier'), opportunities: unlinked.filter((r) => r.type === 'Opportunity') });
  return groups.filter((group) => group.barriers.length || group.opportunities.length);
}
export function groupBarrierStrategies(objective) {
  const groups = objective.strategies.map((strategy) => ({ strategy, records: objective.barriers.filter((record) => sameCrmId(record.strategyId, strategy.id)) })).filter((group) => group.records.length);
  const unlinked = objective.barriers.filter((record) => !objective.strategies.some((strategy) => sameCrmId(record.strategyId, strategy.id)));
  if (unlinked.length) groups.push({ strategy: { id: 'unlinked-strategy', strategy: 'Strategy link unavailable — edit to relink' }, records: unlinked });
  return groups;
}
