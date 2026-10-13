import React, { useMemo, useRef, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { patientListService, type PatientListRecord } from '../../services/patientListService';
import { isQuietTime } from '../../utils/patientLists/listAutomation';
import { windhoekClock } from '../../utils/patientLists/listDates';
import type { PracticeDetails } from '../../utils/patientLists/listMessages';
import type { ListMember } from '../../utils/patientLists/listRules';
import { countSkips, planListSend, type SendResult, type SkipReason } from '../../utils/patientLists/listSend';
import { ListSheet } from './ListSheet';
import { skipReasonLabel } from './listDisplay';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from './listStyles';

interface SendNowSheetProps {
  /** Mount the sheet when it opens: the plan is worked out once, for that moment */
  open: boolean;
  onClose: () => void;
  list: PatientListRecord;
  members: readonly ListMember[];
  practice: PracticeDetails;
  /** Called after a send finished (or stopped), so the screen reloads send records */
  onSent: () => void;
}

type Phase = 'review' | 'sending' | 'done';

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Confirm, send and report "Send now" for one list. Every SMS goes through the centralized gateway. */
export const SendNowSheet: React.FC<SendNowSheetProps> = ({ open, onClose, list, members, practice, onSent }) => {
  const [phase, setPhase] = useState<Phase>('review');
  const [progress, setProgress] = useState({ done: 0, total: 0, sent: 0, failed: 0 });
  const [result, setResult] = useState<SendResult | null>(null);
  const [openReason, setOpenReason] = useState<SkipReason | null>(null);
  const stopRef = useRef(false);

  // Worked out when the sheet opens (the parent mounts it on open), from the saved message settings
  // and today's Windhoek date
  const [clock] = useState(() => windhoekClock(new Date()));
  const plan = useMemo(
    () => planListSend({ members, settings: list.automation, practice, todayKey: clock.dateKey }),
    [members, list.automation, practice, clock.dateKey]
  );
  const quiet = isQuietTime(clock.minutes, list.automation.quietStart, list.automation.quietEnd);
  const skipCounts = countSkips(plan.skipped);
  const birthdayMode = list.automation.schedule === 'birthday_morning';

  const close = () => {
    if (phase !== 'sending') onClose();
  };

  const send = async () => {
    stopRef.current = false;
    setPhase('sending');
    setProgress({ done: 0, total: plan.recipients.length, sent: 0, failed: 0 });
    try {
      const outcome = await patientListService.sendNow({
        list,
        plan,
        onProgress: setProgress,
        shouldStop: () => stopRef.current
      });
      setResult(outcome);
      if (outcome.sent > 0) toast.success(`${plural(outcome.sent, 'SMS')} sent from "${list.name}".`);
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'Sending failed.');
      setResult(null);
    } finally {
      setPhase('done');
      onSent();
    }
  };

  const recipientCount = plan.recipients.length;
  const footer =
    phase === 'review' ? (
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={close} className={SECONDARY_BUTTON}>
          Cancel
        </button>
        <span title={quiet ? 'Quiet hours: messages cannot be sent now.' : undefined}>
          <button
            type="button"
            onClick={() => void send()}
            disabled={recipientCount === 0 || quiet}
            className={`${PRIMARY_BUTTON} w-full sm:w-auto`}
          >
            <Icon icon="solar:plain-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            {recipientCount === 0 ? 'Nobody to send to' : `Send ${plural(recipientCount, 'SMS')}`}
          </button>
        </span>
      </div>
    ) : phase === 'sending' ? (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            stopRef.current = true;
          }}
          className={SECONDARY_BUTTON}
        >
          <Icon icon="solar:pause-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Stop sending
        </button>
      </div>
    ) : (
      <div className="flex justify-end">
        <button type="button" onClick={close} className={PRIMARY_BUTTON}>
          Done
        </button>
      </div>
    );

  return (
    <ListSheet
      open={open}
      onClose={close}
      dismissible={phase !== 'sending'}
      title={phase === 'done' ? 'Sending finished' : `Send "${list.name}" now`}
      subtitle={phase === 'review' ? 'Check who gets the message before it goes out.' : undefined}
      footer={footer}
    >
      {phase === 'review' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 p-4 ring-1 ring-purple-100">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
              <Icon icon="solar:chat-round-dots-bold-duotone" className="h-6 w-6 text-purple-600" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-semibold tabular-nums text-gray-900">{recipientCount}</p>
              <p className="text-sm text-gray-600">
                {recipientCount === 1 ? 'patient gets this SMS' : 'patients get this SMS'}
                {plan.totalParts > recipientCount && ` · ${plural(plan.totalParts, 'SMS credit')} (long message)`}
              </p>
            </div>
          </div>

          {quiet && (
            <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-100">
              <Icon icon="solar:moon-sleep-bold-duotone" className="h-5 w-5 shrink-0" aria-hidden="true" />
              <p>
                It is quiet hours in Windhoek ({list.automation.quietStart} to {list.automation.quietEnd}), so messages
                cannot be sent now. Try again after {list.automation.quietEnd}, or change the quiet hours.
              </p>
            </div>
          )}

          {birthdayMode && (
            <p className="flex gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-100">
              <Icon icon="solar:gift-bold-duotone" className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>
                Birthday greetings go out on the birthday itself, so only today&apos;s birthdays are included.
                {plan.notDueToday > 0 && ` ${plural(plan.notDueToday, 'other patient')} on this list will get it on their day.`}
              </span>
            </p>
          )}

          {plan.recipients[0] && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                Message for {plan.recipients[0].name}
              </p>
              <p className="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3 text-sm text-gray-800">
                {plan.recipients[0].text}
              </p>
            </div>
          )}

          {skipCounts.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-gray-900">
                {plural(plan.skipped.length, 'patient')} will not get it
              </p>
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                {skipCounts.map(({ reason, count }) => (
                  <li key={reason}>
                    <button
                      type="button"
                      onClick={() => setOpenReason(openReason === reason ? null : reason)}
                      aria-expanded={openReason === reason}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                    >
                      <span className="text-gray-700">{skipReasonLabel(reason, list.automation.repeat)}</span>
                      <span className="flex items-center gap-1 tabular-nums text-gray-500">
                        {count}
                        <Icon
                          icon="solar:alt-arrow-down-bold-duotone"
                          className={`h-4 w-4 transition-transform ${openReason === reason ? 'rotate-180' : ''}`}
                          aria-hidden="true"
                        />
                      </span>
                    </button>
                    {openReason === reason && (
                      <ul className="space-y-1 px-3 pb-3 text-sm text-gray-600">
                        {plan.skipped
                          .filter((skipped) => skipped.reason === reason)
                          .map((skipped) => (
                            <li key={skipped.patientId}>
                              {skipped.name}
                              {skipped.detail && <span className="text-gray-400"> · {skipped.detail}</span>}
                            </li>
                          ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-gray-500">
            Sent through the practice&apos;s SMS bundle and logged with your other messages. Nobody gets this list&apos;s
            message twice {list.automation.repeat === 'ever' ? 'ever' : `in the same ${list.automation.repeat}`}.
          </p>
        </div>
      )}

      {phase === 'sending' && (
        <div className="py-6 text-center" role="status" aria-live="polite">
          <Icon icon="solar:plain-bold-duotone" className="mx-auto mb-3 h-10 w-10 animate-pulse text-purple-500" aria-hidden="true" />
          <p className="text-sm font-medium text-gray-900">
            Sending {progress.done} of {progress.total}…
          </p>
          <div className="mx-auto mt-3 h-2 max-w-xs overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all"
              style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-gray-500">Keep this window open until sending finishes.</p>
        </div>
      )}

      {phase === 'done' && (
        <div className="space-y-3" role="status" aria-live="polite">
          {result ? (
            <>
              <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                <Icon icon="solar:check-circle-bold-duotone" className="h-8 w-8 shrink-0 text-emerald-500" aria-hidden="true" />
                <p className="text-sm text-emerald-900">
                  <span className="font-semibold">{plural(result.sent, 'SMS')} sent.</span>
                  {result.alreadyClaimed > 0 &&
                    ` ${plural(result.alreadyClaimed, 'patient')} had just been messaged by another send and were left out.`}
                </p>
              </div>
              {result.stopped && (
                <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-100">
                  <Icon icon="solar:danger-triangle-bold-duotone" className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <p>
                    {result.stopped === 'cancelled' ? 'Sending was stopped.' : result.stopReason}{' '}
                    {result.notAttempted > 0 &&
                      `${plural(result.notAttempted, 'patient')} did not get the message and can be sent to later.`}
                  </p>
                </div>
              )}
              {result.optedOut.length > 0 && (
                <p className="flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                  <Icon icon="solar:bell-off-bold-duotone" className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                  <span>
                    {plural(result.optedOut.length, 'patient')} not sent: their number replied STOP to reminders and
                    greetings ({result.optedOut.map((patient) => patient.name).join(', ')}).
                  </span>
                </p>
              )}
              {result.failed.length > 0 && (
                <div>
                  <p className="mb-1.5 text-sm font-medium text-gray-900">
                    {plural(result.failed.length, 'message')} could not be sent (they can be sent again later)
                  </p>
                  <ul className="space-y-1 rounded-xl border border-gray-200 p-3 text-sm text-gray-600">
                    {result.failed.map((failure) => (
                      <li key={failure.patientId}>
                        {failure.name} <span className="text-gray-400">· {failure.error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.unreleased > 0 && (
                <p className="text-xs text-gray-500">
                  {plural(result.unreleased, 'failed message')} could not be marked for a retry and will wait until the
                  next period.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-600">Nothing was sent. Please try again.</p>
          )}
        </div>
      )}
    </ListSheet>
  );
};

export default SendNowSheet;
