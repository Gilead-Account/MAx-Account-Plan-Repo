const normalize = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const configuredValueMetadata = (value) => {
  const text = String(value || '').trim();
  const separatorIndex = text.lastIndexOf(' | ');
  if (separatorIndex < 0) return { label: '', indications: [] };
  const supportedIndications = new Set(['dlbcl', 'mm', 'portfolio']);
  const suffixValues = text
    .slice(separatorIndex + 3)
    .split(',')
    .map(normalize)
    .filter(Boolean);
  if (!suffixValues.length || !suffixValues.every((item) => supportedIndications.has(item))) {
    return { label: '', indications: [] };
  }
  return {
    label: text.slice(0, separatorIndex).trim(),
    indications: suffixValues,
  };
};

export const BARRIER_OPPORTUNITY_INDICATIONS = ['DLBCL', 'MM'];

export const MEDICAL_STRATEGY_LABELS_BY_INDICATION = {
  DLBCL: [
    'Win the CAR T Treatment Decision',
    'Drive earlier referral and CAR T Action',
    'Community Expansion',
    'Maximize Opportunities in Lymphoma and Leukemia pipeline',
  ],
  MM: [
    'Establish anito-cel as leading treatment option for patients with multiple myeloma',
    'MM Launch Preparedness',
    'Win the CAR T Treatment Decision',
    'Drive earlier referral and CAR T Action',
    'Community Expansion',
  ],
};

export const BARRIER_TITLE_LABELS_BY_INDICATION = {
  DLBCL: [
    'Yescarta AE profile is elevated compared to in- and out-of-class competitors',
    'Confidence/experience with AE management limited',
    'BsAbs are increasingly used in community practices delaying referral for CAR T',
    'Low volume of patient referrals for CAR T',
    'Low awareness of Tecartus 5-YR MCL survival data and optimal patient selection',
    'Limited knowledge on the Kite pipeline and emerging data with next generation constructs',
  ],
  MM: [
    'Highly competitive treatment landscape with many treatment options',
    'Confidence in AE management with community ATCs',
    'Limited clinical and patient management experience outside of clinical trials',
    'Decline in Referrals for CAR T due to increased treatment options (ex CELMoDs)',
    'BsAbs are increasingly used in community practices delaying referral for CAR T',
    'Potential gap in community patients awareness of CAR T as a treatment option for MM',
  ],
};

const SHARED_OPPORTUNITY_TITLE_LABELS = [
  'Potential Kite Clinical Trial Site',
  'Robust Internal Referrals',
  'Strong Community Network',
  'Interest to collaborate with Kite',
];

export const OPPORTUNITY_TITLE_LABELS_BY_INDICATION = {
  DLBCL: SHARED_OPPORTUNITY_TITLE_LABELS,
  MM: SHARED_OPPORTUNITY_TITLE_LABELS,
};

// Salesforce assigns Medical Tactic values at the Medical Tactic record-type
// level (Barrier versus Opportunities). These labels mirror that assignment;
// configuredPicklistOptions still requires an active matching CRM metadata
// value and returns the CRM API value rather than the label.
export const MEDICAL_TACTIC_LABELS_BY_PARENT_RECORD_TYPE_AND_INDICATION = {
  Barrier: {
    DLBCL: [
    'C4/C6, Z24 and RWE data review combined with staff training on AE Management',
    'Educate on 753 emerging data and potential promising safety profile',
    'Differentiate Kite manufacturing success from main competitor',
    'Reenforce OS, Kite commitment to safety (Observational Trial and Next Generation Pipeline)',
    'Identify opportunities for CAR T education, patient identification, Kite clinical trial awareness in the community',
    'Support recruitment to RESOLVE, Palisades 1 and Palisades 2',
    'Educate on axi-cel outpatient data, leverage OP and onboarding resource content',
    'Educate on Kite DLBCL pipeline and potential approval for HGBCL and 2L FL',
    'Educate on 5yr survival and BTKi naive data with Brexu-cel in MCL for RR patients',
    ],
    MM: [
    'Scientific engagement focus on efficacy, safety and manufacturing differentiation from in-class and out of class competitors',
    'Proactive and reactive MM/community education to ensure safe administration of anito-cel in the community',
    'Educate HCPs on the clinical and AE management of anito-cel (patient identification, infusion post-infusion monitoring)',
    'First Patient Experience Support',
    'Peer to peer connection through ATC network',
    'Educate on Anito-cel data and points of differentiation from CARVYKTI and out-of-class therapies',
    'Build patient and caregiver awareness of anito-cel as a differentiated CAR T option in 4L+ RRMM',
    'Discuss differentiation of BsAbs/ADCs/CelMods with one time treatment, lower infection rates and lower CRS/ICANS profile',
    ],
  },
  Driver: {
    // Salesforce currently assigns the same Opportunity tactics to both
    // supported indications. Keep separate arrays because Indication is a
    // controlling field and those assignments can diverge in CRM.
    DLBCL: [
      'Nominate site to clinical development',
      'Assess opportunities to present data/clinical updates to CAR T department',
      'Identify patient navigator at institution for opportunities to educate satellite/community',
      'Understand trial selection process and study start up process',
      'Identify community relationships/referral patterns at ATC',
      'Elevate awareness within Kite of institutions clinical/scientific expertise',
    ],
    MM: [
      'Nominate site to clinical development',
      'Assess opportunities to present data/clinical updates to CAR T department',
      'Identify patient navigator at institution for opportunities to educate satellite/community',
      'Understand trial selection process and study start up process',
      'Identify community relationships/referral patterns at ATC',
      'Elevate awareness within Kite of institutions clinical/scientific expertise',
    ],
  },
};

// The business rules are defined in terms of display labels, while Veeva must
// receive the underlying CRM/API picklist value on save. Resolve each approved
// label back to the value returned by CRM and retain the business-specified
// ordering. Values absent from CRM metadata are deliberately not offered.
export const configuredPicklistOptions = (
  values = [],
  labels = {},
  configuredLabels = [],
  indication = ''
) => {
  const indicationKey = normalize(indication);
  const valueByLabel = new Map();
  for (const value of values || []) {
    if (!value) continue;
    const encoded = configuredValueMetadata(value);
    if (
      indicationKey &&
      encoded.indications.length &&
      !encoded.indications.includes(indicationKey)
    ) {
      continue;
    }
    const displayLabel = labels?.[value] || value;
    const displayKey = normalize(displayLabel);
    const valueKey = normalize(value);
    const encodedLabelKey = normalize(encoded.label);
    if (displayKey && !valueByLabel.has(displayKey)) valueByLabel.set(displayKey, value);
    if (valueKey && !valueByLabel.has(valueKey)) valueByLabel.set(valueKey, value);
    if (encodedLabelKey && !valueByLabel.has(encodedLabelKey)) {
      valueByLabel.set(encodedLabelKey, value);
    }
  }

  const out = [];
  for (const configuredLabel of configuredLabels || []) {
    const value = valueByLabel.get(normalize(configuredLabel));
    if (value && !out.includes(value)) out.push(value);
  }
  return out;
};

export const configuredPicklistOptionsByIndication = (
  values = [],
  labels = {},
  configuredLabelsByIndication = {}
) => Object.fromEntries(
  Object.entries(configuredLabelsByIndication).map(([indication, configuredLabels]) => [
    indication,
    configuredPicklistOptions(values, labels, configuredLabels, indication),
  ])
);
