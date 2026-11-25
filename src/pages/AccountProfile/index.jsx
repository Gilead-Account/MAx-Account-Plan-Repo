import { useEffect, useState } from 'react';
import ProfileTab from '@/pages/AccountProfile/ProfileTab';
import ReferralDynamicsTab from '@/pages/AccountProfile/ReferralDynamicsTab';
import AccountIntelligenceTab from '@/pages/AccountProfile/AccountIntelligenceTab';
import CommercialMmProfileTab from '@/pages/AccountProfile/CommercialMmProfileTab';
import ReferralAccountEditModal from '@/pages/AccountProfile/ReferralAccountEditModal';
import {
  addReferralAccount,
  deleteReferralAccount,
  saveMedicalProfileField,
  saveReferralAccount,
  searchReferralSiteAccounts,
} from '@/lib/dataservice/accountPlan/accountProfile';
import '@/styles/edit-modal.css';
import '@/pages/AccountProfile/AccountProfile.css';

const TABS = [
  { key: 'mm-medical-profile', label: 'MM ATC Medical Profile' },
  { key: 'dlbcl-medical-profile', label: 'DLBCL ATC Medical Profile' },
  { key: 'mm-comm-profile', label: 'MM Comm Profile' },
  { key: 'dlbcl-comm-profile', label: 'DLBCL Comm Profile' },
  { key: 'referral-dynamics', label: 'Referral & Dynamics' },
];

const resolveInitialTab = (initialTab) =>
  TABS.some((tab) => tab.key === initialTab) ? initialTab : 'mm-medical-profile';

const recordValue = (value) =>
  value && typeof value === 'object' && 'value' in value ? value.value : value;

const createdRecordId = (result) =>
  recordValue(result?.data?.id || result?.data?.Id) ||
  recordValue(result?.id || result?.Id || result?.recordId) ||
  `ref-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

export default function AccountProfile({ data, initialTab, onNotify, isReadOnly = false }) {
  const [tab, setTab] = useState(() => resolveInitialTab(initialTab));
  const [referralAccounts, setReferralAccounts] = useState(() => data.referralAccounts || []);
  const [referralModal, setReferralModal] = useState(null);
  const [isSavingReferral, setIsSavingReferral] = useState(false);
  const [referralError, setReferralError] = useState('');

  const planId = data.planId;
  const profileId = data.profileId;
  const medicalProfileId = data.medicalProfileId;

  useEffect(() => {
    setTab(resolveInitialTab(initialTab));
  }, [initialTab]);

  useEffect(() => {
    setReferralAccounts(data.referralAccounts || []);
  }, [data]);

  useEffect(() => {
    if (isReadOnly) setReferralModal(null);
  }, [isReadOnly]);

  const handleSaveMmProfile = async (updates) => {
    if (isReadOnly) return;
    const entries = Object.entries(updates || {}).filter(([field]) => field);
    if (!entries.length) return;
    try {
      for (const [field, value] of entries) {
        await saveMedicalProfileField(medicalProfileId, field, value);
      }
      onNotify?.({
        title: 'Medical profile saved.',
        detail: 'Your changes have been saved.',
        refreshPages: true,
      });
    } catch (error) {
      onNotify?.({
        title: 'Unable to save Medical profile.',
        detail: error?.message || 'Please try again.',
        tone: 'danger',
      });
    }
  };

  const handleSaveReferral = async (form) => {
    if (isReadOnly) return;
    setIsSavingReferral(true);
    setReferralError('');
    try {
      if (form.id) {
        await saveReferralAccount(form.id, form);
        setReferralAccounts((rows) =>
          rows.map((row) => (row.id === form.id ? { ...row, ...form } : row))
        );
      } else {
        const result = await addReferralAccount(planId, profileId, form);
        setReferralAccounts((rows) => [
          { ...form, accountProfileId: profileId, id: createdRecordId(result) },
          ...rows,
        ]);
      }
      onNotify?.({
        title: 'Referral account saved.',
        detail: 'Your changes have been saved.',
        refreshPages: true,
      });
      setReferralModal(null);
    } catch (error) {
      setReferralError(error?.message || 'Unable to save referral account.');
    } finally {
      setIsSavingReferral(false);
    }
  };

  const handleDeleteReferral = async (record) => {
    if (isReadOnly) return;
    setIsSavingReferral(true);
    setReferralError('');
    try {
      await deleteReferralAccount(record.id);
      setReferralAccounts((rows) => rows.filter((row) => row.id !== record.id));
      onNotify?.({
        title: 'Referral mapping deleted.',
        detail: 'The referral mapping has been removed from this account plan.',
        refreshPages: true,
      });
      setReferralModal(null);
    } catch (error) {
      setReferralError(error?.message || 'Unable to delete referral account.');
    } finally {
      setIsSavingReferral(false);
    }
  };

  return (
    <section className="page page-account-profile mock-profile-page">
      <article className="mock-control-panel account-profile-tabs-card">
        <div className="bd-tab-row account-profile-tabs">
          <div className="account-profile-tab-list" role="tablist">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`bd-tab ${tab === item.key ? 'is-active' : ''}`}
                onClick={() => setTab(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </article>

      {tab === 'referral-dynamics' && (
        <ReferralDynamicsTab
          referralAccounts={referralAccounts}
          healthcareNetworks={data.healthcareNetworks || []}
          regionalDynamics={data.regionalDynamics || {}}
          onEditReferral={(record) => {
            if (!isReadOnly) setReferralModal({ record });
          }}
          onAddReferral={() => {
            if (!isReadOnly) setReferralModal({ record: null });
          }}
          isReadOnly={isReadOnly}
        />
      )}

      {['mm-medical-profile', 'dlbcl-medical-profile'].includes(tab) && (
        <AccountIntelligenceTab
          profileTitle={tab === 'mm-medical-profile' ? 'MM ATC Medical Profile' : 'DLBCL ATC Medical Profile'}
          profileType={tab === 'mm-medical-profile' ? 'mm' : 'dlbcl'}
          profileRecordId={medicalProfileId}
          values={tab === 'mm-medical-profile'
            ? data.mmMedicalProfile || {}
            : data.dlbclMedicalProfile || {}}
          mmProfilePicklists={data.mmProfilePicklists || {}}
          isReadOnly={isReadOnly}
          onSave={handleSaveMmProfile}
        />
      )}

      {tab === 'mm-comm-profile' && (
        <CommercialMmProfileTab
          values={data.commercialMmProfile || {}}
          mmProfilePicklists={data.mmProfilePicklists || {}}
          isReadOnly
        />
      )}

      {tab === 'dlbcl-comm-profile' && (
        <ProfileTab
          account={data.account}
          attributeRows={data.accountAttributeRows || []}
          reimbursementRows={data.reimbursementRows || []}
          profileQuestionColumns={data.profileQuestionColumns || []}
          yesNoOptions={data.profileQuestionYesNoOptions || []}
          isReadOnly
        />
      )}

      {!isReadOnly && referralModal && (
        <ReferralAccountEditModal
          record={referralModal.record}
          isSaving={isSavingReferral}
          error={referralError}
          onClose={() => setReferralModal(null)}
          onSave={handleSaveReferral}
          onDelete={handleDeleteReferral}
          searchAccounts={searchReferralSiteAccounts}
          indicationOptions={data.referralIndicationOptions || []}
        />
      )}
    </section>
  );
}
