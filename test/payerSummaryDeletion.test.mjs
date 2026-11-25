import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { crmWriteError } from '../src/lib/helper/crmWriteError.js';
const source = fs.readFileSync('src/lib/dataservice/accountPlan/payerExecutiveSummary.js','utf8');
const handler = source.slice(source.indexOf('export const deletePayerSummaryRecord')).replace('export const', 'const');
for (const kind of ['keyWin', 'customerAsk']) test(`${kind} deletion checks plan and record type and writes only the flag`, async () => {
 const writes = [], queries = [];
 let rows = [{Id:'win'}];
 const context = { crmWriteError, KEY_WINS_RECORD_TYPE_ID:'win-type', KEY_CUSTOMER_ASK_RECORD_TYPE_ID:'ask-type', PAYER_SUMMARY_CHILD_OBJECT:'summary',
 unwrap: (row) => row, isPayerDeleted: (row) => row.KPH_Is_Deleted__c === true,
 isOnline: () => false, toCanonicalSalesforceId: (id) => id,
 hasVeevaRuntime:()=>true, buildIdMatchWhere:(field,value)=>field+'='+value,
 runCrmQuery:async(q)=>{queries.push(q);return rows;},
 updateRecord:async(...args)=>writes.push(args) };
 context.assertPayerAccountPlanEditable = async () => {};
  context.payerRecordTypeWhere = async () => '';
 context.payerRecordTypeFields = async () => ({ RecordTypeId: 'resolved-type' });
 context.summaryType = async (key) => key === 'keyWin' ? 'win-type' : 'ask-type';
 vm.createContext(context);
 vm.runInContext(handler+'\nthis.remove = deletePayerSummaryRecord;', context);
 await context.remove('win','plan',kind);
 assert.ok(queries[0].where.includes('RecordTypeId=' + (kind === 'keyWin' ? 'win-type' : 'ask-type')));
 assert.match(queries[0].where,/KPH_Account_Plan__c=plan/);
 assert.deepEqual({...writes[0][2]},{KPH_Is_Deleted__c:true});
 rows=[];
 await assert.rejects(context.remove('win','other','customerAsk'),/does not belong/);
 assert.equal(writes.length,1);
});

for (const kind of ['keyWin', 'customerAsk']) for (const online of [true, false]) test(`${kind} deletion uses validated ${online ? 'desktop' : 'mobile'} ID`, async () => {
 const writes = [];
 const context = { crmWriteError,
 KEY_WINS_RECORD_TYPE_ID: 'win-type', KEY_CUSTOMER_ASK_RECORD_TYPE_ID: 'ask-type', PAYER_SUMMARY_CHILD_OBJECT: 'summary',
 hasVeevaRuntime: () => true, isOnline: () => online,
 unwrap: row => row, isPayerDeleted: row => row.KPH_Is_Deleted__c === true,
 toCanonicalSalesforceId: id => id === 'validated15char' ? 'canonical18char' : id,
 buildIdMatchWhere: (field, value) => field + '=' + value,
 runCrmQuery: async () => [{ Id: 'validated15char' }],
 updateRecord: async (...args) => writes.push(args),
 };
 context.assertPayerAccountPlanEditable = async () => {};
  context.payerRecordTypeWhere = async () => '';
 context.payerRecordTypeFields = async () => ({ RecordTypeId: 'resolved-type' });
 context.summaryType = async (key) => key === 'keyWin' ? 'win-type' : 'ask-type';
 vm.createContext(context);
 vm.runInContext(handler + '\nthis.remove = deletePayerSummaryRecord;', context);
 await context.remove('stale-ui-id', 'plan', kind);
 assert.equal(writes[0][1], online ? 'canonical18char' : 'validated15char');
});
for (const kind of ['keyWin', 'customerAsk']) for (const confirmed of [true, false, 'read-error']) test(`${kind} failed deletion response requires confirmation: ${confirmed}`, async () => {
 let reads = 0;
 const failure = new Error('NOT_FOUND');
 const context = { crmWriteError,
 KEY_WINS_RECORD_TYPE_ID: 'win-type', KEY_CUSTOMER_ASK_RECORD_TYPE_ID: 'ask-type', PAYER_SUMMARY_CHILD_OBJECT: 'summary',
 hasVeevaRuntime: () => true, isOnline: () => false,
 unwrap: row => row, isPayerDeleted: row => row.KPH_Is_Deleted__c === true,
 buildIdMatchWhere: (field, value) => field + '=' + value,
 runCrmQuery: async () => {
   reads++;
   if (reads > 1 && confirmed === 'read-error') throw new Error('read failed');
   return [{ Id: 'win', KPH_Is_Deleted__c: reads > 1 && confirmed === true }];
 },
 updateRecord: async () => { throw failure; },
 };
 context.assertPayerAccountPlanEditable = async () => {};
  context.payerRecordTypeWhere = async () => '';
 context.payerRecordTypeFields = async () => ({ RecordTypeId: 'resolved-type' });
 context.summaryType = async (key) => key === 'keyWin' ? 'win-type' : 'ask-type';
 vm.createContext(context);
 vm.runInContext(handler + '\nthis.remove = deletePayerSummaryRecord;', context);
 if (confirmed === true) await context.remove('win', 'plan', kind);
 else await assert.rejects(context.remove('win', 'plan', kind), error => error.message.includes('record win') && error.message.includes('NOT_FOUND'));
 assert.equal(reads, 2);
});

