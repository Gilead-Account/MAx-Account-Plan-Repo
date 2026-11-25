import test from 'node:test';
import assert from 'node:assert/strict';
import { crmDateToday } from '../src/lib/helper/payerDates.js';

test('custom Date writes use calendar dates without time components', () => {
  assert.equal(crmDateToday(new Date(2026, 9, 12, 23, 59)), '2026-10-12');
  assert.equal(crmDateToday(new Date(2026, 0, 1, 0, 1)), '2026-01-01');
  assert.equal(crmDateToday(new Date(2024, 1, 29, 23, 59)), '2024-02-29');
  assert.throws(() => crmDateToday(new Date('invalid')), /Invalid date/);
});
