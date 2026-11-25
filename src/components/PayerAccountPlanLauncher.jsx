import { useEffect, useMemo, useState } from 'react';
import KiteAccountPlanLoader from '@/components/KiteAccountPlanLoader';
import { fetchAccessiblePayerAccountPlans } from '@/lib/dataservice/accountPlan/payerAccountPlan';
import { nextTableSort, stableSortRows, toDateSortValue } from '@/lib/helper/tableSort';
import { formatDate } from '@/lib/helper/utils';

const COLUMNS = [
  { key: 'name', label: 'Account Plan Name' },
  { key: 'accountName', label: 'Account Name' },
  { key: 'ownerName', label: 'KAD Owner' },
  { key: 'marketplace', label: 'Marketplace' },
  { key: 'lastModifiedDate', label: 'Last Modified Date', type: 'date' },
];

const SELECTOR_BUILD = 'PAYER-SELECTOR-20261001.2';

const sortValue = (row, key) => (
  key === 'lastModifiedDate' ? toDateSortValue(row[key]) : row[key]
);

function SortButton({ column, sort, onSort }) {
  const active = sort?.key === column.key;
  return <button
    type="button"
    className="payer-plan-launcher-sort"
    onClick={() => onSort(column.key)}
    aria-label={`Sort by ${column.label}`}
    aria-pressed={active}
  >
    <span>{column.label}</span>
    <i className={`activity-sort-arrow ${active ? sort.direction : ''}`} aria-hidden="true"/>
  </button>;
}

export default function PayerAccountPlanLauncher({ onSelectPlan }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(null);

  const loadRows = () => {
    setStatus('loading');
    setError('');
    fetchAccessiblePayerAccountPlans().then(
      (plans) => {
        setRows(plans || []);
        setStatus('ready');
      },
      (loadError) => {
        console.error('[payer-account-plan-launcher] load failed', loadError);
        setRows([]);
        setError(loadError?.message || 'Unable to load Payer Account Plans.');
        setStatus('error');
      }
    );
  };

  useEffect(() => {
    loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => [
      row.name,
      row.accountName,
      row.eid,
      row.ownerName,
      row.marketplace,
    ].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [query, rows]);
  const visibleRows = useMemo(
    () => stableSortRows(filteredRows, sort, sortValue),
    [filteredRows, sort]
  );

  if (status === 'loading') {
    return <main className="payer-plan-launcher payer-plan-launcher-loading"><KiteAccountPlanLoader/></main>;
  }

  return <main className="payer-plan-launcher" aria-label="Payer Account Plan selection">
    <section className="payer-plan-launcher-panel">
      <header className="payer-plan-launcher-header">
        <div className="payer-plan-launcher-title">
          <strong>{filteredRows.length}</strong>
          <div><h1>Payer Account Plans</h1><span>{filteredRows.length === 1 ? '1 result' : `${filteredRows.length} results`}</span><small>{SELECTOR_BUILD}</small></div>
        </div>
        <div className="payer-plan-launcher-actions">
          <label><span>Search</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Plan, account, owner, marketplace"/></label>
          <button type="button" onClick={loadRows}>Refresh</button>
        </div>
      </header>

      {status === 'error' && <div className="payer-plan-launcher-state is-error"><strong>Unable to load Payer Account Plans.</strong><span>{error}</span></div>}
      {status === 'ready' && visibleRows.length === 0 && <div className="payer-plan-launcher-state"><strong>No Payer Account Plans found.</strong><span>The logged-in user does not have access to a matching plan, or the search has no matches.</span></div>}

      {status === 'ready' && visibleRows.length > 0 && <div className="payer-plan-launcher-table" role="table" aria-label="Payer Account Plans">
        <div className="payer-plan-launcher-row is-head" role="row">
          {COLUMNS.map((column) => <span role="columnheader" key={column.key}><SortButton column={column} sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))}/></span>)}
          <span role="columnheader">Action</span>
        </div>
        {visibleRows.map((plan) => <div className="payer-plan-launcher-row" role="row" key={plan.id}>
          {COLUMNS.map((column) => <span role="cell" data-label={column.label} className={column.key === 'name' ? 'payer-plan-launcher-plan' : ''} key={column.key}>
            {column.key === 'name' ? <><strong>{plan.name}</strong><small>{plan.eid}</small></> : column.type === 'date' ? formatDate(plan[column.key], '-') : plan[column.key] || '-'}
          </span>)}
          <span role="cell" data-label="Action"><button type="button" className="payer-plan-launcher-open" onClick={() => onSelectPlan(plan)} aria-label={`Open ${plan.name}`}>Open</button></span>
        </div>)}
      </div>}
    </section>
  </main>;
}
