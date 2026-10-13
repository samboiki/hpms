import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { patientTeethLink } from '../billing/invoiceLinks';
import ToothIcon from './ToothIcon';
import { useDentalPractice } from './useDentalPractice';

interface TeethChartLinkProps {
  patientId: string | null | undefined;
  /** The practice to check; the signed-in user's practice when not given */
  practiceId?: string | null;
  /** Called before following the link (for example to close the dialog it is in) */
  onNavigate?: () => void;
  className?: string;
}

const defaultClass = 'inline-flex items-center gap-1.5 text-sm font-medium text-cyan-700 hover:underline';

/**
 * "Teeth chart": from a quote or an invoice back to the patient's tooth chart. Shown for dental practices only, so a
 * GP's or optometrist's invoice never offers it.
 */
const TeethChartLink: React.FC<TeethChartLinkProps> = ({ patientId, practiceId, onNavigate, className = defaultClass }) => {
  const ownPracticeId = useAuthStore(state => state.selectedPracticeId || state.user?.practice_id || null);
  const isDental = useDentalPractice(practiceId ?? ownPracticeId);
  if (!patientId || isDental !== true) return null;
  return (
    <Link to={patientTeethLink(patientId)} onClick={onNavigate} className={className}>
      <ToothIcon className="h-4 w-4" />
      Teeth chart
    </Link>
  );
};

export default TeethChartLink;
