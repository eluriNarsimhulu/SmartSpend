import { useEffect, useRef } from 'react';
import Icon from './Icon';

// Accessible modal: closes on Esc / overlay click, locks page scroll, returns focus on close.
export default function Modal({ open, onClose, title, children, footer, size = 'md', dismissible = true }) {
  const dialogRef = useRef(null);
  // Keep the latest callbacks in a ref so the effect below only runs when `open` changes
  // (otherwise typing in a form would re-focus the dialog on every render).
  const latest = useRef({ onClose, dismissible });
  latest.current = { onClose, dismissible };

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && latest.current.dismissible) latest.current.onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && dismissible && onClose()}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={dialogRef}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close" disabled={!dismissible}>
            <Icon name="x" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}
