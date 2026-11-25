import CharacterUsage from '@/components/CharacterUsage';
import ModalForm from '@/components/ModalForm';
import { notifySaved } from '@/lib/helper/successNotice';
import { confirmDeletion } from '@/components/confirmDeletion';
import useCrmPicklist from '@/hooks/useCrmPicklist';
import { useEffect, useMemo, useState } from 'react';
import { Icon, Pill } from '@/components/MarketAccessUi';
import TableSortButton from '@/components/TableSortButton';
import { loadPayerStakeholders, savePayerStakeholder, deletePayerStakeholder } from '@/lib/dataservice/accountPlan/payerStakeholders';
import { formatPayerDate } from '@/lib/helper/payerDates';
import { nextTableSort, stableSortRows } from '@/lib/helper/tableSort';

const STAKEHOLDER_COLUMNS = [
  { key: 'nameRole', label: 'Name / Role' },
  { key: 'decisionInfluence', label: 'Decision Areas / Influence for Decision Area' },
  { key: 'relationshipStrength', label: 'Relationship Strength' },
  { key: 'topicsEvidence', label: 'Topics & Evidence of Interest' },
];

const emptyStakeholder = {
  id: '',
  name: '',
  roleFunction: '',
  contactInformation: '',
  decisionAreas: '',
  influence: '',
  relationshipStrength: '',
  topicsEvidence: '',
};

