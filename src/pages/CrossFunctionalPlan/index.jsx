import CharacterUsage from '@/components/CharacterUsage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FieldHelpButton } from '@/components/EditModalField';
import { countNoun, formatDateLabel } from '@/lib/helper/utils';
import { savePoaBlock } from '@/lib/dataservice/accountPlan/crossFunctionalPlan';

// Port of views/pages/linked-opportunities.html. Active DLBCL long-text fields
// live on Account_Plan_vod__c and are grouped by function.

const POA_HELP_TEXT = {
  subheader:
    'This section provides a high-level, compliant summary of the current plan of action across functions to support alignment and shared perspective. It reflects what the team is focused on now and is not intended for detailed tactics or activity tracking. Aligned team members have access to their respective sections.',
  'dlbcl-customer-engagement':
    'Summarize the current, high-level Commercial approach for engaging the account.',
  'dlbcl-market-access':
    'Summarize the current, high-level Market Access approach and priorities impacting the account.',
  'dlbcl-medical-affairs':
    'Choose the open opportunities and medical tactics that should appear in the Medical Plan of Action. All open items are shown by default.',
};

const MAX_POA_LENGTH = 500;
const MEDICAL_POA_FUNCTION = 'Medical Affairs';
const MEDICAL_POA_SELECTION_PREFIX = 'MPOA1|x=';
const EMPTY_MEDICAL_POA_OPPORTUNITIES = [];

const POA_FUNCTION_BY_USER_TYPE = {
  commercial: 'Customer Engagement',
  'market-access': 'Market Access',
  medical: MEDICAL_POA_FUNCTION,
};

const POA_VISIBLE_FUNCTIONS_BY_USER_TYPE = {
  commercial: ['Customer Engagement', 'Market Access', MEDICAL_POA_FUNCTION],
  'market-access': ['Customer Engagement', 'Market Access', MEDICAL_POA_FUNCTION],
  medical: [MEDICAL_POA_FUNCTION],
};

const normalize = (value) => String(value || '').trim().toLowerCase();

export const resolvePoaUserType = (activeUser) => {
  const source = normalize([
    activeUser && activeUser.userType,
    activeUser && activeUser.role,
    activeUser && activeUser.functionName,
    activeUser && activeUser.title,
    activeUser && activeUser.profile,
    activeUser && activeUser.profileName,
    activeUser && activeUser.profileNameVod,
    activeUser && activeUser.Profile_Name_vod_c,
    activeUser && activeUser.Profile_Name_vod__c,
  ].filter(Boolean).join(' '));

  if (!source) return null;
  if (
    source.includes('kph-key account director') ||
    source.includes('market access') ||
    /\baccess\b/.test(source) ||
    source.includes('payer') ||
    source.includes('market') ||
    source.includes('kam') ||
    source.includes('kad') ||
    source.includes('reimbursement')
  ) {
    return 'market-access';
  }
  if (
    source.includes('medical') ||
    source.includes('msl') ||
    source.includes('science') ||
    source.includes('scientist') ||
    source.includes('scientific') ||
    source.includes('heor')
  ) {
    return 'medical';
  }
  if (
    source.includes('commercial') ||
    source.includes('sales') ||
    source.includes('account manager') ||
    source.includes('account director') ||
    source.includes('key account') ||
    source.includes('therapy account') ||
    source.includes('ctam') ||
    source.includes('customer engagement')
  ) {
    return 'commercial';
  }
  return null;
};

export const canEditPoaBlock = (activeUser, block) => {
  if (!block) return false;
  const userType = resolvePoaUserType(activeUser);
  return !!block && POA_FUNCTION_BY_USER_TYPE[userType] === block.functionName;
};

export const canViewPoaBlock = (activeUser, block) => {
  if (!block) return false;
  if (block.functionName === MEDICAL_POA_FUNCTION) return true;
  const userType = resolvePoaUserType(activeUser);
  const visibleFunctions = POA_VISIBLE_FUNCTIONS_BY_USER_TYPE[userType] || [];
  return visibleFunctions.includes(block.functionName);
};

const valuesForBlocks = (blocks) =>
  (blocks || []).reduce((acc, block) => {
    acc[block.key] = block.content || '';
    return acc;
  }, {});

