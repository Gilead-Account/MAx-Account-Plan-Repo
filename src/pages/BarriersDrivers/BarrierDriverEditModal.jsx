import ModalForm from '@/components/ModalForm';
import { useEffect, useMemo, useState } from 'react';
import {
  BARRIER_DRIVER_STATUS_ORDER,
  barrierDriverUsesStrategy,
  filterBarrierDriverIndicationsForType,
  isBarrierDriverIndicationAllowedForType,
  isClosedBarrierDriverStatus,
  isOpenBarrierDriverStatus,
} from '@/lib/dataservice/accountPlan/shared';
import { optionsForControllerValue } from '@/lib/dataservice/accountPlan/dependentPicklists';
import Field from '@/components/EditModalField';
import { optionsWithTransientValue } from '@/pages/BarriersDrivers/barrierDriverModalOptions';
import { medicalRecordTypeLabel } from '@/lib/medicalTerminology';
import { CRITICAL_ACTIVITY_HELP } from '@/pages/CriticalActivities/criticalActivityHelp';
import {
  labelForPicklistValue,
  medicalTacticOptionsForParent,
} from '@/lib/dataservice/accountPlan/titlePicklistMappings';
import {
  escapeBelongsToFieldControl,
  isDirectBackdropClick,
} from '@/lib/helper/modalDismiss';

const BARRIER_DRIVER_HELP = {
  title: 'Select the approved barrier or opportunity title.',
  status: 'Indicates the current stage (e.g., identified, in progress, etc).',
  indication: 'Select the relevant disease area this barrier or opportunity applies to.',
  strategy: 'Select the medical strategic focus aligned to this barrier or opportunity.',
  comments:
    'Provide relevant context or observations to help explain the barrier or opportunity and its impact on the account.',
};

const EMPTY_OPTIONS = [];
const EMPTY_LABELS = {};

const buildInitialForm = (record, defaultType) => ({
  id: record?.id || null,
  type: record?.type || defaultType || 'Barrier',
  name: record?.name || '',
  status: record?.status || '',
  indication: record?.indication || '',
  strategy: barrierDriverUsesStrategy(record?.indication) ? (record?.strategy || '') : '',
  category: record?.categoryValue || record?.category || '',
  businessImpact: record?.businessImpact || '',
  comments: record?.comments || '',
});

const buildInitialTacticForm = (statusOptions = []) => ({
  title: '',
  details: '',
  status: '',
  accountable: '',
  dueDate: '',
});

const firstOptionList = (...lists) => lists.find((list) => Array.isArray(list) && list.length) || [];

const strategyLabelForValue = (picklists, value) => {
  const labels = picklists?.strategyLabels;
  if (!value || !labels || typeof labels !== 'object') return value;
  return Object.prototype.hasOwnProperty.call(labels, value) ? (labels[value] || value) : value;
};

