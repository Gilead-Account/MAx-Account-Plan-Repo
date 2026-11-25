import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { validateObjectiveLimit } from '../src/lib/helper/payerObjectiveLimit.js';
import { sameCrmId } from '../src/lib/helper/barrierRecords.js';
import { payerQueryFields, PAYER_ACTIVE_WHERE, isPayerDeleted } from '../src/lib/dataservice/accountPlan/payerMappedFields.js';
import { PAYER_OBJECTIVE_OBJECT as OBJECTIVE, PAYER_OBJECTIVE_TEXT_FIELDS as TEXT, PAYER_STRATEGY_OBJECT as STRATEGY, PAYER_TACTIC_OBJECT as TACTIC } from '../src/lib/dataservice/accountPlan/payerHierarchyFields.js';
const source = await readFile(new URL('../src/lib/dataservice/accountPlan/payerHierarchy.js', import.meta.url), 'utf8');
test('hierarchy queries request active objectives and omit deleted rows returned by the runtime', async () => {
 const context = {
  sameCrmId, payerQueryFields, PAYER_ACTIVE_WHERE, isPayerDeleted, OBJECTIVE, TEXT, STRATEGY, TACTIC,
  hasVeevaRuntime: () => true, resolvePayerAccountPlanId: async () => 'plan',
  buildIdMatchWhere: () => 'plan filter', unwrap: row => row, payerRecordTypeWhere: async () => '',
  runCrmQuery: async ({ object, fields, where }) => {
   assert.ok(fields.includes('KPH_Is_Deleted__c'));
   assert.ok(where.includes(PAYER_ACTIVE_WHERE));
   return object === OBJECTIVE ? [
    { Id: 'active', [TEXT[0]]: 'Keep' },
    ...[true, 'true', 1].map((flag, index) => ({ Id: `deleted-${index}`, [TEXT[0]]: 'Preserved title', KPH_Is_Deleted__c: flag })),
   ] : [];
  },
 };
 vm.createContext(context);
 vm.runInContext(source.replace(/^import .*;\n/gm, '').replace(/export async function/g, 'async function') + '\nthis.load = loadPayerHierarchy;', context);
 assert.deepEqual(Array.from((await context.load()).hierarchy, row => row.id), ['active']);
});
test('acknowledged strategy survives when a post-create query would fail', async () => {
 let created = false;
 const context = { sameCrmId, payerQueryFields, PAYER_ACTIVE_WHERE, isPayerDeleted, OBJECTIVE, TEXT, STRATEGY, TACTIC, structuredClone,
  isOnline: () => false, hasVeevaRuntime: () => true, resolvePayerAccountPlanId: async () => 'plan',
  buildIdMatchWhere: () => 'plan filter', unwrap: (row) => row,
  runCrmQuery: async ({object}) => {
   if (created) throw new Error('Mobile query temporarily unavailable');
   return object === OBJECTIVE ? [{Id:'objective', [TEXT[0]]:'Objective', KPH_Status__c:'Open'}] : [];
  },
  createCrmRecord: async (object, fields) => {
   assert.equal(object, STRATEGY);
   assert.equal(fields.KPH_Account_Objective__c, 'objective');
   created = true; return {data:{id:'saved-strategy'}};
  },
  updateRecord: async () => { throw new Error('Unexpected update'); },
 };
 context.validateObjectiveLimit = validateObjectiveLimit;
 context.assertPayerAccountPlanEditable = async () => {};
  context.payerRecordTypeWhere = async () => '';
 context.payerRecordTypeFields = async () => ({ RecordTypeId: 'resolved-type' });
 context.summaryType = async (key) => key === 'keyWin' ? 'win-type' : 'ask-type';
 vm.createContext(context);
 vm.runInContext(source.replace(/^import .*;\n/gm, '').replace(/export async function/g, 'async function') + '\nthis.save = savePayerHierarchy;', context);
 const previous = [{id:'objective', textField:TEXT[0], objective:'Objective', status:'Open', strategies:[]}];
 const proposed = structuredClone(previous);
 proposed[0].strategies.push({id:'draft', strategy:'New strategy', status:'Open', tactics:[]});
 const result = await context.save(previous, proposed);
 assert.equal(result.hierarchy[0].strategies[0].id, 'saved-strategy');
 assert.equal(result.hierarchy[0].strategies[0].strategy, 'New strategy');
 assert.equal(previous[0].strategies.length, 0);
});

