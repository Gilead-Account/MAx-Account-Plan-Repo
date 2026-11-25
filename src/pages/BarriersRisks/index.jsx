import CharacterUsage from '@/components/CharacterUsage';
import ModalForm from '@/components/ModalForm';
import { sameCrmId, isCompletedRecord, activeRecordCount, groupBarrierRecords, groupBarrierStrategies } from '@/lib/helper/barrierRecords';
import { confirmDeletion } from '@/components/confirmDeletion';
import useCrmPicklist from '@/hooks/useCrmPicklist';
import { useMemo, useState } from 'react';
import { Icon, Pill } from '@/components/MarketAccessUi';

const maxRecordsPerType = 5;
const emptyFilters = { objectiveId: 'All', strategyId: 'All', status: 'All' };

const objectiveFor = (hierarchy, objectiveId) =>
  hierarchy.find((objective) => sameCrmId(objective.id, objectiveId));

const newDraft = (type) => {
  return {
    id: '',
    name: '',
    type,
    objectiveId: '',
    strategyId: '',
    impact: '',
    status: '',
    details: '',
  };
};

function BarrierOpportunityModal({ draft, setDraft, hierarchy, onClose, onSave, error }) {
  const isBarrier = draft.type === 'Barrier';
  const impactOptions = useCrmPicklist('KPH_Payers_Barrier_Opportunities__c', isBarrier ? 'KPH_Barrier_Impact__c' : 'KPH_Opportunities_Impact__c');
  const statusOptions = useCrmPicklist('KPH_Payers_Barrier_Opportunities__c', isBarrier ? 'KPH_Barrier_Status__c' : 'KPH_Opportunities_Status__c');
  const selectedObjective = objectiveFor(hierarchy, draft.objectiveId);
  const isEditing = Boolean(draft.id);

  const updateObjective = (objectiveId) => {
    setDraft((current) => ({
      ...current,
      objectiveId,
      strategyId: '',
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.objectiveId || (isBarrier && !draft.strategyId)) return;
    onSave({ ...draft, name: draft.name.trim(), details: draft.details.trim() });
  };

  return <div className="key-win-modal-overlay" role="presentation" onMouseDown={onClose}>
    <ModalForm className="key-win-modal bor-modal" role="dialog" aria-modal="true" aria-labelledby="barrierOpportunityModalTitle" onMouseDown={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
      <div className="key-win-modal-head">
        <div>
          <span>{draft.type}</span>
          <h2 id="barrierOpportunityModalTitle">{isEditing ? 'Edit' : 'Add'} {draft.type}</h2>
        </div>
        <button type="button" className="key-win-modal-close" aria-label="Close modal" onClick={onClose}><Icon name="close" size={17}/></button>
      </div>
      {error && <p role="alert" className="key-win-error">{error}</p>}
      <div className="key-win-modal-body bor-modal-grid">
        <label className="key-win-modal-field bor-modal-details">
          <span>Title</span>
          <input type="text" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} maxLength="100" placeholder={`Enter ${draft.type.toLowerCase()} title`} required/>
          <CharacterUsage value={draft.name} maxLength={100} minimumLimit={0}/>
        </label>
        <label className="key-win-modal-field bor-modal-link-field">
          <span>Objective</span>
          <select value={draft.objectiveId} onChange={(event) => updateObjective(event.target.value)} required>
            <option value="">Select objective</option>
            {hierarchy.map((objective, index) => <option key={objective.id} value={objective.id}>{objective.objective || `Untitled Objective ${index + 1}`}</option>)}
          </select>
        </label>
        {isBarrier && <label className="key-win-modal-field bor-modal-link-field">
          <span>Strategy</span>
          <select value={draft.strategyId} onChange={(event) => setDraft((current) => ({ ...current, strategyId: event.target.value }))} required>
            <option value="">Select strategy</option>
            {(selectedObjective?.strategies || []).map((strategy, index) => <option key={strategy.id} value={strategy.id}>{strategy.strategy || `Untitled Strategy ${index + 1}`}</option>)}
          </select>
        </label>}
        <label className="key-win-modal-field">
          <span>Impact</span>
          <select value={draft.impact} onChange={(event) => setDraft((current) => ({ ...current, impact: event.target.value }))} required>
            <option value="">Select impact</option>{impactOptions.map((option) => <option disabled={option.disabled} key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="key-win-modal-field">
          <span>Status</span>
          <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))} required>
            <option value="">Select status</option>{statusOptions.map((option) => <option disabled={option.disabled} key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="key-win-modal-field bor-modal-details">
          <span>Details</span>
          <textarea value={draft.details} onChange={(event) => setDraft((current) => ({ ...current, details: event.target.value }))} maxLength="5000" rows="8" placeholder={`Describe this ${draft.type.toLowerCase()}...`}/>
          <CharacterUsage value={draft.details} maxLength={5000}/>
        </label>
      </div>
      <div className="key-win-modal-actions">
        <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="button primary">Save {draft.type}</button>
      </div>
    </ModalForm>
  </div>;
}

function RecordCard({ canEdit = true, record, hierarchy, onEdit, onDelete }) {
  const strategy = record.type === 'Barrier'
    ? objectiveFor(hierarchy, record.objectiveId)?.strategies.find((item) => sameCrmId(item.id, record.strategyId))
    : null;
  return <article className={`bor-hierarchy-record ${record.type.toLowerCase()}`}>
    <div className="bor-hierarchy-record-copy">
      <h5>{record.name || record.type}</h5>
      <p>{record.details}</p>
      <div className="bor-chip-row">
        {strategy && <Pill tone="amber">{strategy.strategy || 'Untitled Strategy'}</Pill>}
        <Pill tone={record.impact === 'High' ? 'amber' : 'neutral'}>{record.impact} impact</Pill>
        <Pill tone={record.status === 'Open' ? 'green' : 'neutral'}>{record.status}</Pill>
      </div>
    </div>
    <div className="key-win-row-actions">
      <button disabled={!canEdit} type="button" className="key-win-edit-button" onClick={() => onEdit(record)}>Edit</button>
      <button disabled={!canEdit} type="button" className="key-win-delete-button" onClick={() => onDelete(record)} aria-label={`Delete ${record.name || record.type}`} title={`Delete ${record.type.toLowerCase()}`}><Icon name="trash" size={14}/></button>
    </div>
  </article>;
}

export default function BarriersRisksPage({ canEdit = true, commercialHierarchy, records, setRecords }) {
  const [filters, setFilters] = useState(emptyFilters);
  const [draft, setDraft] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [collapsedObjectiveIds, setCollapsedObjectiveIds] = useState(() => new Set());
  const [expandedGroupsByObjective, setExpandedGroupsByObjective] = useState({});
  const selectedObjective = objectiveFor(commercialHierarchy, filters.objectiveId);
  const availableStrategies = selectedObjective?.strategies || [];

  const visibleRecords = useMemo(() => records.filter((record) =>
    (filters.status === 'All' || (filters.status === 'Completed' ? isCompletedRecord(record) : !isCompletedRecord(record))) &&
    (filters.objectiveId === 'All' || sameCrmId(record.objectiveId, filters.objectiveId)) &&
    (record.type !== 'Barrier' || filters.strategyId === 'All' || sameCrmId(record.strategyId, filters.strategyId))
  ), [filters, records]);
  const openCount = records.filter((record) => !isCompletedRecord(record)).length;
  const closedCount = records.filter(isCompletedRecord).length;
  const barrierCount = activeRecordCount(records, 'Barrier');
  const opportunityCount = activeRecordCount(records, 'Opportunity');

  const setFilter = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'objectiveId' ? { strategyId: 'All' } : {}),
    }));
  };

  const saveRecord = async (record) => {
    const typeCount = activeRecordCount(records.filter((item) => item.id !== record.id), record.type);
    if (!isCompletedRecord(record) && typeCount >= maxRecordsPerType) { setSaveError('Only five active records of each type are allowed. Complete an existing record first.'); return; }
    setSaveError('');
    const saved = await setRecords((current) => record.id
      ? current.map((item) => item.id === record.id ? record : item)
      : [{
        ...record,
        id: `${record.type.toLowerCase()}-${Date.now()}`,
      }, ...current]);
    if (saved !== false) setDraft(null);
  };

  const editRecord = (record) => {
    setSaveError('');
    const objective = objectiveFor(commercialHierarchy, record.objectiveId);
    const strategy = objective?.strategies.find((item) => sameCrmId(item.id, record.strategyId));
    setDraft({ ...record, objectiveId: objective?.id || '', strategyId: strategy?.id || '' });
  };

  const deleteRecord = async (record) => {
    if (!await confirmDeletion(`Delete ${record.name || `this ${record.type.toLowerCase()}`}?`)) return;
    if (await setRecords((current) => current.filter((item) => item.id !== record.id)) === false) return;
    if (draft?.id === record.id) setDraft(null);
  };

  const toggleObjective = (objectiveId) => {
    setCollapsedObjectiveIds((current) => {
      const next = new Set(current);
      if (next.has(objectiveId)) next.delete(objectiveId);
      else next.add(objectiveId);
      return next;
    });
  };

  const toggleGroup = (objectiveId, group) => {
    setExpandedGroupsByObjective((current) => {
      const expandedGroups = current[objectiveId] || ['Barrier', 'Opportunity'];
      return {
        ...current,
        [objectiveId]: expandedGroups.includes(group)
          ? expandedGroups.filter((item) => item !== group)
          : [...expandedGroups, group],
      };
    });
  };

  const visibleObjectives = groupBarrierRecords(commercialHierarchy, visibleRecords);

  return <section className="bor-workspace">
    <article className="bor-tabs-panel">
      <div className="bor-page-heading">
        <div>
          <h2>Barriers &amp; Opportunities</h2>
        </div>
        <Pill tone="blue">{records.length} total records</Pill>
      </div>
    </article>

    <article className="bor-command-panel">
      <div className="bor-filter-toolbar">
        <div className="bor-selects">
          <label><select value={filters.objectiveId} onChange={(event) => setFilter('objectiveId', event.target.value)} aria-label="Objective filter"><option value="All">Objective (All)</option>{commercialHierarchy.map((objective, index) => <option key={objective.id} value={objective.id}>{objective.objective || `Untitled Objective ${index + 1}`}</option>)}</select></label>
          <label><select value={filters.strategyId} onChange={(event) => setFilter('strategyId', event.target.value)} aria-label="Barrier strategy filter" disabled={filters.objectiveId === 'All'}><option value="All">{filters.objectiveId === 'All' ? 'Select an objective first' : 'Barrier Strategy (All)'}</option>{availableStrategies.map((strategy, index) => <option key={strategy.id} value={strategy.id}>{strategy.strategy || `Untitled Strategy ${index + 1}`}</option>)}</select></label>
        </div>
        <div className="bor-status-row">
          <button type="button" className={filters.status === 'Open' ? 'is-active' : ''} onClick={() => setFilter('status', filters.status === 'Open' ? 'All' : 'Open')}><span>Open Barriers<br/>and Opportunities</span><strong>{openCount}</strong></button>
          <button type="button" className={filters.status === 'Completed' ? 'is-active' : ''} onClick={() => setFilter('status', filters.status === 'Completed' ? 'All' : 'Completed')}><span>Completed Barriers<br/>and Opportunities</span><strong>{closedCount}</strong></button>
        </div>
        <div className="bor-add-actions bor-command-add-actions">
          <div className="bor-add-control">
            <button type="button" className="button primary bor-add-button" onClick={() => setDraft(newDraft('Barrier'))} disabled={!canEdit || !commercialHierarchy.length || barrierCount >= maxRecordsPerType}><Icon name="plus" size={15}/> Add Barrier</button>
            <small>{barrierCount} of {maxRecordsPerType} active barriers</small>
          </div>
          <div className="bor-add-control">
            <button type="button" className="button primary bor-add-button" onClick={() => setDraft(newDraft('Opportunity'))} disabled={!canEdit || !commercialHierarchy.length || opportunityCount >= maxRecordsPerType}><Icon name="plus" size={15}/> Add Opportunity</button>
            <small>{opportunityCount} of {maxRecordsPerType} active opportunities</small>
          </div>
        </div>
      </div>
    </article>

    <article className="panel bor-record-panel">
      <div className="bor-record-heading">
        <div><h3>Objective Hierarchy</h3><p>Each objective contains its linked barriers and opportunities.</p></div>
        <Pill tone="blue">{visibleRecords.length} {visibleRecords.length === 1 ? 'record' : 'records'}</Pill>
      </div>
      <div className="bor-hierarchy">
        {visibleObjectives.length === 0 && <div className="bor-empty">No barriers or opportunities match the current filters.</div>}
        {visibleObjectives.map((objective) => {
          const isExpanded = !collapsedObjectiveIds.has(objective.id);
          const expandedGroups = expandedGroupsByObjective[objective.id] || ['Barrier', 'Opportunity'];
          const barriersExpanded = expandedGroups.includes('Barrier');
          const opportunitiesExpanded = expandedGroups.includes('Opportunity');
          const barrierStrategyGroups = groupBarrierStrategies(objective);
          return <section className={`bor-hierarchy-objective ${isExpanded ? 'is-expanded' : ''}`} key={objective.id}>
          <header className="bor-hierarchy-node-heading">
            <button type="button" className="bor-objective-toggle" onClick={() => toggleObjective(objective.id)} aria-expanded={isExpanded}>
              <span className="bor-objective-toggle-copy"><span>Objective</span><strong>{objective.objective || 'Untitled Objective'}</strong></span>
              <span className="bor-objective-toggle-icon" aria-hidden="true">{isExpanded ? '−' : '+'}</span>
            </button>
            <Pill tone="blue">{objective.barriers.length + objective.opportunities.length}</Pill>
          </header>
          {isExpanded && <div className="bor-objective-groups">
            <section className={`bor-type-group barrier-group ${barriersExpanded ? 'is-expanded' : ''}`}>
              <button type="button" className="bor-type-toggle" onClick={() => toggleGroup(objective.id, 'Barrier')} aria-expanded={barriersExpanded}>
                <span><h5>Strategy and Barriers</h5><Pill tone="amber">{objective.barriers.length}</Pill></span>
                <span className="bor-type-toggle-icon" aria-hidden="true">{barriersExpanded ? '−' : '+'}</span>
              </button>
              {barriersExpanded && <div className="bor-hierarchy-records">
                {objective.barriers.length ? barrierStrategyGroups.map((group) => <section className="bor-strategy-record-group" key={group.strategy.id}>
                  <div className="bor-strategy-record-group-heading"><span>Strategy</span><strong>{group.strategy.strategy || 'Untitled Strategy'}</strong></div>
                  <div className="bor-strategy-record-list">
                    <div className="bor-linked-barriers-heading"><span>Barriers</span><Pill tone="amber">{group.records.length}</Pill></div>
                    {group.records.map((record) => <RecordCard canEdit={canEdit} record={record} hierarchy={commercialHierarchy} onEdit={editRecord} onDelete={deleteRecord} key={record.id}/>)}
                  </div>
                </section>) : <p className="bor-group-empty">No matching barriers.</p>}
              </div>}
            </section>
            <section className={`bor-type-group opportunity-group ${opportunitiesExpanded ? 'is-expanded' : ''}`}>
              <button type="button" className="bor-type-toggle" onClick={() => toggleGroup(objective.id, 'Opportunity')} aria-expanded={opportunitiesExpanded}>
                <span><h5>Opportunities</h5><Pill tone="green">{objective.opportunities.length}</Pill></span>
                <span className="bor-type-toggle-icon" aria-hidden="true">{opportunitiesExpanded ? '−' : '+'}</span>
              </button>
              {opportunitiesExpanded && <div className="bor-hierarchy-records">
                {objective.opportunities.length ? objective.opportunities.map((record) => <RecordCard canEdit={canEdit} record={record} hierarchy={commercialHierarchy} onEdit={editRecord} onDelete={deleteRecord} key={record.id}/>) : <p className="bor-group-empty">No matching opportunities.</p>}
              </div>}
            </section>
          </div>}
        </section>})}
      </div>
    </article>

    {draft && <BarrierOpportunityModal error={saveError} draft={draft} setDraft={setDraft} hierarchy={commercialHierarchy} onClose={() => setDraft(null)} onSave={saveRecord}/>}
  </section>;
}
