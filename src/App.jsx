import { SUCCESS_NOTICE_EVENT, notifySaved } from '@/lib/helper/successNotice';
import { crmWriteError } from '@/lib/helper/crmWriteError';
import { loadPayerHierarchy, savePayerHierarchy } from '@/lib/dataservice/accountPlan/payerHierarchy';
import { loadPayerBarriersOpportunities, savePayerBarrierOpportunity, deletePayerBarrierOpportunity } from '@/lib/dataservice/accountPlan/payerBarriersOpportunities';
import { useEffect, useMemo, useRef, useState } from 'react';
import MarketAccessSidebar from '@/components/MarketAccessSidebar';
import PayerAccountPlanLauncher from '@/components/PayerAccountPlanLauncher';
import { Icon } from '@/components/MarketAccessUi';
import { initialCriticalActions, navigationItems } from '@/lib/mockData/marketAccessFixtures';
import { fetchPayerAccountSummary } from '@/lib/dataservice/accountPlan/payerAccountSummary';
import { loadPayerAccountPlanAccess } from '@/lib/dataservice/accountPlan/payerAccess';
import {
  resetPayerAccountPlanResolution,
  resolveContextualPayerAccountPlanId,
} from '@/lib/dataservice/accountPlan/payerAccountPlan';
import { setCurrentAccountPlanIdOverride } from '@/lib/dataservice/accountPlan/shared';
import { isLocalPreview } from '@/lib/dataservice/client';
import { detectRuntimeViewMode } from '@/lib/runtime/viewMode';
import AccountLandscapePage from '@/pages/AccountLandscape';
import ActionPlanPage from '@/pages/ActionPlan';
import BarriersRisksPage from '@/pages/BarriersRisks';
import ExecutiveSummaryPage from '@/pages/ExecutiveSummary';
import StakeholderMapPage from '@/pages/StakeholderMap';

const DASHBOARD_VIEW_STORAGE_KEY = 'max-account-plan-dashboard-view';
const dashboardViews = new Set(['desktop', 'ipad', 'ipad-pro']);
const isIPad11Preview = isLocalPreview && new URLSearchParams(window.location.search).get('preview') === 'ipad-11';
const loadingAccountSummary = () => ({
  accountName: 'Loading',
  lastModifiedDate: null,
  eid: 'Loading',
  marketplace: 'Loading',
  kadOwner: 'Loading',
});

