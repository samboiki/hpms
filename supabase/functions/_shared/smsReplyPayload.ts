/**
 * Reading SMSPortal "SMS Reply Webhook" calls. Pure TypeScript (no Deno APIs): unit tested with Vitest.
 *
 * The owner configures a Custom Body (JSON) in SMSPortal:
 *   { "eventId": @@EventId@@, "sourcePhoneNumber": "@@SourcePhoneNumber@@",
 *     "destinationPhoneNumber": "@@DestinationPhoneNumber@@", "customerId": "@@CustomerId@@",
 *     "optOutPhrase": "@@OptOutPhrase@@", "optOut": @@OptOut@@, "campaign": "@@Campaign@@",
 *     "groupData": @@GroupData@@, "incomingId": @@IncomingId@@, "incomingData": "@@IncomingData@@",
 *     "incomingUtc": @@IncomingUtc@@, "sentId": @@SentId@@, "sentData": "@@SentData@@", "sentUtc": @@SentUtc@@ }
 *
 * Placeholders are substituted as text, so the body is not always valid JSON: an empty unquoted
 * value ("eventId": ,), an unquoted date, or a reply containing a quote or a line break. When
 * JSON.parse fails, each field is read between its key and the next key instead. Ids are always
 * read from the raw text, because JSON numbers lose digits beyond 2^53 and two different SMSPortal
 * ids could then look like one (a reply would be dropped as a "duplicate").
 */

export interface SmsPortalReply {
  eventId: string | null;
  incomingId: string | null;
  sentId: string | null;
  /** The patient's number, as SMSPortal sent it */
  sourcePhone: string;
  destinationPhone: string | null;
  /** The reference sent with the original message: the practice_sms_logs id (see the SMS gateway) */
  customerId: string | null;
  optOut: boolean;
  optOutPhrase: string | null;
  campaign: string | null;
  /** The reply text */
  incomingText: string;
  incomingAt: string | null;
  /** The original message text */
  sentText: string | null;
  sentAt: string | null;
}

export type SmsPortalParseResult =
  | { ok: true; reply: SmsPortalReply; repaired: boolean }
  | { ok: false; error: string };

const FIELDS = [
  'eventId', 'sourcePhoneNumber', 'destinationPhoneNumber', 'customerId', 'optOutPhrase', 'optOut',
  'campaign', 'groupData', 'incomingId', 'incomingData', 'incomingUtc', 'sentId', 'sentData', 'sentUtc',
] as const;

const UNREPLACED_PLACEHOLDER = /^@@\w+@@$/;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Read each known field between its key and the next key (the body was not valid JSON). */
function readFieldsLeniently(raw: string): Record<string, unknown> {
  const positions = FIELDS.map((key) => {
    const match = new RegExp(`"${escapeRegExp(key)}"\\s*:`).exec(raw);
    return match ? { key, start: match.index, valueStart: match.index + match[0].length } : null;
  })
    .filter((found): found is { key: (typeof FIELDS)[number]; start: number; valueStart: number } => found !== null)
    .sort((a, b) => a.start - b.start);

  const fields: Record<string, unknown> = {};
  positions.forEach((field, index) => {
    const end = index + 1 < positions.length ? positions[index + 1].start : raw.lastIndexOf('}');
    const value = raw.slice(field.valueStart, end > field.valueStart ? end : raw.length).trim().replace(/,$/, '').trim();
    fields[field.key] = decodeLenientValue(value);
  });
  return fields;
}

function decodeLenientValue(value: string): unknown {
  if (value === '') return null;
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1).replace(/\\(["\\/])/g, '$1').replace(/\\n/g, '\n').replace(/\\r/g, '\r');
    }
  }
  try {
    return JSON.parse(value);
  } catch {
    return value; // a bare token, e.g. an unquoted date
  }
}

