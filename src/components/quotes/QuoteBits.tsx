import React from 'react';
import { Icon } from '@iconify/react';
import { QUOTE_STATUS_LABELS, type QuoteStatus } from './quotes';

/** Shown instead of errors while the quote and bundle tables are not in the database yet. */
export const QuotesNotEnabled: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <div className={compact ? 'rounded-xl bg-gray-50 px-4 py-6 text-center' : 'mx-auto max-w-md px-4 py-12 text-center'}>
    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 ring-1 ring-cyan-100">
      <Icon icon="solar:bill-list-bold-duotone" className="h-6 w-6 text-cyan-600" aria-hidden="true" />
    </div>
    <h3 className="text-base font-semibold text-gray-900">Quotes are not switched on yet</h3>
    <p className="mt-1 text-sm text-gray-500">
      Your administrator needs to apply the quotes and code bundles update first. Nothing is saved until then.
    </p>
  </div>
);

const STATUS_STYLES: Record<QuoteStatus, { chip: string; icon: string }> = {
  draft: { chip: 'bg-gray-100 text-gray-700', icon: 'solar:pen-bold-duotone' },
  sent: { chip: 'bg-blue-50 text-blue-700', icon: 'solar:plain-bold-duotone' },
  accepted: { chip: 'bg-green-50 text-green-700', icon: 'solar:check-circle-bold-duotone' },
  declined: { chip: 'bg-red-50 text-red-700', icon: 'solar:close-circle-bold-duotone' },
  expired: { chip: 'bg-amber-50 text-amber-800', icon: 'solar:clock-circle-bold-duotone' },
  converted: { chip: 'bg-cyan-50 text-cyan-800', icon: 'solar:bill-check-bold-duotone' }
};

export const QuoteStatusChip: React.FC<{ status: QuoteStatus }> = ({ status }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[status].chip}`}>
    <Icon icon={STATUS_STYLES[status].icon} className="h-3.5 w-3.5" aria-hidden="true" />
    {QUOTE_STATUS_LABELS[status]}
  </span>
);

/** Inline list of messages (errors or warnings) under a form. */
export const MessageList: React.FC<{ tone: 'error' | 'warning' | 'info'; messages: readonly string[]; title?: string }> = ({ tone, messages, title }) => {
  if (messages.length === 0) return null;
  const styles = {
    error: { box: 'bg-red-50 border-red-200 text-red-800', icon: 'solar:danger-circle-bold-duotone' },
    warning: { box: 'bg-amber-50 border-amber-200 text-amber-900', icon: 'solar:danger-triangle-bold-duotone' },
    info: { box: 'bg-blue-50 border-blue-200 text-blue-900', icon: 'solar:info-circle-bold-duotone' }
  }[tone];
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${styles.box}`} role={tone === 'error' ? 'alert' : undefined}>
      <Icon icon={styles.icon} className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {messages.map(message => (
          <p key={message} className="break-words">{message}</p>
        ))}
      </div>
    </div>
  );
};

export const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50';
export const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50';
export const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:bg-gray-100';
export const labelClass = 'mb-1 block text-xs font-medium text-gray-600';
