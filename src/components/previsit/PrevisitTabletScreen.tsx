import React, { useEffect, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { loadPrevisitQuestionnaire, savePrevisitAnswersOnTablet, type PrevisitQuestionnaire } from '../../services/previsitService';
import { cleanPrevisitAnswers } from '../../utils/clinical/previsitQuestions';
import { PrevisitQuestionFields } from './PrevisitQuestionFields';

interface PrevisitTabletScreenProps {
  practiceId: string;
  visitId: string;
  /** "Maria", greeted on the screen */
  patientFirstName: string | null;
  onClose: () => void;
  /** After the answers were kept */
  onAnswered: () => void;
}

// Above the booking window and the diary
const SCREEN_Z_INDEX = 2147483647;

/**
 * The practice's questions on the practice's tablet at check-in (parity B17): reception hands the tablet over, the
 * patient answers and hands it back. Nothing of the practice's own screens shows while the patient holds it; the
 * answers are kept once (save_previsit_answers) and the booking's open link stops working.
 */
export const PrevisitTabletScreen: React.FC<PrevisitTabletScreenProps> = ({ practiceId, visitId, patientFirstName, onClose, onAnswered }) => {
  const [questionnaire, setQuestionnaire] = useState<PrevisitQuestionnaire | null>(null);
  const [loadProblem, setLoadProblem] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, boolean | string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadPrevisitQuestionnaire(practiceId).then((load) => {
      if (cancelled) return;
      if (load.state === 'ready') setQuestionnaire(load.questionnaire);
      else setLoadProblem(load.state === 'not_set_up' ? 'Questions before the visit are not set up yet.' : load.message);
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId]);

  // Escape must not close the screen under the patient's hands (reception closes it with the button)
  useEffect(() => {
    const swallow = (event: KeyboardEvent) => {
      if (event.key === 'Escape') event.stopPropagation();
    };
    document.addEventListener('keydown', swallow, true);
    return () => document.removeEventListener('keydown', swallow, true);
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!questionnaire || saving) return;
    const checked = cleanPrevisitAnswers(questionnaire.questions, answers);
    if (!checked.ok) {
      setProblem(checked.error);
      return;
    }
    setProblem(null);
    setSaving(true);
    const result = await savePrevisitAnswersOnTablet(visitId, checked.answers);
    setSaving(false);
    if (!result.ok) {
      setProblem(plainWords(result.message));
      return;
    }
    setDone(true);
    onAnswered();
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="previsit-tablet-title" className="fixed inset-0 overflow-y-auto bg-gray-50" style={{ zIndex: SCREEN_Z_INDEX }}>
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
        {done ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm" role="status">
            <Icon icon="solar:check-circle-bold-duotone" className="mx-auto mb-3 h-14 w-14 text-emerald-600" aria-hidden="true" />
            <h1 id="previsit-tablet-title" className="text-2xl font-semibold text-gray-900">Thank you</h1>
            <p className="mt-2 text-lg text-gray-600">Please hand the tablet back to reception.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              Reception: back to OneHealth
            </button>
          </div>
        ) : (
          <form onSubmit={(event) => void submit(event)} noValidate className="space-y-5">
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 id="previsit-tablet-title" className="text-2xl font-bold text-gray-900">
                  {patientFirstName ? `Welcome, ${patientFirstName}` : 'Before your visit'}
                </h1>
                <p className="mt-1 text-gray-600">
                  {questionnaire?.intro || 'Please answer these questions. It takes a minute and helps us prepare for your visit.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                Reception: close
              </button>
            </header>
            {!questionnaire && !loadProblem && (
              <p className="text-sm text-gray-500" role="status">
                Loading the questions...
              </p>
            )}
            {loadProblem && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {loadProblem}
              </p>
            )}
            {questionnaire && questionnaire.questions.length === 0 && (
              <p className="rounded-lg bg-gray-100 p-3 text-sm text-gray-700">The practice has no questions yet.</p>
            )}
            {questionnaire && questionnaire.questions.length > 0 && (
              <>
                <PrevisitQuestionFields
                  questions={questionnaire.questions}
                  answers={answers}
                  idPrefix="previsit-tablet"
                  disabled={saving}
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
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
                >
                  <Icon
                    icon={saving ? 'solar:refresh-bold-duotone' : 'solar:check-circle-bold-duotone'}
                    className={`h-5 w-5 ${saving ? 'animate-spin motion-reduce:animate-none' : ''}`}
                    aria-hidden="true"
                  />
                  {saving ? 'Saving...' : 'Done'}
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>,
    document.body
  );
};

export default PrevisitTabletScreen;