test('acknowledged summary deletions remove only the deleted row without a second summary query', () => {
 const page = fs.readFileSync('src/pages/ExecutiveSummary/index.jsx', 'utf8');
 for (const [name, end, setter] of [['deleteKeyWin', 'saveCustomerAsk', 'setKeyWins'], ['deleteCustomerAsk', 'updateAccountDetailValue', 'setCustomerAsks']]) {
   const block = page.slice(page.indexOf(`const ${name} =`), page.indexOf(`const ${end} =`));
   assert.doesNotMatch(block, /reloadSummary/);
   assert.ok(block.indexOf('await deletePayerSummaryRecord') < block.indexOf(setter));
   assert.match(block, /current\.filter/);
 }
});

for (const kind of ['keyWin', 'customerAsk']) for (const scenario of ['removed', 'moved', 'read-error', 'other-error']) test(`${kind} reconciles NOT_FOUND after removal: ${scenario}`, async () => {
 const queries = [], writes = [];
 const context = { crmWriteError,
 KEY_WINS_RECORD_TYPE_ID:'win-type', KEY_CUSTOMER_ASK_RECORD_TYPE_ID:'ask-type', PAYER_SUMMARY_CHILD_OBJECT:'summary',
 hasVeevaRuntime:()=>true, isOnline:()=>false, unwrap:row=>row,
 isPayerDeleted:row=>row.KPH_Is_Deleted__c===true,
 buildIdMatchWhere:(field,value)=>field+'='+value,
 runCrmQuery:async q=>{
  queries.push(q);
  if (queries.length===1) return [{Id:'win'}];
  if (queries.length===2) return [];
  if (scenario==='read-error') throw new Error('Read failed');
  return scenario==='moved' ? [{Id:'win',KPH_Is_Deleted__c:false}] : [];
 },
 updateRecord:async(...args)=>{writes.push(args);throw {body:{errorCode:scenario==='other-error'?'ACCESS_DENIED':'NOT_FOUND',message:'Request failed'}};},
 };
 context.assertPayerAccountPlanEditable = async () => {};
  context.payerRecordTypeWhere = async () => '';
 context.payerRecordTypeFields = async () => ({ RecordTypeId: 'resolved-type' });
 context.summaryType = async (key) => key === 'keyWin' ? 'win-type' : 'ask-type';
 vm.createContext(context);
 vm.runInContext(handler+'\nthis.remove=deletePayerSummaryRecord;',context);
 if(scenario==='removed') {
  const result=await context.remove('win','plan',kind);
  assert.equal(result.outcome,'no-longer-available');
 } else await assert.rejects(context.remove('win','plan',kind),/Request failed/);
 assert.equal(writes.length,1);
 if(scenario!=='other-error') assert.equal(queries[2].where,'Id=win');
});
