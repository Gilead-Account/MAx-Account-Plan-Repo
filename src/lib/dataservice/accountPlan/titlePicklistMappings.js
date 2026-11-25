import {
  configuredPicklistOptions,
  MEDICAL_TACTIC_LABELS_BY_PARENT_RECORD_TYPE_AND_INDICATION,
} from './barrierOpportunityPicklists.js';

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const CRM_MEDICAL_TACTIC_OPTIONS_BY_RECORD_TYPE_KEY = '__crmMedicalTacticOptionsByRecordType';

export const picklistInfoFromLabels = (source) => {
  const values = [];
  const labels = {};
  const add = (value, label) => {
    // Restricted picklists must be written with the exact API value returned
    // by CRM. Do not trim or collapse whitespace here: only the user-facing
    // label may be normalized for display and matching.
    const apiValue = value === null || value === undefined ? '' : String(value);
    if (!apiValue.trim()) return;
    if (!values.includes(apiValue)) values.push(apiValue);
    labels[apiValue] = clean(label) || apiValue.trim();
  };

  if (Array.isArray(source)) {
    for (const entry of source) {
      if (typeof entry === 'string') {
        add(entry, entry);
      } else if (entry && typeof entry === 'object') {
        if (entry.isActive === false || entry.active === false) continue;
        // Some runtime versions return both a display `value` and a distinct
        // API identifier. Restricted picklist writes must prefer that API
        // identifier; sending the display value produces INVALID_OR_NULL_FOR_
        // RESTRICTED_PICKLIST even when the option looks correct in the UI.
        const value = entry.apiValue || entry.apiName || entry.name || entry.value || entry.label;
        add(value, entry.label || entry.displayLabel || entry.translatedLabel || entry.value || value);
      }
    }
  } else if (source && typeof source === 'object') {
    for (const [value, label] of Object.entries(source)) add(value, label);
  }

  return { values, labels };
};

export const labelForPicklistValue = (labels, value) =>
  (value && labels?.[value]) || value || '';

const dependencyOptionsForIndication = (optionsByIndication, indication) => {
  if (!optionsByIndication || typeof optionsByIndication !== 'object') return null;
  const normalized = clean(indication).toUpperCase();
  const key = Object.keys(optionsByIndication).find(
    (candidate) => clean(candidate).toUpperCase() === normalized
  );
  // A missing controller key means Veeva supplied only a partial dependency
  // matrix. Fall back to the approved active CRM values for that indication.
  // Preserve an explicitly present empty array as authoritative "no values".
  return key ? optionsByIndication[key] : null;
};

export const buildMedicalTacticOptionsByParentTitle = (
  values = [],
  labels = {},
  dependencyOptionsByIndication = null
) => {
  const optionsByRecordTypeAndIndication = Object.fromEntries(
    Object.entries(MEDICAL_TACTIC_LABELS_BY_PARENT_RECORD_TYPE_AND_INDICATION).map(
      ([type, configuredLabelsByIndication]) => [
        type,
        Object.fromEntries(
          Object.entries(configuredLabelsByIndication).map(([indication, configuredLabels]) => {
            const configured = configuredPicklistOptions(values, labels, configuredLabels, indication);
            const dependent = dependencyOptionsForIndication(
              dependencyOptionsByIndication,
              indication
            );
            const allowed = dependent === null ? configured : configured.filter(
              (value) => dependent.includes(value)
            );
            return [indication, allowed];
          })
        ),
      ]
    )
  );
  return {
    [CRM_MEDICAL_TACTIC_OPTIONS_BY_RECORD_TYPE_KEY]: optionsByRecordTypeAndIndication,
  };
};

export const medicalTacticOptionsForParent = (
  parent,
  optionsByParentTitle = {},
  currentValue = ''
) => {
  if (!parent) return [];
  const type = String(parent.type || '').trim().toLowerCase() === 'driver'
    ? 'Driver'
    : 'Barrier';
  const indication = clean(parent.indication).toUpperCase();
  if (!indication) return [];
  return optionsByParentTitle?.[CRM_MEDICAL_TACTIC_OPTIONS_BY_RECORD_TYPE_KEY]?.[type]?.[indication] || [];
};
