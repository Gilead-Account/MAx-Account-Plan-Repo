export const isCompleted = (status) => ['completed', 'closed', 'complete'].includes(String(status || '').toLowerCase());

const scopeFor = (hierarchy, draft) => {
  const objective = hierarchy.find((item) => item.id === (draft.kind === 'objective' ? draft.id : draft.objectiveId));
  const strategies = (objective?.strategies || []).filter((item) => draft.kind === 'objective' || item.id === draft.id);
  return { objective, strategies, ids: new Set(strategies.map((item) => item.id)) };
};
const linkedIssue = (record, draft, objective, ids) =>
  record.type === 'Opportunity'
    ? draft.kind === 'objective' && record.objectiveId === objective?.id
    : record.type === 'Barrier' && ids.has(record.strategyId);

export const completionDependencies = (hierarchy, records, draft) => {
  if (!draft.id || !['objective', 'strategy'].includes(draft.kind) || !isCompleted(draft.status)) return [];
  const { objective, strategies, ids } = scopeFor(hierarchy, draft);
  return [
    ...(draft.kind === 'objective' ? strategies.map((item) => ({ ...item, label: `Strategy: ${item.strategy}` })) : []),
    ...strategies.flatMap((strategy) => strategy.tactics.map((item) => ({ ...item, label: `Tactic / Resource: ${item.value}` }))),
    ...records.filter((item) => linkedIssue(item, draft, objective, ids)).map((item) => ({ ...item, label: `${item.type}: ${item.name}` })),
  ].filter((item) => !isCompleted(item.status));
};

export const completionValue = (options, kind) => {
  const matches = (options || []).filter((option) => !option.disabled && (isCompleted(option.label) || isCompleted(option.value)));
  if (matches.length !== 1) throw new Error('CRM must provide one unambiguous completion status for ' + kind + '. Complete linked records individually before continuing.');
  return matches[0].value;
};

export const completeDependencies = (hierarchy, records, draft, options = {}) => {
  const { objective, ids } = scopeFor(hierarchy, draft);
  return {
    hierarchy: hierarchy.map((item) => item.id !== objective?.id ? item : {
      ...item,
      strategies: item.strategies.map((strategy) => !ids.has(strategy.id) ? strategy : {
        ...strategy, status: isCompleted(strategy.status) ? strategy.status : completionValue(options.strategy, 'strategies'), tactics: strategy.tactics.map((tactic) => ({ ...tactic, status: isCompleted(tactic.status) ? tactic.status : completionValue(options.tactic, 'tactics') })),
      }),
    }),
    records: records.map((item) => linkedIssue(item, draft, objective, ids) ? { ...item, status: isCompleted(item.status) ? item.status : completionValue(options[item.type], item.type) } : item),
  };
};
