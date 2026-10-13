import React, { useCallback, useEffect, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import RecordImage from '../uploads/RecordImage';
import { currentPracticeId, openRecord } from '../../services/recordFiles';
import { loadVisitDrawings, type VisitDrawing } from '../../services/drawingService';
import { formatDiaryTimestamp } from '../../utils/diary/diaryTime';
import { DrawingSheet } from './DrawingSheet';

interface VisitDrawingsSectionProps {
  patientId: string;
  /** The visit; a visit not saved yet cannot hold a drawing */
  visitId: string | null | undefined;
  /** Tooth charts for a dental practice (isDentalPractice) */
  isDental: boolean;
}

/**
 * Drawings with the visit's notes (parity C9), on the General tab in the same card as its other sections: the visit's
 * drawings (tap one to open it) and "New drawing". The patient file's Media tab lists them too.
 */
export const VisitDrawingsSection: React.FC<VisitDrawingsSectionProps> = ({ patientId, visitId, isDental }) => {
  const [drawings, setDrawings] = useState<VisitDrawing[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);

  const reload = useCallback(async () => {
    if (!visitId) {
      setDrawings([]);
      return;
    }
    try {
      setDrawings(await loadVisitDrawings(visitId));
      setProblem(null);
    } catch (error) {
      setProblem(error instanceof Error ? plainWords(error.message) : "Could not load the visit's drawings.");
    }
  }, [visitId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const open = async (item: VisitDrawing) => {
    try {
      await openRecord(item.storagePath, item.storageBucket);
    } catch {
      toast.error('The drawing could not be opened. Please try again.');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md">
            <Icon icon="solar:pen-new-square-bold-duotone" className="w-5 h-5 text-white" />
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-semibold text-gray-800">Drawings</h3>
            <p className="text-sm text-gray-600">{isDental ? 'On a tooth chart, a body chart or a blank page' : 'On a body chart or a blank page'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDrawing(true)}
          disabled={!visitId}
          title={visitId ? undefined : 'Save the visit first'}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          <Icon icon="solar:pen-bold-duotone" className="h-4 w-4 text-purple-500" aria-hidden="true" />
          New drawing
        </button>
      </div>
      {!visitId && <p className="text-sm text-gray-500">Save the visit first, then draw.</p>}
      {problem && <p className="text-sm text-red-600" role="alert">{problem}</p>}
      {visitId && !problem && drawings.length === 0 && <p className="text-sm text-gray-500">No drawings with this visit yet.</p>}
      {drawings.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {drawings.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => void open(item)}
                className="block w-full overflow-hidden rounded-lg border border-gray-200 bg-white text-left hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                <RecordImage path={item.storagePath} bucket={item.storageBucket} alt={item.title} className="h-28 w-full object-contain bg-white" />
                <span className="block truncate px-2 pt-1 text-xs font-medium text-gray-800" title={item.title}>
                  {item.caption ?? item.title.replace(/^Drawing: /, '')}
                </span>
                <span className="block px-2 pb-1 text-[11px] text-gray-500">{formatDiaryTimestamp(item.createdAt) ?? ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {drawing && visitId && (
        <DrawingSheet
          practiceId={currentPracticeId()}
          patientId={patientId}
          visitId={visitId}
          isDental={isDental}
          onClose={() => setDrawing(false)}
          onSaved={() => {
            setDrawing(false);
            void reload();
          }}
        />
      )}
    </div>
  );
};

export default VisitDrawingsSection;
