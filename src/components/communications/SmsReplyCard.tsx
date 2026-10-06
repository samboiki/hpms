import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { cn } from '../../utils/cn';
import {
  describeMessageType,
  formatReceivedAt,
  formatSmsSender,
  SMS_REPLY_INTENT_LABELS,
  smsParts,
  type SmsReply,
  type SmsReplyBadgeTone,
} from './smsRepliesService';

const TONE_CLASSES: Record<SmsReplyBadgeTone, string> = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200',
  purple: 'bg-violet-50 text-violet-800 ring-violet-200',
  gray: 'bg-gray-100 text-gray-700 ring-gray-200',
};

const BUTTON =
  'inline-flex min-h-[2.5rem] items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
const SECONDARY = `${BUTTON} border-gray-200 bg-white text-gray-700 hover:bg-gray-50`;
const PRIMARY = `${BUTTON} border-cyan-600 bg-cyan-600 text-white hover:bg-cyan-700`;

// Longest staff answer: 3 SMS parts
const MAX_ANSWER_LENGTH = 459;

interface SmsReplyCardProps {
  reply: SmsReply;
  /** Another action on this reply is running */
  busy: boolean;
  onSetHandled: (reply: SmsReply, handled: boolean) => void;
  /** Sends the answer; resolves true when it was sent */
  onSendAnswer: (reply: SmsReply, answer: string) => Promise<boolean>;
}

export function SmsReplyCard({ reply, busy, onSetHandled, onSendAnswer }: SmsReplyCardProps) {
  const [answerOpen, setAnswerOpen] = useState(false);
  const [answer, setAnswer] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const baseId = useId();

  useEffect(() => {
    if (answerOpen) textareaRef.current?.focus();
  }, [answerOpen]);

  const badge = SMS_REPLY_INTENT_LABELS[reply.intent];
  const badgeText = reply.intent === 'rating' && reply.rating ? `Rated ${reply.rating}/5` : badge.label;
  const sender = formatSmsSender(reply.sourcePhone);
  const who = reply.patientName ?? sender;
  const originalType = describeMessageType(reply.originalMessageType);
  const parts = smsParts(answer);

  const closeAnswer = () => {
    setAnswerOpen(false);
    setAnswer('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!answer.trim() || sending) return;
    setSending(true);
    const sent = await onSendAnswer(reply, answer);
    setSending(false);
    if (sent) closeAnswer();
  };

  const onAnswerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape' && !sending) closeAnswer();
  };

  return (
    <article aria-labelledby={`${baseId}-who`} className="p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 id={`${baseId}-who`} className="min-w-0 break-words font-semibold text-gray-900">
          {who}
        </h3>
        {reply.patientName && <span className="text-xs text-gray-500">{sender}</span>}
        <time dateTime={reply.receivedAt} className="ml-auto text-xs text-gray-500">
          {formatReceivedAt(reply.receivedAt)}
        </time>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1', TONE_CLASSES[badge.tone])}>
          <Icon icon={badge.icon} className="h-3.5 w-3.5" aria-hidden="true" />
          {badgeText}
        </span>
        {reply.status === 'new' ? (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">Needs reply</span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
            {reply.handledAutomatically ? 'Handled automatically' : `Handled${reply.handledByName ? ` by ${reply.handledByName}` : ''}`}
          </span>
        )}
      </div>

      <p className="mt-3 whitespace-pre-wrap break-words rounded-xl rounded-tl-sm bg-cyan-50 px-3 py-2 text-sm text-gray-900">
        {reply.message || <span className="italic text-gray-500">(empty message)</span>}
      </p>

      {reply.originalMessage && (
        <p className="mt-2 break-words text-xs text-gray-600">
          <span className="font-medium text-gray-700">In reply to{originalType ? ` (${originalType})` : ''}:</span> {reply.originalMessage}
        </p>
      )}

      {reply.actionTaken && (
        <p className="mt-2 flex gap-1.5 text-sm text-gray-700">
          <Icon icon="solar:magic-stick-3-bold-duotone" className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" aria-hidden="true" />
          <span className="break-words">
            <span className="font-medium">System note:</span> {reply.actionTaken}
          </span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {reply.patientId && (
          <Link to={`/patients?patientId=${encodeURIComponent(reply.patientId)}`} className={SECONDARY}>
            <Icon icon="solar:user-id-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Open patient
          </Link>
        )}
        <button
          type="button"
          className={SECONDARY}
          aria-expanded={answerOpen}
          aria-controls={`${baseId}-answer`}
          onClick={() => (answerOpen ? closeAnswer() : setAnswerOpen(true))}
        >
          <Icon icon="solar:plain-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Reply
        </button>
        {reply.status === 'new' ? (
          <button type="button" className={SECONDARY} disabled={busy} onClick={() => onSetHandled(reply, true)}>
            <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            Mark handled
          </button>
        ) : (
          <button type="button" className={SECONDARY} disabled={busy} onClick={() => onSetHandled(reply, false)}>
            <Icon icon="solar:undo-left-round-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Move to Needs reply
          </button>
        )}
      </div>

      {answerOpen && (
        <form id={`${baseId}-answer`} onSubmit={submit} className="mt-3 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <label htmlFor={`${baseId}-text`} className="block text-sm font-medium text-gray-800">
            Reply to {who} by SMS
          </label>
          <textarea
            id={`${baseId}-text`}
            ref={textareaRef}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            onKeyDown={onAnswerKeyDown}
            maxLength={MAX_ANSWER_LENGTH}
            rows={3}
            aria-describedby={`${baseId}-hint`}
            className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
          />
          <p id={`${baseId}-hint`} className="text-xs text-gray-600">
            Goes to {sender} from the practice SMS bundle. {answer.length} characters
            {parts > 0 ? `, ${parts} SMS` : ''}.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={SECONDARY} disabled={sending} onClick={closeAnswer}>
              Cancel
            </button>
            <button type="submit" className={PRIMARY} disabled={sending || !answer.trim()}>
              <Icon icon={sending ? 'solar:spinner-bold-duotone' : 'solar:plain-bold-duotone'} className={cn('h-4 w-4', sending && 'animate-spin')} aria-hidden="true" />
              {sending ? 'Sending...' : 'Send SMS'}
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