const salesforce18Checksum = (first15) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
  let suffix = '';
  for (let group = 0; group < 3; group += 1) {
    let flags = 0;
    for (let offset = 0; offset < 5; offset += 1) {
      const character = first15[group * 5 + offset];
      if (character >= 'A' && character <= 'Z') flags += 1 << offset;
    }
    suffix += alphabet[flags];
  }
  return suffix;
};

const compactSalesforceId = (id) => {
  const value = String(id || '').trim();
  // Real Salesforce IDs are 15 or 18 characters. Keep local mock IDs intact
  // so records whose distinguishing suffix falls after character 15 do not
  // collapse into the same selection key.
  return value.length === 18 && salesforce18Checksum(value.slice(0, 15)) === value.slice(15)
    ? value.slice(0, 15)
    : value;
};

const medicalItemsForBlock = (block, opportunities = []) =>
  (opportunities || [])
    .filter((opportunity) => !block?.indication || opportunity.indication === block.indication)
    .flatMap((opportunity) => [
      { key: `opportunity:${compactSalesforceId(opportunity.id)}`, id: opportunity.id },
      ...(opportunity.medicalTactics || []).map((tactic) => ({
        key: `tactic:${compactSalesforceId(tactic.id)}`,
        id: tactic.id,
      })),
    ]);

export const medicalPoaSelectionFromContent = (content, block, opportunities = []) => {
  const items = medicalItemsForBlock(block, opportunities);
  const allKeys = new Set(items.map((item) => item.key));
  const stored = String(content || '');
  if (!stored.startsWith(MEDICAL_POA_SELECTION_PREFIX)) return allKeys;
  const excludedIds = new Set(
    stored.slice(MEDICAL_POA_SELECTION_PREFIX.length).split(',').filter(Boolean)
  );
  return new Set(items.filter((item) => !excludedIds.has(compactSalesforceId(item.id))).map((item) => item.key));
};

export const serializeMedicalPoaSelection = (selectedKeys, block, opportunities = []) => {
  const selected = selectedKeys instanceof Set ? selectedKeys : new Set(selectedKeys || []);
  const excludedIds = medicalItemsForBlock(block, opportunities)
    .filter((item) => !selected.has(item.key))
    .map((item) => compactSalesforceId(item.id));
  return `${MEDICAL_POA_SELECTION_PREFIX}${excludedIds.join(',')}`;
};

const medicalSelectionsForBlocks = (blocks, opportunities) =>
  (blocks || []).reduce((acc, block) => {
    if (block.functionName === MEDICAL_POA_FUNCTION) {
      acc[block.key] = medicalPoaSelectionFromContent(block.content, block, opportunities);
    }
    return acc;
  }, {});

const selectionSetsEqual = (left, right) => {
  const a = left instanceof Set ? left : new Set();
  const b = right instanceof Set ? right : new Set();
  return a.size === b.size && [...a].every((key) => b.has(key));
};

function EditPencilIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function PoaHelpToggle({ label, text }) {
  if (!text) return null;
  return (
    <FieldHelpButton
      className="poa-help-toggle"
      label={label}
      text={text}
    />
  );
}

