/**
 * Figures for the Communications dashboard, computed only from the practice's own SMS and email
 * logs and bundles. Nothing is estimated: when there is nothing to measure a rate is null and the
 * screen says so, instead of showing a made-up percentage.
 */

/** Counts returned by communicationService.getSMSStats (null when the logs could not be read) */
export interface SmsLogCounts {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  blocked: number;
  byType: Record<string, number>;
}

/** Counts returned by communicationService.getEmailStats (null when the logs could not be read) */
export interface EmailLogCounts {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  spam: number;
  byType: Record<string, number>;
}

export interface BundleRow {
  monthly_limit: number;
  current_usage: number | null;
}

export interface BundleUsage {
  used: number;
  limit: number;
  /** False when the practice has no active bundle: show that, not a made-up limit */
  hasBundle: boolean;
  /** 0-100, for the usage bar */
  percentUsed: number;
}

export interface MessageTypeCount {
  type: string;
  label: string;
  count: number;
}

export interface SmsSummary {
  total: number;
  /** Accepted by the SMS provider (status sent or delivered) */
  succeeded: number;
  delivered: number;
  /** Failed or blocked */
  failed: number;
  /** Share of all SMS in the period that were accepted; null when none were sent */
  successRate: number | null;
  types: MessageTypeCount[];
}

export interface EmailSummary {
  total: number;
  /** Sent without failing or bouncing (sent, delivered, opened, clicked or marked as spam) */
  succeeded: number;
  /** Opened at least once (a clicked email was also opened) */
  opened: number;
  clicked: number;
  /** Failed or bounced */
  failed: number;
  successRate: number | null;
  /** Share of successfully sent emails that were opened; null when none were sent */
  openRate: number | null;
  types: MessageTypeCount[];
}

/** Percentage with one decimal, or null when there is nothing to divide by. */
export function percentOf(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

/** "appointment_reminder" -> "Appointment reminder"; a missing type -> "Other" */
export function formatMessageType(type: string | null | undefined): string {
  const text = (type ?? '').replace(/[_-]+/g, ' ').trim();
  if (!text || text === 'null' || text === 'undefined') return 'Other';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/** Message types with at least one message, most used first. */
export function messageTypeBreakdown(byType: Record<string, number> | null | undefined): MessageTypeCount[] {
  return Object.entries(byType ?? {})
    .filter(([, count]) => Number.isFinite(count) && count > 0)
    .map(([type, count]) => ({ type, label: formatMessageType(type), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function summarizeSms(counts: SmsLogCounts | null | undefined): SmsSummary {
  const total = counts?.total ?? 0;
  const delivered = counts?.delivered ?? 0;
  const succeeded = (counts?.sent ?? 0) + delivered;
  return {
    total,
    succeeded,
    delivered,
    failed: (counts?.failed ?? 0) + (counts?.blocked ?? 0),
    successRate: percentOf(succeeded, total),
    types: messageTypeBreakdown(counts?.byType)
  };
}

export function summarizeEmail(counts: EmailLogCounts | null | undefined): EmailSummary {
  const total = counts?.total ?? 0;
  const opened = (counts?.opened ?? 0) + (counts?.clicked ?? 0);
  const succeeded = (counts?.sent ?? 0) + (counts?.delivered ?? 0) + opened + (counts?.spam ?? 0);
  return {
    total,
    succeeded,
    opened,
    clicked: counts?.clicked ?? 0,
    failed: (counts?.failed ?? 0) + (counts?.bounced ?? 0),
    successRate: percentOf(succeeded, total),
    openRate: percentOf(opened, succeeded),
    types: messageTypeBreakdown(counts?.byType)
  };
}

export function bundleUsage(row: BundleRow | null | undefined): BundleUsage {
  const limit = row?.monthly_limit ?? 0;
  const used = row?.current_usage ?? 0;
  const hasBundle = !!row && limit > 0;
  return {
    used,
    limit,
    hasBundle,
    percentUsed: hasBundle ? Math.min(100, Math.max(0, (used / limit) * 100)) : 0
  };
}
