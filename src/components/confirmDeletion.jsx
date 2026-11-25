import { useLayoutEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// In-app dialog: embedded iPad webviews may suppress window.confirm.
export function confirmDeletion(message) {
  const previousFocus = document.activeElement;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  return new Promise((resolve) => {
    const finish = (answer) => {
      root.unmount();
      host.remove();
      previousFocus?.focus();
      resolve(answer);
    };
    root.render(<DeletionDialog message={message} finish={finish}/>);
  });
}
function DeletionDialog({ message, finish }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    const pane = document.querySelector('.workspace');
    const fit = () => {
      if (!pane) return;
      const rect = pane.getBoundingClientRect();
      Object.assign(dialog.style, {
        left: `${rect.left + 12}px`, top: `${rect.top + 12}px`,
        right: 'auto', bottom: 'auto', margin: '0',
        width: `${Math.max(0, rect.width - 24)}px`,
        maxWidth: '640px', maxHeight: `${Math.max(0, rect.height - 24)}px`,
      });
      dialog.style.left = `${rect.left + (rect.width - dialog.getBoundingClientRect().width) / 2}px`;
    };
    dialog.showModal();
    fit();
    const observer = pane && new ResizeObserver(fit);
    if (pane) observer.observe(pane);
    window.addEventListener('resize', fit);
    return () => { observer?.disconnect(); window.removeEventListener('resize', fit); };
  }, []);
  return <dialog ref={ref} className="key-win-modal deletion-confirmation" aria-labelledby="deletion-title" onCancel={(event) => { event.preventDefault(); finish(false); }}>
    <div className="key-win-modal-head"><h2 id="deletion-title">Confirm deletion</h2></div>
    <div className="key-win-modal-body" style={{ whiteSpace: 'pre-wrap', overflowY: 'auto', maxHeight: '60vh' }}>{message}</div>
    <div className="key-win-modal-actions"><button autoFocus type="button" className="button secondary" onClick={() => finish(false)}>Cancel</button><button type="button" className="button primary" onClick={() => finish(true)}>Confirm deletion</button></div>
  </dialog>;
}
