import CharacterUsage from '@/components/CharacterUsage';
import { notifySaved } from '@/lib/helper/successNotice';
import { crmDateToday } from '@/lib/helper/payerDates';
import useCrmPicklist from '@/hooks/useCrmPicklist';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FieldHelpButton } from '@/components/EditModalField';
import { Icon } from '@/components/MarketAccessUi';
import Payer360Badge from '@/components/Payer360Badge';
import {
  LANDSCAPE_POLICY_FIELD_CONFIG,
  LANDSCAPE_OVERVIEW_TEXT_LIMIT,
  loadPayerAccountLandscape,
  NETWORK_LANDSCAPE_CONFIG,
  savePayerAccountLandscapeFields,
} from '@/lib/dataservice/accountPlan/payerAccountLandscape';
import { emptyPayerAssessments, loadPayerAssessments, savePayerAssessment } from '@/lib/dataservice/accountPlan/payerAssessments';
import { formatDate } from '@/lib/helper/utils';

const LANDSCAPE_TEXT_LIMIT = 5000;
const decisionSections = [
  { key: 'decisionMakingBodies', title: 'Decision making bodies Notes' },
  { key: 'reviewProcess', title: 'Review Process, Timelines & Pre-Policy Approach to CG&T' },
];

const policySections = ['Coverage Policy & Management', 'Reimbursement', 'Pathway'];
const policySubsections = [
  'CAR T (Class)',
  "Kite's Products",
  'Competitors (BCMA/CPRC5D bispecifics; competitor CAR T)',
];

const createPolicyDetails = () => Object.fromEntries(
  policySections.map((section) => [
    section,
    Object.fromEntries(policySubsections.map((subsection) => [subsection, { value: '', updatedDate: null }])),
  ])
);

