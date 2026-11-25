import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { sameCrmId } from '../src/lib/helper/barrierRecords.js';
const source = fs.readFileSync('src/lib/dataservice/accountPlan/payerStakeholders.js','utf8');
const handler = source.slice(source.indexOf('const requirePlanRecord'), source.indexOf('const persistPayerStakeholder'));
test('stakeholder validation accepts equivalent Salesforce IDs only within scoped results', async () => {
 const id='a0CVE00009N3IzR';
 const context={sameCrmId,isOnline:()=>false,readForPlan:async(plan)=>plan==='current'?[{Id:id+'2AV'}]:[]};
 vm.createContext(context);
 vm.runInContext(handler+'\nthis.check=requirePlanRecord;',context);
 assert.equal(await context.check('current',id),id+'2AV');
 await assert.rejects(context.check('other',id),/no longer available/);
 await assert.rejects(context.check('current','different'),/no longer available/);
});

test('desktop uses canonical Salesforce ID while iPad retains its local record ID', async () => {
 const id='a0CVE00009N3IzR';
 let online=true;
 const context={sameCrmId,isOnline:()=>online,toCanonicalSalesforceId:(value)=>value===id?id+'2AV':null,readForPlan:async()=>[{Id:id},{Id:'local-mobile-id'}]};
 vm.createContext(context);
 vm.runInContext(handler+'\nthis.check=requirePlanRecord;',context);
 assert.equal(await context.check('current',id),id+'2AV');
 online=false;
 assert.equal(await context.check('current',id),id);
 assert.equal(await context.check('current','local-mobile-id'),'local-mobile-id');
});

test('stakeholder save resolves a changed sync ID using mobile identity', async () => {
 const rows = [{Id:'new-server-id',Mobile_ID_vod__c:'mobile-123'}];
 const context={sameCrmId,isOnline:()=>false,readForPlan:async(plan)=>plan==='current'?rows:[]};
 vm.createContext(context);
 vm.runInContext(handler+'\nthis.check=requirePlanRecord;',context);
 assert.equal(await context.check('current','old-id','mobile-123'),'new-server-id');
 assert.equal(await context.check('current','mobile-123'),'new-server-id');
 await assert.rejects(context.check('other','old-id','mobile-123'),/no longer available/);
 await assert.rejects(context.check('current','old-id','different-mobile'),/no longer available/);
 rows.push({Id:'another-id',Mobile_ID_vod__c:'mobile-123'});
 await assert.rejects(context.check('current','old-id','mobile-123'),/Multiple stakeholders/);
});
