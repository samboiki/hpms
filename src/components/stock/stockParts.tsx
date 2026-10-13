/** Small shared components of the stock screens: status chips, a labelled form field, the "not set up" notice */
import React, { useId } from 'react';
import { Icon } from '@iconify/react';
import { CARD, LABEL, STOCK_COLOR } from './stockUi';

type ChipTone = 'gray' | 'green' | 'amber' | 'red' | 'cyan' | 'violet';
const CHIP_TONES: Record<ChipTone, string> = {
  gray: 'bg-gray-100 text-gray-700',
  green: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100',
  red: 'bg-red-50 text-red-700 ring-1 ring-red-100',
  cyan: 'bg-cyan-50 text-cyan-800 ring-1 ring-cyan-100',
  violet: 'bg-violet-50 text-violet-700 ring-1 ring-violet-100'
};

export const Chip: React.FC<{ tone?: ChipTone; icon?: string; children: React.ReactNode }> = ({ tone = 'gray', icon, children }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${CHIP_TONES[tone]}`}>
    {icon && <Icon icon={icon} className="h-3.5 w-3.5" aria-hidden="true" />}
    {children}
  </span>
);

/**
 * A labelled form field. The child input gets the id, and the hint or error is announced with it
 * (aria-describedby), so screen readers read "Quantity, only 4 on hand".
 */
export const Field: React.FC<{
  label: string;
  hint?: React.ReactNode;
  error?: string;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => React.ReactNode;
  className?: string;
}> = ({ label, hint, error, children, className = '' }) => {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div className={className}>
      <label htmlFor={id} className={LABEL}>{label}</label>
      {children({ id, 'aria-describedby': note ? noteId : undefined, 'aria-invalid': error ? true : undefined })}
      {note && (
        <p id={noteId} className={`mt-1 text-xs ${error ? 'text-red-600' : 'text-gray-500'}`}>{note}</p>
      )}
    </div>
  );
};

/** Shown wherever stock is used before the database update is applied */
export const StockNotSetUp: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <div className={`${CARD} flex items-start gap-3 ${compact ? 'p-3' : 'p-5'}`} role="status">
    <Icon icon="solar:box-minimalistic-bold-duotone" className={`mt-0.5 h-6 w-6 flex-shrink-0 ${STOCK_COLOR.text}`} aria-hidden="true" />
    <div className="text-sm text-gray-700">
      <p className="font-semibold text-gray-900">Stock and dispensing are not set up yet</p>
      <p className="mt-0.5">
        The stock update has not been applied to your practice&apos;s database. Until it is, the inventory list in Settings &gt; Practice
        &gt; Inventory works as before.
      </p>
    </div>
  </div>
);
