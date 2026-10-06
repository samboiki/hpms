import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';

interface ListSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
  /** False while something is running (e.g. sending), so a stray tap cannot close it */
  dismissible?: boolean;
  /** Field to focus when the sheet opens (otherwise the sheet itself) */
  initialFocus?: React.RefObject<HTMLElement | null>;
}

/**
 * Dialog for the patient-list screens: a bottom sheet on phones, a centred card on larger screens.
 * Rendered in a portal above the patient file (which sits at z-index 9999). Clicks inside never
 * reach the screen underneath, so the patient file stays open.
 */
export const ListSheet: React.FC<ListSheetProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  dismissible = true,
  initialFocus
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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (initialFocus?.current ?? panelRef.current)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissibleRef.current) {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, initialFocus]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10060] flex items-end justify-center sm:items-center sm:p-4"
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-[2px]"
        aria-hidden="true"
        onClick={() => {
          if (dismissible) onClose();
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
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

export default ListSheet;