function PoaBlock({
  block,
  lastModifiedDate,
  value,
  savedValue,
  helpText,
  canEdit,
  isEditing,
  isSaving,
  hasActiveEdit,
  error,
  onStartEdit,
  onChange,
  onCancel,
  onSave,
  medicalOpportunities,
  selectedMedicalKeys,
  savedMedicalKeys,
  onToggleMedical,
}) {
  const textareaRef = useRef(null);
  const isMedicalBlock = block.functionName === MEDICAL_POA_FUNCTION;
  const stateClass = isEditing ? 'is-editing' : canEdit ? 'is-editable' : 'is-readonly';
  const accessLabel = canEdit ? 'Your section' : 'View only';
  const accessTitle = canEdit
    ? 'You can edit this plan of action.'
    : `${block.functionName} owns edits for this plan of action.`;
  const characterCount = String(value || '').length;
  const hasChanges = isMedicalBlock
    ? !selectionSetsEqual(selectedMedicalKeys, savedMedicalKeys)
    : value !== (savedValue || '');
  const editDisabled = hasActiveEdit && !isEditing;
  const visibleMedicalOpportunities = (medicalOpportunities || []).filter(
    (opportunity) => !block.indication || opportunity.indication === block.indication
  );
  const totalMedicalItems = visibleMedicalOpportunities.reduce(
    (total, opportunity) => total + 1 + (opportunity.medicalTactics || []).length,
    0
  );
  const selectedMedicalCount = selectedMedicalKeys?.size || 0;

  useEffect(() => {
    if (isEditing) textareaRef.current?.focus();
  }, [isEditing]);

  return (
    <article className={`mock-card poa-function-block poa-tone-${block.tone} ${stateClass}`}>
      <div className="poa-function-head">
        <div className="poa-function-title-row">
          <h3>{block.heading}</h3>
          <PoaHelpToggle
            label={`${block.heading} guidance`}
            text={helpText}
          />
        </div>
        <div className="poa-head-actions">
          {!isEditing && (
            <>
              <span
                className={`poa-access-pill ${canEdit ? 'can-edit' : 'is-view-only'}`}
                title={accessTitle}
              >
                {accessLabel}
              </span>
              {canEdit && (
                <button
                  type="button"
                  className="poa-edit-pencil"
                  onClick={() => onStartEdit(block.key)}
                  disabled={editDisabled}
                  aria-label={`Edit ${block.heading}`}
                  title={editDisabled ? 'Finish the current edit first' : 'Edit plan'}
                >
                  <EditPencilIcon />
                </button>
              )}
            </>
          )}
          {isEditing && (
            <div className="poa-head-action-row">
              <button
                type="button"
                className="poa-button-discard"
                onClick={() => onCancel(block.key)}
                disabled={isSaving}
              >
                Discard
              </button>
              <button
                type="button"
                className="poa-button-save"
                onClick={() => onSave(block)}
                disabled={isSaving || !hasChanges}
              >
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      {isMedicalBlock ? (
        <div className="poa-medical-selection" role="group" aria-label={`${block.heading} selections`}>
          {visibleMedicalOpportunities.length === 0 && (
            <div className="poa-medical-empty">No open opportunities are available.</div>
          )}
          {visibleMedicalOpportunities.map((opportunity) => {
            const opportunityKey = `opportunity:${compactSalesforceId(opportunity.id)}`;
            const opportunitySelected = selectedMedicalKeys?.has(opportunityKey);
            const tactics = opportunity.medicalTactics || [];
            const selectedTacticCount = tactics.filter((tactic) =>
              selectedMedicalKeys?.has(`tactic:${compactSalesforceId(tactic.id)}`)
            ).length;
            if (!isEditing && !opportunitySelected && selectedTacticCount === 0) return null;
            return (
              <section className="poa-medical-opportunity" key={opportunity.id}>
                <div className="poa-medical-opportunity-row">
                  {isEditing && (
                    <input
                      type="checkbox"
                      checked={!!opportunitySelected}
                      onChange={(event) => onToggleMedical(
                        block.key,
                        'opportunity',
                        opportunity.id,
                        event.target.checked
                      )}
                      aria-label={`Show opportunity ${opportunity.name}`}
                    />
                  )}
                  <div>
                    <strong>{opportunity.name}</strong>
                    <span>{opportunity.status}</span>
                  </div>
                </div>
                {(isEditing || opportunitySelected || selectedTacticCount > 0) && (
                  <div className="poa-medical-tactic-list">
                    {tactics.length === 0 && (
                      <span className="poa-medical-no-tactics">No open medical tactics.</span>
                    )}
                    {!isEditing && tactics.length > 0 && !tactics.some((tactic) =>
                      selectedMedicalKeys?.has(`tactic:${compactSalesforceId(tactic.id)}`)
                    ) && (
                      <span className="poa-medical-no-tactics">No medical tactics selected.</span>
                    )}
                    {tactics.map((tactic) => {
                      const tacticKey = `tactic:${compactSalesforceId(tactic.id)}`;
                      const tacticSelected = selectedMedicalKeys?.has(tacticKey);
                      if (!isEditing && !tacticSelected) return null;
                      return (
                        <label className="poa-medical-tactic-row" key={tactic.id}>
                          {isEditing && (
                            <input
                              type="checkbox"
                              checked={!!tacticSelected}
                              onChange={(event) => onToggleMedical(
                                block.key,
                                'tactic',
                                tactic.id,
                                event.target.checked
                              )}
                            />
                          )}
                          <span>
                            <strong>{tactic.name}</strong>
                            <small>{tactic.status}{tactic.dueDate ? ` · Due ${formatDateLabel(tactic.dueDate)}` : ''}</small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
          {!isEditing && visibleMedicalOpportunities.length > 0 && selectedMedicalCount === 0 && (
            <div className="poa-medical-empty">No opportunities or medical tactics are selected.</div>
          )}
        </div>
      ) : (
        <div className="poa-editable-box">
          <textarea
            ref={textareaRef}
            maxLength={MAX_POA_LENGTH}
            aria-label={block.heading}
            value={value}
            onChange={isEditing ? (e) => onChange(block.key, e.target.value) : undefined}
            readOnly={!isEditing}
            placeholder={isEditing ? 'Add the shared plan of action...' : 'No plan entered yet.'}
          />
        </div>
      )}

      <div className="poa-footnote-row">
        <div className="poa-updated">
          Updated: {formatDateLabel(lastModifiedDate, 'Never')}
        </div>
        {isMedicalBlock ? (
          <div className="poa-character-count">
            {selectedMedicalCount}/{totalMedicalItems}{' '}
            {countNoun(totalMedicalItems, 'item')} shown
          </div>
        ) : (
          <CharacterUsage as="div"
            className={`poa-character-count ${characterCount > MAX_POA_LENGTH - 50 ? 'is-near-limit' : ''}`}
            value={value} maxLength={MAX_POA_LENGTH} minimumLimit={0}
          />
        )}
      </div>
      {error && <div className="poa-save-error">{error}</div>}
    </article>
  );
}

export default function CrossFunctionalPlan({ data, onNotify, isReadOnly = false }) {
  const blocks = data.blocks || [];
  const medicalPoaOpportunities = data.medicalPoaOpportunities || EMPTY_MEDICAL_POA_OPPORTUNITIES;
  const currentUser = data.currentUser || null;
  const lastModifiedDate = data.poaLastModifiedDate;
  const [savedValues, setSavedValues] = useState(() => valuesForBlocks(blocks));
  const [blockValues, setBlockValues] = useState(() => valuesForBlocks(blocks));
  const [savedMedicalSelections, setSavedMedicalSelections] = useState(
    () => medicalSelectionsForBlocks(blocks, medicalPoaOpportunities)
  );
  const [medicalSelections, setMedicalSelections] = useState(
    () => medicalSelectionsForBlocks(blocks, medicalPoaOpportunities)
  );
  const [editingKey, setEditingKey] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [saveErrors, setSaveErrors] = useState({});
  const [savedAtByKey, setSavedAtByKey] = useState({});

  useEffect(() => {
    const nextValues = valuesForBlocks(blocks);
    setSavedValues(nextValues);
    setBlockValues(nextValues);
    const nextMedicalSelections = medicalSelectionsForBlocks(blocks, medicalPoaOpportunities);
    setSavedMedicalSelections(nextMedicalSelections);
    setMedicalSelections(nextMedicalSelections);
    setEditingKey(null);
    setSaveErrors({});
    setSavedAtByKey({});
  }, [blocks, medicalPoaOpportunities]);

  useEffect(() => {
    if (isReadOnly) setEditingKey(null);
  }, [isReadOnly]);

  const visibleBlocks = useMemo(
    () => blocks.filter((block) => canViewPoaBlock(currentUser, block)),
    [blocks, currentUser]
  );

  const rows = useMemo(() => {
    // Group blocks by function so the grid renders
    // function-by-function, matching the legacy `visiblePoaBlockRows` layout.
    const nextRows = [];
    const seen = new Set();
    for (const block of visibleBlocks) {
      if (seen.has(block.functionName)) continue;
      seen.add(block.functionName);
      const dlbcl = visibleBlocks.find((b) => b.functionName === block.functionName && b.indication === 'DLBCL');
      const rowBlocks = [dlbcl].filter(Boolean);
      if (rowBlocks.length) {
        nextRows.push({ key: block.functionName, blocks: rowBlocks });
      }
    }
    return nextRows;
  }, [visibleBlocks]);

  const updateBlockValue = (key, value) => {
    if (isReadOnly) return;
    setBlockValues((current) => ({ ...current, [key]: value }));
  };

  const toggleMedicalSelection = (key, type, id, checked) => {
    if (isReadOnly) return;
    setMedicalSelections((current) => {
      const next = new Set(current[key] || []);
      const itemKey = `${type}:${compactSalesforceId(id)}`;
      if (checked) next.add(itemKey);
      else next.delete(itemKey);
      return { ...current, [key]: next };
    });
  };

  const startEdit = (key) => {
    if (isReadOnly) return;
    const block = visibleBlocks.find((item) => item.key === key);
    if (!canEditPoaBlock(currentUser, block)) return;
    setEditingKey(key);
    setSaveErrors((current) => ({ ...current, [key]: null }));
  };

  const cancelEdit = (key) => {
    setBlockValues((current) => ({ ...current, [key]: savedValues[key] || '' }));
    setMedicalSelections((current) => ({
      ...current,
      [key]: new Set(savedMedicalSelections[key] || []),
    }));
    setSaveErrors((current) => ({ ...current, [key]: null }));
    setEditingKey(null);
  };

  const saveBlock = async (block) => {
    if (isReadOnly) return;
    if (!canEditPoaBlock(currentUser, block)) {
      setSaveErrors((current) => ({
        ...current,
        [block.key]: 'You can only edit your own Plan of Action section.',
      }));
      return;
    }
    const isMedicalBlock = block.functionName === MEDICAL_POA_FUNCTION;
    const value = isMedicalBlock
      ? serializeMedicalPoaSelection(medicalSelections[block.key], block, medicalPoaOpportunities)
      : (blockValues[block.key] || '');
    if (value.length > MAX_POA_LENGTH) {
      setSaveErrors((current) => ({
        ...current,
        [block.key]: 'Too many exclusions are selected to save. Keep more items shown and try again.',
      }));
      return;
    }
    setSavingKey(block.key);
    setSaveErrors((current) => ({ ...current, [block.key]: null }));
    try {
      await savePoaBlock(data.planId, block, value);
      setSavedValues((current) => ({ ...current, [block.key]: value }));
      if (isMedicalBlock) {
        setBlockValues((current) => ({ ...current, [block.key]: value }));
        setSavedMedicalSelections((current) => ({
          ...current,
          [block.key]: new Set(medicalSelections[block.key] || []),
        }));
      }
      setSavedAtByKey((current) => ({ ...current, [block.key]: new Date().toISOString() }));
      onNotify?.({
        title: 'Plan of Action saved.',
        detail: 'Your changes have been saved.',
        refreshPages: true,
      });
      setEditingKey(null);
    } catch (error) {
      setSaveErrors((current) => ({
        ...current,
        [block.key]: error && error.message ? error.message : 'Unable to save changes.',
      }));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <section className="page page-poa mock-poa-page">
      <header className="mock-card poa-page-header">
        <div className="poa-page-title-row">
          <h2>Cross Functional Account Plan</h2>
        </div>
        <p className="poa-page-subheader">{POA_HELP_TEXT.subheader}</p>
      </header>

      {rows.length === 0 && (
        <div className="poa-access-note">
          No Plan of Action sections are available.
        </div>
      )}

      {rows.length > 0 && (
        <div className="poa-block-list">
          {rows.map((row) => (
            <div key={row.key} className={`poa-block-row ${row.blocks.length > 1 ? 'has-mm' : ''}`.trim()}>
              {row.blocks.map((block) => (
                <PoaBlock
                  key={block.key}
                  block={block}
                  value={blockValues[block.key] || ''}
                  savedValue={savedValues[block.key] || ''}
                  helpText={POA_HELP_TEXT[block.key]}
                  canEdit={!isReadOnly && canEditPoaBlock(currentUser, block)}
                  isEditing={editingKey === block.key}
                  isSaving={savingKey === block.key}
                  hasActiveEdit={!!editingKey}
                  error={saveErrors[block.key]}
                  onStartEdit={startEdit}
                  onChange={updateBlockValue}
                  onCancel={cancelEdit}
                  onSave={saveBlock}
                  medicalOpportunities={medicalPoaOpportunities}
                  selectedMedicalKeys={medicalSelections[block.key] || new Set()}
                  savedMedicalKeys={savedMedicalSelections[block.key] || new Set()}
                  onToggleMedical={toggleMedicalSelection}
                  lastModifiedDate={savedAtByKey[block.key] || lastModifiedDate}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
