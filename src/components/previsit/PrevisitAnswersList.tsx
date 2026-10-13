import React from 'react';
import type { PrevisitAnswerRecord } from '../../services/previsitService';
import { previsitAnswerRows } from '../../utils/clinical/previsitQuestions';
import { formatDiaryTimestamp } from '../../utils/diary/diaryTime';

/** "Answered on the practice tablet, 13 Oct 2026, 08:12" */
export const describePrevisitAnswered = (record: Pick<PrevisitAnswerRecord, 'via' | 'answeredAt'>): string =>
  `Answered ${record.via === 'tablet' ? 'on the practice tablet' : 'through the link'}${
    formatDiaryTimestamp(record.answeredAt) ? `, ${formatDiaryTimestamp(record.answeredAt)}` : ''
  }`;

/** The questions as they were asked, with the patient's answers (parity B17) */
export const PrevisitAnswersList: React.FC<{ record: PrevisitAnswerRecord }> = ({ record }) => (
  <dl className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
    {previsitAnswerRows(record.questions, record.answers).map((row) => (
      <div key={row.id} className="px-3 py-2">
        <dt className="break-words text-xs text-gray-500">{row.question}</dt>
        <dd className={`break-words text-sm ${row.answered ? 'font-medium text-gray-900' : 'text-gray-400'}`}>{row.answer}</dd>
      </div>
    ))}
  </dl>
);

export default PrevisitAnswersList;
