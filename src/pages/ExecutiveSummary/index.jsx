import CharacterUsage from '@/components/CharacterUsage';
import AutoSizeTextarea from '@/components/AutoSizeTextarea';
import ModalForm from '@/components/ModalForm';
import { notifySaved } from '@/lib/helper/successNotice';
import { confirmDeletion } from '@/components/confirmDeletion';
import { createFieldQueue } from '@/lib/autosave/fieldQueue';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/MarketAccessUi';
import { FieldHelpButton } from '@/components/EditModalField';
import Payer360Badge from '@/components/Payer360Badge';
import TableSortButton from '@/components/TableSortButton';
import { nextTableSort, stableSortRows, toDateSortValue } from '@/lib/helper/tableSort';
import {
  ACCOUNT_DETAIL_FIELD_CONFIG,
  deletePayerSummaryRecord,
  loadPayerExecutiveSummary,
  savePayerCustomerAsk,
  savePayerKeyWin,
  savePayerArchetype,
  updatePayerSummaryPlanField,
  ANITO_LAUNCH_CONFIG,
} from '@/lib/dataservice/accountPlan/payerExecutiveSummary';
import { formatDate } from '@/lib/helper/utils';
import { formatPayerDate as formatKeyWinDate, payerDateInputValue } from '@/lib/helper/payerDates';

const KEY_WIN_COLUMNS = [
  { key: 'createdDate', label: 'Created Date' },
  { key: 'lastModifiedDate', label: 'Updated Date' },
  { key: 'date', label: 'Key Wins Date' },
  { key: 'description', label: 'Description' },
  { key: 'impact', label: 'Impact' },
];

const CUSTOMER_ASK_COLUMNS = [
  { key: 'dateCreated', label: 'Date Created' },
  { key: 'lastModifiedDate', label: 'Date Updated' },
  { key: 'stakeholder', label: 'Stakeholder' },
  { key: 'description', label: 'Description' },
];

function KeyWinModal({ record, onClose, onSave, onDelete }) {
  const isEdit = Boolean(record?.id);
  const [form, setForm] = useState({
    id: record?.id || '',
    date: payerDateInputValue(record?.date),
    description: record?.description || '',
    impact: record?.impact || '',
  });

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  return <div className="key-win-modal-overlay" role="presentation" onMouseDown={onClose}>
    <ModalForm
      className="key-win-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyWinModalTitle"
      onMouseDown={(event) => event.stopPropagation()}
      onSubmit={handleSubmit}
    >
      <header className="key-win-modal-head">
        <div><span>Key Wins</span><h2 id="keyWinModalTitle">{isEdit ? 'Edit Key Win' : 'Add Key Win'}</h2></div>
        <button type="button" className="key-win-modal-close" onClick={onClose} aria-label="Close key win modal">
          <Icon name="close" size={17}/>
        </button>
      </header>
      <div className="key-win-modal-body">
        <label className="key-win-modal-field">
          <span>Date</span>
          <input type="date" value={form.date} onChange={(event) => updateField('date', event.target.value)} required autoFocus/>
        </label>
        <label className="key-win-modal-field">
          <span>Description</span>
          <textarea rows="4" maxLength="5000" value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Describe the key win" required/>
          <CharacterUsage value={form.description} maxLength={5000}/>
        </label>
        <label className="key-win-modal-field">
          <span>Impact</span>
          <textarea rows="4" maxLength="5000" value={form.impact} onChange={(event) => updateField('impact', event.target.value)} placeholder="Describe the business impact" required/>
          <CharacterUsage value={form.impact} maxLength={5000}/>
        </label>
      </div>
      <footer className="key-win-modal-actions">
        {isEdit && <button type="button" className="button key-win-modal-delete" onClick={() => onDelete(record)}><Icon name="trash" size={15}/> Delete</button>}
        <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="button primary">{isEdit ? 'Save Changes' : 'Add Key Win'}</button>
      </footer>
    </ModalForm>
  </div>;
}