export function EditableTextField({ label, value, onChange, isEditing = false, updatedDate = null, updatedDateLabel = 'Updated', placeholder, headerControl = null, rows = 2, compact = false, maxLength = LANDSCAPE_TEXT_LIMIT, disabled = false }) {
  const textareaRef = useRef(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return <div className={`stakeholder-map-field${isEditing ? ' is-editing' : ''}${compact ? ' is-compact' : ''}`}>
    <div className="stakeholder-map-field-heading">
      <label>{label}</label>
      {headerControl}
      {compact && <CharacterUsage className="stakeholder-map-character-count" value={value} maxLength={maxLength} minimumLimit={0}/>}
    </div>
    <textarea
      ref={textareaRef}
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      readOnly={!isEditing}
      disabled={disabled}
      aria-label={label}
    />
    {updatedDate && <small className="stakeholder-map-updated-date">{updatedDateLabel}: {formatDate(updatedDate)}</small>}
    {!compact && <CharacterUsage className="stakeholder-map-character-count" value={value} maxLength={maxLength} minimumLimit={0}/>}
  </div>;
}

function PayerPositionCard({ insightKey, insight, onChange, onSave, disabled, saving }) {
  const [isEditing, setIsEditing] = useState(false);
  const usesLevelOptions = insightKey === 'cart' || insightKey === 'kite';
  const handleEditSave = async () => {
    if (isEditing) {
      if (await onSave(insightKey)) setIsEditing(false);
    } else setIsEditing(true);
  };

  return <article className="panel stakeholder-position-card">
    <header>
      <div className="payer-position-title-row">
        <h2>{insight.title}</h2>
        {insightKey === 'communityExpansion' && <FieldHelpButton
          variant="reminder"
          label="Community Expansion Position guidance"
          text={<>
            <p>Select the option that best reflects payer’s current willingness to support CAR-T delivery beyond established/academic centers into qualified community settings.</p>
            <p><strong>1. Restrictive:</strong> Actively limits community CAR-T delivery; strong preference/requirements for established or academic centers.</p>
            <p><strong>2. Controlled:</strong> Allows community delivery selectively, with meaningful payer controls or network restrictions.</p>
            <p><strong>3. Evaluative:</strong> Open to community expansion but still assessing evidence, capabilities, economics, or outcomes.</p>
            <p><strong>4. Enabling:</strong> Supports community delivery for qualified providers with limited payer-driven barriers.</p>
            <p><strong>5. Progressive:</strong> Actively facilitates community expansion as part of its access/network strategy.</p>
          </>}
        />}
        {insightKey === 'kite' && <FieldHelpButton
          variant="reminder"
          label="Willingness to Partner with Kite information"
          text={<>
            <strong>Available for payers interviewed:</strong>
            <ul>
              <li>Kite's top payers</li>
              <li>7 BCBS plans:
                <ul>
                  <li>Elevance</li>
                  <li>Highmark</li>
                  <li>BCBS-MA</li>
                  <li>BCBS-MI</li>
                  <li>BCBS-CA</li>
                  <li>BCBS-TN</li>
                  <li>BCBS-HI</li>
                </ul>
              </li>
            </ul>
          </>}
        />}
      </div>
      <button type="button" className={`stakeholder-map-edit-button${isEditing ? ' is-editing' : ''}`} disabled={disabled || saving} onClick={handleEditSave}>{saving ? 'Saving…' : isEditing ? 'Save' : 'Edit'}</button>
    </header>
    <div className="stakeholder-position-card-body">
      <div className="stakeholder-position-field stakeholder-position-position">
        <span className="payer-position-title-row">
          <label htmlFor={`${insightKey}-position`}>{usesLevelOptions ? 'Level' : 'Position'}</label>
        </span>
        <select id={`${insightKey}-position`} value={insight.position} onChange={(event) => onChange(insightKey, 'position', event.target.value)} disabled={!isEditing || disabled || saving}>
          <option value="">Select {usesLevelOptions ? 'level' : 'position'}</option>
          {insight.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
        <small className="stakeholder-map-updated-date">Updated: {formatDate(insight.positionUpdated)}</small>
      </div>
      <label className="stakeholder-position-field stakeholder-position-comments">
        <span>Comments</span>
        <textarea rows="5" maxLength="1000" value={insight.comments} onChange={(event) => onChange(insightKey, 'comments', event.target.value)} readOnly={!isEditing} disabled={disabled || saving}/>
          <CharacterUsage value={insight.comments} maxLength={1000}/>
        <small className="stakeholder-map-updated-date">Updated: {formatDate(insight.commentsUpdated)}</small>
      </label>
    </div>
  </article>;
}

export default function AccountLandscapePage({ canEdit = true } = {}) {
  const [payerPositions, setPayerPositions] = useState(emptyPayerAssessments);
  const [assessmentStatus, setAssessmentStatus] = useState('loading');
  const [assessmentError, setAssessmentError] = useState('');
  const [savingAssessment, setSavingAssessment] = useState(null);
  const [qualityOfAccessScore, setQualityOfAccessScore] = useState('');
  const qualityOptions = useCrmPicklist('KPH_Account_Landscape__c', 'KPH_Quality_of_Access_Score__c');
  const [networkPorosity, setNetworkPorosity] = useState('');
  const [networkPorosityOptions, setNetworkPorosityOptions] = useState([]);
  const [editingSections, setEditingSections] = useState({ network: false, decision: false, quality: false });
  const [savingSection, setSavingSection] = useState(null);
  const [planId, setPlanId] = useState(null);
  const [landscapeId, setLandscapeId] = useState(null);
  const [networkDetails, setNetworkDetails] = useState(() => Object.fromEntries(
    NETWORK_LANDSCAPE_CONFIG.map(({ key }) => [key, { narrative: '', selection: '', options: [] }])
  ));
  const [reviewProcessUpdatedDate, setReviewProcessUpdatedDate] = useState(null);
  const [decisionDetails, setDecisionDetails] = useState(() => Object.fromEntries(
    decisionSections.map(({ key }) => [key, ''])
  ));
  const [policyDetails, setPolicyDetails] = useState(createPolicyDetails);
  const [expandedPolicySections, setExpandedPolicySections] = useState(() => new Set(policySections));
  const [dirtyMappedFields, setDirtyMappedFields] = useState(() => new Set());
  const [dataStatus, setDataStatus] = useState('loading');
  const [dataError, setDataError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [dirtyAssessments, setDirtyAssessments] = useState(() => new Set());

  const applyLandscape = (data) => {
    setPlanId(data.planId);
    setLandscapeId(data.landscapeId);
    setNetworkDetails(data.networkDetails);
    setReviewProcessUpdatedDate(data.reviewProcessUpdatedDate);
    setNetworkPorosity(data.networkPorosity || '');
    setNetworkPorosityOptions(data.networkPorosityOptions || []);
    setQualityOfAccessScore(data.qualityOfAccessScore);
    setDecisionDetails((current) => ({
      ...current,
      decisionMakingBodies: data.decisionMakingBodies,
      reviewProcess: data.reviewProcess,
    }));
    setPolicyDetails((current) => {
      const next = createPolicyDetails();
      for (const section of policySections) {
        for (const subsection of policySubsections) {
          next[section][subsection] = data.policyDetails[section]?.[subsection] || current[section]?.[subsection] || next[section][subsection];
        }
      }
      return next;
    });
    setDirtyMappedFields(new Set());
    setDataStatus('ready');
    setDataError('');
  };

  useEffect(() => {
    let cancelled = false;
    loadPayerAccountLandscape().then(
      (data) => {
        if (!cancelled) applyLandscape(data);
      },
      (error) => {
        console.error('[payer-account-landscape] load failed', error);
        if (!cancelled) {
          setDataStatus('error');
          setDataError(error?.message || 'Unable to load Account Landscape data.');
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadPayerAssessments().then((data) => {
      if (!cancelled) { setPayerPositions(data.assessments); setAssessmentStatus('ready'); }
    }).catch((error) => {
      if (!cancelled) { setAssessmentError(error.message || 'Unable to load payer assessments.'); setAssessmentStatus('error'); }
    });
    return () => { cancelled = true; };
  }, []);

  const saveAssessment = async (key) => {
    if (savingAssessment) return false;
    setSavingAssessment(key);
    setAssessmentError('');
    try {
      const saved = await savePayerAssessment(key, payerPositions[key]);
      notifySaved();
      setPayerPositions((current) => ({ ...current, [key]: saved }));
      setDirtyAssessments((current) => { const next = new Set(current); next.delete(key); return next; });
      return true;
    } catch (error) {
      setAssessmentError(error.message || 'Unable to save payer assessment.');
      return false;
    } finally { setSavingAssessment(null); }
  };

  const toggleSectionEditing = async (sectionKey) => {
    if (savingSection) return;
    if (!editingSections[sectionKey]) {
      setEditingSections((current) => ({ ...current, [sectionKey]: true }));
      return;
    }

    const fields = {};
    const changedPolicyFields = [];
    const updatedDate = crmDateToday();
    if (sectionKey === 'network') {
      if (dirtyMappedFields.has('KPH_Network_Porosity__c')) fields.KPH_Network_Porosity__c = networkPorosity;
      for (const config of NETWORK_LANDSCAPE_CONFIG) {
        if (dirtyMappedFields.has(config.notesField)) fields[config.notesField] = networkDetails[config.key].narrative;
      }
    } else if (sectionKey === 'decision') {
      if (dirtyMappedFields.has('KPH_Review_Process_CG_T_Notes__c')) fields.KPH_Review_Process_CG_T_Notes__c = decisionDetails.reviewProcess;
      const field = 'KPH_Decision_making_bodies_Notes__c';
      if (dirtyMappedFields.has(field)) fields[field] = decisionDetails.decisionMakingBodies;
    } else {
      if (dirtyMappedFields.has('KPH_Quality_of_Access_Score__c')) fields.KPH_Quality_of_Access_Score__c = qualityOfAccessScore;
      for (const [section, configs] of Object.entries(LANDSCAPE_POLICY_FIELD_CONFIG)) {
        for (const [subsection, config] of Object.entries(configs)) {
          if (!dirtyMappedFields.has(config.field)) continue;
          fields[config.field] = policyDetails[section][subsection].value;
          if (config.updatedField) {
            fields[config.updatedField] = updatedDate;
            changedPolicyFields.push({ section, subsection });
          }
        }
      }
    }

    setSavingSection(sectionKey);
    setDataError('');
    try {
      if (Object.keys(fields).length) {
        await savePayerAccountLandscapeFields({ landscapeId, planId, fields });
        notifySaved();
        if (Object.hasOwn(fields, 'KPH_Review_Process_CG_T_Notes__c')) setReviewProcessUpdatedDate(updatedDate);
        if (!landscapeId) {
          // Resolve the new record without replacing drafts in other sections.
          const saved = await loadPayerAccountLandscape();
          setLandscapeId(saved.landscapeId);
        }
        setDirtyMappedFields((current) => {
          const next = new Set(current);
          Object.keys(fields).forEach((field) => next.delete(field));
          return next;
        });
        setPolicyDetails((current) => {
          const next = { ...current };
          for (const { section, subsection } of changedPolicyFields) {
            next[section] = { ...next[section], [subsection]: { ...next[section][subsection], updatedDate } };
          }
          return next;
        });
      }
      setEditingSections((current) => ({ ...current, [sectionKey]: false }));
    } catch (error) {
      console.error('[payer-account-landscape] section save failed', error);
      setDataError(error?.message || 'Unable to save Account Landscape data.');
    } finally {
      setSavingSection(null);
    }
  };

  const sectionEditButton = (key, title) => <button
    type="button"
    className={`stakeholder-map-edit-button${editingSections[key] ? ' is-editing' : ''}`}
    disabled={!canEdit || dataStatus !== 'ready' || !!savingSection}
    onClick={() => toggleSectionEditing(key)}
    aria-label={`${editingSections[key] ? 'Save' : 'Edit'} ${title}`}
  >{savingSection === key ? 'Saving…' : editingSections[key] ? 'Save' : 'Edit'}</button>;

  const updatePayerPosition = (insightKey, field, value) => {
    setDirtyAssessments((current) => new Set(current).add(insightKey));
    setPayerPositions((current) => ({
      ...current,
      [insightKey]: { ...current[insightKey], [field]: value },
    }));
  };

  const updateNetworkDetail = (sectionKey, field, value) => {
    setNetworkDetails((current) => ({
      ...current,
      [sectionKey]: { ...current[sectionKey], [field]: value },
    }));
  };

  const updatePolicyDetail = (section, subsection, value) => {
    setPolicyDetails((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [subsection]: { ...current[section][subsection], value },
      },
    }));
    const field = LANDSCAPE_POLICY_FIELD_CONFIG[section]?.[subsection]?.field;
    if (field) setDirtyMappedFields((current) => new Set(current).add(field));
  };

  const togglePolicySection = (section) => {
    setExpandedPolicySections((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const refreshLandscape = async () => {
    if (refreshing || savingSection || savingAssessment || dirtyMappedFields.size || dirtyAssessments.size) return;
    setRefreshing(true);
    setDataStatus('loading');
    setAssessmentStatus('loading');
    try {
      const [landscape, assessments] = await Promise.all([loadPayerAccountLandscape(), loadPayerAssessments()]);
      applyLandscape(landscape);
      setPayerPositions(assessments.assessments);
      setAssessmentError('');
      setAssessmentStatus('ready');
    } catch (error) {
      setDataError(error?.message || 'Unable to refresh Account Landscape.');
      setDataStatus('error');
      setAssessmentStatus('error');
    } finally { setRefreshing(false); }
  };

  return <section className="stakeholder-map-workspace">
    <button type="button" className="stakeholder-map-edit-button landscape-refresh-button" onClick={refreshLandscape}
      disabled={refreshing || !!savingSection || !!savingAssessment || !!dirtyMappedFields.size || !!dirtyAssessments.size || dataStatus === 'loading' || assessmentStatus === 'loading'}
      title="Reload saved values. On iPad, sync first. Save your edits before refreshing."
    ><Icon name="refresh" size={16}/><span>{refreshing ? 'Refreshing…' : 'Refresh saved values'}</span></button>
    {dataStatus === 'loading' && <p className="executive-data-status">Loading Account Landscape data…</p>}
    {dataError && <p className="executive-data-status executive-data-error" role="alert">{dataError}</p>}
    {assessmentStatus === 'loading' && <p className="executive-data-status">Loading payer assessments…</p>}
    {assessmentError && <p className="executive-data-status executive-data-error" role="alert">{assessmentError}</p>}
    <section className="stakeholder-position-grid" aria-label="Payer position assessments">
      {Object.entries(payerPositions).map(([insightKey, insight]) => <PayerPositionCard insightKey={insightKey} insight={insight} onChange={updatePayerPosition} onSave={saveAssessment} disabled={!canEdit || assessmentStatus !== 'ready' || (!!savingAssessment && savingAssessment !== insightKey)} saving={savingAssessment === insightKey} key={insightKey}/>)}
    </section>

    <div className="stakeholder-map-overview-grid">
      <article className="panel stakeholder-map-overview-card">
        <header className="stakeholder-map-card-heading">
          <h2>National CAR T COE Network Approach</h2>
          {sectionEditButton('network', 'National CAR T COE Network Approach')}
        </header>
        <div className="stakeholder-map-card-body network-approach-fields">
          {[
            { key: 'network-size', label: 'Network Size', description: 'Number of in-network sites.', options: networkDetails.networkModel.options || [] },
            { key: 'network-porosity', label: 'Network Porosity', description: 'Network porosity = % of out-of-network patients [who received CAR T]', options: networkPorosityOptions },
          ].map((field) => <section className="stakeholder-map-detail-section" key={field.key}>
            <div className="stakeholder-position-field">
              <div className="network-approach-label-row">
                <label htmlFor={field.key}>{field.label}</label>
                <Payer360Badge/>
                <FieldHelpButton
                  variant="reminder"
                  label={`${field.label} information`}
                  text="Available in Payer360 dashboard for most payers (not all payers make their networks public)."
                />
              </div>
              <p className="network-approach-description" id={`${field.key}-description`}>{field.description}</p>
              <select
                id={field.key}
                aria-describedby={`${field.key}-description`}
                value={field.key === 'network-size' ? networkDetails.networkModel.narrative : networkPorosity}
                disabled={dataStatus !== 'ready' || !editingSections.network || !!savingSection}
                onChange={(event) => {
                  const value = event.target.value;
                  if (field.key === 'network-porosity') {
                    setNetworkPorosity(value);
                    setDirtyMappedFields((current) => new Set(current).add('KPH_Network_Porosity__c'));
                  } else {
                    updateNetworkDetail('networkModel', 'narrative', value);
                    setDirtyMappedFields((current) => new Set(current).add(NETWORK_LANDSCAPE_CONFIG.find((config) => config.key === 'networkModel').notesField));
                  }
                }}
              >
                <option value="">Select {field.label.toLowerCase()}</option>
                {field.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
              </select>
            </div>
          </section>)}
          {NETWORK_LANDSCAPE_CONFIG.filter((config) => config.key === 'siteInclusionCriteria').map((config) => <section className="stakeholder-map-detail-section" key={config.key}>
            <EditableTextField
              label={config.notesLabel}
              value={networkDetails[config.key].narrative}
              onChange={(value) => {
                updateNetworkDetail(config.key, 'narrative', value);
                setDirtyMappedFields((current) => new Set(current).add(config.notesField));
              }}
              isEditing={editingSections.network}
              placeholder="Add network approach/site inclusion criteria details"
              rows={3}
              maxLength={LANDSCAPE_OVERVIEW_TEXT_LIMIT}
              disabled={dataStatus !== 'ready' || !!savingSection}
            />
          </section>)}
        </div>
      </article>

      <article className="panel stakeholder-map-overview-card">
        <header className="stakeholder-map-card-heading">
          <h2>Decision Making Process</h2>
          {sectionEditButton('decision', 'Decision Making Process')}
        </header>
        <div className="stakeholder-map-card-body">
          {decisionSections.map(({ key, title }) => <section className="stakeholder-map-detail-section" key={key}>
            <EditableTextField
              label={title}
              value={decisionDetails[key]}
              onChange={(value) => {
                setDecisionDetails((current) => ({ ...current, [key]: value }));
                if (key === 'reviewProcess') setDirtyMappedFields((current) => new Set(current).add('KPH_Review_Process_CG_T_Notes__c'));
                if (key === 'decisionMakingBodies') {
                  setDirtyMappedFields((current) => new Set(current).add('KPH_Decision_making_bodies_Notes__c'));
                }
              }}
              isEditing={editingSections.decision}
              placeholder={`Add ${title.toLowerCase()} details`}
              maxLength={LANDSCAPE_OVERVIEW_TEXT_LIMIT}
              updatedDate={key === 'reviewProcess' ? reviewProcessUpdatedDate : null}
              disabled={dataStatus !== 'ready' || !!savingSection}
            />

          </section>)}
        </div>
      </article>
    </div>

    <section className="panel stakeholder-map-account-snapshot">
      <header className="stakeholder-map-snapshot-heading">
        <h2>Quality of Access</h2>
          {sectionEditButton('quality', 'Quality of Access')}
      </header>
      <div className="quality-of-access-score-row">
        <div className="stakeholder-position-field quality-of-access-score-field">
          <div className="quality-of-access-score-label">
            <label htmlFor="quality-of-access-score">Quality of Access Score</label>
            <Payer360Badge/>
            <FieldHelpButton
              variant="reminder"
              label="Quality of Access information"
              text={<>
                <strong>Quality of Access</strong>
                <p>Restrictiveness of a payer's CAR T coverage policy / prior authorization criteria relative to the FDA label.</p>
                <strong>1:</strong>
                <ul>
                  <li>Highly restrictive</li>
                  <li>Criteria largely reflects clinical trial eligibility.</li>
                </ul>
                <strong>4:</strong>
                <ul>
                  <li>Moderately restrictive</li>
                  <li>Mixing trial criteria and FDA label elements.</li>
                </ul>
                <strong>7:</strong>
                <ul>
                  <li>Unrestrictive</li>
                  <li>Policies closely mirror FDA labels.</li>
                </ul>
                <p>Available in Payer360 dashboard for most payers.</p>
              </>}
            />
          </div>
          <select disabled={!editingSections.quality || dataStatus !== 'ready' || !!savingSection} id="quality-of-access-score" value={qualityOfAccessScore} onChange={(event) => { setQualityOfAccessScore(event.target.value); setDirtyMappedFields((current) => new Set(current).add('KPH_Quality_of_Access_Score__c')); }}>
            <option value="">Select quality of access score</option>
            {qualityOptions.map((option) => <option disabled={option.disabled} key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </div>
      <div className="stakeholder-map-policy-list">
        {policySections.map((section) => {
          const isExpanded = expandedPolicySections.has(section);
          const sectionId = `account-landscape-${section.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
          return <article className={`stakeholder-map-policy-card${isExpanded ? ' is-expanded' : ' is-collapsed'}`} key={section}>
          <header className="stakeholder-map-policy-heading">
            <button type="button" className="stakeholder-map-policy-toggle" onClick={() => togglePolicySection(section)} aria-expanded={isExpanded} aria-controls={sectionId}>
              <h2>{section}</h2>
              <span className="stakeholder-map-policy-chevron" aria-hidden="true" />
            </button>
          </header>
          <div className="stakeholder-map-policy-subsections" id={sectionId} hidden={!isExpanded}>
            {policySubsections.map((subsection) => {
              const config = LANDSCAPE_POLICY_FIELD_CONFIG[section]?.[subsection];
              const detail = policyDetails[section][subsection];
              return <section className="stakeholder-map-policy-subsection" key={subsection}>
              <EditableTextField
                label={config?.label || subsection}
                value={detail.value}
                onChange={(value) => updatePolicyDetail(section, subsection, value)}
                isEditing={editingSections.quality}
                updatedDate={detail.updatedDate}
                updatedDateLabel={config?.updatedLabel}
                placeholder={`Add ${subsection.toLowerCase()} details`}
                rows={1}
                compact
                maxLength={config ? 5000 : LANDSCAPE_TEXT_LIMIT}
                disabled={!config || dataStatus !== 'ready' || !!savingSection}
              />
              {!config && <small role="note">CRM field mapping is required before this field can be saved.</small>}
            </section>})}
          </div>
        </article>})}
      </div>
    </section>
  </section>;
}
