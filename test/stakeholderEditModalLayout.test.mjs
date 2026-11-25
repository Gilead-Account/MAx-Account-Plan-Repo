import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const modalPath = new URL('../src/pages/Stakeholders/StakeholderEditModal.jsx', import.meta.url);
test('stakeholder add and edit modal conditionally exposes Other Role for Role Other', async () => {
  const modalSource = await readFile(modalPath, 'utf8');
  const fieldsBlock = modalSource.match(/const IDENTITY_FIELDS = \[([\s\S]*?)\];/)?.[1] || '';

  assert.match(fieldsBlock, /key: 'name'[\s\S]*?key: 'role'/);
  assert.doesNotMatch(fieldsBlock, /key: '(?:stakeholderId|primaryParent)'/);
  assert.match(modalSource, /label: 'Other Role'[\s\S]*?key: 'otherRole'/);
  assert.match(modalSource, /isOtherStakeholderRole\(form\.role\)/);
  assert.match(modalSource, /Other Role is required when Role is Other\./);
  assert.match(modalSource, /required=\{field\.required\}/);
  assert.match(modalSource, /onSubmit=\{handleSave\}[\s\S]*?noValidate/);
  assert.doesNotMatch(modalSource, /DLBCL_FIELDS|MM_FIELDS|AccordionSection/);
  assert.match(modalSource, /\.\.\.\(stakeholder \|\| \{\}\)/);
});

test('stakeholder role picklist options are sorted alphabetically in the modal', async () => {
  const modalSource = await readFile(modalPath, 'utf8');

  assert.match(modalSource, /const sortAlphabetically = \(values\) =>/);
  assert.match(modalSource, /localeCompare\(String\(right\), undefined, \{ sensitivity: 'base' \}\)/);
  assert.match(modalSource, /const mergeSortedOptions = \(current, options\) => sortAlphabetically\(mergeOptions\(current, options\)\);/);
  assert.match(modalSource, /if \(field\.key === 'role'\) return mergeSortedOptions\(form\[field\.key\], roleOptions\);/);
});

test('stakeholder edit modal exposes field-level helper guidance', async () => {
  const modalSource = await readFile(modalPath, 'utf8');

  assert.match(modalSource, /FieldHelpButton/);
  assert.match(modalSource, /STAKEHOLDER_FIELD_HELP/);
  assert.match(modalSource, /Select the HCP who has influence on account decisions or patient flow/);
  assert.match(modalSource, /Identify the stakeholder's role within the account/);
  assert.match(modalSource, /Specify the stakeholder's role when Role is Other/);
});
