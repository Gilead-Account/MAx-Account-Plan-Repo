import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import PdfAllPagesViewer from '@/components/PdfAllPagesViewer';
import userGuidePdf from '@/assets/market-access-account-plan-user-guide.pdf?url';
import '@/components/PayerUserGuideModal.css';

export default function PayerUserGuideModal({ onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key !== 'Tab') return;
      const targets = [...dialogRef.current.querySelectorAll('button, a[href], [tabindex="0"]')];
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="payer-user-guide-overlay" onClick={onClose}>
      <section className="payer-user-guide" role="dialog" aria-modal="true" aria-labelledby="payer-user-guide-title" ref={dialogRef} onClick={(event) => event.stopPropagation()}>
        <header className="payer-user-guide-header">
          <h2 id="payer-user-guide-title">Payer360 CRM Metric Definitions Training</h2>
          <button type="button" ref={closeRef} onClick={onClose} aria-label="Close user guide">Close</button>
        </header>
        <div className="payer-user-guide-body">
          <PdfAllPagesViewer src={userGuidePdf} />
        </div>
      </section>
    </div>,
    document.body,
  );
}
