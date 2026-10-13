import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { answerByLink, loadByLink, type LinkPageState } from '../services/previsitService';
import { cleanPrevisitAnswers, previsitCodeFromLocation } from '../utils/clinical/previsitQuestions';
import { PrevisitQuestionFields } from '../components/previsit/PrevisitQuestionFields';

type PageState = LinkPageState | { status: 'loading' };

const NOTICES: Record<'saved' | 'answered' | 'expired' | 'not_found', { icon: string; tone: string; title: string; text: string }> = {
  saved: {
    icon: 'solar:check-circle-bold-duotone',
    tone: 'text-emerald-600',
    title: 'Thank you',
    text: 'Your answers are with the practice. You can close this page.'
  },
  answered: {
    icon: 'solar:check-circle-bold-duotone',
    tone: 'text-emerald-600',
    title: 'Already answered',
    text: 'The practice already has your answers for this visit. You can close this page.'
  },
  expired: {
    icon: 'solar:clock-circle-bold-duotone',
    tone: 'text-amber-600',
    title: 'This link has expired',
    text: 'The practice can send you a new link, or you can answer the questions when you arrive.'
  },
  not_found: {
    icon: 'solar:danger-triangle-bold-duotone',
    tone: 'text-amber-600',
    title: 'This link does not work',
    text: 'Check that the whole link from the SMS was opened, or call the practice.'
  }
};

/**
 * The patient's pre-visit questions (parity B17), at #/q/<code>, opened from an SMS without signing in. The page talks
 * to the database through one function only (previsit_questionnaire): with a valid code it gets the practice's name and
 * questions, nothing about the patient or the booking, and it can hand in answers once.
 */
const PrevisitQuestionnairePage: React.FC = () => {
  const code = previsitCodeFromLocation(window.location);
  const [state, setState] = useState<PageState>(code ? { status: 'loading' } : { status: 'not_found' });
  const [answers, setAnswers] = useState<Record<string, boolean | string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    document.title = 'Before your visit';
    if (!code) return;
    let cancelled = false;
    void loadByLink(code).then((loaded) => {
      if (!cancelled) setState(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code || state.status !== 'open' || sending) return;
    const checked = cleanPrevisitAnswers(state.questions, answers);
    if (!checked.ok) {
      setProblem(checked.error);
      return;
    }
    setProblem(null);
    setSending(true);
    const result = await answerByLink(code, checked.answers);
    setSending(false);
    if (result.status === 'invalid' || result.status === 'error') {
      setProblem(result.message);
      return;
    }
    setState(result);
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-xl">
        {state.status === 'loading' && (
          <p className="text-center text-sm text-gray-500" role="status">
            Loading the questions...
          </p>
        )}

        {state.status === 'error' && (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm" role="alert">
            <Icon icon="solar:wi-fi-router-minimalistic-bold-duotone" className="mx-auto mb-3 h-10 w-10 text-amber-600" aria-hidden="true" />
            <p className="text-gray-700">{state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
            >
              Try again
            </button>
          </div>
        )}

        {(state.status === 'saved' || state.status === 'answered' || state.status === 'expired' || state.status === 'not_found') && (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm" role="status">
            <Icon icon={NOTICES[state.status].icon} className={`mx-auto mb-3 h-12 w-12 ${NOTICES[state.status].tone}`} aria-hidden="true" />
            <h1 className="text-xl font-semibold text-gray-900">{NOTICES[state.status].title}</h1>
            <p className="mt-2 text-gray-600">{NOTICES[state.status].text}</p>
          </div>
        )}

        {state.status === 'open' && (
          <form onSubmit={(event) => void submit(event)} noValidate className="space-y-5">
            <header className="space-y-1">
              {state.practiceName && <p className="text-sm font-medium text-purple-700">{state.practiceName}</p>}
              <h1 className="text-2xl font-bold text-gray-900">Before your visit</h1>
              <p className="text-gray-600">{state.intro || 'Please answer these questions. It takes a minute and helps the practice prepare.'}</p>
            </header>
            <PrevisitQuestionFields
              questions={state.questions}
              answers={answers}
              idPrefix="previsit-link"
              disabled={sending}
              onChange={(id, value) =>
                setAnswers((current) => {
                  const next = { ...current };
                  if (value === undefined) delete next[id];
                  else next[id] = value;
                  return next;
                })
              }
            />
            {problem && (
              <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                <span>{problem}</span>
              </p>
            )}
            <button
              type="submit"
              disabled={sending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
            >
              <Icon
                icon={sending ? 'solar:refresh-bold-duotone' : 'solar:check-circle-bold-duotone'}
                className={`h-5 w-5 ${sending ? 'animate-spin motion-reduce:animate-none' : ''}`}
                aria-hidden="true"
              />
              {sending ? 'Sending...' : 'Send my answers'}
            </button>
            <p className="text-center text-xs text-gray-500">Your answers go only to the practice and can be sent once.</p>
          </form>
        )}
      </div>
    </main>
  );
};

export default PrevisitQuestionnairePage;
