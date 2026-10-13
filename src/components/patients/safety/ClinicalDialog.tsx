import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';

interface ClinicalDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
  /** False while something is saving, so a stray tap or Escape cannot close it */
  dismissible?: boolean;
  /** Field to focus when the dialog opens (otherwise the dialog itself) */
  initialFocus?: React.RefObject<HTMLElement | null>;
  /** 'alert' for decisions that need attention (an allergy warning) */
  role?: 'dialog' | 'alertdialog';
}

/**
 * Dialog for the clinical screens: a bottom sheet on phones, a centred card on larger screens. It
 * opens above the full-screen visit screen and the patient file (both use the highest z-index, so this
 * one, added to the page last, stacks on top). Clicks inside never reach the screen underneath.
 * Same behaviour as the patient-list sheet (ListSheet), which sits below the visit screen.
 */
export const ClinicalDialog: React.FC<ClinicalDialogProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  dismissible = true,
  initialFocus,
  role = 'dialog'
}) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  onCloseRef.current = onClose;
  dismissibleRef.current = dismissible;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (initialFocus?.current ?? panelRef.current)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Escape belongs to this dialog, never to the visit screen or patient file underneath
        event.stopPropagation();
        if (dismissibleRef.current) onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previousFocus?.focus();
    };
  }, [open, initialFocus]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483647] flex items-end justify-center sm:items-center sm:p-4"
      onClick={event => event.stopPropagation()}
      onMouseDown={event => event.stopPropagation()}
    >
      <div
        className="absolute inset-0 bg-gray-900/40"
        aria-hidden="true"
        onClick={() => {
          if (dismissible) onClose();
        }}
      />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none sm:rounded-2xl ${
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg'
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-gray-900">
              {title}
            </h2>
            {subtitle && <div className="mt-0.5 text-sm text-gray-500">{subtitle}</div>}
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <Icon icon="solar:close-circle-bold-duotone" className="h-6 w-6" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer && <div className="border-t border-gray-100 bg-gray-50/80 px-4 py-3 sm:px-5">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

export default ClinicalDialog;
