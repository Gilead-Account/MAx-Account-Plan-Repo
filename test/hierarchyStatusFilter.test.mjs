import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesHierarchyStatus } from '../src/lib/helper/hierarchyStatusFilter.js';

test('column status filters group completed CRM variants and keep unfinished records open', () => {
  for (const status of ['Complete', 'Completed', 'Closed', 'completed']) {
    assert.equal(matchesHierarchyStatus({ status }, 'Completed'), true);
    assert.equal(matchesHierarchyStatus({ status }, 'Open'), false);
  }
  for (const status of ['Open', 'Pending', 'In Progress', '']) {
    assert.equal(matchesHierarchyStatus({ status }, 'Open'), true);
    assert.equal(matchesHierarchyStatus({ status }, 'Completed'), false);
  }
  for (const status of ['Open', 'Completed', 'Pending', '']) assert.equal(matchesHierarchyStatus({ status }, 'All'), true);
});
