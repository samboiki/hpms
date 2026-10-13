import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { currentPracticeId } from '../../services/recordFiles';
import { normalizePhoneNumber } from '../patients/patientContact';
import {
  createPrevisitLink,
  loadBookingPrevisit,
  loadPrevisitQuestionnaire,
  type PrevisitAnswerRecord,
  type PrevisitLinkRecord
} from '../../services/previsitService';
import { previsitLink, previsitSmsText } from '../../utils/clinical/previsitQuestions';
import { formatDiaryTimestamp } from '../../utils/diary/diaryTime';
import { describeSlotWhen } from '../../utils/diary/waitingList';
import { supabase } from '../../lib/supabase';
import { PrevisitAnswersList, describePrevisitAnswered } from './PrevisitAnswersList';
import { PrevisitLinkDialog } from './PrevisitLinkDialog';
import { PrevisitTabletScreen } from './PrevisitTabletScreen';

interface PrevisitBookingPanelProps {
  /** The booking as the diary holds it */
  visit: {
    id: string;
    patient_id?: string | null;
    patient?: { id?: string; first_name?: string | null; last_name?: string | null; cell_number?: string | null } | null;
    date?: string | null;
    time?: string | null;
  };
  /** Questions can still be asked: the booking is not cancelled, missed or seen yet */
  canAsk: boolean;
}

const CHIP_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500';

type PanelState =
  | { status: 'loading' }
  | { status: 'hidden' }
  | { status: 'ready'; hasQuestions: boolean; answers: PrevisitAnswerRecord | null; link: PrevisitLinkRecord | null };

/**
 * "Questions before the visit" in a booking's window (parity B17): whether the patient answered and how, the answers
 * one tap away, and, while the booking is still to come, the practice tablet, an SMS with the booking's link or the
 * link to copy. Hidden until the practice has questions (Diary settings > Questions) or before the database update.
 */
export const PrevisitBookingPanel: React.FC<PrevisitBookingPanelProps> = ({ visit, canAsk }) => {
  const practiceId = currentPracticeId();
  const patientId = visit.patient_id ?? visit.patient?.id ?? null;
  const patientName = [visit.patient?.first_name, visit.patient?.last_name].filter(Boolean).join(' ') || 'the patient';
  const [state, setState] = useState<PanelState>({ status: 'loading' });
  const [showAnswers, setShowAnswers] = useState(false);
  const [tabletOpen, setTabletOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [smsRequest, setSmsRequest] = useState<React.ComponentProps<typeof PrevisitLinkDialog>['request']>(null);

  const reload = useCallback(async () => {
    if (!practiceId) {
      setState({ status: 'hidden' });
      return;
    }
    const [questionnaire, booking] = await Promise.all([loadPrevisitQuestionnaire(practiceId), loadBookingPrevisit(visit.id)]);
    if (questionnaire.state !== 'ready' || booking.state !== 'ready') {
      setState({ status: 'hidden' });
      return;
    }
    const hasQuestions = questionnaire.questionnaire.questions.length > 0;
    if (!hasQuestions && !booking.answers) {
      setState({ status: 'hidden' });
      return;
    }
    setState({ status: 'ready', hasQuestions, answers: booking.answers, link: booking.link });
  }, [practiceId, visit.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (state.status !== 'ready' || !patientId || !practiceId) return null;

  const when = visit.date ? describeSlotWhen(visit.date.slice(0, 10), (visit.time ?? '').slice(0, 5)) : null;
  const openLink = state.link && !state.link.usedAt && Date.parse(state.link.expiresAt) > Date.now() ? state.link : null;

  // A new link for the booking (an earlier open one stops working), made only when it is sent or copied
  const makeLink = async (): Promise<string | null> => {
    setBusy(true);
    const created = await createPrevisitLink(visit.id);
    setBusy(false);
    if (!created.ok) {
      toast.error(created.message);
      return null;
    }
    return previsitLink(window.location.origin, created.code);
  };

  // The confirmation shows the SMS first; its link is made only when reception presses Send SMS
  const sendBySms = async () => {
    setBusy(true);
    const { data } = await supabase.from('practices').select('name').eq('id', practiceId).maybeSingle();
    setBusy(false);
    const practiceName = (data as { name?: string | null } | null)?.name ?? null;
    setSmsRequest({
      practiceId,
      patientId,
      patientName,
      visitId: visit.id,
      phone: normalizePhoneNumber(visit.patient?.cell_number ?? null),
      messageFor: (link) => previsitSmsText({ practiceName, firstName: visit.patient?.first_name ?? null, when, link })
    });
  };

  const copyLink = async () => {
    const link = await makeLink();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copied. It works once, until the end of the booking\'s day.');
    } catch {
      window.prompt('Copy the link for the patient:', link);
    }
    void reload();
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <Icon icon="solar:clipboard-list-bold-duotone" className="mt-0.5 h-6 w-6 flex-none text-purple-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">Questions before the visit</p>
          {state.answers ? (
            <p className="text-sm text-gray-600">{describePrevisitAnswered(state.answers)}.</p>
          ) : (
            <p className="text-sm text-gray-600">
              Not answered yet.
              {openLink
                ? ` A link was made ${formatDiaryTimestamp(openLink.createdAt) ?? ''}; it works until ${formatDiaryTimestamp(openLink.expiresAt) ?? ''}.`
                : ''}
            </p>
          )}
        </div>
      </div>

      {state.answers && (
        <>
          <button type="button" onClick={() => setShowAnswers((shown) => !shown)} aria-expanded={showAnswers} className={`${CHIP_CLASS} mt-3`}>
            <Icon icon="solar:document-text-bold-duotone" className="h-4 w-4 text-purple-500" aria-hidden="true" />
            {showAnswers ? 'Hide the answers' : 'See the answers'}
          </button>
          {showAnswers && (
            <div className="mt-3">
              <PrevisitAnswersList record={state.answers} />
            </div>
          )}
        </>
      )}

      {!state.answers && canAsk && state.hasQuestions && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setTabletOpen(true)} disabled={busy} className={CHIP_CLASS}>
            <Icon icon="solar:tablet-bold-duotone" className="h-4 w-4 text-purple-500" aria-hidden="true" />
            Answer on this tablet
          </button>
          <span title={normalizePhoneNumber(visit.patient?.cell_number ?? null) ? undefined : 'No cell number on file that can receive an SMS'}>
            <button
              type="button"
              onClick={() => void sendBySms()}
              disabled={busy || !normalizePhoneNumber(visit.patient?.cell_number ?? null)}
              className={CHIP_CLASS}
            >
              <Icon icon="solar:chat-round-dots-bold-duotone" className="h-4 w-4 text-purple-500" aria-hidden="true" />
              Send the link by SMS
            </button>
          </span>
          <button type="button" onClick={() => void copyLink()} disabled={busy} className={CHIP_CLASS}>
            <Icon icon="solar:link-round-bold-duotone" className="h-4 w-4 text-purple-500" aria-hidden="true" />
            Copy the link
          </button>
        </div>
      )}

      {tabletOpen && (
        <PrevisitTabletScreen
          practiceId={practiceId}
          visitId={visit.id}
          patientFirstName={visit.patient?.first_name ?? null}
          onClose={() => setTabletOpen(false)}
          onAnswered={() => void reload()}
        />
      )}
      <PrevisitLinkDialog
        request={smsRequest}
        onClose={() => setSmsRequest(null)}
        onSent={() => {
          setSmsRequest(null);
          void reload();
        }}
      />
    </div>
  );
};

export default PrevisitBookingPanel;
