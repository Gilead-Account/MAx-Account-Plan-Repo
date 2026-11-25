import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { missingRequiredFields, validateModalSubmit } from '../src/lib/helper/modalRequiredFields.js';

const control = (overrides = {}) => ({
  required: true, willValidate: true, type: 'text', value: 'Complete',
  validity: { valueMissing: false }, ...overrides,
});

test('missing required controls block saving, including blank text and unselected choices', () => {
  for (const field of [
    control({ value: '', validity: { valueMissing: true } }),
    control({ value: '  \n ' }),
    control({ type: 'textarea', value: '\t' }),
    control({ type: 'select-one', value: '', validity: { valueMissing: true } }),
    control({ type: 'date', value: '', validity: { valueMissing: true } }),
    control({ type: 'checkbox', value: 'on', validity: { valueMissing: true } }),
  ]) {
    let prevented = false;
    const event = {
      currentTarget: { elements: [field], reportValidity: () => { throw new Error('Required prompt should replace the browser popup'); } },
      preventDefault: () => { prevented = true; },
    };
    assert.equal(validateModalSubmit(event), false);
    assert.equal(prevented, true);
  }
});

test('optional, disabled and read-only fields do not block saving', () => {
  const form = { elements: [
    control({ required: false, value: '' }),
    control({ willValidate: false, value: '', validity: { valueMissing: true } }),
    control({ type: 'checkbox', value: 'on' }),
    control({ type: 'file', value: '' }),
  ], reportValidity: () => true };
  assert.equal(missingRequiredFields(form).length, 0);
  assert.equal(validateModalSubmit({ currentTarget: form }), true);
});

test('completing the required fields allows saving; other native validation remains active', () => {
  const field = control({ value: '' });
  const form = { elements: [field], reportValidity: () => true };
  const event = { currentTarget: form, preventDefault() {} };
  assert.equal(validateModalSubmit(event), false);
  field.value = 'Completed';
  assert.equal(validateModalSubmit(event), true);
  form.reportValidity = () => false;
  assert.equal(validateModalSubmit(event), false);
});

test('every modal form uses the shared required-field prompt', async () => {
  async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = new URL(entry.name, directory);
      if (entry.isDirectory()) await inspect(new URL(`${entry.name}/`, directory));
      else if (entry.name.endsWith('.jsx') && entry.name !== 'ModalForm.jsx') {
        assert.doesNotMatch(await readFile(path, 'utf8'), /<form\b/, `${path.pathname} must use ModalForm`);
      }
    }
  }
  await inspect(new URL('../src/', import.meta.url));
});
