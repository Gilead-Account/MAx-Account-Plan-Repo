import { useEffect, useMemo, useState } from 'react';
import '@/styles/edit-modal.css';
import '@/pages/Stakeholders/Stakeholders.css';
import StakeholdersTab from '@/pages/Stakeholders/StakeholdersTab';
import StakeholderEditModal from '@/pages/Stakeholders/StakeholderEditModal';
import {
  createStakeholder,
  deleteStakeholder,
  searchStakeholderAccounts,
  updateStakeholder,
} from '@/lib/dataservice/accountPlan/stakeholders';

const DEFAULT_FILTERS = { role: 'All' };

export default function Stakeholders({ data, onNotify, isReadOnly = false }) {
  const sourceStakeholders = data.stakeholders || [];
  const picklists = data.picklists || {};
  const [stakeholders, setStakeholders] = useState(sourceStakeholders);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [editingStakeholder, setEditingStakeholder] = useState(null);

  useEffect(() => {
    setStakeholders(sourceStakeholders);
  }, [sourceStakeholders]);

  useEffect(() => {
    if (isReadOnly) setEditingStakeholder(null);
  }, [isReadOnly]);

  const excludedStakeholderAccountIds = useMemo(() => {
    const editingId = editingStakeholder?.id || '';
    return stakeholders
      .filter((stakeholder) => stakeholder?.id !== editingId)
      .map((stakeholder) => stakeholder?.profileRecordId)
      .filter(Boolean);
  }, [stakeholders, editingStakeholder?.id]);

  const openAddStakeholder = () => {
    if (isReadOnly) return;
    setEditingStakeholder({});
  };

  const openEditStakeholder = (stakeholder) => {
    if (isReadOnly) return;
    setEditingStakeholder(stakeholder);
  };

  const saveStakeholder = async (id, form) => {
    if (isReadOnly) return;
    if (id) {
      await updateStakeholder(id, form);
      setStakeholders((current) =>
        current.map((stakeholder) =>
          stakeholder.id === id ? { ...stakeholder, ...form } : stakeholder
        )
      );
      onNotify?.({
        title: 'Stakeholder saved.',
        detail: 'Your changes have been saved.',
        refreshPages: true,
      });
      return;
    }

    const saved = await createStakeholder(data.planId, form);
    const created = { ...saved, ...form, id: saved.id };
    setStakeholders((current) => [created, ...current]);
    onNotify?.({
      title: 'Stakeholder saved.',
      detail: 'Your changes have been saved.',
      refreshPages: true,
    });
  };

  const deleteStakeholderRow = async (stakeholder) => {
    if (isReadOnly || !stakeholder?.id) return;
    await deleteStakeholder(stakeholder.id);
    setStakeholders((current) => current.filter((row) => row.id !== stakeholder.id));
    onNotify?.({
      title: 'Stakeholder deleted.',
      detail: 'The stakeholder has been removed from this account plan.',
      refreshPages: true,
    });
  };

  return (
    <section className="page page-stakeholders-team mock-stakeholder-page">
      <StakeholdersTab
        stakeholders={stakeholders}
        filters={filters}
        onFilterChange={setFilters}
        onAdd={isReadOnly ? null : openAddStakeholder}
        onOpenEdit={isReadOnly ? null : openEditStakeholder}
        isReadOnly={isReadOnly}
      />

      {!isReadOnly && editingStakeholder && (
        <StakeholderEditModal
          stakeholder={editingStakeholder}
          roleOptions={picklists.roleOptions || []}
          searchStakeholders={searchStakeholderAccounts}
          excludedStakeholderAccountIds={excludedStakeholderAccountIds}
          onClose={() => setEditingStakeholder(null)}
          onSave={saveStakeholder}
          onDelete={deleteStakeholderRow}
        />
      )}
    </section>
  );
}
