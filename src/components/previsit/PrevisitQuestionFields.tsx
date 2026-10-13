import React from 'react';
import { PREVISIT_ANSWER_MAX, type PrevisitQuestion } from '../../utils/clinical/previsitQuestions';

interface PrevisitQuestionFieldsProps {
  questions: readonly PrevisitQuestion[];
  answers: Record<string, boolean | string>;
  onChange: (questionId: string, value: boolean | string | undefined) => void;
  /** Keeps the ids unique when two forms are on one page */
  idPrefix: string;
  disabled?: boolean;
}

/**
 * The practice's questions as a patient answers them (parity B17), on the practice's tablet or their own phone: big
 * Yes / No buttons and a box for words, each question labelled for screen readers, "needed" said in words.
 */
export const PrevisitQuestionFields: React.FC<PrevisitQuestionFieldsProps> = ({ questions, answers, onChange, idPrefix, disabled = false }) => (
  <ol className="space-y-4">
    {questions.map((question, index) => {
      const labelId = `${idPrefix}-${question.id}-label`;
      const answer = answers[question.id];
      return (
        <li key={question.id} className="rounded-xl border border-gray-200 bg-white p-4">
          <p id={labelId} className="text-base font-medium text-gray-900">
            <span className="mr-1 text-gray-500">{index + 1}.</span>
            {question.text}
            {question.required && <span className="ml-2 text-xs font-semibold text-purple-700">(needed)</span>}
          </p>
          {question.kind === 'yes_no' ? (
            <div role="group" aria-labelledby={labelId} className="mt-3 grid grid-cols-2 gap-3">
              {[
                { value: true, label: 'Yes' },
                { value: false, label: 'No' }
              ].map((option) => {
                const pressed = answer === option.value;
                return (
                  <button
                    key={option.label}
                    type="button"
                    disabled={disabled}
                    aria-pressed={pressed}
                    onClick={() => onChange(question.id, pressed ? undefined : option.value)}
                    className={`min-h-[48px] rounded-xl px-4 py-3 text-base font-semibold ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-60 ${
                      pressed ? 'bg-purple-600 text-white ring-purple-600' : 'bg-white text-gray-800 ring-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <textarea
              aria-labelledby={labelId}
              rows={3}
              maxLength={PREVISIT_ANSWER_MAX}
              disabled={disabled}
              value={typeof answer === 'string' ? answer : ''}
              onChange={(event) => onChange(question.id, event.target.value === '' ? undefined : event.target.value)}
              className="mt-3 w-full resize-y rounded-xl border-0 bg-gray-100 px-4 py-3 text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
            />
          )}
        </li>
      );
    })}
  </ol>
);

export default PrevisitQuestionFields;