for (const kind of ['objective', 'tactic']) for (const deleted of [true, false]) test(`${kind} delete response failure requires confirmed deletion: ${deleted}`, async () => {
 let attempted = false;
 const failure = new Error('NOT_FOUND');
 const context = { sameCrmId, payerQueryFields, PAYER_ACTIVE_WHERE, isPayerDeleted, OBJECTIVE, TEXT, STRATEGY, TACTIC, structuredClone,
  isOnline:()=>true,toCanonicalSalesforceId:(id)=>id===kind?`canonical-${kind}`:id,
  hasVeevaRuntime:()=>true,resolvePayerAccountPlanId:async()=>'plan',buildIdMatchWhere:(field,id)=>field+'='+id,unwrap:(row)=>row,
  runCrmQuery:async({object,where})=>{
   if(attempted) {assert.match(where,/KPH_Account_Plan__c=plan/);return [{Id:kind,KPH_Is_Deleted__c:deleted}];}
   if(object===OBJECTIVE)return [{Id:'objective',[TEXT[0]]:'Objective',KPH_Status__c:'Open'}];
   if(kind==='objective')return [];
   if(object===STRATEGY)return [{Id:'strategy',KPH_Account_Objective__c:'objective',KPH_Strategy_Title__c:'Strategy',KPH_Strategy_Status__c:'Open'}];
   return [{Id:'tactic',KPH_Strategy__c:'strategy',KPH_Tactics_and_Resources_Title__c:'Tactic',KPH_Tactic_Status__c:'Open'}];
  },
  createCrmRecord:async()=>{throw new Error('Unexpected create');},
  updateRecord:async(object,id,fields)=>{assert.equal(object,kind==='objective'?OBJECTIVE:TACTIC);assert.equal(id,`canonical-${kind}`);assert.deepEqual(Object.keys(fields),['KPH_Is_Deleted__c']);assert.equal(fields.KPH_Is_Deleted__c,true);attempted=true;throw failure;},
 };
 context.validateObjectiveLimit = validateObjectiveLimit;
 context.assertPayerAccountPlanEditable = async () => {};
  context.payerRecordTypeWhere = async () => '';
 context.payerRecordTypeFields = async () => ({ RecordTypeId: 'resolved-type' });
 context.summaryType = async (key) => key === 'keyWin' ? 'win-type' : 'ask-type';
 vm.createContext(context);
 vm.runInContext(source.replace(/^import .*;\n/gm, '').replace(/export async function/g, 'async function') + '\nthis.save=savePayerHierarchy;',context);
 const previous=[{id:'objective',objective:'Objective',status:'Open',strategies:kind==='objective'?[]:[{id:'strategy',strategy:'Strategy',status:'Open',tactics:[{id:'tactic',value:'Tactic',status:'Open'}]}]}];
 const next=kind==='objective'?[]:structuredClone(previous);if(kind==='tactic')next[0].strategies[0].tactics=[];
 if(deleted) {
  const result=await context.save(previous,next);
  assert.equal(kind==='objective'?result.hierarchy.length:result.hierarchy[0].strategies[0].tactics.length,0);
 }
 else await assert.rejects(context.save(previous,next),/NOT_FOUND/);
});

