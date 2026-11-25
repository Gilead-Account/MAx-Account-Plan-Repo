import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { activeRecordCount, isCompletedRecord } from '../src/lib/helper/barrierRecords.js';
const source = fs.readFileSync('src/pages/BarriersRisks/index.jsx','utf8');
const handler = source.slice(source.indexOf('  const saveRecord ='), source.indexOf('  const editRecord ='));
function setup(records) {
 const state = { records, error: '', saves: 0 };
 const context = { records, activeRecordCount, isCompletedRecord, maxRecordsPerType: 5,
 setSaveError: (message) => { state.error = message; },
 setDraft: () => {},
 setRecords: async (update) => { state.records = update(state.records); state.saves++; return true; },
 };
 vm.createContext(context);
 vm.runInContext(handler + '\nthis.save = saveRecord;', context);
 return { state, save: context.save };
}
const rows = (type, count) => Array.from({length:count}, (_,i)=>({id:type+i,type,status:'Open'}));
for (const type of ['Barrier','Opportunity']) {
 test(type + ': five open blocks a sixth and reopening, but permits edits and completion', async () => {
  const records = [...rows('Barrier',5), ...rows('Opportunity',5), {id:'completed',type,status:'Completed'}];
  for (const record of [{type,status:'Open'}, {id:'completed',type,status:'Open'}]) {
   const {state,save}=setup(records);
   await save(record);
   assert.equal(state.saves,0);
   assert.match(state.error,/five/);
  }
  for (const status of ['Open','Completed']) {
   const {state,save}=setup(records);
   await save({...records.find(r=>r.type===type),status,name:'Edited'});
   assert.equal(state.saves,1);
  }
 });
 test(type + ': completing or deleting one permits another and other type does not consume capacity', async () => {
  const other=type==='Barrier'?'Opportunity':'Barrier';
  for (const extras of [[],[{id:'done',type,status:'Completed'}]]) {
   const {state,save}=setup([...rows(type,4), ...rows(other,5), ...extras]);
   await save({type,status:'Open'});
   assert.equal(state.saves,1);
   assert.equal(activeRecordCount(state.records,type),5);
   assert.equal(activeRecordCount(state.records,other),5);
  }
 });
}
