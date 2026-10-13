import React, { useState } from 'react';
import FormModal from '../modals/FormModal';
import ToothIcon from './ToothIcon';
import TeethView from './TeethView';
import { useDentalPractice } from './useDentalPractice';

interface TeethChartButtonProps {
  patientId: string;
  practiceId: string | null | undefined;
  /** The visit on screen: work recorded or marked done from the chart is linked to it */
  visitId: string | null;
}

/**
 * "Teeth" on the visit screen (dental practices only): the patient's tooth chart and plan over the visit, so the
 * practitioner never leaves a visit with unsaved changes to look at a tooth.
 */
const TeethChartButton: React.FC<TeethChartButtonProps> = ({ patientId, practiceId, visitId }) => {
  const isDental = useDentalPractice(practiceId);
  const [open, setOpen] = useState(false);
  if (isDental !== true) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-none items-center gap-1.5 rounded-lg bg-white/20 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none"
        aria-haspopup="dialog"
      >
        <ToothIcon className="h-5 w-5" />
        Teeth
      </button>
      <FormModal isOpen={open} onClose={() => setOpen(false)} title="Teeth" icon="solar:clipboard-list-bold-duotone" className="max-w-4xl">
        {open && <TeethView practiceId={practiceId} patientId={patientId} visitId={visitId} />}
      </FormModal>
    </>
  );
};

export default TeethChartButton;