for (const partial of [false, true]) test(`validation preserves draft only before any successful writes: partial=${partial}`, async () => {
 const { crmWriteError } = await import('../src/lib/helper/crmWriteError.js');
 const context = { crmWriteError, sameCrmId, payerQueryFields, PAYER_ACTIVE_WHERE, isPayerDeleted, OBJECTIVE, TEXT, STRATEGY, TACTIC, structuredClone,
  isOnline:()=>false, hasVeevaRuntime:()=>true, resolvePayerAccountPlanId:async()=>'plan', buildIdMatchWhere:()=>'', unwrap:row=>row,
  runCrmQuery:async({object})=>object===OBJECTIVE?[{Id:'objective',[TEXT[0]]:'Objective',KPH_Status__c:'Open'}]:[],
  updateRecord:async()=>({}),
  createCrmRecord:async()=>{throw new Error('The strategy field value must be unique within the same Account Plan. FIELD_CUSTOM_VALIDATION_EXCEPTION');},
 };
 context.validateObjectiveLimit = validateObjectiveLimit;
 context.assertPayerAccountPlanEditable = async () => {};
  context.payerRecordTypeWhere = async () => '';
 context.payerRecordTypeFields = async () => ({ RecordTypeId: 'resolved-type' });
 context.summaryType = async (key) => key === 'keyWin' ? 'win-type' : 'ask-type';
 vm.createContext(context);
 vm.runInContext(source.replace(/^import .*;\n/gm, '').replace(/export async function/g, 'async function')+'\nthis.save=savePayerHierarchy;',context);
 const previous=[{id:'objective',objective:'Objective',status:'Open',strategies:[]}];
 const next=structuredClone(previous);
 if(partial) next[0].objective='Changed objective';
 next[0].strategies.push({id:'draft',strategy:'My draft strategy',status:'Open',tactics:[]});
 await assert.rejects(context.save(previous,next),error=>{
  assert.equal(error.canCorrectDraft,!partial);
  assert.match(error.message,/unique within the same Account Plan/);
  return true;
 });
 assert.equal(next[0].strategies[0].strategy,'My draft strategy');
});

for (const scenario of ['removed', 'moved', 'read-failed', 'permission']) test('missing tactic verification: ' + scenario, async () => {
 let attempted = false;
 const failure = new Error(scenario === 'permission' ? 'Permission denied' : 'NOT_FOUND');
 const crmWriteError = error => error;
 const context = { crmWriteError, sameCrmId, payerQueryFields, PAYER_ACTIVE_WHERE, isPayerDeleted, OBJECTIVE, TEXT, STRATEGY, TACTIC, structuredClone,
  isOnline:()=>true,toCanonicalSalesforceId:(id)=>id==='tactic'?'canonical-tactic':id,
  hasVeevaRuntime:()=>true,resolvePayerAccountPlanId:async()=>'plan',buildIdMatchWhere:(field,id)=>field+'='+id,unwrap:(row)=>row,
  runCrmQuery:async({object,where})=>{
   if(attempted) {
    if(where.includes('KPH_Account_Plan__c=plan')) return [];
    assert.equal(where, 'Id=tactic');
    if(scenario === 'read-failed') throw new Error('Read failed');
    return scenario === 'moved' ? [{Id:'tactic'}] : [];
   }
   if(object===OBJECTIVE)return [{Id:'objective',[TEXT[0]]:'Objective',KPH_Status__c:'Open'}];
   if(object===STRATEGY)return [{Id:'strategy',KPH_Account_Objective__c:'objective',KPH_Strategy_Title__c:'Strategy',KPH_Strategy_Status__c:'Open'}];
   return [{Id:'tactic',KPH_Strategy__c:'strategy',KPH_Tactics_and_Resources_Title__c:'Tactic',KPH_Tactic_Status__c:'Open'}];
  },
  createCrmRecord:async()=>{throw new Error('Unexpected create');},
  updateRecord:async(object,id,fields)=>{assert.equal(id,'canonical-tactic');assert.equal(fields.KPH_Is_Deleted__c,true);attempted=true;throw failure;},
 };
 context.validateObjectiveLimit = validateObjectiveLimit;
 context.assertPayerAccountPlanEditable = async () => {};
  context.payerRecordTypeWhere = async () => '';
 context.payerRecordTypeFields = async () => ({ RecordTypeId: 'resolved-type' });
 context.summaryType = async (key) => key === 'keyWin' ? 'win-type' : 'ask-type';
 vm.createContext(context);
 vm.runInContext(source.replace(/^import .*;\n/gm, '').replace(/export async function/g, 'async function') + '\nthis.save=savePayerHierarchy;',context);
 const previous=[{id:'objective',objective:'Objective',status:'Open',strategies:[{id:'strategy',strategy:'Strategy',status:'Open',tactics:[{id:'tactic',value:'Tactic',status:'Open'}]}]}];
 const next=structuredClone(previous);next[0].strategies[0].tactics=[];
 if(scenario === 'removed')assert.equal((await context.save(previous,next)).hierarchy[0].strategies[0].tactics.length,0);
 else await assert.rejects(context.save(previous,next),/NOT_FOUND|Permission denied/);
});

