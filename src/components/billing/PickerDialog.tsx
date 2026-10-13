import React, { useEffect, useId, useRef } from 'react';
import { Icon } from '@iconify/react';

interface PickerDialogProps {
  open: boolean;
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** md: a tooth picker; xl: the service list */
  size?: 'md' | 'xl';
  /** Field to focus when the dialog opens (otherwise the dialog itself) */
  initialFocus?: React.RefObject<HTMLElement | null>;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]';

/**
 * A picker over the visit screen (the service list, the tooth picker): a bottom sheet on phones, a centred card from
 * 640 px. It is drawn inside the visit (which is itself full screen), so it needs no portal. Escape closes the picker
 * only: the visit screen closes on Escape too, and would otherwise lose the visit being written.
 */
const PickerDialog: React.FC<PickerDialogProps> = ({ open, title, subtitle, onClose, children, footer, size = 'md', initialFocus }) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (initialFocus?.current ?? panelRef.current)?.focus();
    // On the window, in the capture phase: before the visit screen's own Escape handler on the document
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      previousFocus?.focus();
    };
  }, [open, initialFocus]);

  if (!open) return null;

  // Tab stays inside the dialog
  const keepFocusInside = (event: React.KeyboardEvent) => {
    if (event.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(item => item.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" onClick={event => event.stopPropagation()}>
      <div className="absolute inset-0 bg-gray-900/40" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={keepFocusInside}
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none sm:max-h-[88vh] sm:rounded-2xl ${
          // The service list keeps its height while a search narrows it, so the dialog does not jump
          size === 'xl' ? 'h-[92dvh] sm:h-[85vh] sm:max-w-5xl' : 'sm:max-w-3xl'
        }`}
      >
        <div className="flex flex-none items-start justify-between gap-3 border-b border-gray-100 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h3 id={titleId} className="text-lg font-semibold text-gray-900">
              {title}
            </h3>
            {subtitle && <div className="mt-0.5 text-sm text-gray-500">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex-none rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 motion-reduce:transition-none"
          >
            <Icon icon="solar:close-circle-bold-duotone" className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="flex-none border-t border-gray-100 bg-gray-50/80 px-4 py-3 sm:px-6">{footer}</div>}
      </div>
    </div>
  );
};

export default PickerDialog;
