import test from 'node:test';
import assert from 'node:assert/strict';
import { crmWriteError } from '../src/lib/helper/crmWriteError.js';
test('nested Salesforce reason survives generic Veeva wrapper', () => {
  const error = { message: 'An error occurred while trying to update the record. Please try again.', data: { errors: [{ errorCode: 'REQUIRED_FIELD_MISSING', message: 'Required fields are missing: [Name]' }] } };
  const message = crmWriteError(error, 'Create stakeholder').message;
  assert.match(message, /REQUIRED_FIELD_MISSING/);
  assert.match(message, /Required fields are missing: \[Name\]/);
});
test('generic rejection is identified without claiming a cause', () => {
  assert.match(crmWriteError({}, 'Create stakeholder').message, /without a detailed reason/);
});

test('iPad query errors without a top-level message retain field and code', () => {
  const error = { data: { message: 'getFieldLabel called with field that cannot be accessed: KPH_Test__c', code: 21 } };
  assert.match(crmWriteError(error, 'Load linked CRM records').message, /KPH_Test__c/);
});