for (const partial of [false, true]) {
 test(`record type rejection retains a draft only before any successful writes: partial=${partial}`, async () => {
  const { crmWriteError } = await import('../src/lib/helper/crmWriteError.js');
  const recordTypeId = '012VE0000081kx3YAA';
  const creates = [];
  let updates = 0;
  const context = {
   crmWriteError, sameCrmId, payerQueryFields, PAYER_ACTIVE_WHERE, isPayerDeleted,
   OBJECTIVE, TEXT, STRATEGY, TACTIC, structuredClone, validateObjectiveLimit,
   hasVeevaRuntime: () => true, isOnline: () => false,
   resolvePayerAccountPlanId: async () => 'plan', assertPayerAccountPlanEditable: async () => {},
   buildIdMatchWhere: () => 'plan filter', unwrap: row => row,
   payerRecordTypeWhere: async () => ` AND RecordTypeId = '${recordTypeId}'`,
   payerRecordTypeFields: async () => ({ RecordTypeId: recordTypeId }),
   runCrmQuery: async ({ object }) => partial && object === OBJECTIVE
    ? [{ Id: 'existing', [TEXT[0]]: 'Existing objective', KPH_Status__c: 'Open' }] : [],
   updateRecord: async () => { updates++; },
   createCrmRecord: async (object, fields) => {
    creates.push({ object, fields });
    throw { data: { errors: [{
     errorCode: 'INVALID_CROSS_REFERENCE_KEY',
     message: `Record Type ID: this ID value isn't valid for the user: ${recordTypeId}`,
    }] } };
   },
  };
  vm.createContext(context);
  vm.runInContext(source.replace(/^import .*;\n/gm, '').replace(/export async function/g, 'async function') + '\nthis.save = savePayerHierarchy;', context);
  const previous = partial ? [{ id: 'existing', objective: 'Existing objective', status: 'Open', strategies: [] }] : [];
  const next = partial ? [{ ...previous[0], objective: 'Updated objective' }] : [];
  next.push({ id: 'draft', objective: 'My objective draft', status: 'Open', strategies: [] });
  await assert.rejects(context.save(previous, next), error => {
   assert.equal(error.canCorrectDraft, !partial);
   assert.match(error.message, /Salesforce administrator/);
   assert.match(error.message, /available to your user/);
   assert.ok(error.message.includes(recordTypeId));
   assert.match(error.message, /INVALID_CROSS_REFERENCE_KEY/);
   return true;
  });
  assert.equal(creates.length, 1, 'record type rejection must not trigger a fallback create');
  assert.equal(creates[0].fields.RecordTypeId, recordTypeId);
  assert.equal(updates, partial ? 1 : 0);
  assert.equal(next.at(-1).objective, 'My objective draft');
 });
}
