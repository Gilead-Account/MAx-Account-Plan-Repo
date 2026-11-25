import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('milestones persist against confirmed plan lookup, with shared notes and CRM timestamps', async () => {
  const storage = new Map();
  const oldWindow = globalThis.window;
  globalThis.window = { location: { search: '', hostname: 'localhost' }, localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) } };
  let server;
  try {
    server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
    const service = await server.ssrLoadModule('/src/lib/dataservice/accountPlan/payerMilestones.js');
    const mapping = await server.ssrLoadModule('/src/lib/dataservice/accountPlan/payerMilestoneFields.js');
    const query = await server.ssrLoadModule('/src/lib/dataservice/query.js');
    const object = mapping.PAYER_MILESTONE_OBJECT;
    const fields = mapping.PAYER_MILESTONE_FIELD_MAP;
    const dateRows = [
      { Id: 'older', [fields.additionalNotes]: 'Old notes', [fields.additionalNotesUpdatedDate]: new Date(2026, 9, 7), LastModifiedDate: new Date(2026, 9, 7, 15) },
      { Id: 'latest', [fields.additionalNotes]: 'Latest notes', [fields.additionalNotesUpdatedDate]: new Date(2026, 9, 12), LastModifiedDate: new Date(2026, 9, 12, 15) },
    ];
    assert.equal(service.sharedNotesRow(dateRows).Id, 'latest', 'CRM Date objects must sort chronologically rather than by weekday');
    assert.equal(service.sharedNotesRow([{ ...dateRows[1], Id: 'clear', [fields.additionalNotes]: '', LastModifiedDate: new Date(2026, 9, 12, 16) }, dateRows[1]]).Id, 'clear', 'an explicit newer clearing of notes remains authoritative');
    const initial = await service.loadPayerMilestones();
    assert.equal(initial.milestones.length, 0);
    assert.equal(service.PAYER_MILESTONE_PLAN_FIELD, 'KPH_Account_Plan__c');
    assert.ok(initial.statusOptions.some((option) => option.value === 'In Progress'));
    const draft = { milestone: 'Evidence meeting', customerStakeholderName: 'Customer', customerStakeholderRole: 'Director', kiteOwnerName: 'Owner', kiteOwnerRole: 'KAD', kiteCollaboratorName: 'Collaborator', kiteCollaboratorRole: 'Medical', timing: '2026-10-20', status: 'In Progress', nextSteps: 'Send agenda', additionalNotes: 'Private meeting notes' };
    await service.savePayerMilestone(draft);
    const created = (await service.loadPayerMilestones()).milestones[0];
    assert.ok(created.id);
    assert.match(created.createdDate, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(created.updatedDate, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(created.additionalNotes, '', 'milestone writes must not save shared notes');
    await service.savePayerMilestoneNotes('Shared plan notes');
    assert.equal((await service.loadPayerMilestones()).additionalNotes.value, 'Shared plan notes');
    assert.equal(created.timing, '2026-10-20T00:00:00.000Z');
    await query.updateRecord(object, created.id, { [fields.createdDate]: '2020-01-01T12:30:00.000Z', [fields.additionalNotesUpdatedDate]: '2020-01-03' });
    await service.savePayerMilestone({ ...created, createdDate: '1999-01-01T00:00:00.000Z', updatedDate: '1999-01-02T00:00:00.000Z', nextSteps: 'Revised agenda' });
    const edited = (await service.loadPayerMilestones()).milestones[0];
    assert.equal(edited.createdDate, '2020-01-01T12:30:00.000Z');
    assert.match(edited.updatedDate, /^\d{4}-\d{2}-\d{2}T/);
    assert.notEqual(edited.updatedDate, '1999-01-02T00:00:00.000Z');
    assert.equal(edited.additionalNotesUpdatedDate, '2020-01-03');
    await service.savePayerMilestone({ ...edited, additionalNotes: 'Changed notes' });
    const notesChanged = (await service.loadPayerMilestones()).milestones[0];
    assert.equal(notesChanged.additionalNotesUpdatedDate, '2020-01-03');
    assert.equal(notesChanged.additionalNotes, '', 'milestone edits must not overwrite shared notes');
    await service.savePayerMilestoneNotes('Updated shared notes');
    assert.equal((await service.loadPayerMilestones()).additionalNotes.value, 'Updated shared notes');
    await assert.rejects(service.savePayerMilestone({ ...draft, id: 'another-plan' }), /does not belong/);
    await assert.rejects(service.deletePayerMilestone('another-plan'), /no longer available/);
    await assert.rejects(service.savePayerMilestone({ ...draft, milestone: 'x'.repeat(501) }), /exceeds/);
    await query.createRecord(object, { KPH_Account_Plan__c: 'other-plan', [fields.milestone]: 'Hidden other plan milestone' });
    assert.equal((await service.loadPayerMilestones()).milestones.length, 1);
    await service.deletePayerMilestone(created.id);
    assert.equal((await service.loadPayerMilestones()).milestones.length, 0);
    assert.equal((await service.loadPayerMilestones()).additionalNotes.value, 'Updated shared notes');
    await service.savePayerMilestoneNotes('');
    assert.equal((await service.loadPayerMilestones()).additionalNotes.value, '');
  } finally {
    await server?.close();
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
  }
});
