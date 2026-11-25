import CharacterUsage from '@/components/CharacterUsage';
import ModalForm from '@/components/ModalForm';
import { notifySaved } from '@/lib/helper/successNotice';
import { sameCrmId } from '@/lib/helper/barrierRecords';
import { confirmDeletion } from '@/components/confirmDeletion';
import { loadPayerCriticalActions, savePayerCriticalAction, deletePayerCriticalAction } from '@/lib/dataservice/accountPlan/payerCriticalActions';
import { crmWriteError } from '@/lib/helper/crmWriteError';
import useCrmPicklist from '@/hooks/useCrmPicklist';
import { PAYER_LAUNCH_CONFIG, emptyPayerLaunch, loadPayerLaunchReadiness, savePayerLaunchReadiness } from '@/lib/dataservice/accountPlan/payerLaunchReadiness';
import { loadPayerMilestones, savePayerMilestone, deletePayerMilestone, savePayerMilestoneNotes } from '@/lib/dataservice/accountPlan/payerMilestones';
import { formatPayerDate } from '@/lib/helper/payerDates';
import { PAYER_MILESTONE_LIMITS, milestoneTimingInputValue, milestoneTimingSaveValue, formatMilestoneTiming } from '@/lib/dataservice/accountPlan/payerMilestoneFields';
import { completionDependencies, completeDependencies } from '@/lib/helper/hierarchyCompletion';
import { availableObjectiveSlots, validateObjectiveLimit } from '@/lib/helper/payerObjectiveLimit';
import { hierarchyStatusGroup, matchesHierarchyStatus } from '@/lib/helper/hierarchyStatusFilter';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon, Pill } from '@/components/MarketAccessUi';
import TableSortButton from '@/components/TableSortButton';
import { nextTableSort, stableSortRows } from '@/lib/helper/tableSort';
import {
  actionPlanTabs,
} from '@/lib/mockData/marketAccessFixtures';

const CRITICAL_ACTION_COLUMNS = [
  { key: 'action', label: 'Action & Critical Next Steps' },
  { key: 'customerStakeholderName', label: 'Customer Stakeholder' },
  { key: 'kiteOwnerName', label: 'Kite Owner (DRI)' },
  { key: 'kiteCollaboratorName', label: 'Kite Collaborator' },
  { key: 'timing', label: 'Timing' },
  { key: 'status', label: 'Status' },
  { key: 'nextSteps', label: 'Next Steps' },
];

const MILESTONE_COLUMNS = [
  { key: 'milestone', label: 'Milestones & Engagements' },
  { key: 'customerStakeholderName', label: 'Customer Stakeholder' },
  { key: 'kiteOwnerName', label: 'Kite Owner (DRI)' },
  { key: 'kiteCollaboratorName', label: 'Kite Collaborator' },
  { key: 'timing', label: 'Timing' },
  { key: 'status', label: 'Status' },
  { key: 'nextSteps', label: 'Next Steps' },
];

const emptyMilestone = {
  milestone: '',
  customerStakeholderName: '',
  customerStakeholderRole: '',
  kiteOwnerName: '',
  kiteOwnerRole: '',
  kiteCollaboratorName: '',
  kiteCollaboratorRole: '',
  timing: '',
  status: '',
  nextSteps: '',
};

const emptyCriticalAction = {
  action: '',
  linkedStrategyId: '',
  customerStakeholderName: '',
  customerStakeholderRole: '',
  kiteOwnerName: '',
  kiteOwnerRole: '',
  kiteCollaboratorName: '',
  kiteCollaboratorRole: '',
  timing: '',
  status: '',
  nextSteps: '',
};

const itemStatus = (item) => item.status || '';
const hierarchyId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const strategyLetter = (index) => {
  let number = index + 1;
  let label = '';
  while (number > 0) {
    number -= 1;
    label = String.fromCharCode(65 + number % 26) + label;
    number = Math.floor(number / 26);
  }
  return label;
};

