import { useEffect, useRef, useState } from 'react';
import { deliverPreparedPayerAccountPlanPpt, preparePayerAccountPlanPpt } from '@/lib/export/payerAccountPlanPpt';
import { Icon } from '@/components/MarketAccessUi';
import { navigationItems } from '@/lib/mockData/marketAccessFixtures';
import { formatDate } from '@/lib/helper/utils';
import { detectRuntimeViewMode } from '@/lib/runtime/viewMode';
import PayerUserGuideModal from '@/components/PayerUserGuideModal';

export default function MarketAccessSidebar({ activeKey, accountSummary, planId, onNavigate, onNotify, onChangePlan }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [userGuideOpen, setUserGuideOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState('idle');
  const [exportError, setExportError] = useState('');
  const [manualDownload, setManualDownload] = useState(null);
  const exportRequest = useRef(0);
  const preparedPpt = useRef(null);
  const manualUrl = useRef(null);
  const isIPad = detectRuntimeViewMode().viewMode === 'ipad';

  const releaseManualUrl = () => {
    if (manualUrl.current) URL.revokeObjectURL(manualUrl.current);
    manualUrl.current = null;
  };
  useEffect(() => {
    exportRequest.current += 1;
    preparedPpt.current = null;
    setExportOpen(false);
    setExportStatus('idle');
    setExportError('');
    setManualDownload(null);
    return () => { exportRequest.current += 1; releaseManualUrl(); };
  }, [planId]);

  const prepareExport = async () => {
    const request = ++exportRequest.current;
    preparedPpt.current = null;
    releaseManualUrl();
    setManualDownload(null);
    setExportError('');
    setExportStatus('preparing');
    try {
      const prepared = await preparePayerAccountPlanPpt(planId);
      if (request !== exportRequest.current) return;
      preparedPpt.current = prepared;
      setExportStatus('ready');
    } catch (error) {
      if (request !== exportRequest.current) return;
      setExportStatus('error');
      setExportError(error?.message || 'Unable to prepare the PowerPoint. Please try again.');
    }
  };
  const toggleExport = () => {
    if (exportStatus === 'exporting') return;
    setHelpOpen(false);
    setExportOpen(!exportOpen);
    if (!exportOpen) prepareExport();
  };
  const exportPpt = async () => {
    if (exportStatus !== 'ready' || !preparedPpt.current) return;
    const request = exportRequest.current;
    setExportStatus('exporting');
    setExportError('');
    releaseManualUrl();
    setManualDownload(null);
    // The prepared file reaches Web Share directly from the user's tap,
    // preserving the user activation required by iPad and Veeva WebViews.
    try {
      const result = await deliverPreparedPayerAccountPlanPpt(preparedPpt.current, { directShare: true });
      if (request !== exportRequest.current) {
        if (result.manualUrl) URL.revokeObjectURL(result.manualUrl);
        return;
      }
      releaseManualUrl();
      if (result.manualUrl) {
        manualUrl.current = result.manualUrl;
        setManualDownload({ url: result.manualUrl, fileName: result.fileName });
      } else if (result.mode !== 'share-cancelled') {
        setExportOpen(false);
      }
      setExportStatus('ready');
      if (result.mode !== 'share-cancelled') onNotify(result.manualUrl ? 'PowerPoint is ready. Use Open / Save PPT if it did not open.' : 'PowerPoint export ready.');
    } catch (error) {
      if (request !== exportRequest.current) return;
      setExportStatus('ready');
      setExportError(error?.message || 'Unable to open the PowerPoint. Please try again.');
    }
  };

  return <aside className="sidebar">
    <section className="account-card">
      <div className="account-card-head">
        <strong>{accountSummary.planName || `${accountSummary.accountName.toUpperCase()} Account Plan`}</strong>
        <span>Payer EID</span><b>{accountSummary.eid}</b>
      </div>
      <div className="account-stat"><span className="account-stat-icon"><Icon name="calendar" size={18}/></span><div><span>LAST MODIFIED DATE</span><strong>{formatDate(accountSummary.lastModifiedDate)}</strong></div></div>
      <div className="account-stat"><span className="account-stat-icon"><Icon name="globe" size={18}/></span><div><span>MARKETPLACE</span><strong>{accountSummary.marketplace}</strong></div></div>
      <div className="account-stat"><span className="account-stat-icon"><Icon name="people" size={18}/></span><div><span>KAD OWNER</span><strong>{accountSummary.kadOwner}</strong></div></div>
    </section>
    {!isIPad && <button type="button" className="change-payer-plan-button" onClick={onChangePlan}><Icon name="building" size={16}/> Change Account Plan</button>}
    <nav aria-label="MAx account plan pages">
      {navigationItems.map((item) => <button
        type="button"
        key={item.key}
        className={activeKey === item.key ? 'active' : ''}
        onClick={() => onNavigate(item.key)}
      >
        <span className="nav-button-icon"><Icon name={item.icon}/></span>
        <span>{item.label}</span>
      </button>)}
    </nav>
    <div className="sidebar-footer">
      <div className="footer-control-wrap">
        <button type="button" className={`sidebar-control ${helpOpen ? 'open' : ''}`} onClick={() => { setHelpOpen((open) => !open); setExportOpen(false); }}>
          <span>Help &amp; Compliance Reminder</span><Icon name="info" size={18}/>
        </button>
        {helpOpen && <div className="sidebar-popover help-popover">
          <strong>Planning reminder</strong>
          <p>For internal strategic planning only. Do not include promotional claims, patient-identifiable information, or content not approved for use.</p>
          <p>Any tactics developed to address barriers will be reviewed and approved by Legal and in compliance with all company policies, applicable laws, and regulations.</p>
          <button type="button" onClick={() => { setUserGuideOpen(true); setHelpOpen(false); }}>Open user guide</button>
        </div>}
      </div>
      <div className="footer-control-wrap">
        <button type="button" className={`sidebar-control export-control ${exportOpen ? 'open' : ''}`} onClick={toggleExport} aria-expanded={exportOpen} aria-controls="payer-export-options" disabled={exportStatus === 'exporting'}>
          <span>Export</span><i className="menu-caret"/>
        </button>
        {exportOpen && <div className="sidebar-popover export-popover" id="payer-export-options">
          <small>EXPORT</small>
          <button type="button" onClick={exportPpt} disabled={exportStatus !== 'ready'}>{exportStatus === 'preparing' ? 'Preparing PowerPoint…' : exportStatus === 'exporting' ? 'Opening PowerPoint…' : 'Export to PPT'}</button>
          {exportStatus === 'preparing' && <p role="status">Loading all sections of this Payer Account Plan.</p>}
          {exportError && <p role="alert">{exportError}</p>}
          {exportStatus === 'error' && <button type="button" onClick={prepareExport}>Retry export</button>}
          {manualDownload && <a className="payer-export-download" href={manualDownload.url} download={manualDownload.fileName} target="_blank" rel="noopener">Open / Save PPT</a>}
        </div>}
      </div>
    </div>
    {userGuideOpen && <PayerUserGuideModal onClose={() => setUserGuideOpen(false)} />}
  </aside>;
}