export default function App() {
  const mutationLock = useRef(false);
  const [accountSummary, setAccountSummary] = useState(loadingAccountSummary);
  const [entryStatus, setEntryStatus] = useState('checking');
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [planAccess, setPlanAccess] = useState(null);
  const accessReady = planAccess?.planId === selectedPlanId;
  const canEdit = accessReady && planAccess.canEdit;
  useEffect(() => {
    if (!selectedPlanId) { setPlanAccess(null); return undefined; }
    let cancelled = false;
    loadPayerAccountPlanAccess(selectedPlanId).then(
      (access) => { if (!cancelled) setPlanAccess({ ...access, planId: selectedPlanId }); },
      () => { if (!cancelled) setPlanAccess({ planId: selectedPlanId, canEdit: false, reason: 'Edit access could not be verified. This Account Plan is read-only. Reopen the plan to retry.' }); }
    );
    return () => { cancelled = true; };
  }, [selectedPlanId]);
  const [activeKey, setActiveKey] = useState('executive-summary');
  const [toast, setToast] = useState(null);
  useEffect(() => {
    const onSuccess = (event) => setToast({ message: event.detail });
    window.addEventListener(SUCCESS_NOTICE_EVENT, onSuccess);
    return () => window.removeEventListener(SUCCESS_NOTICE_EVENT, onSuccess);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const [criticalActions, setCriticalActions] = useState(initialCriticalActions);
  const [issues, setIssues] = useState([]);
  const [commercialHierarchy, setCommercialHierarchy] = useState([]);
  const [linkedDataReady, setLinkedDataReady] = useState(false);
  const [linkedDataError, setLinkedDataError] = useState('');
  const [linkedBusy, setLinkedBusy] = useState(false);
  const [linkedLoading, setLinkedLoading] = useState(false);
  const [linkedLoadAttempt, setLinkedLoadAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLinkedDataReady(false); setLinkedDataError('');
    if (!selectedPlanId) { setLinkedLoading(false); return; }
    setLinkedLoading(true);
    Promise.all([loadPayerHierarchy(), loadPayerBarriersOpportunities()]).then(([tree, barriers]) => {
      if (!cancelled) { setCommercialHierarchy(tree.hierarchy); setIssues(barriers.records); setLinkedDataReady(true); }
    }).catch((error) => { if (!cancelled) setLinkedDataError(crmWriteError(error, 'Load linked CRM records').message); }).finally(() => { if (!cancelled) setLinkedLoading(false); });
    return () => { cancelled = true; };
  }, [selectedPlanId, linkedLoadAttempt]);
  const persistHierarchy = async (updater) => {
    if (!canEdit || mutationLock.current || !linkedDataReady) return false;
    mutationLock.current = true; setLinkedBusy(true); setLinkedDataError('');
    try {
      const next = typeof updater === 'function' ? updater(commercialHierarchy) : updater;
      const result = await savePayerHierarchy(commercialHierarchy, next);
      setCommercialHierarchy(result.hierarchy);
      if (JSON.stringify(commercialHierarchy) !== JSON.stringify(next)) notifySaved();
      return result;
    } catch (error) {
      if (error.canCorrectDraft) return { error: error.message };
      setLinkedDataError(crmWriteError(error, 'Save linked records').message + ' Retry loading to check which changes were saved.');
      setLinkedDataReady(false);
      return false;
    } finally { mutationLock.current = false; setLinkedBusy(false); }
  };
  const persistIssues = async (updater) => {
    if (!canEdit || mutationLock.current || !linkedDataReady) return false;
    mutationLock.current = true; setLinkedBusy(true); setLinkedDataError('');
    try {
      const next = typeof updater === 'function' ? updater(issues) : updater;
      for (const row of next) {
        const old = issues.find((item) => item.id === row.id);
        if (!old || JSON.stringify(old) !== JSON.stringify(row)) await savePayerBarrierOpportunity({ ...row, id: old ? row.id : undefined });
      }
      for (const row of issues) if (!next.some((item) => item.id === row.id)) await deletePayerBarrierOpportunity(row.id);
      setIssues((await loadPayerBarriersOpportunities()).records);
      if (JSON.stringify(issues) !== JSON.stringify(next)) notifySaved();
      return true;
    } catch (error) { setLinkedDataError(crmWriteError(error, 'Save linked records').message + ' Retry loading before editing again.'); setLinkedDataReady(false); return false; }
    finally { mutationLock.current = false; setLinkedBusy(false); }
  };
  const [dashboardView, setDashboardView] = useState(() => {
    if (isIPad11Preview) return 'ipad';
    if (isLocalPreview && new URLSearchParams(window.location.search).get('preview') === 'desktop') return 'desktop';
    try {
      const storedView = window.localStorage.getItem(DASHBOARD_VIEW_STORAGE_KEY);
      return dashboardViews.has(storedView) ? storedView : 'desktop';
    } catch {
      return 'desktop';
    }
  });
  const activePage = useMemo(
    () => navigationItems.find((item) => item.key === activeKey),
    [activeKey]
  );

  useEffect(() => {
    document.title = `${activePage.label} | ${accountSummary.accountName}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [accountSummary.accountName, activePage]);

  useEffect(() => {
    // Match the established Medical Account Plan launcher behavior: the
    // hosted desktop tab always starts at the plan list, even when Veeva
    // exposes a stale/current Account Plan through the surrounding shell.
    // Record context remains useful on iPad, where users launch the report
    // from an individual synced Account Plan.
    if (!isLocalPreview && detectRuntimeViewMode().viewMode === 'desktop') {
      setCurrentAccountPlanIdOverride(null);
      resetPayerAccountPlanResolution();
      setEntryStatus('selector');
      return undefined;
    }

    let cancelled = false;
    resolveContextualPayerAccountPlanId().then(
      (planId) => {
        if (cancelled) return;
        if (planId) {
          setCurrentAccountPlanIdOverride(planId);
          resetPayerAccountPlanResolution();
          setSelectedPlanId(planId);
          setEntryStatus('dashboard');
        } else {
          setEntryStatus('selector');
        }
      },
      (error) => {
        console.warn('[payer-account-plan-entry] context unavailable; showing selector', error);
        if (!cancelled) setEntryStatus('selector');
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (entryStatus !== 'dashboard' || !selectedPlanId) return undefined;
    let cancelled = false;
    fetchPayerAccountSummary().then(
      (summary) => {
        if (!cancelled) setAccountSummary(summary);
      },
      (error) => {
        console.error('[payer-account-summary] load failed', error);
        if (!cancelled) {
          setAccountSummary({
            accountName: 'Not available',
            lastModifiedDate: null,
            eid: 'Not available',
            marketplace: 'Not available',
            kadOwner: 'Not available',
          });
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [entryStatus, selectedPlanId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(DASHBOARD_VIEW_STORAGE_KEY, dashboardView);
    } catch {
      // Storage may be unavailable in restricted embedded environments.
    }
  }, [dashboardView]);

  const notify = (message) => {
    setToast({ message });
  };

  const selectAccountPlan = (plan) => {
    if (!plan?.id) return;
    setCurrentAccountPlanIdOverride(plan.id);
    resetPayerAccountPlanResolution();
    setAccountSummary(loadingAccountSummary());
    setCommercialHierarchy([]);
    setIssues([]);
    setCriticalActions(initialCriticalActions);
    setActiveKey('executive-summary');
    setSelectedPlanId(plan.id);
    setEntryStatus('dashboard');
  };

  const changeAccountPlan = () => {
    if (mutationLock.current) { notify('Please wait for the current CRM save to finish.'); return; }
    setCurrentAccountPlanIdOverride(null);
    resetPayerAccountPlanResolution();
    setSelectedPlanId(null);
    setAccountSummary(loadingAccountSummary());
    setEntryStatus('selector');
  };

  const activePageContent = {
    'executive-summary': <ExecutiveSummaryPage canEdit={canEdit}/>,
    'account-landscape': <AccountLandscapePage canEdit={canEdit}/>,
    'action-plan': <ActionPlanPage canEdit={canEdit} criticalActions={criticalActions} setCriticalActions={setCriticalActions} issues={issues} setIssues={persistIssues} commercialHierarchy={commercialHierarchy} setCommercialHierarchy={persistHierarchy}/>,
    'barriers-risks': <BarriersRisksPage canEdit={canEdit} records={issues} setRecords={persistIssues} commercialHierarchy={commercialHierarchy}/>,
    'stakeholder-map': <StakeholderMapPage canEdit={canEdit}/>,
  }[activeKey];

  if (entryStatus === 'checking') {
    return <main className="payer-plan-launcher payer-plan-launcher-loading"><p>Resolving Account Plan context…</p></main>;
  }

  if (entryStatus === 'selector') {
    return <PayerAccountPlanLauncher onSelectPlan={selectAccountPlan}/>;
  }

  return <div className={`dashboard-view-stage dashboard-view-${dashboardView}`} data-preview-device={isIPad11Preview ? 'ipad-11' : undefined}>
    <div className="app-shell">
      <MarketAccessSidebar accountSummary={accountSummary} planId={selectedPlanId} activeKey={activeKey} onNavigate={setActiveKey} onNotify={notify} onChangePlan={changeAccountPlan} dashboardView={dashboardView} onDashboardViewChange={setDashboardView}/>
      <div className="workspace">
        <main className="page-content" data-plan-read-only={accessReady && !canEdit ? 'true' : undefined} key={`${selectedPlanId}:${activeKey}`}>{linkedDataError && <p role="alert">{linkedDataError}</p>}
          {accessReady && !canEdit && <p role="status">Read-only: {planAccess.reason}</p>}
          {!accessReady ? <p role="status">Checking Account Plan access…</p> : ['action-plan', 'barriers-risks'].includes(activeKey) && !linkedDataReady ? <section aria-busy={linkedLoading}>
            <p role="status">{linkedLoading ? 'Loading objectives, strategies, tactics, barriers and opportunities…' : 'Linked CRM records could not be loaded. Editing is paused until loading succeeds.'}</p>
            {!linkedLoading && <button type="button" className="button primary" onClick={() => setLinkedLoadAttempt((attempt) => attempt + 1)}>Retry loading</button>}
          </section> : <fieldset disabled={linkedBusy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>{activePageContent}</fieldset>}</main>
      </div>
      {toast && <div className="toast" role="status" aria-live="polite" aria-atomic="true">
        <Icon name="check" size={18}/>{toast.message}
        <button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)}><Icon name="close" size={15}/></button>
      </div>}
    </div>
  </div>;
}
