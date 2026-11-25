import ModalForm from '@/components/ModalForm';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FieldHelpButton } from '@/components/EditModalField';
import AccountLookupField from '@/pages/AccountProfile/AccountLookupField';

const STAKEHOLDER_FIELD_HELP = {
  name: 'Select the HCP who has influence on account decisions or patient flow.',
  role: "Identify the stakeholder's role within the account (e.g., treater, referrer, administrator).",
  otherRole: "Specify the stakeholder's role when Role is Other.",
};

const IDENTITY_FIELDS = [
  { label: 'Stakeholder Name', key: 'name', readOnly: false, type: 'stakeholderLookup', help: STAKEHOLDER_FIELD_HELP.name },
  { label: 'Role', key: 'role', readOnly: false, type: 'select', help: STAKEHOLDER_FIELD_HELP.role },
];

const OTHER_ROLE_FIELD = {
  label: 'Other Role',
  key: 'otherRole',
  readOnly: false,
  type: 'text',
  required: true,
  help: STAKEHOLDER_FIELD_HELP.otherRole,
};

const OTHER_ROLE_REQUIRED_ERROR = 'Other Role is required when Role is Other.';
const isOtherStakeholderRole = (value) => String(value || '').trim().toLowerCase() === 'other';

// Preserve non-visible values in form state so editing Name or Role does not
// clear existing CRM fields when the shared stakeholder save mapper runs.
const buildInitialForm = (stakeholder) => {
  return {
    ...(stakeholder || {}),
    name: stakeholder?.name ?? '',
    role: stakeholder?.role ?? '',
    otherRole: stakeholder?.otherRole ?? '',
    profileRecordId: stakeholder?.profileRecordId ?? '',
  };
};

const sortAlphabetically = (values) =>
  [...values].sort((left, right) =>
    String(left).localeCompare(String(right), undefined, { sensitivity: 'base' })
  );

const mergeOptions = (current, options) => {
  const seen = new Set();
  const out = [];
  for (const value of [current, ...(options || [])]) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
};

const mergeSortedOptions = (current, options) => sortAlphabetically(mergeOptions(current, options));

const normalizeAccountId = (value) => {
  const text = String(value || '').trim();
  return text ? text.slice(0, 15).toLowerCase() : '';
};

function Field({ field, value, onChange, options = [] }) {
  const id = `stk-field-${field.key}`;
  const readOnly = field.alwaysReadOnly || field.readOnly;
  const type = field.type || 'text';
  const className = [
    'stakeholder-edit-field',
    `is-${type}`,
    readOnly ? 'is-readonly' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className}>
      <div className="stakeholder-edit-field-label-row">
        <label className="stakeholder-edit-field-label" htmlFor={id}>
          {field.label}
        </label>
        {field.help && (
          <FieldHelpButton
            className="stakeholder-edit-field-help"
            label={`${field.label} guidance`}
            text={field.help}
          />
        )}
      </div>
      {readOnly && (
        <input
          id={id}
          type="text"
          value={value || ''}
          placeholder="-"
          readOnly
          aria-readonly="true"
        />
      )}
      {type === 'select' && !readOnly && (
        <select
          id={id}
          value={value || ''}
          required={field.required}
          onChange={(e) => onChange(field.key, e.target.value)}
        >
          <option value="">Select {field.label.toLowerCase()}</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}
      {type === 'textarea' && !readOnly && (
        <textarea
          id={id}
          rows={2}
          value={value || ''}
          required={field.required}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      )}
      {type === 'text' && !readOnly && (
        <input
          id={id}
          type="text"
          value={value || ''}
          required={field.required}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      )}
    </div>
  );
}