function LaunchReadinessPlan({ canEdit = true } = {}) {
  const [form, setForm] = useState(emptyPayerLaunch);
  const [isEditingMetrics, setIsEditingMetrics] = useState(false);
  const [isEditingCommentary, setIsEditingCommentary] = useState(false);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState({});
  const [dates, setDates] = useState({});
  const [dirty, setDirty] = useState(() => new Set());
  useEffect(() => {
    let cancelled = false;
    loadPayerLaunchReadiness().then((data) => {
      if (!cancelled) { setForm(data.form); setOptions(data.options); setDates(data.dates); setStatus('ready'); }
    }).catch((error) => { if (!cancelled) { setError(error.message); setStatus('error'); } });
    return () => { cancelled = true; };
  }, []);
  const editSave = async (group, editing, setEditing) => {
    if (!editing) { setEditing(true); return; }
    setBusy(true); setError('');
    const keys = [...dirty].filter((key) => PAYER_LAUNCH_CONFIG[key].group === group);
    try {
      const date = await savePayerLaunchReadiness(form, keys);
      if (keys.length) notifySaved();
      setDates((current) => ({ ...current, ...Object.fromEntries(keys.map((key) => [key, date])) }));
      setDirty((current) => new Set([...current].filter((key) => !keys.includes(key))));
      setEditing(false);
    } catch (error) { setError(error.message || 'Unable to save launch readiness.'); }
    finally { setBusy(false); }
  };
  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setDirty((current) => new Set(current).add(field));
  };

  return <section className="launch-readiness-workspace">
    {status === 'loading' && <p className="executive-data-status">Loading launch readiness…</p>}
    {error && <p className="executive-data-status executive-data-error" role="alert">{error}</p>}
    <div className="launch-readiness-grid">
      <section className={`panel executive-section-card launch-readiness-panel launch-readiness-metrics${isEditingMetrics ? ' is-editing' : ''}`}>
        <div className="executive-section-heading milestones-engagements-heading launch-readiness-heading">
          <div><h2>Anito-Cel Pre-Launch Insights</h2></div>
          <button
            type="button"
            className={`button ${isEditingMetrics ? 'primary' : 'secondary'} launch-readiness-edit-button`}
            disabled={!canEdit || status !== 'ready' || busy} onClick={() => editSave('metrics', isEditingMetrics, setIsEditingMetrics)}
          >
            {isEditingMetrics ? 'Save' : 'Edit'}
          </button>
        </div>
        <div className="launch-readiness-fields">
          <label className="launch-readiness-field">
            <span>Medical Policy Published</span>
            <select name="medicalPolicyPublished" value={form.medicalPolicyPublished} onChange={(event) => updateField('medicalPolicyPublished', event.target.value)} disabled={!isEditingMetrics || busy}>
              <option value="">Select an option</option>
              {(options.medicalPolicyPublished || []).map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
            <small className="milestone-record-date">Updated: {formatPayerDate(dates.medicalPolicyPublished)}</small>
          </label>
          {form.medicalPolicyPublished === 'No' && <label className="launch-readiness-field">
            <span>Payer Value Prop Delivery</span>
            <select name="payerValuePropDelivery" value={form.payerValuePropDelivery} onChange={(event) => updateField('payerValuePropDelivery', event.target.value)} disabled={!isEditingMetrics || busy}>
              <option value="">Select an option</option>
              {(options.payerValuePropDelivery || []).map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
            <small className="milestone-record-date">Updated: {formatPayerDate(dates.payerValuePropDelivery)}</small>
          </label>}
          {form.medicalPolicyPublished !== 'Yes' && <label className="launch-readiness-field">
            <span>Anticipated to Publish Medical Policy</span>
            <select name="anticipatedMedicalPolicyPublication" value={form.anticipatedMedicalPolicyPublication} onChange={(event) => updateField('anticipatedMedicalPolicyPublication', event.target.value)} disabled={!isEditingMetrics || busy}>
              <option value="">Select an option</option>
              {(options.anticipatedMedicalPolicyPublication || []).map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
            <small className="milestone-record-date">Updated: {formatPayerDate(dates.anticipatedMedicalPolicyPublication)}</small>
          </label>}
          <label className="launch-readiness-field">
            <span>PIE Delivery Status</span>
            <select name="pieDeliveryStatus" value={form.pieDeliveryStatus} onChange={(event) => updateField('pieDeliveryStatus', event.target.value)} disabled={!isEditingMetrics || busy}>
              <option value="">Select an option</option>
              {(options.pieDeliveryStatus || []).map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
            <small className="milestone-record-date">Updated: {formatPayerDate(dates.pieDeliveryStatus)}</small>
          </label>
          <label className="launch-readiness-field">
            <span className="launch-readiness-label-with-help">
              <span>Risk Assessment for Delayed Coverage</span>
              <span className="launch-readiness-risk-help" tabIndex="0" role="button" aria-label="Risk Assessment for Delayed Coverage definition">
                <span aria-hidden="true">i</span>
                <span className="launch-readiness-risk-tooltip" role="tooltip">Medical policy risk assessment.</span>
              </span>
            </span>
            <select name="riskAssessment" value={form.riskAssessment} onChange={(event) => updateField('riskAssessment', event.target.value)} disabled={!isEditingMetrics || busy}>
              <option value="">Select an option</option>
              {(options.riskAssessment || []).map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
            <small className="milestone-record-date">Updated: {formatPayerDate(dates.riskAssessment)}</small>
          </label>
        </div>
        <section className="launch-readiness-notes-section">
          <label className="launch-readiness-field">
            <span>Policy Notes</span>
            <textarea
              name="policyContextNotes"
              rows="5"
              maxLength={PAYER_LAUNCH_CONFIG.policyContextNotes.maxLength}
              value={form.policyContextNotes || ''}
              onChange={(event) => updateField('policyContextNotes', event.target.value)}
              placeholder="Add relevant policy context, decisions, timing considerations, or other launch insights"
              readOnly={!isEditingMetrics || busy}
            />
          <CharacterUsage value={form.policyContextNotes || ''} maxLength={PAYER_LAUNCH_CONFIG.policyContextNotes.maxLength}/>
          </label>
        </section>
      </section>

      <section className={`panel executive-section-card launch-readiness-panel launch-readiness-commentary${isEditingCommentary ? ' is-editing' : ''}`}>
        <div className="executive-section-heading milestones-engagements-heading launch-readiness-heading">
          <div><h2>Commentary</h2></div>
          <button
            type="button"
            className={`button ${isEditingCommentary ? 'primary' : 'secondary'} launch-readiness-edit-button`}
            disabled={!canEdit || status !== 'ready' || busy} onClick={() => editSave('commentary', isEditingCommentary, setIsEditingCommentary)}
          >
            {isEditingCommentary ? 'Save' : 'Edit'}
          </button>
        </div>
        <div className="launch-readiness-fields">
          <label className="launch-readiness-field">
            <span>Drivers for Anito-cel Adoption</span>
            <textarea maxLength="1000" name="driversForAdoption" rows="4" value={form.driversForAdoption} onChange={(event) => updateField('driversForAdoption', event.target.value)} readOnly={!isEditingCommentary || busy}/>
          <CharacterUsage value={form.driversForAdoption} maxLength={1000}/>
          </label>
          <label className="launch-readiness-field">
            <span>Anticipated Barriers at Launch (if Applicable)</span>
            <textarea maxLength="1000" name="anticipatedBarriers" rows="4" value={form.anticipatedBarriers} onChange={(event) => updateField('anticipatedBarriers', event.target.value)} readOnly={!isEditingCommentary || busy}/>
          <CharacterUsage value={form.anticipatedBarriers} maxLength={1000}/>
          </label>
          <label className="launch-readiness-field">
            <span>Evidence to Support Payer Decision Making</span>
            <textarea maxLength="1000" name="evidenceForPillarDecision" rows="4" value={form.evidenceForPillarDecision} onChange={(event) => updateField('evidenceForPillarDecision', event.target.value)} readOnly={!isEditingCommentary || busy}/>
          <CharacterUsage value={form.evidenceForPillarDecision} maxLength={1000}/>
          </label>
        </div>
      </section>
    </div>
  </section>;
}

function HierarchyItemModal({ draft, hierarchy, issues, onClose, onSave }) {
  const strategyStatusOptions = useCrmPicklist({ objective: 'KPH_Account_Objective__c', strategy: 'KPH_Strategy__c', tactic: 'KPH_Tactics_Resource__c' }[draft.kind], { objective: 'KPH_Status__c', strategy: 'KPH_Strategy_Status__c', tactic: 'KPH_Tactic_Status__c' }[draft.kind]);
  const [confirming, setConfirming] = useState(false);
  const [validated, setValidated] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [text, setText] = useState(draft.text || '');
  const [status, setStatus] = useState(draft.status || '');
  const dependencies = completionDependencies(hierarchy, issues, { ...draft, status });
  const dialogRef = useRef(null);
  const label = { objective: 'Objective', strategy: 'Strategy', tactic: 'Tactic / Resource' }[draft.kind];
  const linkedObjective = hierarchy.find((objective) => objective.id === draft.objectiveId);
  const linkedStrategy = linkedObjective?.strategies.find((strategy) => strategy.id === draft.strategyId);
  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current.showModal();
    return () => previousFocus?.focus();
  }, []);
  return <dialog ref={dialogRef} className="key-win-modal hierarchy-item-modal" aria-labelledby="hierarchy-item-title" onCancel={onClose}>
    <ModalForm onSubmit={async (event) => { event.preventDefault(); if (!text.trim()) return; if (text.length > 200) { setSaveError(`${label} must contain no more than 200 characters.`); return; } if (dependencies.length && !confirming) { setConfirming(true); return; } if (dependencies.length && !validated) return; try { setSaveError(''); await onSave({ ...draft, text: text.trim(), status }, confirming && validated); } catch (error) { setSaveError(error.message); } }}>
      <header className="key-win-modal-head"><h2 id="hierarchy-item-title">{draft.id ? 'Edit' : 'Add'} {label}</h2><button type="button" className="key-win-modal-close" onClick={onClose} aria-label="Close"><Icon name="close" size={17}/></button></header>
      {saveError && <p role="alert">{saveError}</p>}
      {confirming ? <div className="key-win-modal-body" role="alert">
        <p>This {draft.kind} cannot be completed while these linked items remain open or pending:</p>
        <ul>{dependencies.map((item) => <li key={item.id}>{item.label}</li>)}</ul>
        <label><input type="checkbox" checked={validated} onChange={(event) => setValidated(event.target.checked)} required/> I confirm completing all listed items and this {draft.kind}.</label>
      </div> : <div className="key-win-modal-body">
        {draft.kind !== 'objective' && <label className="key-win-modal-field"><span>Linked Objective</span><textarea rows="2" value={linkedObjective?.objective || 'Untitled Objective'} readOnly/></label>}
        {draft.kind === 'tactic' && <label className="key-win-modal-field"><span>Linked Strategy</span><textarea rows="2" value={linkedStrategy?.strategy || 'Untitled Strategy'} readOnly/></label>}
        <label className="key-win-modal-field"><span>{label}</span><textarea rows="5" maxLength={200} value={text} onChange={(event) => { setText(event.target.value); setSaveError(''); }} required autoFocus/>
          <CharacterUsage value={text} maxLength={200} minimumLimit={0}/>
        </label>
        <label className="key-win-modal-field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)} required><option value="">Select status</option>{strategyStatusOptions.map((option) => <option disabled={option.disabled} value={option.value} key={option.value}>{option.label}</option>)}</select></label>
      </div>}
      <footer className="key-win-modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button type="submit" className="button primary">{confirming ? 'Complete All Linked Items' : draft.id ? 'Save Changes' : `Add ${label}`}</button></footer>
    </ModalForm>
  </dialog>;
}

function HierarchyItemContent({ text, item }) {
  return <div className="commercial-item-content"><p>{text || 'Untitled'}</p><span className={`commercial-item-status ${itemStatus(item) === 'Completed' ? 'is-completed' : ''}`}>{itemStatus(item)}</span></div>;
}

function HierarchyStatusFilter({ label, value, onChange }) {
  return <select className="commercial-status-filter" aria-label={`${label} status filter`} value={value} onChange={(event) => onChange(event.target.value)}>
    {['All', 'Open', 'Completed'].map((status) => <option key={status} value={status}>{status}</option>)}
  </select>;
}

export function CommercialHierarchy({
  canEdit = true,
  hierarchy,
  setHierarchy,
  selectedObjectiveId,
  setSelectedObjectiveId,
  selectedStrategyId,
  setSelectedStrategyId,
  viewScope,
  setViewScope,
  issues,
  setIssues,
}) {
  const completionOptions = {
    strategy: useCrmPicklist('KPH_Strategy__c', 'KPH_Strategy_Status__c'),
    tactic: useCrmPicklist('KPH_Tactics_Resource__c', 'KPH_Tactic_Status__c'),
    Barrier: useCrmPicklist('KPH_Payers_Barrier_Opportunities__c', 'KPH_Barrier_Status__c'),
    Opportunity: useCrmPicklist('KPH_Payers_Barrier_Opportunities__c', 'KPH_Opportunities_Status__c'),
  };
  const [isExpanded, setIsExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const [itemDraft, setItemDraft] = useState(null);
  const [selectedTacticId, setSelectedTacticId] = useState(null);
  const [strategyStatusFilter, setStrategyStatusFilter] = useState('All');
  const [objectiveStatusFilter, setObjectiveStatusFilter] = useState('All');
  const [tacticStatusFilter, setTacticStatusFilter] = useState('All');
  const hierarchyRef = useRef(null);
  const isViewingAll = viewScope === 'all-objectives';
  const isViewingObjectiveStrategies = viewScope === 'objective-strategies';
  const selectedObjectiveIndex = hierarchy.findIndex((objective) => objective.id === selectedObjectiveId);
  const selectedObjective = selectedObjectiveIndex >= 0 ? hierarchy[selectedObjectiveIndex] : null;
  const visibleObjectives = isViewingAll ? hierarchy.filter((objective) => matchesHierarchyStatus(objective, objectiveStatusFilter)) : selectedObjective ? [selectedObjective] : [];

  const selectObjective = (objective) => {
    setViewScope('selected-strategy');
    setSelectedObjectiveId(objective.id);
    setSelectedStrategyId(objective.strategies.find((strategy) => matchesHierarchyStatus(strategy, strategyStatusFilter))?.id || '');
    setSelectedTacticId(null);
  };
  const selectStrategy = (objective, strategy) => {
    setViewScope('selected-strategy');
    setSelectedObjectiveId(objective.id);
    setSelectedStrategyId(strategy.id);
    setSelectedTacticId(null);
  };
  useLayoutEffect(() => {
    const measureHierarchy = () => {
      const columns = hierarchyRef.current?.querySelectorAll('.commercial-hierarchy-column') || [];
      const viewportThreshold = window.innerHeight * 0.75;
      const exceedsThreshold = [...columns].some((column) => {
        const header = column.firstElementChild;
        const content = column.children[1];
        return (header?.offsetHeight || 0) + (content?.scrollHeight || 0) > viewportThreshold;
      });
      setCanExpand(exceedsThreshold);
      if (!exceedsThreshold) setIsExpanded(false);
    };

    measureHierarchy();
    window.addEventListener('resize', measureHierarchy);
    return () => window.removeEventListener('resize', measureHierarchy);
  }, [hierarchy, selectedObjectiveId, selectedStrategyId, viewScope, objectiveStatusFilter, strategyStatusFilter, tacticStatusFilter]);

  const changeStrategyStatusFilter = (status) => {
    setStrategyStatusFilter(status);
    setSelectedStrategyId(selectedObjective?.strategies.find((strategy) => matchesHierarchyStatus(strategy, status))?.id || '');
    setSelectedTacticId(null);
  };
  const changeObjectiveStatusFilter = (status) => {
    setObjectiveStatusFilter(status);
    if (selectedObjective && !matchesHierarchyStatus(selectedObjective, status)) {
      setSelectedObjectiveId('');
      setSelectedStrategyId('');
      setSelectedTacticId(null);
    }
  };
  const addObjective = () => { if (availableObjectiveSlots(hierarchy)) setItemDraft({ kind: 'objective' }); };
  const addStrategy = (objectiveId) => {
    if (hierarchy.some((item) => item.id === objectiveId)) setItemDraft({ kind: 'strategy', objectiveId });
  };
  const addTactic = (objectiveId, strategyId) => setItemDraft({ kind: 'tactic', objectiveId, strategyId });
  const saveItem = async (draft, cascade = false) => {
    if (completionDependencies(hierarchy, issues, draft).length && !cascade) return;
    const completed = cascade ? completeDependencies(hierarchy, issues, draft, completionOptions) : null;
    if (completed && await setIssues(completed.records) === false) return;
    const id = draft.id || hierarchyId(`commercial-${draft.kind}`);
    const saved = await setHierarchy((current) => {
      if (completed) current = completed.hierarchy;
      if (draft.kind === 'objective') {
        const next = !draft.id
          ? [...current, { id, objective: draft.text, status: draft.status, strategies: [] }]
          : current.map((item) => item.id === id ? { ...item, objective: draft.text, status: draft.status } : item);
        validateObjectiveLimit(current, next);
        return next;
      }
      return current.map((objective) => {
        if (objective.id !== draft.objectiveId) return objective;
        if (draft.kind === 'strategy') {
          const strategies = draft.id
            ? objective.strategies.map((item) => item.id === id ? { ...item, strategy: draft.text, status: draft.status } : item)
            : [...objective.strategies, { id, strategy: draft.text, status: draft.status, tactics: [] }];
          return { ...objective, strategies };
        }
        return { ...objective, strategies: objective.strategies.map((strategy) => strategy.id !== draft.strategyId ? strategy : {
          ...strategy, tactics: draft.id
            ? strategy.tactics.map((item) => item.id === id ? { ...item, value: draft.text, status: draft.status } : item)
            : [...strategy.tactics, { id, value: draft.text, status: draft.status }],
        }) };
      });
    });
    if (saved === false) return;
    if (saved?.error) throw new Error(saved.error);
    const savedId = saved?.ids?.[id] || id;
    setSelectedObjectiveId(draft.kind === 'objective' ? savedId : draft.objectiveId);
    if (draft.kind === 'objective') setObjectiveStatusFilter(hierarchyStatusGroup(draft.status));
    if (draft.kind === 'strategy') { setSelectedStrategyId(savedId); setStrategyStatusFilter(hierarchyStatusGroup(draft.status)); }
    if (draft.kind === 'objective' && !draft.id) setSelectedStrategyId('');
    if (draft.kind === 'tactic') { setSelectedStrategyId(draft.strategyId); setSelectedTacticId(savedId); setTacticStatusFilter(hierarchyStatusGroup(draft.status)); }
    setViewScope('selected-strategy');
    setItemDraft(null);
  };
  const affectedItemList = (label, items) => {
    const names = items.map((item) => item.trim()).filter(Boolean);
    return `• ${names.length} ${label}${names.length ? `:\n${names.map((name) => `  - ${name}`).join('\n')}` : ''}`;
  };
  const deleteObjective = async (objective) => {
    const linkedStrategyIds = objective.strategies.map((strategy) => strategy.id);
    const isLinkedIssue = (issue) => sameCrmId(issue.objectiveId, objective.id) || linkedStrategyIds.some((id) => sameCrmId(id, issue.strategyId));
    const linkedIssues = issues.filter(isLinkedIssue);
    const strategyNames = objective.strategies.map((strategy, index) => `Strategy ${strategyLetter(index)}: ${strategy.strategy || 'Untitled Strategy'}`);
    const tacticNames = objective.strategies.flatMap((strategy, strategyIndex) => strategy.tactics.map((tactic, tacticIndex) => `Strategy ${strategyLetter(strategyIndex)} / Tactic or Resource ${tacticIndex + 1}: ${tactic.value || 'Untitled'}`));
    const warning = [
      `Delete objective: "${objective.objective || 'Untitled Objective'}"?`,
      '',
      'Everything below this objective will also be deleted, including all linked items:',
      affectedItemList(strategyNames.length === 1 ? 'strategy' : 'strategies', strategyNames),
      affectedItemList(tacticNames.length === 1 ? 'tactic/resource' : 'tactics/resources', tacticNames),
      affectedItemList('linked barriers / opportunities', linkedIssues.map((issue) => `${issue.type}: ${issue.name || 'Untitled'}`)),
      '',
      'This cannot be undone.',
    ].join('\n');
    if (!await confirmDeletion(warning)) return;
    const finalWarning = [
      `Final confirmation: delete "${objective.objective || 'Untitled Objective'}" and ALL linked items?`,
      '',
      `${strategyNames.length} strategies, ${tacticNames.length} tactics/resources, ${linkedIssues.length} barriers / opportunities will also be deleted.`,
      'This includes linked items hidden by the current filters.',
      '',
      'This cannot be undone. Select Confirm deletion to delete everything listed, or Cancel to keep everything.',
    ].join('\n');
    if (!await confirmDeletion(finalWarning)) return;
    if (await setIssues((current) => current.filter((issue) => !isLinkedIssue(issue))) === false) return;
    if (await setHierarchy((current) => current.filter((item) => item.id !== objective.id)) === false) return;
    if (selectedObjectiveId === objective.id) {
      setSelectedObjectiveId('');
      setSelectedStrategyId('');
      setViewScope('selected-strategy');
    }
    setSelectedTacticId(null);
  };
  const deleteStrategy = async (objective, strategy) => {
    const isLinkedBarrier = (issue) => issue.type === 'Barrier' && sameCrmId(issue.strategyId, strategy.id);
    const linkedBarriers = issues.filter(isLinkedBarrier);
    const tacticNames = strategy.tactics.map((tactic, index) => `Tactic or Resource ${index + 1}: ${tactic.value || 'Untitled'}`);
    const warning = [
      `Delete strategy: "${strategy.strategy || 'Untitled Strategy'}"?`,
      `From objective: "${objective.objective || 'Untitled Objective'}"`,
      '',
      'Everything below this strategy will also be deleted, including all linked items:',
      affectedItemList(tacticNames.length === 1 ? 'tactic/resource' : 'tactics/resources', tacticNames),
      affectedItemList('linked barriers', linkedBarriers.map((barrier) => barrier.name || 'Untitled Barrier')),
      '',
      'This cannot be undone.',
    ].join('\n');
    if (!await confirmDeletion(warning)) return;
    const finalWarning = [
      `Final confirmation: delete "${strategy.strategy || 'Untitled Strategy'}" and ALL linked items?`,
      '',
      `${tacticNames.length} tactics/resources, ${linkedBarriers.length} barriers will also be deleted.`,
      'This includes linked items hidden by the current filters.',
      '',
      'This cannot be undone. Select Confirm deletion to delete everything listed, or Cancel to keep everything.',
    ].join('\n');
    if (!await confirmDeletion(finalWarning)) return;
    const remainingStrategies = objective.strategies.filter((item) => item.id !== strategy.id);
    if (await setIssues((current) => current.filter((issue) => !isLinkedBarrier(issue))) === false) return;
    if (await setHierarchy((current) => current.map((item) => item.id === objective.id ? { ...item, strategies: remainingStrategies } : item)) === false) return;
    if (selectedStrategyId === strategy.id) setSelectedStrategyId(remainingStrategies[0]?.id || '');
    setSelectedTacticId(null);
  };
  const deleteTactic = async (objectiveId, strategyId, tactic) => {
    if (!await confirmDeletion(`Delete this tactic/resource: "${tactic.value || 'Untitled'}"?`)) return;
    await setHierarchy((current) => current.map((objective) => objective.id === objectiveId
      ? {
        ...objective,
        strategies: objective.strategies.map((strategy) => strategy.id === strategyId
          ? { ...strategy, tactics: strategy.tactics.filter((item) => item.id !== tactic.id) }
          : strategy),
      }
      : objective));
    setSelectedTacticId(null);
  };

  return <section ref={hierarchyRef} className={`commercial-hierarchy ${isExpanded ? 'is-expanded' : ''}`} aria-label="Commercial objective hierarchy">
    <article className="panel commercial-hierarchy-column objective-column">
      <header>
        <span>1</span><h2>Account Objectives</h2>
        <div className="commercial-objective-actions">
          <HierarchyStatusFilter label="Account Objectives" value={objectiveStatusFilter} onChange={changeObjectiveStatusFilter}/>
        </div>
      </header>
      <div className="commercial-hierarchy-content">
        {Array.from({ length: hierarchy.length + availableObjectiveSlots(hierarchy) }, (_, objectiveIndex) => {
          const objective = hierarchy[objectiveIndex];
          if (objective && !matchesHierarchyStatus(objective, objectiveStatusFilter)) return null;
          return objective ? <div className={`commercial-objective-card ${objective.id === selectedObjective?.id ? 'is-selected' : ''}`} key={objective.id} onClick={(event) => { if (!event.target.closest('button')) selectObjective(objective); }}>
            <div className="commercial-node-heading">
              <button type="button" className="commercial-node-selector" onClick={() => selectObjective(objective)} aria-pressed={objective.id === selectedObjective?.id}>Objective {objectiveIndex + 1}</button>
              <div className="commercial-field-actions"><button disabled={!canEdit} type="button" className="commercial-field-edit" onClick={() => { selectObjective(objective); setItemDraft({ kind: 'objective', id: objective.id, objectiveId: objective.id, text: objective.objective, status: itemStatus(objective) }); }}>Edit</button><button disabled={!canEdit} type="button" className="commercial-field-delete" onClick={() => deleteObjective(objective)} aria-label={`Delete Objective ${objectiveIndex + 1}`} title="Delete objective"><Icon name="trash" size={14}/></button></div>
            </div>
            <div className="commercial-hierarchy-field">
              <span className="sr-only">Objective {objectiveIndex + 1} description</span>
              <HierarchyItemContent text={objective.objective} item={objective}/>
            </div>
          </div> : <button disabled={!canEdit} type="button" className="commercial-objective-empty" onClick={addObjective} key={`empty-objective-${objectiveIndex}`}><Icon name="plus" size={15}/><span><strong>Objective {objectiveIndex + 1}</strong><small>Add an account objective</small></span></button>;
        })}
      </div>
    </article>

    <article className="panel commercial-hierarchy-column strategy-column">
      <header><span>2</span><h2>Strategies</h2><div className="commercial-objective-actions"><HierarchyStatusFilter label="Strategies" value={strategyStatusFilter} onChange={changeStrategyStatusFilter}/></div></header>
      <div className="commercial-hierarchy-content">
        {visibleObjectives.length === 0 && <div className="commercial-hierarchy-empty-state"><Icon name="target" size={25}/><strong>Select an Account Objective</strong><span>Its strategies will populate here.</span></div>}
        {visibleObjectives.map((objective) => {
          const objectiveIndex = hierarchy.findIndex((item) => item.id === objective.id);
          const visibleStrategies = objective.strategies.filter((strategy) => matchesHierarchyStatus(strategy, strategyStatusFilter));
          return <section className="commercial-objective-branch" key={objective.id}>
            {isViewingAll && <div className="commercial-selection-context"><span>Account Objective</span><strong>Objective {objectiveIndex + 1}: {objective.objective || 'Untitled Objective'}</strong></div>}
            <div className="commercial-hierarchy-group">
              {visibleStrategies.map((strategy) => {
                const strategyIndex = objective.strategies.findIndex((item) => item.id === strategy.id);
                return <div className={`commercial-strategy-card ${strategy.id === selectedStrategyId ? 'is-selected' : ''}`} key={strategy.id} onClick={(event) => { if (!event.target.closest('button')) selectStrategy(objective, strategy); }}>
                <div className="commercial-node-heading">
                  <button type="button" className="commercial-node-selector" onClick={() => selectStrategy(objective, strategy)} aria-pressed={strategy.id === selectedStrategyId}>Strategy {strategyLetter(strategyIndex)}</button>
                  <div className="commercial-field-actions"><button disabled={!canEdit} type="button" className="commercial-field-edit" onClick={() => { selectStrategy(objective, strategy); setItemDraft({ kind: 'strategy', id: strategy.id, objectiveId: objective.id, text: strategy.strategy, status: itemStatus(strategy) }); }}>Edit</button><button disabled={!canEdit} type="button" className="commercial-field-delete" onClick={() => deleteStrategy(objective, strategy)} aria-label={`Delete Strategy ${strategyLetter(strategyIndex)}`} title="Delete strategy"><Icon name="trash" size={14}/></button></div>
                </div>
                <div className="commercial-hierarchy-field">
                  <span className="sr-only">Strategy {strategyLetter(strategyIndex)} description</span>
                  <HierarchyItemContent text={strategy.strategy} item={strategy}/>
                </div>
              </div>})}
              {visibleStrategies.length === 0 && <div className="commercial-strategy-filter-empty">No {strategyStatusFilter.toLowerCase()} strategies.</div>}
              <button disabled={!canEdit} type="button" className="commercial-hierarchy-add" onClick={() => addStrategy(objective.id)}><Icon name="plus" size={15}/> Add Strategy</button>
            </div>
          </section>;
        })}
      </div>
    </article>

    <article className="panel commercial-hierarchy-column tactic-column">
      <header><h2>Tactics &amp; Resources</h2><div className="commercial-objective-actions"><HierarchyStatusFilter label="Tactics and Resources" value={tacticStatusFilter} onChange={(status) => { setTacticStatusFilter(status); setSelectedTacticId(null); }}/></div></header>
      <div className="commercial-hierarchy-content">
        {visibleObjectives.length === 0 && <div className="commercial-hierarchy-empty-state"><Icon name="target" size={25}/><strong>Select an Account Objective</strong><span>Related tactics and resources will populate here.</span></div>}
        {visibleObjectives.map((objective) => {
          const objectiveIndex = hierarchy.findIndex((item) => item.id === objective.id);
          return <section className="commercial-objective-branch" key={objective.id}>
            {isViewingAll && <div className="commercial-selection-context"><span>Account Objective</span><strong>Objective {objectiveIndex + 1}: {objective.objective || 'Untitled Objective'}</strong></div>}
            <div className="commercial-hierarchy-group">
              {(isViewingAll || isViewingObjectiveStrategies ? objective.strategies : objective.strategies.filter((strategy) => strategy.id === selectedStrategyId)).map((strategy) => {
                const strategyIndex = objective.strategies.findIndex((item) => item.id === strategy.id);
                return <div className={`commercial-tactic-group ${strategy.id === selectedStrategyId ? 'is-selected' : ''}`} key={strategy.id}>
                {(isViewingAll || isViewingObjectiveStrategies) && <button type="button" className="commercial-tactic-heading" onClick={() => selectStrategy(objective, strategy)}><strong>Strategy {strategyLetter(strategyIndex)}:</strong> {strategy.strategy || 'Untitled Strategy'}</button>}
                {strategy.tactics.map((tactic, tacticIndex) => !matchesHierarchyStatus(tactic, tacticStatusFilter) ? null : <div className={`commercial-hierarchy-field commercial-tactic-card ${selectedTacticId === tactic.id ? 'is-selected' : ''}`} key={tactic.id} onClick={() => setSelectedTacticId(tactic.id)}>
                  <div className="commercial-field-label-row"><span>Tactic / Resource {tacticIndex + 1}</span><div className="commercial-field-actions"><button disabled={!canEdit} type="button" className="commercial-field-edit" onClick={() => {  setItemDraft({ kind: 'tactic', id: tactic.id, objectiveId: objective.id, strategyId: strategy.id, text: tactic.value, status: itemStatus(tactic) }); }}>Edit</button><button disabled={!canEdit} type="button" className="commercial-field-delete" onClick={(event) => { event.stopPropagation(); deleteTactic(objective.id, strategy.id, tactic); }} aria-label={`Delete Tactic or Resource ${tacticIndex + 1}`} title="Delete tactic or resource"><Icon name="trash" size={14}/></button></div></div>
                  <HierarchyItemContent text={tactic.value} item={tactic}/>
                </div>)}
                <button disabled={!canEdit} type="button" className="commercial-hierarchy-add" onClick={() => addTactic(objective.id, strategy.id)}><Icon name="plus" size={15}/> Add Tactic / Resource</button>
              </div>})}
            </div>
          </section>;
        })}
      </div>
    </article>
    {itemDraft && <HierarchyItemModal draft={itemDraft} hierarchy={hierarchy} issues={issues} onClose={() => setItemDraft(null)} onSave={saveItem}/>}
    {canExpand && <div className="commercial-hierarchy-more-row">
      <button type="button" className="commercial-hierarchy-more" aria-expanded={isExpanded} onClick={() => setIsExpanded((current) => !current)}>{isExpanded ? 'Show Less' : 'More'}</button>
    </div>}
  </section>;
}

function CriticalActionModal({ record, strategyOptions, onClose, onSave, onDelete, busy, error }) {
  const milestoneStatusOptions = useCrmPicklist('KPH_Actions_and_Critical_Next_Steps__c', 'KPH_Status__c');
  const isEdit = Boolean(record?.id);
  const [form, setForm] = useState({ ...emptyCriticalAction, ...record, timing: milestoneTimingInputValue(record?.timing) });

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const handleSubmit = (event) => {
    event.preventDefault();
    if (!busy && (isEdit || form.linkedStrategyText?.trim())) onSave({ ...form, timing: milestoneTimingSaveValue(form.timing, record?.timing) });
  };
  const people = [
    ['Customer Stakeholder', 'customerStakeholderName', 'customerStakeholderRole', 'Enter stakeholder name', 'e.g., Medical Director'],
    ['Kite Owner (DRI)', 'kiteOwnerName', 'kiteOwnerRole', 'Enter owner name', 'e.g., KAD'],
    ['Kite Collaborator', 'kiteCollaboratorName', 'kiteCollaboratorRole', 'Enter collaborator name', 'e.g., Medical Affairs Director'],
  ];

  return <div className="key-win-modal-overlay milestone-modal-overlay" role="presentation" onMouseDown={onClose}>
    <ModalForm className="key-win-modal milestone-modal" role="dialog" aria-modal="true" aria-labelledby="criticalActionModalTitle" onMouseDown={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
      <header className="key-win-modal-head">
        <div><span>Objectives, Strategies &amp; Critical Actions</span><h2 id="criticalActionModalTitle">{isEdit ? 'Edit Action / Critical Next Step' : 'Add Action / Critical Next Step'}</h2></div>
        <button disabled={busy} type="button" className="key-win-modal-close" onClick={onClose} aria-label="Close action modal"><Icon name="close" size={17}/></button>
      </header>
      {error && <p role="alert" className="executive-data-status executive-data-error">{error}</p>}
      {!isEdit && !form.linkedStrategyText && <p className="executive-data-status" role="status">Enter a strategy title in Linked Strategy to continue.</p>}
      <div className="milestone-modal-scroll"><fieldset disabled={busy} className="key-win-modal-body milestone-modal-body">
        <label className="key-win-modal-field milestone-field-milestone">
          <span>Action &amp; Critical Next Steps</span>
          <textarea rows="3" maxLength="500" value={form.action} onChange={(event) => updateField('action', event.target.value)} required autoFocus/>
          <CharacterUsage value={form.action} maxLength={500}/>
        </label>
        <label className="key-win-modal-field milestone-field-milestone">
          <span>Linked Strategy</span>
          <input type="text" value={form.linkedStrategyText || ''} onChange={(event) => updateField('linkedStrategyText', event.target.value)} maxLength="250" placeholder="Enter strategy title" aria-label="Linked Strategy" required={!isEdit}/>

        </label>
        {people.map(([label, nameField, roleField, namePlaceholder, rolePlaceholder]) => <fieldset className="milestone-person-fields" key={nameField}>
          <legend>{label}</legend>
          <label className="key-win-modal-field"><span>Name</span><input type="text" maxLength="250" value={form[nameField]} onChange={(event) => updateField(nameField, event.target.value)} placeholder={namePlaceholder} required/></label>
          <label className="key-win-modal-field"><span>Role</span><input type="text" maxLength="250" value={form[roleField]} onChange={(event) => updateField(roleField, event.target.value)} placeholder={rolePlaceholder} required/></label>
        </fieldset>)}
        <label className="key-win-modal-field"><span>Timing</span><input type="date" value={form.timing} onChange={(event) => updateField('timing', event.target.value)} required/></label>
        <label className="key-win-modal-field"><span>Status</span><select value={form.status} onChange={(event) => updateField('status', event.target.value)} required><option value="">Select status</option>{milestoneStatusOptions.map((option) => <option disabled={option.disabled} value={option.value} key={option.value}>{option.label}</option>)}</select></label>
        <label className="key-win-modal-field milestone-field-nextSteps"><span>Next Steps</span><textarea rows="3" maxLength="5000" value={form.nextSteps} onChange={(event) => updateField('nextSteps', event.target.value)} required/>
          <CharacterUsage value={form.nextSteps} maxLength={5000}/></label>
      </fieldset></div>
      <footer className="key-win-modal-actions">
        {isEdit && <button disabled={busy} type="button" className="button milestone-modal-delete" onClick={() => onDelete(record)}><Icon name="trash" size={15}/> Delete</button>}
        <button disabled={busy} type="button" className="button secondary" onClick={onClose}>Cancel</button>
        <button disabled={busy} type="submit" className="button primary">{isEdit ? 'Save Changes' : 'Add Action / Critical Next Step'}</button>
      </footer>
    </ModalForm>
  </div>;
}

function MilestoneEngagementModal({ record, onClose, onSave, onDelete, statusOptions, busy, error }) {
  const isEdit = Boolean(record?.id);
  const [form, setForm] = useState({ ...emptyMilestone, ...record, timing: milestoneTimingInputValue(record?.timing) });

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const handleSubmit = (event) => {
    event.preventDefault();
    if (!busy) onSave({ ...form, timing: milestoneTimingSaveValue(form.timing, record?.timing) });
  };

  const options = form.status && !statusOptions.some((option) => option.value === form.status)
    ? [{ value: form.status, label: form.status }, ...statusOptions] : statusOptions;

  const people = [
    ['Customer Stakeholder', 'customerStakeholderName', 'customerStakeholderRole', 'Enter stakeholder name', 'e.g., Medical Director'],
    ['Kite Owner (DRI)', 'kiteOwnerName', 'kiteOwnerRole', 'Enter owner name', 'e.g., KAD'],
    ['Kite Collaborator', 'kiteCollaboratorName', 'kiteCollaboratorRole', 'Enter collaborator name', 'e.g., Medical Affairs Director'],
  ];

  return <div className="key-win-modal-overlay milestone-modal-overlay" role="presentation" onMouseDown={onClose}>
    <ModalForm className="key-win-modal milestone-modal" role="dialog" aria-modal="true" aria-labelledby="milestoneModalTitle" onMouseDown={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
      <header className="key-win-modal-head">
        <div><span>Action Plan &amp; Objectives</span><h2 id="milestoneModalTitle">{isEdit ? 'Edit Milestone / Engagement' : 'Add Milestone / Engagement'}</h2></div>
        <button type="button" className="key-win-modal-close" onClick={onClose} aria-label="Close milestone modal"><Icon name="close" size={17}/></button>
      </header>
      {error && <p className="executive-data-status executive-data-error" role="alert">{error}</p>}
      <div className="milestone-modal-scroll"><fieldset disabled={busy} className="key-win-modal-body milestone-modal-body payer-milestone-fields">
        <label className="key-win-modal-field milestone-modal-field milestone-field-milestone">
          <span>Milestone / Engagement</span>
          <textarea rows="3" maxLength={PAYER_MILESTONE_LIMITS.milestone} value={form.milestone} onChange={(event) => updateField('milestone', event.target.value)} required/>
          <CharacterUsage value={form.milestone} maxLength={PAYER_MILESTONE_LIMITS.milestone}/>
        </label>
        {people.map(([label, nameField, roleField, namePlaceholder, rolePlaceholder]) => <fieldset className="milestone-person-fields" key={nameField}>
          <legend>{label}</legend>
          <label className="key-win-modal-field">
            <span>Name</span>
            <input type="text" maxLength={PAYER_MILESTONE_LIMITS[nameField]} value={form[nameField]} onChange={(event) => updateField(nameField, event.target.value)} placeholder={namePlaceholder} required/>
          </label>
          <label className="key-win-modal-field">
            <span>Role (optional)</span>
            <input type="text" maxLength={PAYER_MILESTONE_LIMITS[roleField]} value={form[roleField]} onChange={(event) => updateField(roleField, event.target.value)} placeholder={rolePlaceholder}/>
          </label>
        </fieldset>)}
        <label className="key-win-modal-field milestone-modal-field">
          <span>Timing</span>
          <input type="date" value={form.timing} onChange={(event) => updateField('timing', event.target.value)} required/>
        </label>
        <label className="key-win-modal-field milestone-modal-field">
          <span>Status</span>
          <select value={form.status} onChange={(event) => updateField('status', event.target.value)} required>
            <option value="">Select status</option>
            {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="key-win-modal-field milestone-modal-field milestone-field-nextSteps">
          <span>Next Steps</span>
          <textarea rows="3" maxLength={PAYER_MILESTONE_LIMITS.nextSteps} value={form.nextSteps} onChange={(event) => updateField('nextSteps', event.target.value)} required/>
          <CharacterUsage value={form.nextSteps} maxLength={PAYER_MILESTONE_LIMITS.nextSteps}/>
        </label>
      </fieldset></div>
      <footer className="key-win-modal-actions">
        {isEdit && <button type="button" className="button milestone-modal-delete" disabled={busy} onClick={() => onDelete(record)}><Icon name="trash" size={15}/> Delete</button>}
        <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="button primary" disabled={busy}>{busy ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Milestone / Engagement'}</button>
      </footer>
    </ModalForm>
  </div>;
}

export default function ActionPlanPage({ canEdit = true, criticalActions, setCriticalActions, commercialHierarchy, setCommercialHierarchy, issues, setIssues }) {
  const milestoneStatusOptions = useCrmPicklist('KPH_Actions_and_Critical_Next_Steps__c', 'KPH_Status__c');
  const [activeTab, setActiveTab] = useState(actionPlanTabs[0]);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState('');
  const [selectedStrategyId, setSelectedStrategyId] = useState('');
  const [viewScope, setViewScope] = useState('all-objectives');
  const [actionStatusFilter, setActionStatusFilter] = useState('All');
  const [activeCriticalAction, setActiveCriticalAction] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionReady, setActionReady] = useState(false);
  const reloadActions = async () => { const data = await loadPayerCriticalActions(); setCriticalActions(data.actions); };
  useEffect(() => {
    let cancelled = false;
    loadPayerCriticalActions().then((data) => { if (!cancelled) { setCriticalActions(data.actions); setActionReady(true); } }).catch((error) => { if (!cancelled) setActionError(error.message); });
    return () => { cancelled = true; };
  }, []);
  const [milestones, setMilestones] = useState([]);
  const [activeMilestone, setActiveMilestone] = useState(null);
  const [criticalActionSort, setCriticalActionSort] = useState(null);
  const [milestoneSort, setMilestoneSort] = useState(null);
  const [milestoneDataStatus, setMilestoneDataStatus] = useState('loading');
  const [additionalNotes, setAdditionalNotes] = useState({ value: '', updatedDate: null });
  const [notesEditing, setNotesEditing] = useState(false);
  const [notesBusy, setNotesBusy] = useState(false);
  const [notesError, setNotesError] = useState('');
  const [milestoneError, setMilestoneError] = useState('');
  const [milestoneBusy, setMilestoneBusy] = useState(false);
  const [crmMilestoneStatuses, setCrmMilestoneStatuses] = useState([]);

  useEffect(() => {
    let cancelled = false;
    loadPayerMilestones().then((data) => {
      if (!cancelled) { setMilestones(data.milestones); setAdditionalNotes(data.additionalNotes); setCrmMilestoneStatuses(data.statusOptions); setMilestoneDataStatus('ready'); }
    }).catch((error) => {
      if (!cancelled) { setMilestoneError(error.message || 'Unable to load milestones.'); setMilestoneDataStatus('error'); }
    });
    return () => { cancelled = true; };
  }, []);
  const strategyOptions = commercialHierarchy.flatMap((objective, objectiveIndex) => objective.strategies.map((strategy, strategyIndex) => ({
    id: strategy.id,
    title: strategy.strategy,
    label: `Objective ${objectiveIndex + 1} / Strategy ${strategyLetter(strategyIndex)}: ${strategy.strategy || 'Untitled Strategy'}`,
  })));
  const strategyName = (strategyId) => strategyOptions.find((strategy) => strategy.id === strategyId)?.label || 'Unlinked Strategy';
  const selectedObjective = commercialHierarchy.find((objective) => objective.id === selectedObjectiveId);
  const selectedObjectiveStrategyIds = new Set((selectedObjective?.strategies || []).map((strategy) => strategy.id));
  const actionsWithLinks = criticalActions.map((action) => {
    const matches = strategyOptions.filter((option) => option.title === action.linkedStrategyText);
    return { ...action, linkedStrategyId: matches.length === 1 ? matches[0].id : '' };
  });
  const visibleCriticalActions = viewScope === 'all-objectives'
    ? actionsWithLinks
    : viewScope === 'objective-strategies'
      ? actionsWithLinks.filter((action) => selectedObjectiveStrategyIds.has(action.linkedStrategyId))
      : actionsWithLinks.filter((action) => action.linkedStrategyId === selectedStrategyId);
  const criticalActionContext = viewScope === 'all-objectives'
    ? 'Showing actions linked to all objectives and strategies'
    : viewScope === 'objective-strategies' && selectedObjective
      ? `Showing actions linked to all strategies for ${selectedObjective.objective || 'the selected objective'}`
      : selectedStrategyId
        ? `Showing actions linked to ${strategyName(selectedStrategyId)}`
        : 'Select an Account Objective to show its linked critical actions';
  const sortedCriticalActions = useMemo(() => stableSortRows(
    visibleCriticalActions.filter((action) => actionStatusFilter === 'All' || action.status === actionStatusFilter),
    criticalActionSort,
    (row, key) => key === 'linkedStrategyId' ? strategyName(row.linkedStrategyId) : row[key]
  ), [visibleCriticalActions, criticalActionSort, strategyOptions, actionStatusFilter]);
  const sortedMilestones = useMemo(
    () => stableSortRows(milestones, milestoneSort, (row, key) => row[key]),
    [milestones, milestoneSort]
  );

  const saveCriticalAction = async (record) => {
    if (actionBusy) return;
    setActionBusy(true); setActionError('');
    try {
      await savePayerCriticalAction(record); notifySaved();
      setActiveCriticalAction(null);
      await reloadActions();
    } catch (error) { setActionError(crmWriteError(error, 'Save action').message); }
    finally { setActionBusy(false); }
  };

  const deleteCriticalAction = async (record) => {
    if (actionBusy || !await confirmDeletion(`Delete "${record.action}"?`)) return;
    setActionBusy(true); setActionError('');
    try { await deletePayerCriticalAction(record.id); notifySaved('Record deleted. Your changes have been saved.'); setActiveCriticalAction(null); await reloadActions(); }
    catch (error) { setActionError(crmWriteError(error, 'Delete action').message); }
    finally { setActionBusy(false); }
  };

  const editSaveMilestoneNotes = async () => {
    if (!notesEditing) { setNotesEditing(true); return; }
    if (notesBusy) return;
    setNotesBusy(true);
    setNotesError('');
    try {
      setAdditionalNotes(await savePayerMilestoneNotes(additionalNotes.value));
      notifySaved();
      setNotesEditing(false);
    } catch (error) { setNotesError(error.message || 'Unable to save additional notes.'); }
    finally { setNotesBusy(false); }
  };

  const saveMilestone = async (milestone) => {
    if (milestoneBusy) return;
    setMilestoneBusy(true);
    setMilestoneError('');
    try {
      await savePayerMilestone(milestone); notifySaved();
      setActiveMilestone(null);
      const data = await loadPayerMilestones();
      setMilestones(data.milestones);
      setCrmMilestoneStatuses(data.statusOptions);
    } catch (error) { setMilestoneError(error.message || 'Unable to save milestone.'); }
    finally { setMilestoneBusy(false); }
  };

  const deleteMilestone = async (milestone) => {
    if (milestoneBusy || !await confirmDeletion(`Delete "${milestone.milestone}"?`)) return;
    setMilestoneBusy(true);
    setMilestoneError('');
    try {
      await deletePayerMilestone(milestone.id); notifySaved('Record deleted. Your changes have been saved.');
      setMilestones((current) => current.filter((row) => row.id !== milestone.id));
      setActiveMilestone(null);
    } catch (error) { setMilestoneError(error.message || 'Unable to delete milestone.'); }
    finally { setMilestoneBusy(false); }
  };

  return <section className="action-plan-workspace">
    <div className="bor-tabs-panel action-plan-tabs-panel">
      <div className="bor-tabs" role="tablist" aria-label="Action plan sections">
        {actionPlanTabs.map((tab) => {
          const isActive = activeTab === tab;
          return <button
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls="actionPlanTabPanel"
            className={isActive ? 'is-active' : ''}
            onClick={() => setActiveTab(tab)}
            key={tab}
          >
            {tab}
          </button>;
        })}
      </div>
    </div>

    <div id="actionPlanTabPanel" role="tabpanel" className="action-plan-tab-panel">
      {activeTab === 'Launch Readiness Plan' && (
        <LaunchReadinessPlan canEdit={canEdit}/>
      )}

      {activeTab === 'Objectives, Strategies & Critical Actions' && <>
        <CommercialHierarchy canEdit={canEdit} issues={issues} setIssues={setIssues} hierarchy={commercialHierarchy} setHierarchy={setCommercialHierarchy} selectedObjectiveId={selectedObjectiveId} setSelectedObjectiveId={setSelectedObjectiveId} selectedStrategyId={selectedStrategyId} setSelectedStrategyId={setSelectedStrategyId} viewScope={viewScope} setViewScope={setViewScope}/>
        <section className="panel milestones-engagements-card critical-actions-card">
          <div className="executive-section-heading milestones-engagements-heading">
            <div>
              <div className="critical-actions-title-row">
                <h2>Action &amp; Critical Next Steps</h2>
                <span className="critical-actions-info">
                  <button type="button" aria-label="About separate strategy workstreams" aria-describedby="criticalActionsWorkstreamHelp"><Icon name="info" size={15}/></button>
                  <span className="critical-actions-info-tooltip" id="criticalActionsWorkstreamHelp" role="tooltip">
                    <strong>Separate strategy workstreams</strong>
                    <span>Tactics &amp; Resources support the strategy. Action &amp; Critical Next Steps are managed separately and link directly to the selected strategy—not to a tactic or resource.</span>
                  </span>
                </span>
              </div>
              <p>{criticalActionContext}</p>
              {viewScope !== 'selected-strategy' && <p>Select a strategy above to prefill its title, or enter the title when adding an action.</p>}
            </div>
            <div className="critical-actions-heading-actions">
              <label className="action-status-filter">Status <select value={actionStatusFilter} onChange={(event) => setActionStatusFilter(event.target.value)} aria-label="Action and Critical Next Steps status"><option value="All">All statuses</option>{milestoneStatusOptions.map((option) => <option disabled={option.disabled} value={option.value} key={option.value}>{option.label}</option>)}</select></label>
              <button disabled={!canEdit || actionBusy} type="button" className="button primary" onClick={() => setActiveCriticalAction({ ...emptyCriticalAction, linkedStrategyText: strategyOptions.find((option) => option.id === selectedStrategyId)?.title || '' })}><Icon name="plus" size={15}/> Add Action / Critical Next Step</button>
            </div>
          </div>
          <div className="table-wrap milestones-engagements-table critical-actions-table"><table>
            <thead><tr>
              {CRITICAL_ACTION_COLUMNS.map((column) => <th key={column.key}><TableSortButton column={column} sort={criticalActionSort} onSort={(key) => setCriticalActionSort((current) => nextTableSort(current, key))}/></th>)}
              <th><span className="sr-only">Actions</span></th>
            </tr></thead>
            <tbody>{sortedCriticalActions.map((row) => <tr key={row.id}>
              <td data-label="Action / Critical Next Step"><strong>{row.action}</strong></td>
              <td data-label="Customer Stakeholder"><span className="milestone-person"><strong>{row.customerStakeholderName}</strong><small>{row.customerStakeholderRole}</small></span></td>
              <td data-label="Kite Owner (DRI)"><span className="milestone-person"><strong>{row.kiteOwnerName}</strong><small>{row.kiteOwnerRole}</small></span></td>
              <td data-label="Kite Collaborator"><span className="milestone-person"><strong>{row.kiteCollaboratorName}</strong><small>{row.kiteCollaboratorRole}</small></span></td>
              <td data-label="Timing">{formatMilestoneTiming(row.timing)}</td>
              <td data-label="Status"><Pill tone={row.status === 'Complete' ? 'green' : row.status === 'In Progress' ? 'blue' : row.status === 'Deprioritized' ? 'neutral' : 'purple'}>{row.status}</Pill></td>
              <td data-label="Next Steps">{row.nextSteps}</td>
              <td data-label="Actions" className="milestone-actions-cell"><div className="milestone-row-actions">
                <button disabled={!canEdit} type="button" className="table-edit-button" onClick={() => setActiveCriticalAction(row)} aria-label={`Edit ${row.action}`} title="Edit action / critical next step"><Icon name="edit" size={15}/></button>
                <button disabled={!canEdit} type="button" className="milestone-delete-button" onClick={() => deleteCriticalAction(row)} aria-label={`Delete ${row.action}`} title="Delete action / critical next step"><Icon name="trash" size={15}/></button>
              </div></td>
            </tr>)}{sortedCriticalActions.length === 0 && <tr className="critical-actions-empty"><td colSpan={CRITICAL_ACTION_COLUMNS.length + 1}>{actionStatusFilter !== 'All' ? 'No actions match this status in the current selection.' : 'No actions in the current selection.'}</td></tr>}</tbody>
          </table></div>
        </section>
        {actionError && !activeCriticalAction && <p role="alert">{actionError}</p>}
        {activeCriticalAction && <CriticalActionModal busy={actionBusy} error={actionError} record={activeCriticalAction} strategyOptions={strategyOptions} onClose={() => { if (!actionBusy) { setActiveCriticalAction(null); setActionError(''); } }} onSave={saveCriticalAction} onDelete={deleteCriticalAction}/>}
      </>}

      {activeTab === 'Milestones & Engagements' && <>
        {milestoneDataStatus === 'loading' && <p className="executive-data-status">Loading milestones…</p>}
        {milestoneError && !activeMilestone && <p className="executive-data-status executive-data-error" role="alert">{milestoneError}</p>}
        <section className="panel milestones-engagements-card">
          <div className="executive-section-heading milestones-engagements-heading">
            <div>
              <h2>Milestones &amp; Engagements</h2>
            </div>
            <button type="button" className="button primary" disabled={!canEdit || milestoneDataStatus !== 'ready' || milestoneBusy} onClick={() => setActiveMilestone({ ...emptyMilestone })}><Icon name="plus" size={15}/> Add Milestone / Engagement</button>
          </div>
          <div className="table-wrap milestones-engagements-table">
            <table>
              <thead><tr>
                {MILESTONE_COLUMNS.map((column) => <th key={column.key}><TableSortButton column={column} sort={milestoneSort} onSort={(key) => setMilestoneSort((current) => nextTableSort(current, key))}/></th>)}
                <th><span className="sr-only">Actions</span></th>
              </tr></thead>
              <tbody>{sortedMilestones.map((row) => <tr key={row.id}>
                <td data-label="Milestone / Engagement"><strong>{row.milestone}</strong><small className="milestone-record-date">Created: {formatPayerDate(row.createdDate)}</small><small className="milestone-record-date">Updated: {formatPayerDate(row.updatedDate)}</small></td>
                <td data-label="Customer Stakeholder"><span className="milestone-person"><strong>{row.customerStakeholderName}</strong><small>{row.customerStakeholderRole}</small></span></td>
                <td data-label="Kite Owner (DRI)"><span className="milestone-person"><strong>{row.kiteOwnerName}</strong><small>{row.kiteOwnerRole}</small></span></td>
                <td data-label="Kite Collaborator"><span className="milestone-person"><strong>{row.kiteCollaboratorName}</strong><small>{row.kiteCollaboratorRole}</small></span></td>
                <td data-label="Timing">{formatMilestoneTiming(row.timing)}</td>
                <td data-label="Status"><Pill tone={row.status === 'Complete' ? 'green' : row.status === 'In Progress' ? 'blue' : row.status === 'Deprioritized' ? 'neutral' : 'purple'}>{crmMilestoneStatuses.find((option) => option.value === row.status)?.label || row.status}</Pill></td>
                <td data-label="Next Steps">{row.nextSteps}</td>
                <td data-label="Actions" className="milestone-actions-cell"><div className="milestone-row-actions">
                  <button type="button" className="table-edit-button" disabled={!canEdit || milestoneBusy} onClick={() => setActiveMilestone(row)} aria-label={`Edit ${row.milestone}`} title="Edit milestone / engagement"><Icon name="edit" size={15}/></button>
                  <button type="button" className="milestone-delete-button" disabled={!canEdit || milestoneBusy} onClick={() => deleteMilestone(row)} aria-label={`Delete ${row.milestone}`} title="Delete milestone / engagement"><Icon name="trash" size={15}/></button>
                </div></td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>
        <section className="panel executive-section-card milestone-notes-card">
          <div className="executive-section-heading">
            <h2>Additional Notes</h2>
            <button type="button" className="stakeholder-map-edit-button" disabled={!canEdit || milestoneDataStatus !== 'ready' || notesBusy} onClick={editSaveMilestoneNotes}>{notesBusy ? 'Saving…' : notesEditing ? 'Save' : 'Edit'}</button>
          </div>
          {notesError && <p className="executive-data-status executive-data-error" role="alert">{notesError}</p>}
          <textarea className="executive-customer-ask-textbox" rows="5" maxLength={PAYER_MILESTONE_LIMITS.additionalNotes} value={additionalNotes.value} onChange={(event) => setAdditionalNotes((current) => ({ ...current, value: event.target.value }))} readOnly={!notesEditing} disabled={notesBusy} aria-label="Additional milestone and engagement notes"/>
          <CharacterUsage value={additionalNotes.value} maxLength={PAYER_MILESTONE_LIMITS.additionalNotes}/>
          <small className="milestone-record-date">Updated: {formatPayerDate(additionalNotes.updatedDate)}</small>
        </section>
        {activeMilestone && <MilestoneEngagementModal record={activeMilestone} onClose={() => { if (!milestoneBusy) { setActiveMilestone(null); setMilestoneError(''); } }} onSave={saveMilestone} onDelete={deleteMilestone} statusOptions={crmMilestoneStatuses} busy={milestoneBusy} error={milestoneError}/>}
      </>}
    </div>
  </section>;
}
