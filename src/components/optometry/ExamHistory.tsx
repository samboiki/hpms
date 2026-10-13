import React from 'react';
import { LINK } from '../stock/stockUi';
import { formatServiceDate } from '../../utils/billing/dates';
import { IOP_METHOD_LABELS, type ExamRecord, type PrescriptionRecord } from '../../utils/optometry/records';
import { CL_LENS_TYPE_LABELS, historySummary, keratometrySummary, partSummary, type EyePart } from '../../utils/optometry/examParts';
import { Facts, Section } from './optometryParts';

const pair = (right: string | number | null, left: string | number | null, unit = ''): string | null =>
  right === null && left === null ? null : `R ${right ?? '-'}${unit} · L ${left ?? '-'}${unit}`;

/** "All normal" or what was abnormal; nothing when that part of the eye was not examined */
const health = (exam: ExamRecord, part: EyePart): string | null => {
  const summary = partSummary(exam.ocular.findings, part);
  return summary === 'Not examined' ? null : summary;
};

const ratio = (value: number | null): string | null => (value === null ? null : value.toFixed(2));

/**
 * Patient file > Eyes > Eye exams: each exam with why the patient came, vision, keratometry, pressure, fields and eye
 * health, newest first, one tap to its visit (the exam is recorded and changed there).
 */
const ExamHistory: React.FC<{ exams: readonly ExamRecord[]; prescriptions: readonly PrescriptionRecord[]; onOpenVisit?: (visitId: string) => void }> = ({
  exams,
  prescriptions,
  onOpenVisit
}) => (
  <Section title="Eye exams" icon="solar:health-bold-duotone" subtitle="Recorded in the visit's Eye exam section">
    {exams.length === 0 ? (
      <p className="text-sm text-gray-500">No eye exam recorded yet. Open a visit and fill in its Eye exam section.</p>
    ) : (
      <ul className="divide-y divide-gray-100">
        {exams.map(exam => {
          const refraction = prescriptions.some(rx => rx.examId === exam.id && rx.kind === 'spectacles' && !rx.voidedAt);
          const fitting = prescriptions.some(rx => rx.examId === exam.id && rx.kind === 'contact_lenses' && !rx.voidedAt);
          return (
            <li key={exam.id} className="space-y-1 py-2.5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {onOpenVisit ? (
                  <button type="button" className={`${LINK} font-semibold`} onClick={() => onOpenVisit(exam.visitId)}>
                    {formatServiceDate(exam.examinedOn)}
                  </button>
                ) : (
                  <span className="font-semibold text-gray-900">{formatServiceDate(exam.examinedOn)}</span>
                )}
                {exam.recordedBy && <span className="text-xs text-gray-500">{exam.recordedBy}</span>}
                {refraction && <span className="text-xs text-gray-500">· prescription written</span>}
                {fitting && <span className="text-xs text-gray-500">· contact lenses fitted</span>}
              </div>
              <Facts
                items={[
                  ['Came for', historySummary(exam.history)],
                  ['Without glasses', pair(exam.vaUnaided.right, exam.vaUnaided.left)],
                  ['With own glasses', pair(exam.vaAided.right, exam.vaAided.left)],
                  [
                    'Pressure',
                    pair(exam.iopRight, exam.iopLeft, ' mmHg') && `${pair(exam.iopRight, exam.iopLeft, ' mmHg')}${exam.iopMethod ? ` (${IOP_METHOD_LABELS[exam.iopMethod].toLowerCase()}${exam.iopTime ? `, ${exam.iopTime}` : ''})` : ''}`
                  ],
                  ['Fields', exam.fieldsResult ? `${exam.fieldsResult === 'normal' ? 'Normal' : 'Abnormal'}${exam.fieldsNote ? `: ${exam.fieldsNote}` : ''}` : null],
                  ['K', keratometrySummary(exam.keratometry)],
                  ['Front of the eye', health(exam, 'front')],
                  ['Back of the eye', health(exam, 'back')],
                  ['Cup-to-disc', pair(ratio(exam.ocular.cdRight), ratio(exam.ocular.cdLeft))],
                  [
                    'Contact lens fit',
                    exam.clFit.lensType &&
                      `${CL_LENS_TYPE_LABELS[exam.clFit.lensType]}${pair(exam.clFit.vaRight, exam.clFit.vaLeft) ? `, vision ${pair(exam.clFit.vaRight, exam.clFit.vaLeft)}` : ''}`
                  ]
                ]}
              />
            </li>
          );
        })}
      </ul>
    )}
  </Section>
);

export default ExamHistory;