export default function StakeholderEditModal({
  stakeholder,
  roleOptions = [],
  searchStakeholders,
  excludedStakeholderAccountIds = [],
  onClose,
  onSave,
  onDelete,
}) {
  const [form, setForm] = useState(() => buildInitialForm(stakeholder));
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const isEdit = !!stakeholder?.id;
  const isNew = !isEdit;
  const excludedStakeholderAccountIdSet = useMemo(
    () =>
      new Set(
        (excludedStakeholderAccountIds || [])
          .map(normalizeAccountId)
          .filter(Boolean)
      ),
    [excludedStakeholderAccountIds]
  );

  const filteredStakeholderSearch = useCallback(
    (query, limit) =>
      Promise.resolve(searchStakeholders ? searchStakeholders(query, limit) : []).then((rows) =>
        (rows || []).filter((account) => account && !excludedStakeholderAccountIdSet.has(normalizeAccountId(account.id)))
      ),
    [excludedStakeholderAccountIdSet, searchStakeholders]
  );

  // If the user opens edit on a different row without unmounting, refresh state.
  useEffect(() => {
    setForm(buildInitialForm(stakeholder));
    setSaveError('');
    setIsSaving(false);
    setDeleteConfirm(false);
  }, [stakeholder?.id]);

  // ESC closes the modal.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!stakeholder) return null;

  const updateField = (key, value) => {
    setSaveError('');
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'role' && !isOtherStakeholderRole(value) ? { otherRole: '' } : {}),
    }));
  };

  const updateStakeholderQuery = (value) => {
    setSaveError('');
    setForm((current) => ({
      ...current,
      name: value,
      profileRecordId: '',
      stakeholderId: '',
      primaryParent: '',
    }));
  };

  const selectStakeholderAccount = (account) => {
    setSaveError('');
    setForm((current) => ({
      ...current,
      name: account?.name || '',
      profileRecordId: account?.id || '',
      stakeholderId: account?.eid || account?.accountIdentifier || '',
      primaryParent: account?.primaryParent || '',
    }));
  };

  const optionsForField = (field) => {
    if (field.key === 'role') return mergeSortedOptions(form[field.key], roleOptions);
    return [];
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError('');
    const stakeholderNameChanged = String(form.name || '') !== String(stakeholder.name || '');
    if (searchStakeholders && (isNew || stakeholderNameChanged) && !form.profileRecordId) {
      setSaveError('Select a Stakeholder Name from the account search results.');
      return;
    }
    if (isOtherStakeholderRole(form.role) && !String(form.otherRole || '').trim()) {
      setSaveError(OTHER_ROLE_REQUIRED_ERROR);
      return;
    }
    setIsSaving(true);
    try {
      if (onSave) await onSave(stakeholder.id, form);
      onClose();
    } catch (error) {
      setSaveError(error && error.message ? error.message : 'Unable to save stakeholder.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || isNew) return;
    setSaveError('');
    setIsSaving(true);
    try {
      await onDelete(stakeholder);
      onClose();
    } catch (error) {
      setSaveError(error && error.message ? error.message : 'Unable to delete stakeholder.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="stakeholder-edit-overlay" onClick={isSaving ? undefined : onClose} role="presentation">
      <ModalForm validationError={saveError}
        className="stakeholder-edit-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSave}
        noValidate
      >
        <header className="stakeholder-edit-head">
          <div className="stakeholder-edit-title">
            <span className="stakeholder-edit-eyebrow">Stakeholder</span>
            <h3>{isNew ? 'Add Stakeholder' : 'Edit Stakeholder'}</h3>
            <p>{isNew ? 'Create a new stakeholder row' : stakeholder.name || 'Unnamed stakeholder'}</p>
          </div>
          <button
            type="button"
            className="stakeholder-edit-close"
            onClick={isSaving ? undefined : onClose}
            aria-label="Close"
            disabled={isSaving}
          />
        </header>

        <div className="stakeholder-edit-body">
          {deleteConfirm && (
            <div className="stakeholder-delete-warning-banner">
              Confirm delete for this stakeholder record. This cannot be undone.
            </div>
          )}
          <section className="stakeholder-edit-section">
            <div className="stakeholder-edit-grid">
              {IDENTITY_FIELDS.map((field) => {
                if (field.type === 'stakeholderLookup') {
                  return (
                    <AccountLookupField
                      key={field.key}
                      label="Stakeholder Name"
                      query={form.name}
                      placeholder="Search stakeholder name"
                      searchAccounts={filteredStakeholderSearch}
                      loadingText="Searching stakeholders..."
                      emptyText="No stakeholders found."
                      className="stakeholder-account-lookup-field"
                      resultLimit={50}
                      portalResults
                      help={field.help}
                      onQueryChange={updateStakeholderQuery}
                      onSelect={selectStakeholderAccount}
                    />
                  );
                }
                return (
                  <Field
                    key={field.key}
                    field={field}
                    value={form[field.key]}
                    onChange={updateField}
                    options={optionsForField(field)}
                  />
                );
              })}
              {isOtherStakeholderRole(form.role) && (
                <Field
                  field={OTHER_ROLE_FIELD}
                  value={form.otherRole}
                  onChange={updateField}
                />
              )}
            </div>
          </section>

        </div>

        <footer className="stakeholder-edit-foot">
          {isEdit && !deleteConfirm && onDelete && (
            <button
              type="button"
              className="critical-activity-delete-button"
              onClick={() => setDeleteConfirm(true)}
              disabled={isSaving}
            >
              Delete
            </button>
          )}
          {isEdit && deleteConfirm && (
            <>
              <button
                type="button"
                className="critical-activity-delete-button confirm"
                onClick={handleDelete}
                disabled={isSaving}
              >
                {isSaving ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button
                type="button"
                className="stakeholder-edit-button-secondary"
                onClick={() => setDeleteConfirm(false)}
                disabled={isSaving}
              >
                Keep Record
              </button>
            </>
          )}
          {!deleteConfirm && (
            <>
              <button type="button" className="stakeholder-edit-button-secondary" onClick={onClose} disabled={isSaving}>
                Cancel
              </button>
              <button type="submit" className="stakeholder-edit-button-primary" disabled={isSaving}>
                {isSaving ? 'Saving...' : isNew ? 'Add Stakeholder' : 'Save'}
              </button>
            </>
          )}
        </footer>
      </ModalForm>
    </div>
  );
}
