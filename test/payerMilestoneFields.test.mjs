import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { PAYER_MILESTONE_FIELD_MAP, payerMilestoneFromRow, payerMilestoneWriteFields, milestoneTimingInputValue, milestoneTimingCrmValue, milestoneTimingSaveValue, formatMilestoneTiming } from '../src/lib/dataservice/accountPlan/payerMilestoneFields.js';

test('milestone fields read system timestamps and exclude them from CRM writes', () => {
  const draft = { milestone: 'Discuss access', createdDate: '2026-10-08T12:30:00.000Z', updatedDate: '2026-10-09T15:45:00.000Z', customerStakeholderName: 'Customer', customerStakeholderRole: 'Director', kiteOwnerName: 'Owner', kiteOwnerRole: 'KAD', kiteCollaboratorName: 'Collaborator', kiteCollaboratorRole: 'Medical', timing: '2026-10-10T15:00:00Z', status: 'In Progress', nextSteps: 'Follow up', additionalNotes: 'Notes', additionalNotesUpdatedDate: '2026-10-09' };
  const fields = payerMilestoneWriteFields(draft);
  assert.equal(fields.KPH_Milestones_Engagements__c, draft.milestone);
  assert.equal(PAYER_MILESTONE_FIELD_MAP.createdDate, 'CreatedDate');
  assert.equal(PAYER_MILESTONE_FIELD_MAP.updatedDate, 'LastModifiedDate');
  assert.equal(Object.hasOwn(fields, 'CreatedDate'), false);
  assert.equal(Object.hasOwn(fields, 'LastModifiedDate'), false);
  assert.equal(fields.KPH_Customer_Stakeholder_Name__c, draft.customerStakeholderName);
  assert.equal(fields.KPH_Kite_Owner_DRI_Name__c, draft.kiteOwnerName);
  assert.equal(fields.KPH_Kite_Collaborator_Role__c, draft.kiteCollaboratorRole);
  assert.equal(fields.KPH_Timing__c, '2026-10-10T15:00:00.000Z');
  assert.equal(fields.KPH_Status__c, draft.status);
  assert.equal(fields.KPH_Additional_Notes_updated_date__c, draft.additionalNotesUpdatedDate);
  const loaded = payerMilestoneFromRow({ Id: 'milestone-1', ...fields, CreatedDate: draft.createdDate, LastModifiedDate: draft.updatedDate });
  for (const key of Object.keys(draft).filter((key) => key !== 'timing')) assert.equal(loaded[key], draft[key]);
  assert.equal(loaded.id, 'milestone-1');
  assert.equal(Object.keys(PAYER_MILESTONE_FIELD_MAP).length, 14);
  assert.equal(Object.hasOwn(payerMilestoneWriteFields({ milestone: 'Only title' }), 'KPH_Additional_Notes__c'), false);
});

test('field limits prevent oversized CRM writes', () => {
  assert.doesNotThrow(() => payerMilestoneWriteFields({ milestone: 'x'.repeat(500), customerStakeholderName: 'x'.repeat(250), nextSteps: 'x'.repeat(5000) }));
  for (const [key, length] of [['milestone', 501], ['customerStakeholderName', 251], ['kiteOwnerRole', 251], ['nextSteps', 5001], ['additionalNotes', 5001]]) {
    assert.throws(() => payerMilestoneWriteFields({ [key]: 'x'.repeat(length) }), /exceeds/);
  }
});

test('Timing uses calendar dates in inputs and displays while remaining compatible with CRM DateTime', () => {
  const iso = '2026-10-15T15:31:45.000Z';
  const input = milestoneTimingInputValue(iso);
  assert.equal(input, '2026-10-15');
  assert.equal(milestoneTimingCrmValue(input), '2026-10-15T00:00:00.000Z');
  assert.equal(milestoneTimingInputValue(milestoneTimingCrmValue(input)), input);
  assert.equal(formatMilestoneTiming(iso), 'Oct 15, 2026');
  assert.equal(formatMilestoneTiming('2026-10-15T00:00:00.000Z'), 'Oct 15, 2026');
  assert.equal(milestoneTimingSaveValue(input, iso), iso, 'unrelated edits preserve existing timestamps');
  assert.equal(milestoneTimingSaveValue('2026-10-16', iso), '2026-10-16T00:00:00.000Z');
  assert.equal(milestoneTimingInputValue(null), '');
  assert.equal(milestoneTimingCrmValue(''), null);
  assert.throws(() => milestoneTimingCrmValue('invalid'), /valid milestone/);
  assert.throws(() => milestoneTimingCrmValue('2026-02-30'), /valid milestone/);
  assert.equal(formatMilestoneTiming(null), '-');
});

test('date-only Timing keeps the same calendar day across device time zones and CRM Date objects', () => {
  const moduleUrl = new URL('../src/lib/dataservice/accountPlan/payerMilestoneFields.js', import.meta.url).href;
  const script = `
    import assert from 'node:assert/strict';
    import { milestoneTimingInputValue, milestoneTimingCrmValue, formatMilestoneTiming } from ${JSON.stringify(moduleUrl)};
    const stored = milestoneTimingCrmValue('2026-10-22');
    assert.equal(stored, '2026-10-22T00:00:00.000Z');
    for (const value of [stored, new Date(stored)]) {
      assert.equal(milestoneTimingInputValue(value), '2026-10-22');
      assert.equal(formatMilestoneTiming(value), 'Oct 22, 2026');
    }
  `;
  for (const timezone of ['America/Jamaica', 'America/Los_Angeles', 'Asia/Tokyo']) {
    execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ: timezone } });
  }
});
