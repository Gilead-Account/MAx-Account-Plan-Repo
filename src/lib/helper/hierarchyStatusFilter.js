import { isCompleted } from './hierarchyCompletion.js';

export const hierarchyStatusGroup = (status) => isCompleted(status) ? 'Completed' : 'Open';
export const matchesHierarchyStatus = (item, filter) => filter === 'All' || hierarchyStatusGroup(item.status) === filter;
