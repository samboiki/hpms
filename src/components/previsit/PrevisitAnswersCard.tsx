import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { loadBookingPrevisit, type PrevisitAnswerRecord } from '../../services/previsitService';
import { PrevisitAnswersList, describePrevisitAnswered } from './PrevisitAnswersList';

interface PrevisitAnswersCardProps {
  /** The visit (booking); nothing shows before it is saved */
  visitId: string | null | undefined;
}

/**
 * The patient's answers before the visit (parity B17), on the visit's General tab in the same card as its other
 * sections. Nothing shows when the patient did not answer (or before the database update).
 */
export const PrevisitAnswersCard: React.FC<PrevisitAnswersCardProps> = ({ visitId }) => {
  const [record, setRecord] = useState<PrevisitAnswerRecord | null>(null);

  useEffect(() => {
    setRecord(null);
    if (!visitId) return;
    let cancelled = false;
    void loadBookingPrevisit(visitId).then((load) => {
      if (!cancelled && load.state === 'ready') setRecord(load.answers);
    });
    return () => {
      cancelled = true;
    };
  }, [visitId]);

  if (!record) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center mb-4">
        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 shadow-md">
          <Icon icon="solar:clipboard-list-bold-duotone" className="w-5 h-5 text-white" />
        </div>
        <div className="ml-3">
          <h3 className="text-lg font-semibold text-gray-800">Answers before the visit</h3>
          <p className="text-sm text-gray-600">{describePrevisitAnswered(record)}</p>
        </div>
      </div>
      <PrevisitAnswersList record={record} />
    </div>
  );
};

export default PrevisitAnswersCard;
