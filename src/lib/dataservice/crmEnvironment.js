import { hasVeevaRuntime } from '@/lib/dataservice/client';
import { runCrmQuery, unwrap } from '@/lib/dataservice/query';

let environmentPromise;

// Vite's production build mode describes packaging, never the Salesforce org.
export const resolveCrmEnvironment = () => {
  if (!hasVeevaRuntime()) return Promise.resolve({ environment: 'sandbox', source: 'local-preview' });
  if (environmentPromise) return environmentPromise;
  environmentPromise = (async () => {
    const configured = String(import.meta.env.VITE_CRM_ENVIRONMENT || '').trim().toLowerCase();
    if (configured && !['sandbox', 'production'].includes(configured)) {
      throw new Error('VITE_CRM_ENVIRONMENT must be sandbox or production.');
    }
    let detected;
    try {
      const rows = await runCrmQuery({ object: 'Organization', fields: ['Id', 'IsSandbox'], limit: 1 });
      const value = rows.length === 1 ? unwrap(rows[0])?.IsSandbox : undefined;
      if (value === true || value === 'true') detected = 'sandbox';
      if (value === false || value === 'false') detected = 'production';
    } catch { /* Offline org metadata may be unavailable. Use explicit config/default. */ }
    if (configured && detected && configured !== detected) {
      throw new Error(`CRM environment mismatch: configured ${configured}, connected org is ${detected}.`);
    }
    return Object.freeze({ environment: detected || configured || 'sandbox', source: detected ? 'Organization.IsSandbox' : configured ? 'configuration' : 'sandbox-default' });
  })().catch((error) => { environmentPromise = null; throw error; });
  return environmentPromise;
};