function StakeholderRecordModal({ record, onClose, onSave, busy, error }) {
  const relationshipStrengthOptions = useCrmPicklist('KPH_Stakeholder_Map__c', 'KPH_Stakeholder_Relationship_Strength__c').slice().sort((a, b) => {
    const order = { Limited: 0, Moderate: 1, Strong: 2 };
    return (order[a.label] ?? 99) - (order[b.label] ?? 99);
  });
  const [form, setForm] = useState(record);
  const isEditing = Boolean(record.id);
  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!busy) onSave(form);
  };

  return <div className="key-win-modal-overlay" role="presentation" onMouseDown={onClose}>
    <ModalForm className="key-win-modal stakeholder-record-modal" role="dialog" aria-modal="true" aria-labelledby="stakeholderRecordModalTitle" onMouseDown={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
      <div className="key-win-modal-head">
        <div><span>Stakeholder</span><h2 id="stakeholderRecordModalTitle">{isEditing ? 'Edit Stakeholder' : 'Add Stakeholder'}</h2></div>
        <button type="button" className="key-win-modal-close" aria-label="Close modal" onClick={onClose}><Icon name="close" size={17}/></button>
      </div>
      {error && <p className="executive-data-status executive-data-error" role="alert">{error}</p>}
      <div className="milestone-modal-scroll"><fieldset disabled={busy} className="key-win-modal-body stakeholder-record-modal-grid payer-stakeholder-fields" style={{ margin: 0, border: 0, minWidth: 0 }}>
        <label className="key-win-modal-field"><span>Name</span><input type="text" maxLength="100" value={form.name} onChange={(event) => updateField('name', event.target.value)} required/></label>
        <label className="key-win-modal-field"><span>Role / Function</span><input type="text" maxLength="100" value={form.roleFunction} onChange={(event) => updateField('roleFunction', event.target.value)} required/></label>
        <label className="key-win-modal-field"><span>Email (optional)</span><input type="email" maxLength="100" value={form.contactInformation} onChange={(event) => updateField('contactInformation', event.target.value)}/></label>
        <label className="key-win-modal-field"><span>Relationship Strength</span><select value={form.relationshipStrength} onChange={(event) => updateField('relationshipStrength', event.target.value)} required><option value="">Select relationship strength</option>{relationshipStrengthOptions.map((option) => <option disabled={option.disabled} value={option.value} key={option.value}>{option.label}</option>)}</select></label>
        <label className="key-win-modal-field"><span>Decision Areas</span><textarea rows="3" maxLength="250" value={form.decisionAreas} onChange={(event) => updateField('decisionAreas', event.target.value)} required/></label>
        <label className="key-win-modal-field"><span>Influence for Decision Area</span><textarea rows="3" maxLength="250" value={form.influence} onChange={(event) => updateField('influence', event.target.value)} required/></label>
        <label className="key-win-modal-field stakeholder-record-topics-field"><span>Topics &amp; Evidence of Interest</span><textarea rows="3" maxLength="1000" value={form.topicsEvidence} onChange={(event) => updateField('topicsEvidence', event.target.value)} required/>
          <CharacterUsage value={form.topicsEvidence} maxLength={1000}/></label>
      </fieldset></div>
      <div className="key-win-modal-actions">
        <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="button primary" disabled={busy}>{busy ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Stakeholder'}</button>
      </div>
    </ModalForm>
  </div>;
}

export default function StakeholderMapPage({ canEdit = true } = {}) {
  const [stakeholderRecords, setStakeholderRecords] = useState([]);
  const [dataStatus, setDataStatus] = useState('loading');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeStakeholder, setActiveStakeholder] = useState(null);
  const [stakeholderSort, setStakeholderSort] = useState(null);
  const sortedStakeholderRecords = useMemo(() => stableSortRows(stakeholderRecords, stakeholderSort, (row, key) => {
    if (key === 'nameRole') return `${row.name || ''} ${row.roleFunction || ''}`;
    if (key === 'decisionInfluence') return `${row.decisionAreas || ''} ${row.influence || ''}`;
    return row[key];
  }), [stakeholderRecords, stakeholderSort]);

  useEffect(() => {
    let cancelled = false;
    loadPayerStakeholders().then((data) => {
      if (!cancelled) { setStakeholderRecords(data.stakeholders); setDataStatus('ready'); }
    }).catch((error) => {
      if (!cancelled) { setError(error.message || 'Unable to load stakeholders.'); setDataStatus('error'); }
    });
    return () => { cancelled = true; };
  }, []);

  const saveStakeholder = async (record) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await savePayerStakeholder(record); notifySaved();
      setActiveStakeholder(null);
      const data = await loadPayerStakeholders();
      setStakeholderRecords(data.stakeholders);
    } catch (error) {
      setError(error.message || 'Unable to save stakeholder.');
    } finally { setBusy(false); }
  };

  const deleteStakeholder = async (record) => {
    if (busy || !await confirmDeletion(`Delete ${record.name}?`)) return;
    setBusy(true);
    setError('');
    try {
      await deletePayerStakeholder(record.id); notifySaved('Record deleted. Your changes have been saved.');
      setStakeholderRecords((current) => current.filter((item) => item.id !== record.id));
    } catch (error) {
      setError(error.message || 'Unable to delete stakeholder.');
    } finally { setBusy(false); }
  };

  return <section className="stakeholder-map-workspace">
    {dataStatus === 'loading' && <p className="executive-data-status">Loading stakeholders…</p>}
    {error && !activeStakeholder && <p className="executive-data-status executive-data-error" role="alert">{error}</p>}
    <section className="panel executive-section-card stakeholder-records-card">
      <div className="executive-section-heading stakeholder-records-heading">
        <div><h2>Key Stakeholders</h2><p>Capture each stakeholder’s role, influence, relationship, and evidence needs.</p></div>
        <button type="button" className="button primary" disabled={!canEdit || busy || dataStatus !== 'ready'} onClick={() => setActiveStakeholder({ ...emptyStakeholder })}><Icon name="plus" size={15}/> Add Stakeholder</button>
      </div>
      <div className="table-wrap stakeholder-records-table">
        <table>
          <thead><tr>
            {STAKEHOLDER_COLUMNS.map((column) => <th key={column.key}><TableSortButton column={column} sort={stakeholderSort} onSort={(key) => setStakeholderSort((current) => nextTableSort(current, key))}/></th>)}
            <th><span className="sr-only">Actions</span></th>
          </tr></thead>
          <tbody>{sortedStakeholderRecords.map((record) => <tr key={record.id}>
            <td data-label="Name / Role"><div className="stakeholder-name-role"><span><strong>{record.name}</strong><small>{record.roleFunction}</small><small>Created: {formatPayerDate(record.createdDate)}</small><small>Updated: {formatPayerDate(record.updatedDate)}</small></span>{record.contactInformation && <div className="stakeholder-email-icon" data-email={record.contactInformation} aria-label={`${record.name}: ${record.contactInformation}`}><Icon name="mail" size={15}/></div>}</div></td>
            <td data-label="Decision Areas / Influence for Decision Area"><span className="stakeholder-decision-influence"><strong>{record.decisionAreas}</strong><small>{record.influence}</small></span></td>
            <td data-label="Relationship Strength"><Pill tone={record.relationshipStrength === 'Strong' ? 'green' : record.relationshipStrength === 'Moderate' ? 'blue' : 'neutral'}>{record.relationshipStrength}</Pill></td>
            <td data-label="Topics & Evidence of Interest">{record.topicsEvidence}</td>
            <td data-label="Actions" className="stakeholder-record-actions-cell"><div className="stakeholder-record-actions">
              <button type="button" className="table-edit-button" disabled={!canEdit || busy} onClick={() => setActiveStakeholder(record)} aria-label={`Edit ${record.name}`} title="Edit stakeholder"><Icon name="edit" size={15}/></button>
              <button type="button" className="key-win-delete-button" disabled={!canEdit || busy} aria-label={`Delete ${record.name}`} title="Delete stakeholder" onClick={() => deleteStakeholder(record)}><Icon name="trash" size={14}/></button>
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>

    {activeStakeholder && <StakeholderRecordModal record={activeStakeholder} onClose={() => { if (!busy) { setActiveStakeholder(null); setError(''); } }} onSave={saveStakeholder} busy={busy} error={error}/>}
  </section>;
}
