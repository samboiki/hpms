import React, { useEffect, useId, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Icon } from '@iconify/react';
import { cn } from '../../../utils/cn';

/**
 * Building blocks of the receipt screens. A sheet is a bottom sheet on phones (full width, up to
 * the full height) and a centred dialog from sm. It renders into document.body so it also works
 * on top of another dialog.
 */

type Tone = 'cyan' | 'amber' | 'red' | 'green' | 'violet' | 'gray';

const CHIP: Record<Tone, string> = {
  cyan: 'bg-cyan-100 text-cyan-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  green: 'bg-green-100 text-green-700',
  violet: 'bg-violet-100 text-violet-700',
  gray: 'bg-gray-100 text-gray-700'
};

const WIDTH = { md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  icon: string;
  tone?: Tone;
  /** While saving: the sheet cannot be closed */
  busy?: boolean;
  size?: keyof typeof WIDTH;
  footer?: React.ReactNode;
  /** Opened from a full-screen screen (the visit): shown above it, as the clinical dialogs are */
  overFullScreen?: boolean;
  children: React.ReactNode;
}

export const Sheet: React.FC<SheetProps> = ({ open, onClose, title, subtitle, icon, tone = 'cyan', busy = false, size = 'lg', footer, overFullScreen = false, children }) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // The latest close handler and busy flag, without re-running the open effect (which moves focus)
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  });

  useEffect(() => {
    if (!open) return;
    // Captured on window and stopped, so Escape closes this sheet only, not a dialog underneath it
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      if (!busyRef.current) onCloseRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus the first field (or the panel) once, so keyboard users start inside the sheet
    const first = panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button[data-autofocus]');
    (first ?? panelRef.current)?.focus();
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;
  return ReactDOM.createPortal(
    <div
      className={cn('fixed inset-0 flex items-end sm:items-center justify-center bg-black/50 sm:p-4', overFullScreen ? 'z-[2147483647]' : 'z-[60]')}
      onMouseDown={event => {
        // A click outside closes this sheet only: a dialog underneath must not see it as its own outside click
        event.stopPropagation();
        if (!busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={event => event.stopPropagation()}
        className={cn('flex w-full flex-col bg-white shadow-xl rounded-t-2xl sm:rounded-2xl max-h-[100dvh] sm:max-h-[90vh] focus:outline-none', WIDTH[size])}
      >
        <div className="flex items-start gap-3 border-b border-gray-100 px-4 py-4 sm:px-6">
          <div className={cn('rounded-lg p-2 flex-shrink-0', CHIP[tone])}>
            <Icon icon={icon} className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold leading-snug text-gray-900">{title}</h2>
            {subtitle && <div className="mt-0.5 text-sm text-gray-500">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            aria-label="Close"
          >
            <Icon icon="solar:close-circle-bold-duotone" className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-4 py-3 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

export const Field: React.FC<{ label: string; htmlFor?: string; hint?: React.ReactNode; error?: string | null; className?: string; children: React.ReactNode }> = ({
  label,
  htmlFor,
  hint,
  error,
  className,
  children
}) => (
  <div className={className}>
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
    {children}
    {error ? (
      <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>
    ) : hint ? (
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    ) : null}
  </div>
);

export const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 disabled:bg-gray-50';

/** N$ amount: typed as text so "12.5" and "1,250" work; parse with parseAmountInput */
export const AmountInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-500">N$</span>
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cn(inputClass, 'pl-10 text-right tabular-nums', invalid && 'border-red-400 focus:border-red-500 focus:ring-red-500/30', className)}
        {...props}
      />
    </div>
  )
);
AmountInput.displayName = 'AmountInput';

export interface Choice<T extends string> {
  value: T;
  label: string;
  icon?: string;
}

/** A small set of options as buttons (radio group) */
export function ChoiceGroup<T extends string>({ value, onChange, options, label, disabled }: {
  value: T | null;
  onChange: (value: T) => void;
  options: readonly Choice<T>[];
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(option => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50',
              selected ? 'border-cyan-500 bg-cyan-50 text-cyan-800 ring-1 ring-cyan-200' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            )}
          >
            {option.icon && <Icon icon={option.icon} className="h-4 w-4" aria-hidden="true" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: string; busy?: boolean; tone?: 'cyan' | 'red' }> = ({
  icon,
  busy,
  tone = 'cyan',
  children,
  className,
  disabled,
  ...props
}) => (
  <button
    type="button"
    disabled={disabled || busy}
    className={cn(
      'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50',
      tone === 'red' ? 'bg-red-600 hover:bg-red-700' : 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:shadow-md',
      className
    )}
    {...props}
  >
    <Icon icon={busy ? 'solar:refresh-bold-duotone' : icon ?? 'solar:check-circle-bold-duotone'} className={cn('h-4 w-4', busy && 'animate-spin')} aria-hidden="true" />
    {children}
  </button>
);

export const SecondaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: string }> = ({ icon, children, className, ...props }) => (
  <button
    type="button"
    className={cn('inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50', className)}
    {...props}
  >
    {icon && <Icon icon={icon} className="h-4 w-4" aria-hidden="true" />}
    {children}
  </button>
);

/** A row of label and amount in a summary box */
export const SummaryRow: React.FC<{ label: React.ReactNode; value: React.ReactNode; strong?: boolean; tone?: 'default' | 'warning' | 'good' }> = ({ label, value, strong, tone = 'default' }) => (
  <div className={cn('flex items-baseline justify-between gap-3 text-sm', strong && 'font-semibold', tone === 'warning' && 'text-amber-800', tone === 'good' && 'text-green-700')}>
    <span className={tone === 'default' && !strong ? 'text-gray-600' : undefined}>{label}</span>
    <span className="tabular-nums whitespace-nowrap">{value}</span>
  </div>
);

export const ErrorBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
    <Icon icon="solar:danger-circle-bold-duotone" className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" aria-hidden="true" />
    <div className="min-w-0 break-words">{children}</div>
  </div>
);
