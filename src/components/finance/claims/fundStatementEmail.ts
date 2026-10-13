/**
 * Emails the statement of outstanding claims to the fund (parity F22): the PDF (fundStatementPdf.ts) to the fund's claims
 * address from the fund master (medical_aid_providers.email, kept by OneHealth support under Administration > Medical
 * aid funds), through the centralized email gateway (communicationService.sendEmail), which logs it in
 * practice_email_logs with the other emails. Nothing is sent until staff confirm on the screen.
 */
import { communicationService, getCommunicationErrorMessage } from '../../../services/communicationService';
import { formatServiceDate } from '../../../utils/billing/dates';
import { formatNad, fromCents } from '../../../utils/billing/money';
import { isEmailAddress } from '../../../utils/messages/documentEmail';
import { fundName } from './fundStatementPdf';
import type { FundStatement } from './fundStatement';
import type { FundProvider, PracticeInfo } from './types';

export interface FundRecipient {
  email: string;
  /** "NHP (NHPM)" */
  label: string;
  reference: string | null;
}

const lower = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase();

/**
 * Where the statement can go: the claims address of each fund code its batches were sent under (one address once);
 * when no code matches, the fund with the statement's name. Funds without a usable address are left out.
 */
export function fundRecipients(statement: Pick<FundStatement, 'fund' | 'fundCodes'>, funds: readonly FundProvider[]): FundRecipient[] {
  const codes = new Set(statement.fundCodes.map(code => code.trim().toUpperCase()));
  let matches = funds.filter(fund => fund.medical_aid_reference && codes.has(fund.medical_aid_reference.trim().toUpperCase()));
  if (matches.length === 0) {
    const name = lower(statement.fund);
    matches = funds.filter(fund => name !== '' && (lower(fund.name) === name || lower(fund.short_name) === name));
  }
  const seen = new Set<string>();
  const recipients: FundRecipient[] = [];
  for (const fund of matches) {
    const email = (fund.email ?? '').trim();
    if (!isEmailAddress(email) || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    const reference = fund.medical_aid_reference?.trim() || null;
    recipients.push({ email, label: `${fund.short_name?.trim() || fund.name}${reference ? ` (${reference})` : ''}`, reference });
  }
  return recipients;
}

export interface FundStatementMessage {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The email that goes with the PDF: who it is from, how many claims, how much, how old, and who to answer */
export function fundStatementMessage(statement: FundStatement, asOfKey: string, practice: Pick<PracticeInfo, 'name' | 'practice_number' | 'contact_email'>): FundStatementMessage {
  const fund = fundName(statement);
  const total = formatNad(fromCents(statement.owedCents));
  const asAt = formatServiceDate(asOfKey);
  const practiceText = `${practice.name}${practice.practice_number ? ` (practice number ${practice.practice_number})` : ''}`;
  const oldest = statement.oldestAgeDays === null ? null : `${statement.oldestAgeDays} days`;
  const reply = practice.contact_email?.trim() || null;
  const lines = [
    `Dear ${fund} claims team,`,
    '',
    `Please find attached our statement of outstanding claims as at ${asAt}: ${statement.claimCount} claim(s) sent to you that are not paid yet, ${total} in all${oldest ? `, the oldest ${oldest}` : ''}.`,
    'Please let us know when they will be paid, or which you have rejected and why.',
    '',
    `${practiceText}${reply ? `. Replies to ${reply}` : ''}.`
  ];
  return {
    subject: `Outstanding claims as at ${asAt} - ${practice.name}${practice.practice_number ? ` (practice ${practice.practice_number})` : ''}`,
    text: lines.join('\n'),
    html: lines.map(line => (line ? `<p>${escapeHtml(line)}</p>` : '')).join('')
  };
}

export interface FundStatementEmail {
  practice: PracticeInfo;
  statement: FundStatement;
  recipient: FundRecipient;
  message: FundStatementMessage;
  attachment: { fileName: string; base64: string };
}

/** Sends the statement through the gateway; the result's message is shown as it is */
export async function emailFundStatement(email: FundStatementEmail): Promise<{ ok: boolean; message: string }> {
  const { practice, statement, recipient, message } = email;
  if (!isEmailAddress(recipient.email)) return { ok: false, message: 'The fund has no valid claims email address on record.' };
  const response = await communicationService.sendEmail({
    practiceId: practice.id,
    recipientEmail: recipient.email,
    recipientName: `${recipient.label} claims`,
    subject: message.subject,
    htmlContent: message.html,
    textContent: message.text,
    emailType: 'report',
    attachments: [{ filename: email.attachment.fileName, content: email.attachment.base64, type: 'application/pdf' }],
    // Codes and counts only: the PDF carries the names
    metadata: { kind: 'fund_statement', fundCodes: statement.fundCodes, claimCount: statement.claimCount, owedCents: statement.owedCents, attachmentNames: [email.attachment.fileName] },
    tags: ['claims', 'fund_statement', ...statement.fundCodes]
  });
  if (!response.success) return { ok: false, message: getCommunicationErrorMessage('email', response.error) };
  return { ok: true, message: `The statement (${statement.claimCount} claim(s), ${formatNad(fromCents(statement.owedCents))}) was emailed to ${recipient.label} at ${recipient.email}.` };
}