function CustomerAskModal({ record, onClose, onSave, onDelete }) {
  const isEdit = Boolean(record?.id);
  const [form, setForm] = useState({
    id: record?.id || '',
    dateCreated: payerDateInputValue(record?.dateCreated),
    stakeholderName: record?.stakeholderName || '',
    stakeholderRole: record?.stakeholderRole || '',
    description: record?.description || '',
  });

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  return <div className="key-win-modal-overlay" role="presentation" onMouseDown={onClose}>
    <ModalForm className="key-win-modal" role="dialog" aria-modal="true" aria-labelledby="customerAskModalTitle" onMouseDown={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
      <header className="key-win-modal-head">
        <div><span>Key Payer Asks</span><h2 id="customerAskModalTitle">{isEdit ? 'Edit Payer Ask' : 'Add Payer Ask'}</h2></div>
        <button type="button" className="key-win-modal-close" onClick={onClose} aria-label="Close payer ask modal"><Icon name="close" size={17}/></button>
      </header>
      <div className="key-win-modal-body">
        <label className="key-win-modal-field">
          <span>Date Created</span>
          <input type="date" value={form.dateCreated} readOnly aria-label="Date created"/>
        </label>
        <fieldset className="milestone-person-fields customer-ask-stakeholder-fields">
          <legend>Stakeholder</legend>
          <label className="key-win-modal-field">
            <span>Stakeholder Name</span>
            <input type="text" maxLength="100" value={form.stakeholderName} onChange={(event) => setForm((current) => ({ ...current, stakeholderName: event.target.value }))} placeholder="Enter stakeholder name" required autoFocus/>
          </label>
          <label className="key-win-modal-field">
            <span>Stakeholder Role</span>
            <input type="text" maxLength="100" value={form.stakeholderRole} onChange={(event) => setForm((current) => ({ ...current, stakeholderRole: event.target.value }))} placeholder="e.g., Medical Director" required/>
          </label>
        </fieldset>
        <label className="key-win-modal-field">
          <span>Description</span>
          <textarea rows="5" maxLength="1000" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe the payer ask" required/>
          <CharacterUsage value={form.description} maxLength={1000}/>
        </label>
      </div>
      <footer className="key-win-modal-actions">
        {isEdit && <button type="button" className="button key-win-modal-delete" onClick={() => onDelete(record)}><Icon name="trash" size={15}/> Delete</button>}
        <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="button primary">{isEdit ? 'Save Changes' : 'Add Payer Ask'}</button>
      </footer>
    </ModalForm>
  </div>;
}

const todayInputValue = () => {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60_000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
};

export default function ExecutiveSummaryPage({ canEdit = true } = {}) {
  const [planId, setPlanId] = useState(null);
  const [accountDetails, setAccountDetails] = useState({});
  const [detailSaveStatus, setDetailSaveStatus] = useState({});
  const detailSavesInFlight = useRef(new Set());
  const [payerRestrictiveness, setPayerRestrictiveness] = useState({ value: '', definition: '', updatedDate: null, options: [] });
  const [anitoCelLaunch, setAnitoCelLaunch] = useState({ meetingRequestSent: '', valuePropDelivered: '', options: {}, updatedDate: null });
  const [customerAsks, setCustomerAsks] = useState([]);
  const [activeCustomerAsk, setActiveCustomerAsk] = useState(null);
  const [keyWins, setKeyWins] = useState([]);
  const [activeKeyWin, setActiveKeyWin] = useState(null);
  const [keyWinSort, setKeyWinSort] = useState(null);
  const [customerAskSort, setCustomerAskSort] = useState(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState({});
  const autoSave = useRef(null);
  const planRef = useRef(null);
  const alive = useRef(true);
  if (!autoSave.current) autoSave.current = createFieldQueue({
    save: async (key, value) => {
      if (key === 'archetype') {
        const definition = await savePayerArchetype(planRef.current, value);
        if (alive.current) setPayerRestrictiveness((current) => current.value === value ? { ...current, definition } : current);
        return;
      }
      const config = ANITO_LAUNCH_CONFIG.find((item) => item.key === key);
      return updatePayerSummaryPlanField(planRef.current,
        config?.field || 'KPH_Payer_Restrictiveness__c',
        config?.updatedField || 'KPH_Payer_Restrictiveness_updated_date__c', value);
    },
    onState: (key, status, error) => {
      if (!alive.current) return;
      setAutoSaveStatus((current) => ({ ...current, [key]: { status, error: error?.message } }));
      if (status === 'saved') {
        notifySaved();
        const updatedDate = todayInputValue();
        if (key === 'archetype') setPayerRestrictiveness((current) => ({ ...current, updatedDate }));
        else if (ANITO_LAUNCH_CONFIG.some((config) => config.key === key)) setAnitoCelLaunch((current) => ({ ...current, updatedDate }));
      }
    },
  });
  useEffect(() => {
    alive.current = true;
    const flush = () => { autoSave.current.flush(); };
    const visibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      alive.current = false;
      flush();
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  const [dataStatus, setDataStatus] = useState('loading');
  const [dataError, setDataError] = useState('');

  const applySummary = (summary) => {
    setPlanId(summary.planId);
    planRef.current = summary.planId;
    setAccountDetails(Object.fromEntries(Object.entries(summary.accountDetails).map(([key, detail]) => [key, { ...detail, savedValue: detail.value }])));
    setPayerRestrictiveness(summary.payerRestrictiveness);
    setAnitoCelLaunch(summary.anitoCelLaunch);
    setKeyWins(summary.keyWins);
    setCustomerAsks(summary.customerAsks);
    setDataStatus('ready');
    setDataError('');
  };

  const reloadSummary = () => loadPayerExecutiveSummary().then((summary) => {
    setKeyWins(summary.keyWins);
    setCustomerAsks(summary.customerAsks);
  });

  useEffect(() => {
    let cancelled = false;
    loadPayerExecutiveSummary().then(
      (summary) => {
        if (!cancelled) applySummary(summary);
      },
      (error) => {
        console.error('[payer-executive-summary] load failed', error);
        if (!cancelled) {
          setDataStatus('error');
          setDataError(error?.message || 'Unable to load Executive Summary data.');
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);
  const sortedKeyWins = useMemo(() => stableSortRows(keyWins, keyWinSort, (row, key) => (
    ['createdDate', 'lastModifiedDate', 'date'].includes(key) ? toDateSortValue(row[key]) : row[key]
  )), [keyWins, keyWinSort]);
  const sortedCustomerAsks = useMemo(() => stableSortRows(customerAsks, customerAskSort, (row, key) => {
    if (['dateCreated', 'lastModifiedDate'].includes(key)) return toDateSortValue(row[key]);
    if (key === 'stakeholder') return `${row.stakeholderName || ''} ${row.stakeholderRole || ''}`;
    return row[key];
  }), [customerAsks, customerAskSort]);

  const saveKeyWin = async (keyWin) => {
    try {
      await savePayerKeyWin(planId, keyWin); notifySaved();
      await reloadSummary();
      setActiveKeyWin(null);
    } catch (error) {
      console.error('[payer-executive-summary] key win save failed', error);
      setDataError(error?.message || 'Unable to save the Key Win.');
    }
  };

  const deleteKeyWin = async (keyWin) => {
    if (!await confirmDeletion(`Delete this key win: "${keyWin.description}"?`)) return;
    try {
      await deletePayerSummaryRecord(keyWin.id, planId, 'keyWin'); notifySaved('Record deleted. Your changes have been saved.');
      setKeyWins((current) => current.filter((row) => row.id !== keyWin.id));
      setDataError('');
      setActiveKeyWin(null);
    } catch (error) {
      console.error('[payer-executive-summary] key win delete failed', error);
      setDataError(error?.message || 'Unable to delete the Key Win.');
    }
  };

  const saveCustomerAsk = async (customerAsk) => {
    try {
      await savePayerCustomerAsk(planId, customerAsk); notifySaved();
      await reloadSummary();
      setActiveCustomerAsk(null);
    } catch (error) {
      console.error('[payer-executive-summary] payer ask save failed', error);
      setDataError(error?.message || 'Unable to save the Payer Ask.');
    }
  };

  const deleteCustomerAsk = async (customerAsk) => {
    if (!await confirmDeletion(`Delete this payer ask: "${customerAsk.description}"?`)) return;
    try {
      await deletePayerSummaryRecord(customerAsk.id, planId, 'customerAsk'); notifySaved('Record deleted. Your changes have been saved.');
      setCustomerAsks((current) => current.filter((row) => row.id !== customerAsk.id));
      setDataError('');
      setActiveCustomerAsk(null);
    } catch (error) {
      console.error('[payer-executive-summary] payer ask delete failed', error);
      setDataError(error?.message || 'Unable to delete the Payer Ask.');
    }
  };

  const updateAccountDetailValue = (key, value) => {
    setAccountDetails((current) => ({
      ...current,
      [key]: { ...current[key], value },
    }));
    setDetailSaveStatus((current) => ({ ...current, [key]: { status: 'edited' } }));
  };

  const saveAccountDetail = async (key) => {
    if (dataStatus !== 'ready' || detailSavesInFlight.current.has(key)) return;
    const config = ACCOUNT_DETAIL_FIELD_CONFIG.find((field) => field.key === key);
    if (!config) return;
    const value = accountDetails[key]?.value || '';
    if (value === (accountDetails[key]?.savedValue || '')) return;
    detailSavesInFlight.current.add(key);
    setDetailSaveStatus((current) => ({ ...current, [key]: { status: 'saving' } }));
    try {
      await updatePayerSummaryPlanField(planRef.current, config.field, config.updatedField, value);
      if (!alive.current) return;
      setAccountDetails((current) => ({ ...current, [key]: { ...current[key], savedValue: value, updatedDate: todayInputValue() } }));
      setDetailSaveStatus((current) => ({ ...current, [key]: { status: 'saved' } }));
      notifySaved();
    } catch (error) {
      if (alive.current) setDetailSaveStatus((current) => ({ ...current, [key]: { status: 'error', error: error?.message || `Unable to save ${config.label}.` } }));
    } finally {
      detailSavesInFlight.current.delete(key);
    }
  };

  const saveRestrictiveness = (value) => {
    setPayerRestrictiveness((current) => ({ ...current, value, definition: '' }));
    autoSave.current.change('archetype', value, true);
  };

  const archetypeOptions = payerRestrictiveness.options;
  const selectedArchetype = archetypeOptions.find((option) => option.value === payerRestrictiveness.value);

  return <div className="executive-summary-form">
    <div role="status" aria-live="polite">
      {Object.values(autoSaveStatus).some((item) => ['pending', 'saving'].includes(item.status)) && <p>Saving changes…</p>}
    </div>
    {Object.values(autoSaveStatus).some((item) => item.status === 'error') && <p role="alert">
      Changes could not be saved. Your updated values are still shown. {Object.values(autoSaveStatus).find((item) => item.status === 'error')?.error}
      <button disabled={!canEdit} type="button" onClick={() => autoSave.current.flush()}>Retry saving</button>
    </p>}
    {dataStatus === 'loading' && <p className="executive-data-status">Loading Executive Summary data…</p>}
    {dataError && <p className="executive-data-status executive-data-error" role="alert">{dataError}</p>}
    <section className="panel executive-detail-card" aria-label="Account details">
      <div className="executive-field-grid executive-detail-grid">
        {ACCOUNT_DETAIL_FIELD_CONFIG.map((config) => <div className="executive-field executive-dashboard-field executive-dashboard-editable" key={config.key}>
          <span className="payer360-field-label">{config.label} <Payer360Badge/></span>
          <AutoSizeTextarea
            rows="1"
            maxLength="250"
            value={accountDetails[config.key]?.value || ''}
            onChange={(event) => updateAccountDetailValue(config.key, event.target.value)}
            placeholder={`Enter ${config.label}`}
            aria-label={config.label}
            aria-describedby={`${config.key}-character-count`}
            disabled={!canEdit || dataStatus !== 'ready' || detailSaveStatus[config.key]?.status === 'saving'}
          />
          <small className="executive-field-metadata">
            <span>Updated: {formatDate(accountDetails[config.key]?.updatedDate)}</span>
            <CharacterUsage as="span" className="" id={`${config.key}-character-count`} value={accountDetails[config.key]?.value} maxLength={250} minimumLimit={0}/>
          </small>
          <div className="executive-detail-save-row">
            <small>{(accountDetails[config.key]?.value || '') !== (accountDetails[config.key]?.savedValue || '') ? 'Unsaved changes' : ''}</small>
            <button type="button" className="button secondary" aria-label={`Save ${config.label}`} onClick={() => saveAccountDetail(config.key)} disabled={!canEdit || dataStatus !== 'ready' || detailSaveStatus[config.key]?.status === 'saving' || (accountDetails[config.key]?.value || '') === (accountDetails[config.key]?.savedValue || '')}>
              {detailSaveStatus[config.key]?.status === 'saving' ? 'Saving…' : 'Save'}
            </button>
          </div>
          {detailSaveStatus[config.key]?.status === 'error' && <small className="executive-data-error" role="alert">{detailSaveStatus[config.key].error}</small>}
        </div>)}
        <div className="executive-field payer-restrictiveness-field">
          <span className="payer-archetype-label-row">
            <label htmlFor="payer-archetype">Payer Archetype</label>
            <Payer360Badge/>
            <FieldHelpButton variant="reminder" label="Archetype selection guidance" text={<>
              <strong>Archetype selection guidance</strong>
              <p>Use when unavailable in Payer360.</p>
              <strong>CAR T Bystander:</strong>
              <ul>
                <li>If network size &lt;15 sites</li>
                <li>Or if no CAR T network</li>
                <li>Or if details unavailable</li>
              </ul>
              <strong>Cautious Reviewer:</strong>
              <ul><li>If network size &gt;15 sites and network porosity &gt;40%</li></ul>
              <strong>Network Enforcer:</strong>
              <ul><li>If network size &gt;15 sites and network porosity &lt;40%</li></ul>
              <p>Network porosity = % of out-of-network patients [who received CAR T]</p>
            </>}/>
          </span>
          <select id="payer-archetype" value={selectedArchetype?.value || ''} onChange={(event) => saveRestrictiveness(event.target.value)} aria-label="Payer Archetype" disabled={!canEdit || dataStatus !== 'ready'} required>
            <option value="">Select archetype</option>
            {archetypeOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
          <small>Updated: {formatDate(payerRestrictiveness.updatedDate)}</small>
        </div>
        <label className="executive-field payer-archetype-definition-field">
          <span>Payer Archetype Definition</span>
          <AutoSizeTextarea
            rows="2"
            readOnly
            value={payerRestrictiveness.definition || ''}
            placeholder={['pending', 'saving'].includes(autoSaveStatus.archetype?.status) ? 'Updating definition…' : ''}
            aria-busy={['pending', 'saving'].includes(autoSaveStatus.archetype?.status)}
            aria-label="Payer Archetype Definition"
          />
        </label>
      </div>
    </section>

    <section className="panel executive-section-card" aria-labelledby="anito-cel-launch-heading">
      <h2 id="anito-cel-launch-heading">Anito-cel Launch</h2>
      <small>Updated: {formatKeyWinDate(anitoCelLaunch.updatedDate)}</small>
      <div className="executive-field-grid anito-cel-launch-grid">
        <label className="executive-field">
          <span>Day 1 Approved Email + Value Prop Meeting Request Sent</span>
          <select
            disabled={!canEdit || dataStatus !== 'ready' || !anitoCelLaunch.options?.meetingRequestSent?.length} value={anitoCelLaunch.meetingRequestSent}
            onChange={(event) => { const value = event.target.value; setAnitoCelLaunch((current) => ({ ...current, meetingRequestSent: value })); autoSave.current.change('meetingRequestSent', value, true); }}
          >
            <option value="">Select status</option>
            {(anitoCelLaunch.options?.meetingRequestSent || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="executive-field">
          <span>Value Prop Delivered within 90 days of Launch</span>
          <select
            disabled={!canEdit || dataStatus !== 'ready' || !anitoCelLaunch.options?.valuePropDelivered?.length} value={anitoCelLaunch.valuePropDelivered}
            onChange={(event) => { const value = event.target.value; setAnitoCelLaunch((current) => ({ ...current, valuePropDelivered: value })); autoSave.current.change('valuePropDelivered', value, true); }}
          >
            <option value="">Select status</option>
            {(anitoCelLaunch.options?.valuePropDelivered || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>
    </section>

    <section className="panel executive-section-card">
      <div className="executive-section-heading">
        <h2>Key Wins</h2>
        <button type="button" className="button primary" disabled={!canEdit || dataStatus !== 'ready'} onClick={() => setActiveKeyWin({ date: '', description: '', impact: '' })}>
          <Icon name="plus" size={15}/> Add Key Win
        </button>
      </div>
      <div className="table-wrap executive-wins-table">
        <table>
          <thead><tr>{KEY_WIN_COLUMNS.map((column) => <th key={column.key}><TableSortButton column={column} sort={keyWinSort} onSort={(key) => setKeyWinSort((current) => nextTableSort(current, key))}/></th>)}<th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{sortedKeyWins.map((keyWin) => <tr key={keyWin.id}>
            <td data-label="Created Date">{formatKeyWinDate(keyWin.createdDate)}</td>
            <td data-label="Updated Date">{formatKeyWinDate(keyWin.lastModifiedDate)}</td>
            <td data-label="Key Wins Date">{formatKeyWinDate(keyWin.date)}</td>
            <td data-label="Description">{keyWin.description}</td>
            <td data-label="Impact">{keyWin.impact}</td>
            <td data-label="Actions" className="key-win-actions-cell"><div className="key-win-row-actions">
              <button disabled={!canEdit} type="button" className="table-edit-button" onClick={() => setActiveKeyWin(keyWin)} aria-label={`Edit key win: ${keyWin.description}`} title="Edit key win"><Icon name="edit" size={15}/></button>
              <button disabled={!canEdit} type="button" className="key-win-delete-button" onClick={() => deleteKeyWin(keyWin)} aria-label={`Delete key win: ${keyWin.description}`} title="Delete key win"><Icon name="trash" size={15}/></button>
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>

    <section className="panel executive-section-card executive-customer-asks">
      <div className="executive-section-heading">
        <h2>Key Payer Asks</h2>
        <button type="button" className="button primary" disabled={!canEdit || dataStatus !== 'ready' || customerAsks.length >= 5} onClick={() => setActiveCustomerAsk({ dateCreated: todayInputValue(), stakeholderName: '', stakeholderRole: '', description: '' })} title={customerAsks.length >= 5 ? 'Maximum of 5 payer asks' : 'Add payer ask'}><Icon name="plus" size={15}/> Add Payer Ask</button>
      </div>
      <div className="table-wrap executive-wins-table customer-asks-table">
        <table>
          <thead><tr>{CUSTOMER_ASK_COLUMNS.map((column) => <th key={column.key}><TableSortButton column={column} sort={customerAskSort} onSort={(key) => setCustomerAskSort((current) => nextTableSort(current, key))}/></th>)}<th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{sortedCustomerAsks.map((customerAsk) => <tr key={customerAsk.id}>
            <td data-label="Date Created">{formatKeyWinDate(customerAsk.dateCreated)}</td>
            <td data-label="Date Updated">{formatKeyWinDate(customerAsk.lastModifiedDate)}</td>
            <td data-label="Stakeholder"><span className="milestone-person"><strong>{customerAsk.stakeholderName}</strong><small>{customerAsk.stakeholderRole}</small></span></td>
            <td data-label="Description">{customerAsk.description}</td>
            <td data-label="Actions" className="key-win-actions-cell"><div className="key-win-row-actions">
              <button disabled={!canEdit} type="button" className="table-edit-button" onClick={() => setActiveCustomerAsk(customerAsk)} aria-label={`Edit payer ask: ${customerAsk.description}`} title="Edit payer ask"><Icon name="edit" size={15}/></button>
              <button disabled={!canEdit} type="button" className="key-win-delete-button" onClick={() => deleteCustomerAsk(customerAsk)} aria-label={`Delete payer ask: ${customerAsk.description}`} title="Delete payer ask"><Icon name="trash" size={15}/></button>
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
    {activeKeyWin && <KeyWinModal record={activeKeyWin} onClose={() => setActiveKeyWin(null)} onSave={saveKeyWin} onDelete={deleteKeyWin}/>}
    {activeCustomerAsk && <CustomerAskModal record={activeCustomerAsk} onClose={() => setActiveCustomerAsk(null)} onSave={saveCustomerAsk} onDelete={deleteCustomerAsk}/>}
  </div>;
}
