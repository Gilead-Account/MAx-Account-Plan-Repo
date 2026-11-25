import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const readSource = (file) => readFileSync(new URL(`../../src/lib/dataservice/${file}`, import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '').replace(/export const /g, 'const ');
const environmentSource = readSource('crmEnvironment.js').replace('import.meta.env.VITE_CRM_ENVIRONMENT', 'configuredEnvironment');
const recordTypeSource = readSource('accountPlan/recordTypes.js');
export function installRecordTypes(context, { configured = '', isSandbox = true } = {}) {
  const query = context.runCrmQuery;
  context.configuredEnvironment = configured;
  context.runCrmQuery = (params) => params.object === 'Organization'
    ? Promise.resolve(isSandbox == null ? [] : [{ Id: 'org', IsSandbox: isSandbox }])
    : query(params);
  vm.runInContext('(function () {\n' + environmentSource + '\n' + recordTypeSource + '\nthis.resolveRecordTypeId = resolveRecordTypeId; this.resolveCrmEnvironment = resolveCrmEnvironment; this.payerRecordTypeFields = payerRecordTypeFields; this.payerRecordTypeWhere = payerRecordTypeWhere; }).call(this);', context);
}
