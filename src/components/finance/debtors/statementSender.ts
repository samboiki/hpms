import { communicationService } from '../../../services/communicationService';
import { plainWords } from '../../../utils/plainErrors';
import type { PlannedStatement } from '../../../services/ledgerService';

/**
 * Sends planned statements one at a time through the practice's communication gateways
 * (communicationService: logged, counted against the bundle, opt-outs respected). A statement run
 * is a bulk send, so the SMS gateway treats it as one: a patient who replied STOP gets no SMS from
 * it (their statement goes by email or print instead). Nothing here sends by itself: the screen
 * calls it after staff confirm.
 */

export interface StatementMessage {
  planned: PlannedStatement;
  /** The statement in the body, and as a plain PDF attachment (no password: owner, 13 Oct 2026) */
  email?: { subject: string; html: string; text: string; attachment?: { fileName: string; base64: string } };
  sms?: string;
}

export interface SendOutcome {
  patientId: string;
  channel: PlannedStatement['channel'];
  ok: boolean;
  error: string | null;
}

export interface SendContext {
  practiceId: string;
  /** The statement run (statement_runs.id), kept in each message's log */
  runId: string | null;
  /** True for a run of many accounts */
  bulk: boolean;
}

export async function sendStatementMessage(message: StatementMessage, context: SendContext): Promise<SendOutcome> {
  const { planned } = message;
  const metadata = { kind: 'statement', statementRunId: context.runId, bulkSend: context.bulk };
  try {
    if (planned.channel === 'email') {
      if (!planned.to || !message.email) throw new Error('No email address');
      const result = await communicationService.sendEmail({
        practiceId: context.practiceId,
        recipientEmail: planned.to,
        recipientName: planned.name,
        subject: message.email.subject,
        htmlContent: message.email.html,
        textContent: message.email.text,
        ...(message.email.attachment ? { attachments: [{ filename: message.email.attachment.fileName, content: message.email.attachment.base64, type: 'application/pdf' }] } : {}),
        emailType: 'invoice',
        patientId: planned.patientId,
        metadata
      });
      if (!result.success) throw new Error(result.error || 'The email was not sent');
    } else if (planned.channel === 'sms') {
      if (!planned.to || !message.sms) throw new Error('No cell number');
      const result = await communicationService.sendSMS({
        practiceId: context.practiceId,
        recipientPhone: planned.to,
        messageContent: message.sms,
        messageType: 'system',
        patientId: planned.patientId,
        metadata
      });
      if (!result.success) throw new Error(result.error || 'The SMS was not sent');
    }
    return { patientId: planned.patientId, channel: planned.channel, ok: true, error: null };
  } catch (error) {
    return { patientId: planned.patientId, channel: planned.channel, ok: false, error: error instanceof Error ? plainWords(error.message) : 'Not sent' };
  }
}

export interface RunTotals {
  emailed: number;
  sms: number;
  printed: number;
  failed: number;
  failures: Array<{ patient_id: string; channel: string; error: string }>;
}

/** Sends the messages one by one (never in parallel: gateways and bundles count each one) */
export async function sendStatementRun(messages: readonly StatementMessage[], context: SendContext, onProgress?: (done: number, total: number) => void): Promise<RunTotals> {
  const totals: RunTotals = { emailed: 0, sms: 0, printed: 0, failed: 0, failures: [] };
  let done = 0;
  for (const message of messages) {
    if (message.planned.channel === 'print') {
      totals.printed += 1;
    } else {
      const outcome = await sendStatementMessage(message, context);
      if (outcome.ok) {
        if (outcome.channel === 'email') totals.emailed += 1;
        else totals.sms += 1;
      } else {
        totals.failed += 1;
        totals.failures.push({ patient_id: outcome.patientId, channel: outcome.channel, error: outcome.error ?? 'Not sent' });
      }
    }
    done += 1;
    onProgress?.(done, messages.length);
  }
  return totals;
}
