import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { PREVISIT_NOT_SET_UP_MESSAGE, loadPrevisitQuestionnaire, savePrevisitQuestionnaire } from '../../services/previsitService';
import {
  EXAMPLE_PREVISIT_QUESTIONS,
  PREVISIT_INTRO_MAX,
  PREVISIT_KINDS,
  PREVISIT_QUESTION_MAX,
  PREVISIT_QUESTIONS_MAX,
  checkPrevisitQuestionnaire,
  newPrevisitQuestionId,
  type PrevisitQuestion,
  type PrevisitQuestionKind
} from '../../utils/clinical/previsitQuestions';
import { ReadOnlyNote, SettingsErrors, SettingsNotEnabled } from '../appointments/diary/DiarySettingsParts';
import { CHECK_CLASS, ICON_BUTTON_CLASS, INPUT_CLASS, LABEL_CLASS, PRIMARY_CLASS, SECONDARY_CLASS } from '../appointments/diary/diarySettingsStyles';

interface PrevisitQuestionsTabProps {
  practiceId: string;
  /** Practice administrators and practitioners change the questions (save_previsit_questionnaire) */
  canChange: boolean;
}

interface QuestionDraft {
  /** null: a new question */
  index: number | null;
  text: string;
  kind: PrevisitQuestionKind;
  required: boolean;
}

/**
 * Diary settings > Questions (parity B17): the practice's own questions before a visit. Patients answer them on the
 * practice's tablet at check-in, or through their booking's link (sent from the booking). No questions: the practice
 * does not ask.
 */
