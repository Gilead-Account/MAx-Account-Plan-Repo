import test from 'node:test';
import assert from 'node:assert/strict';
import { createFieldQueue } from '../src/lib/autosave/fieldQueue.js';

test('writes remain ordered when edits arrive during an in-flight save', async () => {
  const writes = [];
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  const queue = createFieldQueue({ save: async (key, value) => { if (value === 'old') await blocked; writes.push([key, value]); } });
  queue.change('field', 'old', true);
  await Promise.resolve();
  queue.change('field', 'new', true);
  queue.change('other', 'untouched draft', true);
  release();
  await queue.flush();
  assert.deepEqual(writes, [['field', 'old'], ['field', 'new'], ['other', 'untouched draft']]);
});
test('flush saves latest typed value without requiring blur; failed values can retry', async () => {
  const writes = [];
  let fail = true;
  const states = [];
  const queue = createFieldQueue({ save: async (key, value) => { if (fail) throw Error('Offline'); writes.push(value); }, onState: (key, state) => states.push(state) });
  queue.change('text', 'a');
  queue.change('text', 'latest');
  await queue.flush();
  assert.equal(states.at(-1), 'error');
  fail = false;
  await queue.flush();
  assert.deepEqual(writes, ['latest']);
  assert.equal(states.at(-1), 'saved');
});
test('typing pause triggers autosave without blur', async () => {
  let saved;
  const queue = createFieldQueue({ delay: 5, save: async (key, value) => { saved = value; } });
  queue.change('text', 'ipad input');
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(saved, 'ipad input');
});
