import test from 'node:test';
import assert from 'node:assert/strict';
import { sameCrmId, isCompletedRecord, activeRecordCount, groupBarrierRecords, groupBarrierStrategies } from '../src/lib/helper/barrierRecords.js';

test('completed and legacy closed records release capacity without changing CRM values', () => {
 const records = Array.from({ length: 5 }, (_, i) => ({ id: i, type: 'Barrier', status: 'Open' }));
 assert.equal(activeRecordCount(records, 'Barrier'), 5);
 records[0].status = 'Completed';
 assert.equal(activeRecordCount(records, 'Barrier'), 4);
 for (const status of ['Completed', 'Closed', 'complete', ' completed ']) assert.ok(isCompletedRecord({ status }));
 assert.equal(records[0].status, 'Completed');
 assert.equal(isCompletedRecord({ status: 'In Progress' }), false);
});
test('15/18-character lookups group every record without hiding broken links', () => {
 const id = 'a0CVE00009N3IzR', sid = 'a0SVE00009N3IzR';
 const hierarchy = [{ id: id + '2AV', strategies: [{ id: sid + '2AV' }] }];
 const records = [
  { id: 'b1', type: 'Barrier', objectiveId: id, strategyId: sid },
  { id: 'b2', type: 'Barrier', objectiveId: id, strategyId: 'unavailable' },
  { id: 'o1', type: 'Opportunity', objectiveId: 'unavailable' },
 ];
 const groups = groupBarrierRecords(hierarchy, records);
 assert.equal(groups.length, 2);
 assert.equal(groups.flatMap((g) => [...g.barriers, ...g.opportunities]).length, records.length);
 assert.equal(groupBarrierStrategies(groups[0]).flatMap((g) => g.records).length, 2);
 assert.ok(sameCrmId(id, id + '2AV'));
 assert.equal(sameCrmId('', ''), false);
});
