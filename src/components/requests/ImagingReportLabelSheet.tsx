import React, { useEffect, useState } from 'react';
import { LabelPrintSheet } from '../labels/LabelPrintSheet';
import { loadImagingLabelSource } from '../../services/imagingReportService';
import { imagingLabelLines, imagingTypeLabel } from '../../utils/clinical/imagingReports';
import { toDateKey } from '../../utils/diary/diaryTime';
import type { LabelData } from '../../utils/labels/labelSheet';
import type { ImagingRequestForReport } from './ImagingReportDialog';

interface ImagingReportLabelSheetProps {
  patientId: string;
  /** The request to label; null keeps the sheet closed */
  request: ImagingRequestForReport | null;
  onClose: () => void;
}

/**
 * A request's label for the film packet or the envelope (parity C12): the patient, the examination, the day it was
 * requested, its reference and the practice, printed through the practice's label printer (A4 label sheets or a label
 * printer; the choice is remembered on this computer).
 */
export const ImagingReportLabelSheet: React.FC<ImagingReportLabelSheetProps> = ({ patientId, request, onClose }) => {
  const [labels, setLabels] = useState<LabelData[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!request) return;
    let live = true;
    setLabels(null);
    setProblem(null);
    void loadImagingLabelSource(patientId).then((source) => {
      if (!live) return;
      if (!source) {
        setProblem('The patient could not be loaded for the label. Please try again.');
        setLabels([]);
        return;
      }
      setLabels([
        {
          kind: 'address',
          lines: imagingLabelLines({
            patient: source.patient,
            todayKey: toDateKey(new Date()),
            imagingType: request.imaging_type,
            bodyPart: request.body_part ?? null,
            requestDate: request.request_date ?? null,
            requestId: request.id,
            practiceName: source.practiceName
          })
        }
      ]);
    });
    return () => {
      live = false;
    };
  }, [patientId, request]);

  // Escape closes this sheet only: the patient file underneath closes on Escape too, before the sheet would hear it
  useEffect(() => {
    if (!request) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [request, onClose]);

  return (
    <LabelPrintSheet
      open={request !== null}
      onClose={onClose}
      title={request ? `${imagingTypeLabel(request.imaging_type)} label` : 'Imaging label'}
      subtitle="For the film packet or the envelope"
      purpose="address"
      look="purple"
      labels={labels}
    >
      {problem && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {problem}
        </p>
      )}
    </LabelPrintSheet>
  );
};

export default ImagingReportLabelSheet;