export default function BarrierDriverEditModal({
  record,
  defaultType,
  picklists,
  accountableOptions = EMPTY_OPTIONS,
  activityStatusOptions = EMPTY_OPTIONS,
  medicalTacticOptions = EMPTY_OPTIONS,
  medicalTacticTitleLabels = EMPTY_LABELS,
  medicalTacticOptionsByParentTitle = EMPTY_LABELS,
  isSaving,
  error,
  onClose,
  onSave,
  modalClassName = '',
  hideSubtitle = false,
  headerSubtitle,
  children,
}) {
  const isEdit = !!record?.id;
  const statusOnlyMode = isEdit && isClosedBarrierDriverStatus(record?.status);
  const [form, setForm] = useState(() => buildInitialForm(record, defaultType));
  const [tacticForm, setTacticForm] = useState(() => buildInitialTacticForm(activityStatusOptions));
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setForm(buildInitialForm(record, defaultType));
    setTacticForm(buildInitialTacticForm(activityStatusOptions));
    setValidationError('');
  }, [record?.id, defaultType]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !isSaving && !escapeBelongsToFieldControl(e)) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSaving, onClose]);

  const availableStatusOptions = picklists?.barrierStatuses || ['Open', 'Closed'];
  const createStatusOptions = availableStatusOptions.filter(isOpenBarrierDriverStatus);
  const statusOptions = isEdit
    ? availableStatusOptions
    : (createStatusOptions.length ? createStatusOptions : [BARRIER_DRIVER_STATUS_ORDER[0]]);
  const hasIndication = !!form.indication;
  const usesStrategy = barrierDriverUsesStrategy(form.indication);
  const dependentStrategySource = optionsForControllerValue(
    picklists?.strategyOptionsByIndication,
    form.indication
  );
  const strategySource = !usesStrategy
    ? []
    : dependentStrategySource ||
      firstOptionList(picklists?.barrierStrategies, picklists?.dlbclStrategies, picklists?.portfolioStrategies);
  const indicationOptions = useMemo(
    () => filterBarrierDriverIndicationsForType(
      picklists?.barrierDriverIndications,
      form.type,
      form.indication
    ),
    [form.indication, form.type, picklists?.barrierDriverIndications]
  );
  const strategyOptions = useMemo(
    () => (usesStrategy ? optionsWithTransientValue(form.strategy, strategySource || picklists?.barrierStrategies) : []),
    [form.strategy, strategySource, picklists?.barrierStrategies, usesStrategy]
  );
  const allTitleOptions = form.type === 'Driver'
    ? (picklists?.driverTitles || [])
    : (picklists?.barrierTitles || []);
  const titleOptionsByIndication = form.type === 'Driver'
    ? picklists?.driverTitleOptionsByIndication
    : picklists?.barrierTitleOptionsByIndication;
  const dependentTitleSource = optionsForControllerValue(
    titleOptionsByIndication,
    form.indication
  );
  const titleSource = hasIndication
    ? (dependentTitleSource ?? allTitleOptions)
    : [];
  const titleLabels = form.type === 'Driver'
    ? (picklists?.driverTitleLabels || {})
    : (picklists?.barrierTitleLabels || {});
  const titleOptions = useMemo(
    () => optionsWithTransientValue(form.name, titleSource),
    [form.name, titleSource]
  );
  const linkedParentPreview = useMemo(() => ({
    name: form.name,
    type: form.type,
    indication: form.indication,
  }), [form.indication, form.name, form.type]);
  const mappedMedicalTacticOptions = useMemo(
    () => medicalTacticOptionsForParent(
      linkedParentPreview,
      medicalTacticOptionsByParentTitle,
      tacticForm.title
    ).filter((option) => !medicalTacticOptions.length || medicalTacticOptions.includes(option)),
    [
      linkedParentPreview,
      medicalTacticOptions,
      medicalTacticOptionsByParentTitle,
      tacticForm.title,
    ]
  );
  const modalAccountableOptions = useMemo(
    () => optionsWithTransientValue(tacticForm.accountable, accountableOptions),
    [accountableOptions, tacticForm.accountable]
  );
  const modalActivityStatusOptions = useMemo(
    () => optionsWithTransientValue(tacticForm.status, activityStatusOptions),
    [activityStatusOptions, tacticForm.status]
  );

  const updateField = (key, value) => {
    setValidationError('');
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'indication') {
        next.strategy = '';
        next.category = '';
        next.name = '';
      }
      if (key === 'type') {
        next.category = '';
        next.name = '';
      }
      return next;
    });
    if (key === 'name' || key === 'type' || key === 'indication') {
      setTacticForm((current) => ({ ...current, title: '' }));
    }
  };

  const updateTacticField = (key, value) => {
    setValidationError('');
    setTacticForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submission = usesStrategy ? form : { ...form, strategy: '', strategyRank: null, planStrategyId: null };
    if (!submission.type) {
      setValidationError('Type is required.');
      return;
    }
    if (!submission.status) {
      setValidationError('Status is required.');
      return;
    }
    if (statusOnlyMode) {
      if (onSave) onSave({ ...submission, statusOnlyUpdate: true });
      return;
    }
    if (!submission.name.trim()) {
      setValidationError(`${typeLabel} Title is required.`);
      return;
    }
    if (titleSource.length && !titleOptions.includes(submission.name)) {
      setValidationError(`Select a valid ${typeLower} title.`);
      return;
    }
    if (!submission.indication) {
      setValidationError('Indication is required.');
      return;
    }
    if (!isBarrierDriverIndicationAllowedForType(submission.type, submission.indication)) {
      setValidationError('MM indication is available for opportunities only.');
      return;
    }
    if (usesStrategy && !submission.strategy) {
      setValidationError('Medical Strategy is required.');
      return;
    }
    if (usesStrategy && strategyOptions.length && !strategyOptions.includes(submission.strategy)) {
      setValidationError('Select a valid medical strategy.');
      return;
    }
    if (!submission.comments.trim()) {
      setValidationError('Comments are required.');
      return;
    }
    if (!isEdit) {
      if (!tacticForm.title.trim() || !tacticForm.details.trim() || !tacticForm.dueDate) {
        setValidationError('Medical Tactic, Details, and Due Date are required.');
        return;
      }
      if (!mappedMedicalTacticOptions.includes(tacticForm.title)) {
        setValidationError('Select an active Medical Tactic value from CRM.');
        return;
      }
      if (
        tacticForm.accountable &&
        modalAccountableOptions.length &&
        !modalAccountableOptions.includes(tacticForm.accountable)
      ) {
        setValidationError('Select a valid accountable POD member.');
        return;
      }
    }
    if (onSave) {
      onSave(
        submission,
        isEdit ? null : { ...tacticForm, indication: submission.indication }
      );
    }
  };

  const typeLabel = medicalRecordTypeLabel(form.type);
  const typeLower = typeLabel.toLowerCase();
  const title = isEdit ? `Edit ${typeLabel}` : `New ${typeLabel}`;
  const subtitle = isEdit
    ? `${typeLabel} · ${form.name || 'Untitled'}`
    : `Create a new ${typeLower} for this account plan.`;
  const displayedSubtitle = headerSubtitle ?? subtitle;
  const modalClassNames = [
    'stakeholder-edit-modal',
    'bd-barrier-driver-modal',
    !isEdit ? 'bd-create-with-tactic-modal' : '',
    modalClassName,
  ].filter(Boolean).join(' ');

  return (
    <div
      className="stakeholder-edit-overlay"
      onClick={isSaving ? undefined : (event) => {
        if (isDirectBackdropClick(event)) onClose();
      }}
      role="presentation"
    >
      <ModalForm validationError={validationError}
        className={modalClassNames}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="barrier-driver-modal-title"
      >
        <header className="stakeholder-edit-head">
          <div className="stakeholder-edit-title">
            <h3 id="barrier-driver-modal-title">{title}</h3>
            {!hideSubtitle ? <p>{displayedSubtitle}</p> : null}
          </div>
          <button
            type="button"
            className="stakeholder-edit-close"
            onClick={onClose}
            aria-label="Close"
            disabled={isSaving}
          />
        </header>

        <div className="stakeholder-edit-body">
          <section className="stakeholder-edit-section">
            <div className="stakeholder-edit-grid">
              <Field label="Indication" help={BARRIER_DRIVER_HELP.indication}>
                <select
                  value={form.indication}
                  required
                  disabled={statusOnlyMode}
                  onChange={(e) => updateField('indication', e.target.value)}
                >
                  <option value="">Select indication</option>
                  {indicationOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Medical Strategy" help={BARRIER_DRIVER_HELP.strategy}>
                <select
                  value={form.strategy}
                  required
                  aria-required="true"
                  disabled={statusOnlyMode || !usesStrategy}
                  onChange={(e) => updateField('strategy', e.target.value)}
                >
                  <option value="">
                    {!hasIndication
                      ? 'Select indication first'
                      : usesStrategy
                        ? 'Select medical strategy'
                        : 'Not applicable'}
                  </option>
                  {strategyOptions.map((option) => (
                    <option key={option} value={option}>
                      {strategyLabelForValue(picklists, option)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={`${typeLabel} Title`} help={BARRIER_DRIVER_HELP.title}>
                <select
                  value={form.name}
                  required
                  disabled={statusOnlyMode || !hasIndication}
                  onChange={(e) => updateField('name', e.target.value)}
                >
                  <option value="">
                    {hasIndication ? `Select ${typeLower} title` : 'Select indication first'}
                  </option>
                  {titleOptions.map((option) => (
                    <option key={option} value={option}>
                      {titleLabels[option] || option}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Status" help={BARRIER_DRIVER_HELP.status}>
                <select
                  value={form.status}
                  required
                  onChange={(e) => updateField('status', e.target.value)}
                >
                  <option value="">Select status</option>
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Comments" help={BARRIER_DRIVER_HELP.comments} className="is-textarea">
                <textarea
                  rows={4}
                  value={form.comments}
                  maxLength={1000}
                  required
                  disabled={statusOnlyMode}
                  onChange={(e) => updateField('comments', e.target.value)}
                />
              </Field>
            </div>
          </section>
          {!isEdit && (
            <section className="stakeholder-edit-section bd-linked-tactic-section">
              <div className="bd-linked-tactic-heading">
                <h4>New Linked Medical Tactic</h4>
                <p>Complete the linked medical tactic before saving the {typeLower}.</p>
              </div>
              <div className="stakeholder-edit-grid">
                <Field label="Linked Barrier/Opportunity" help={CRITICAL_ACTIVITY_HELP.linkedBarrierDriver}>
                  <input
                    type="text"
                    readOnly
                    aria-readonly="true"
                    value={form.name ? `${typeLabel}: ${titleLabels[form.name] || form.name}` : ''}
                    placeholder={`Select the ${typeLower} title above`}
                  />
                </Field>

                <Field label="Medical Tactic" help={CRITICAL_ACTIVITY_HELP.title}>
                  <select
                    value={tacticForm.title}
                    required
                    disabled={!form.name}
                    onChange={(e) => updateTacticField('title', e.target.value)}
                  >
                    <option value="">
                      {form.name ? 'Select medical tactic' : `Select ${typeLower} title first`}
                    </option>
                    {mappedMedicalTacticOptions.map((option) => (
                      <option key={option} value={option}>
                        {labelForPicklistValue(medicalTacticTitleLabels, option)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Status" help={CRITICAL_ACTIVITY_HELP.status}>
                  <select
                    value={tacticForm.status}
                    required
                    onChange={(e) => updateTacticField('status', e.target.value)}
                  >
                    <option value="">Select status</option>
                    {modalActivityStatusOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Due Date" className="critical-activity-due-date-field">
                  <input
                    className="critical-activity-due-date-input"
                    data-field-help={CRITICAL_ACTIVITY_HELP.dueDate}
                    name="linkedMedicalTacticDueDate"
                    type="date"
                    required
                    value={tacticForm.dueDate}
                    onChange={(e) => updateTacticField('dueDate', e.target.value)}
                  />
                </Field>

                <Field label="Indication" help={CRITICAL_ACTIVITY_HELP.indication}>
                  <input
                    type="text"
                    readOnly
                    aria-readonly="true"
                    value={form.indication}
                    placeholder="Set by the barrier/opportunity above"
                  />
                </Field>

                <Field label="Accountable" help={CRITICAL_ACTIVITY_HELP.accountable}>
                  <select
                    value={tacticForm.accountable}
                    onChange={(e) => updateTacticField('accountable', e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {modalAccountableOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Details" help={CRITICAL_ACTIVITY_HELP.details} className="is-textarea">
                  <textarea
                    rows={3}
                    value={tacticForm.details}
                    maxLength={255}
                    required
                    onChange={(e) => updateTacticField('details', e.target.value)}
                  />
                </Field>
              </div>
            </section>
          )}
          {children}
          {error && <div className="critical-activity-edit-error">{error}</div>}
        </div>

        <footer className="stakeholder-edit-foot">
          <button
            type="button"
            className="stakeholder-edit-button-secondary"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button type="submit" className="stakeholder-edit-button-primary" disabled={isSaving}>
            {isSaving ? 'Saving' : (isEdit ? 'Save' : `Save ${typeLabel} and Medical Tactic`)}
          </button>
        </footer>
      </ModalForm>
    </div>
  );
}
