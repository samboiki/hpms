import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import VideoConsultModal from '../telemedicine/VideoConsultModal';
import { formatPhoneForDisplay, normalizePhoneNumber, toTelHref } from './patientContact';

interface PatientContactActionsProps {
  patient: { id: string; first_name: string; last_name: string; cell_number?: string | null };
  practiceId?: string | null;
  practiceName?: string | null;
  /** Named to the patient in the video call and its SMS invite */
  clinicianName?: string | null;
}

const BUTTON_CLASS =
  'inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition-colors';

/** Call (tel: link) and Video consult, for the patient header. */
const PatientContactActions: React.FC<PatientContactActionsProps> = ({ patient, practiceId, practiceName, clinicianName }) => {
  const [isVideoConsultOpen, setIsVideoConsultOpen] = useState(false);
  const dialNumber = normalizePhoneNumber(patient.cell_number);
  const telHref = toTelHref(patient.cell_number);
  const callDisabledReason = !patient.cell_number?.trim()
    ? 'No cell number on file. Add one with Edit.'
    : !telHref
      ? `The cell number on file (${patient.cell_number}) is not a valid phone number. Correct it with Edit.`
      : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {telHref && dialNumber ? (
        <a href={telHref} className={BUTTON_CLASS} title={`Call ${formatPhoneForDisplay(dialNumber)}`}>
          <Icon icon="solar:phone-calling-bold-duotone" className="w-4 h-4" aria-hidden="true" />
          <span>Call</span>
          <span className="hidden md:inline font-normal text-white/80">{formatPhoneForDisplay(dialNumber)}</span>
        </a>
      ) : (
        // A disabled button shows no tooltip in every browser, so the wrapper carries it
        <span title={callDisabledReason} className="cursor-not-allowed">
          <button
            type="button"
            disabled
            aria-label={`Call unavailable: ${callDisabledReason}`}
            className={`${BUTTON_CLASS} opacity-50 pointer-events-none`}
          >
            <Icon icon="solar:phone-calling-bold-duotone" className="w-4 h-4" aria-hidden="true" />
            <span>Call</span>
          </button>
        </span>
      )}

      <button
        type="button"
        onClick={() => setIsVideoConsultOpen(true)}
        className={BUTTON_CLASS}
        title="Start a video consultation with this patient"
      >
        <Icon icon="solar:videocamera-record-bold-duotone" className="w-4 h-4" aria-hidden="true" />
        <span>Video consult</span>
      </button>

      <VideoConsultModal
        isOpen={isVideoConsultOpen}
        onClose={() => setIsVideoConsultOpen(false)}
        patient={{
          id: patient.id,
          firstName: patient.first_name,
          lastName: patient.last_name,
          cellNumber: patient.cell_number
        }}
        practiceId={practiceId}
        practiceName={practiceName}
        clinicianName={clinicianName}
      />
    </div>
  );
};

export default PatientContactActions;
