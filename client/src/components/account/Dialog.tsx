import { useEffect, useId, useRef, type FormEventHandler, type KeyboardEvent, type ReactNode } from 'react';

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

interface DialogProps {
  title: string;
  onClose: () => void;
  wide?: boolean;
  /** When provided, the content is wrapped in a <form>. */
  onSubmit?: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
}

/**
 * Accessible modal: role="dialog", labelled by its title, closes on Escape,
 * keeps Tab focus inside, locks page scroll and returns focus to the trigger.
 * Add `data-autofocus` to an element to choose what receives initial focus.
 */
export const Dialog = ({ title, onClose, wide = false, onSubmit, children }: DialogProps) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const preferred = panel?.querySelector<HTMLElement>('[data-autofocus]');
    const first = preferred ?? panel?.querySelector<HTMLElement>('input,select,textarea,button');
    (first ?? panel)?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="account-dialog-backdrop">
      <div
        ref={panelRef}
        className={`account-dialog${wide ? ' account-dialog--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <h2 id={titleId}>{title}</h2>
        {onSubmit ? <form onSubmit={onSubmit}>{children}</form> : children}
      </div>
    </div>
  );
};

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Replaces window.confirm for destructive actions. Focus starts on Cancel. */
export const ConfirmDialog = ({ title, message, confirmLabel = 'Delete', busy = false, onConfirm, onCancel }: ConfirmDialogProps) => (
  <Dialog title={title} onClose={onCancel}>
    <p className="account-confirm__message">{message}</p>
    <div className="dialog-actions">
      <button type="button" data-autofocus onClick={onCancel} disabled={busy}>Cancel</button>
      <button type="button" className="account-danger" onClick={onConfirm} disabled={busy}>
        {busy ? 'Working…' : confirmLabel}
      </button>
    </div>
  </Dialog>
);
