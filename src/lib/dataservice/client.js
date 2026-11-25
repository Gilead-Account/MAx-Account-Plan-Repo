// Veeva MyInsights runtime bridge.
//
// `window.Q` and `window.ds` are loaded as <script> tags in index.html
// from public/static/. iPad may finish initializing them after this module
// has been evaluated, so runtime access must remain dynamic.
//
// Only local Vite development uses the bundled mock adapter. Every packaged
// build uses Veeva's runtime DataService and fails closed when it is missing.

import {
  bindMockAccountPlanContext,
  mockAdapter,
} from '@/lib/mockData/mockAdapter';

const isDev = !!(import.meta && import.meta.env && import.meta.env.DEV);
const useMockData = isDev;
const getRuntimeDs = () =>
  typeof window !== 'undefined' && window.ds ? window.ds : null;
export const hasVeevaRuntime = () => !isDev && !!getRuntimeDs();

const missingRuntime = (method) => () =>
  Promise.reject(
    new Error(
      `Veeva DataService runtime unavailable: ${method} requires window.ds. ` +
        'Deploy this ZIP inside Veeva CRM MyInsights to load actual data.'
    )
  );

const missingRuntimeAdapter = {
  runQuery: missingRuntime('runQuery'),
  queryRecord: missingRuntime('queryRecord'),
  getDataForCurrentObject: missingRuntime('getDataForCurrentObject'),
  getPicklistValueLabels: missingRuntime('getPicklistValueLabels'),
  getObjectMetadata: missingRuntime('getObjectMetadata'),
  viewRecord: missingRuntime('viewRecord'),
  createRecord: missingRuntime('createRecord'),
  updateRecord: missingRuntime('updateRecord'),
  deleteRecord: missingRuntime('deleteRecord'),
};

export const $q = (typeof window !== 'undefined' && window.Q) || null;
const dynamicRuntimeAdapter = Object.fromEntries(
  Object.keys(missingRuntimeAdapter).map((method) => [
    method,
    (...args) => {
      const runtimeDs = getRuntimeDs();
      const implementation = runtimeDs && typeof runtimeDs[method] === 'function'
        ? runtimeDs[method].bind(runtimeDs)
        : missingRuntimeAdapter[method];
      return implementation(...args);
    },
  ])
);
export const ds = useMockData
  ? mockAdapter
  : dynamicRuntimeAdapter;
// Explicit read-only CRM channel for callers that must bypass local fixtures.
export const crmReadDs = Object.freeze({
  runQuery: (...args) => dynamicRuntimeAdapter.runQuery(...args),
  getDataForCurrentObject: (...args) => dynamicRuntimeAdapter.getDataForCurrentObject(...args),
  getPicklistValueLabels: (...args) => dynamicRuntimeAdapter.getPicklistValueLabels(...args),
});
// Deliberately narrow live-write channels. Feature code must opt in explicitly.
export const crmCreateDs = Object.freeze({
  createRecord: (...args) => dynamicRuntimeAdapter.createRecord(...args),
});
export const crmUpdateDs = Object.freeze({
  updateRecord: (...args) => dynamicRuntimeAdapter.updateRecord(...args),
});

export const isMockRuntime = useMockData;
export const isLocalPreview = isDev;
export const isHybridTrainingRuntime = () => false;
export const bindAccountPlanDataContext = (planId) =>
  useMockData ? bindMockAccountPlanContext(planId) : planId;

// True when running inside Veeva CRM's online hosted CDN (cdnhtml.salesforce.com).
// The offline iPad container hosts MyInsights from a local path, and a few
// VQL syntax differences (e.g. `{'a','b'}` vs `('a','b')`) hinge on this check.
// Mirrors `isOnline` in site_crm_v1/src/lib/helper/utils.js.
export const isOnline = () => {
  if (typeof window === 'undefined') return false;
  return /cdnhtml/i.test(window.location.hostname);
};
