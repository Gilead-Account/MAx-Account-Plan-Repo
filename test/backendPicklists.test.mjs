import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('live picklist hook uses CRM API values and labels, with no mock fallback', async () => {
  const source = await readFile(new URL('../src/hooks/useCrmPicklist.js', import.meta.url), 'utf8');
  let options;
  const calls = [];
  const context = {
    useState: () => [[], (value) => { options = value; }],
    useEffect: (effect) => effect(),
    hasVeevaRuntime: () => true,
    getCrmPicklistValueLabels: async (...args) => { calls.push(args); return { NEW_API: 'New backend label' }; },
    getPicklistValueLabels: () => { throw Error('Mock fallback forbidden'); },
    payerPicklistOptions: (labels) => Object.entries(labels).map(([value, label]) => ({ value, label })),
    console,
  };
  vm.createContext(context);
  vm.runInContext(source.replace(/^import .*;\n/gm, '').replace('export default function', 'function') + "\nuseCrmPicklist('Object__c', 'Field__c');", context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, [['Object__c', 'Field__c']]);
  assert.deepEqual(options, [{ value: 'NEW_API', label: 'New backend label' }]);
});
