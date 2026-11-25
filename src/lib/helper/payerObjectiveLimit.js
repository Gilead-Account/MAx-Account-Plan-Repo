import { isCompleted } from './hierarchyCompletion.js';

export const MAX_OPEN_OBJECTIVES = 3;
export const openObjectiveCount = (hierarchy) => hierarchy.filter((objective) => !isCompleted(objective.status)).length;
export const availableObjectiveSlots = (hierarchy) => Math.max(0, MAX_OPEN_OBJECTIVES - openObjectiveCount(hierarchy));

export function validateObjectiveLimit(previous, proposed) {
  const count = openObjectiveCount(proposed);
  if (count > MAX_OPEN_OBJECTIVES && count > openObjectiveCount(previous)) {
    const error = new Error('Only 3 open objectives are allowed at a time. Complete an open objective before adding or reopening another.');
    error.canCorrectDraft = true;
    throw error;
  }
}