/** Digits of an id field, read from the raw body so large numbers keep every digit. */
function rawDigits(raw: string, key: string): string | null {
  const match = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*"?\\s*(\\d{1,30})\\s*"?\\s*[,}]`).exec(raw);
  return match ? match[1].replace(/^0+(?=\d)/, '') : null;
}

function idValue(raw: string, key: string, parsed: unknown): string | null {
  const exact = rawDigits(raw, key);
  if (exact && exact !== '0') return exact;
  if (typeof parsed === 'number' && Number.isSafeInteger(parsed) && parsed > 0) return String(parsed);
  if (typeof parsed === 'string' && /^\d+$/.test(parsed.trim()) && /[1-9]/.test(parsed)) {
    return parsed.trim().replace(/^0+(?=\d)/, '');
  }
  return null;
}

/** A text field, or null when empty or never filled in. Message texts keep a literal "null" a patient typed. */
function textValue(value: unknown, isMessageText = false): string | null {
  if (value === null || value === undefined) return null;
  const text = typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' ? String(value) : null;
  if (text === null) return null;
  const trimmed = text.trim();
  if (trimmed === '' || UNREPLACED_PLACEHOLDER.test(trimmed)) return null;
  if (!isMessageText && trimmed.toLowerCase() === 'null') return null;
  return trimmed;
}

function booleanValue(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') return ['true', '1', 'yes', 'y'].includes(value.trim().toLowerCase());
  return false;
}

const ISO_LIKE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?(?:Z|[+-]\d{2}:?\d{2})?$/i;
const EARLIEST = Date.UTC(2000, 0, 1);

/**
 * A provider timestamp as ISO text, or null when it cannot be read safely. Accepts epoch seconds or
 * milliseconds (number or digits) and ISO-like UTC text; day/month text such as "07/10/2026" is
 * ambiguous and ignored (the receive time is used instead).
 */
export function parseProviderTime(value: unknown, now: Date = new Date()): string | null {
  let ms: number | null = null;
  const numeric = typeof value === 'number' ? value : typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : null;
  if (numeric !== null && Number.isFinite(numeric) && numeric > 0) {
    ms = numeric < 1e11 ? numeric * 1000 : numeric;
  } else if (typeof value === 'string' && ISO_LIKE.test(value.trim())) {
    const text = value.trim().replace(' ', 'T');
    const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
    const parsed = Date.parse(hasZone || text.length === 10 ? text : `${text}Z`); // the field is UTC
    ms = Number.isNaN(parsed) ? null : parsed;
  }
  if (ms === null || ms < EARLIEST || ms > now.getTime() + 24 * 60 * 60 * 1000) return null;
  return new Date(ms).toISOString();
}

/** Read an SMSPortal reply webhook body. */
export function parseSmsPortalReply(rawBody: string, now: Date = new Date()): SmsPortalParseResult {
  const raw = (rawBody ?? '').trim();
  if (!raw) return { ok: false, error: 'Empty body' };

  let fields: Record<string, unknown> | null = null;
  let repaired = false;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) fields = parsed as Record<string, unknown>;
  } catch {
    fields = null;
  }
  if (!fields) {
    if (!raw.startsWith('{')) return { ok: false, error: 'The body is not a JSON object' };
    fields = readFieldsLeniently(raw);
    repaired = true;
  }

  const sourcePhone = textValue(fields.sourcePhoneNumber);
  if (!sourcePhone || !/\d/.test(sourcePhone)) {
    return { ok: false, error: 'sourcePhoneNumber is missing: check the SMSPortal custom body' };
  }

  return {
    ok: true,
    repaired,
    reply: {
      eventId: idValue(raw, 'eventId', fields.eventId),
      incomingId: idValue(raw, 'incomingId', fields.incomingId),
      sentId: idValue(raw, 'sentId', fields.sentId),
      sourcePhone,
      destinationPhone: textValue(fields.destinationPhoneNumber),
      customerId: textValue(fields.customerId),
      optOut: booleanValue(fields.optOut),
      optOutPhrase: textValue(fields.optOutPhrase),
      campaign: textValue(fields.campaign),
      incomingText: textValue(fields.incomingData, true) ?? '',
      incomingAt: parseProviderTime(fields.incomingUtc, now),
      sentText: textValue(fields.sentData, true),
      sentAt: parseProviderTime(fields.sentUtc, now),
    },
  };
}

/**
 * The key that makes a reply unique: SMSPortal's id of the incoming SMS (the same on every
 * delivery attempt of the webhook), else the event id. Null when the body has neither.
 */
export function replyIdempotencyKey(reply: Pick<SmsPortalReply, 'incomingId' | 'eventId'>): string | null {
  if (reply.incomingId) return `smsportal:incoming:${reply.incomingId}`;
  if (reply.eventId) return `smsportal:event:${reply.eventId}`;
  return null;
}

/** Compare a presented secret with the expected one in time that does not depend on where they differ. */
export function constantTimeEqual(presented: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(presented);
  const b = encoder.encode(expected);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The practice_sms_logs id in customerId, when it is one (older messages carried "msg-<time>"). */
export function smsLogIdFromCustomerId(customerId: string | null | undefined): string | null {
  const value = (customerId ?? '').trim();
  return UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}