export const PrevisitQuestionsTab: React.FC<PrevisitQuestionsTabProps> = ({ practiceId, canChange }) => {
  const [state, setState] = useState<'loading' | 'ready' | 'not_set_up' | 'error'>('loading');
  const [intro, setIntro] = useState('');
  const [questions, setQuestions] = useState<PrevisitQuestion[]>([]);
  const [draft, setDraft] = useState<QuestionDraft | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadPrevisitQuestionnaire(practiceId).then((load) => {
      if (cancelled) return;
      if (load.state === 'ready') {
        setIntro(load.questionnaire.intro ?? '');
        setQuestions(load.questionnaire.questions);
        setState('ready');
      } else {
        setState(load.state === 'not_set_up' ? 'not_set_up' : 'error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId]);

  if (state === 'loading') return <p className="text-sm text-gray-500" role="status">Loading...</p>;
  if (state === 'not_set_up') return <SettingsNotEnabled message={PREVISIT_NOT_SET_UP_MESSAGE} />;
  if (state === 'error') return <p className="text-sm text-red-600" role="alert">Could not load the questions. Close Diary settings and try again.</p>;

  const changeQuestions = (next: PrevisitQuestion[]) => {
    setQuestions(next);
    setDirty(true);
    setErrors([]);
  };

  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    changeQuestions(next);
  };

  const keepDraft = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const text = draft.text.replace(/\s+/g, ' ').trim();
    if (!text) {
      setErrors(['Write the question.']);
      return;
    }
    if (draft.index === null) {
      changeQuestions([...questions, { id: newPrevisitQuestionId(questions), text, kind: draft.kind, required: draft.required }]);
    } else {
      changeQuestions(questions.map((question, index) => (index === draft.index ? { ...question, text, kind: draft.kind, required: draft.required } : question)));
    }
    setDraft(null);
  };

  const save = async () => {
    const problems = checkPrevisitQuestionnaire({ intro, questions });
    if (problems.length > 0) {
      setErrors(problems);
      return;
    }
    setSaving(true);
    const result = await savePrevisitQuestionnaire(practiceId, intro, questions);
    setSaving(false);
    if (!result.ok) {
      setErrors([result.message]);
      return;
    }
    setErrors([]);
    setDirty(false);
    toast.success(questions.length > 0 ? 'Questions saved' : 'Questions removed: the practice does not ask any');
  };

  return (
    <section className="space-y-4" aria-labelledby="previsit-heading">
      <h3 id="previsit-heading" className="text-sm font-semibold text-gray-900">Questions before the visit</h3>
      <p className="text-sm text-gray-600">
        The practice's own questions. Patients answer them on the practice's tablet when they arrive, or through a link sent
        from their booking. The answers are kept with the booking and shown on the visit.
      </p>
      {!canChange && <ReadOnlyNote>Only a practice administrator or a practitioner can change the questions.</ReadOnlyNote>}

      <div>
        <label htmlFor="previsit-intro" className={LABEL_CLASS}>Welcome line (optional)</label>
        <input
          id="previsit-intro"
          value={intro}
          maxLength={PREVISIT_INTRO_MAX}
          disabled={!canChange}
          onChange={(event) => {
            setIntro(event.target.value);
            setDirty(true);
          }}
          placeholder="Please answer these questions. It takes a minute and helps us prepare."
          className={INPUT_CLASS}
        />
      </div>

      {questions.length === 0 ? (
        <div className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
          <p>No questions yet: the practice does not ask any.</p>
          {canChange && (
            <button
              type="button"
              onClick={() => changeQuestions(EXAMPLE_PREVISIT_QUESTIONS.map((question) => ({ ...question })))}
              className={`${SECONDARY_CLASS} mt-3`}
            >
              <Icon icon="solar:clipboard-list-bold-duotone" className="h-5 w-5" aria-hidden="true" />
              Start from 4 example questions
            </button>
          )}
        </div>
      ) : (
        <ol className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white" aria-label="The practice's questions">
          {questions.map((question, index) => (
            <li key={question.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-6 flex-none text-sm text-gray-500">{index + 1}.</span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-medium text-gray-900">{question.text}</span>
                <span className="block text-xs text-gray-500">
                  {PREVISIT_KINDS.find((kind) => kind.value === question.kind)?.label}
                  {question.required ? ', must be answered' : ', may be skipped'}
                </span>
              </span>
              {canChange && (
                <span className="flex flex-none gap-1">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move question ${index + 1} up`} title="Move up" className={ICON_BUTTON_CLASS}>
                    <Icon icon="solar:alt-arrow-up-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === questions.length - 1}
                    aria-label={`Move question ${index + 1} down`}
                    title="Move down"
                    className={ICON_BUTTON_CLASS}
                  >
                    <Icon icon="solar:alt-arrow-down-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft({ index, text: question.text, kind: question.kind, required: question.required })}
                    aria-label={`Change question ${index + 1}`}
                    title="Change"
                    className={ICON_BUTTON_CLASS}
                  >
                    <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => changeQuestions(questions.filter((_, other) => other !== index))}
                    aria-label={`Remove question ${index + 1}`}
                    title="Remove"
                    className={ICON_BUTTON_CLASS}
                  >
                    <Icon icon="solar:trash-bin-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {canChange && draft && (
        <form onSubmit={keepDraft} noValidate className="space-y-4 rounded-xl border border-purple-200 bg-purple-50/40 p-4">
          <h4 className="text-sm font-semibold text-gray-900">{draft.index === null ? 'New question' : 'Change the question'}</h4>
          <div>
            <label htmlFor="previsit-question" className={LABEL_CLASS}>Question</label>
            <input
              id="previsit-question"
              value={draft.text}
              maxLength={PREVISIT_QUESTION_MAX}
              onChange={(event) => setDraft({ ...draft, text: event.target.value })}
              placeholder="Do you have a fever, cough or sore throat today?"
              className={INPUT_CLASS}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="previsit-kind" className={LABEL_CLASS}>Answered</label>
              <select id="previsit-kind" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as PrevisitQuestionKind })} className={INPUT_CLASS}>
                {PREVISIT_KINDS.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="inline-flex items-center gap-2 self-end pb-2 text-sm text-gray-800">
              <input type="checkbox" checked={draft.required} onChange={(event) => setDraft({ ...draft, required: event.target.checked })} className={CHECK_CLASS} />
              Must be answered
            </label>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setDraft(null)} className={SECONDARY_CLASS}>
              Cancel
            </button>
            <button type="submit" className={PRIMARY_CLASS}>
              <Icon icon="solar:check-circle-bold-duotone" className="h-5 w-5" aria-hidden="true" />
              {draft.index === null ? 'Add the question' : 'Keep the change'}
            </button>
          </div>
        </form>
      )}

      <SettingsErrors errors={errors} />
      {canChange && !draft && (
        <div className="flex flex-wrap justify-between gap-2">
          <button
            type="button"
            onClick={() => setDraft({ index: null, text: '', kind: 'yes_no', required: false })}
            disabled={questions.length >= PREVISIT_QUESTIONS_MAX}
            className={SECONDARY_CLASS}
          >
            <Icon icon="solar:add-circle-bold-duotone" className="h-5 w-5" aria-hidden="true" />
            Add a question
          </button>
          <button type="button" onClick={() => void save()} disabled={saving || !dirty} className={PRIMARY_CLASS}>
            <Icon
              icon={saving ? 'solar:refresh-bold-duotone' : 'solar:check-circle-bold-duotone'}
              className={`h-5 w-5 ${saving ? 'animate-spin motion-reduce:animate-none' : ''}`}
              aria-hidden="true"
            />
            {saving ? 'Saving...' : 'Save the questions'}
          </button>
        </div>
      )}
    </section>
  );
};

export default PrevisitQuestionsTab;
