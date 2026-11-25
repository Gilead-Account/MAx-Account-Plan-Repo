export function Icon({ name, size = 20 }) {
  const paths = {
    spark: <><path d="M12 3l1.7 4.7L18 9.5l-4.3 1.8L12 16l-1.7-4.7L6 9.5l4.3-1.8L12 3z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"/></>,
    building: <><path d="M5 21V6l7-3 7 3v15"/><path d="M3 21h18M9 8h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1"/></>,
    people: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 20c.5-4 2.3-6 5.5-6s5 2 5.5 6m.5-5c3.3-.7 5.2 1 5.5 4"/></>,
    signal: <><path d="M4 19V9m6 10V5m6 14v-7m4 7V3"/><path d="M2 21h20"/></>,
    target: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M15 9l6-6m-3 0h3v3"/></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4m8-4v4M4 10h16"/></>,
    check: <path d="M5 12l4 4L19 6"/>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    edit: <><path d="M4 20h4l11-11-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/><path d="M10 11v5m4-5v5"/></>,
    close: <path d="M6 6l12 12M18 6L6 18"/>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M4 7l8 6 8-6"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></>,
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.5"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
  };

  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export function Pill({ children, tone = 'neutral' }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function PanelTitle({ eyebrow, title, action }) {
  return <div className="panel-head">
    <div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>
    {action}
  </div>;
}
