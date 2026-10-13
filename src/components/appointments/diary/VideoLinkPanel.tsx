import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';
import { currentPracticeId } from '../../../services/recordFiles';
import { opensInApp, shortVideoLink, storedVideoLink } from '../../../utils/diary/videoBookings';
import { getClinicianDisplayName } from '../../telemedicine/telemedicineLinks';
import VideoConsultModal from '../../telemedicine/VideoConsultModal';
import { VideoBookingIcon } from './VideoBookingIcon';

interface VideoLinkPanelProps {
  /** The booking's room link (visits.video_link) */
  link: string | null | undefined;
  /** The booking's patient, for the call and its SMS invite */
  patient: { id: string; firstName: string; lastName: string; cellNumber?: string | null } | null;
  visitId: string;
}

const CHIP_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500';

/**
 * A video booking's room in its booking window (parity B16): the link, "Copy link" and "Join the call". A OneHealth
 * room opens the in-app call (VideoConsultModal, which also texts the link after a confirmation); a Zoom, Teams or Meet
 * link opens in a new tab, where its own app takes over.
 */
export const VideoLinkPanel: React.FC<VideoLinkPanelProps> = ({ link, patient, visitId }) => {
  const user = useAuthStore((state) => state.user);
  const [callOpen, setCallOpen] = useState(false);
  const [practiceName, setPracticeName] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const stored = storedVideoLink(link);
  const practiceId = currentPracticeId();

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = setTimeout(() => setCopyState('idle'), 2500);
    return () => clearTimeout(timer);
  }, [copyState]);

  // The SMS invite names the practice: read once, when the call is opened
  useEffect(() => {
    if (!callOpen || !practiceId || practiceName) return;
    let cancelled = false;
    void supabase
      .from('practices')
      .select('name')
      .eq('id', practiceId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setPracticeName((data as { name?: string | null } | null)?.name ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [callOpen, practiceId, practiceName]);

  if (!stored) return null;
  const inApp = opensInApp(stored) && !!patient;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(stored);
      setCopyState('copied');
    } catch (error) {
      console.error('Could not copy the video link:', error);
      setCopyState('failed');
    }
  };

  const join = () => {
    if (inApp) {
      setCallOpen(true);
      return;
    }
    window.open(stored, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <VideoBookingIcon link={stored} showLabel />
      <span className="min-w-0 max-w-full truncate font-mono text-xs text-gray-500" title={stored}>
        {shortVideoLink(stored)}
      </span>
      <button type="button" onClick={() => void copyLink()} className={CHIP_CLASS}>
        <Icon icon={copyState === 'copied' ? 'solar:check-circle-bold-duotone' : 'solar:copy-bold-duotone'} className="h-4 w-4 text-purple-500" aria-hidden="true" />
        {copyState === 'copied' ? 'Copied' : 'Copy link'}
      </button>
      <button type="button" onClick={join} className={CHIP_CLASS}>
        <Icon icon="solar:videocamera-record-bold-duotone" className="h-4 w-4 text-purple-500" aria-hidden="true" />
        Join the call
      </button>
      <span className="sr-only" aria-live="polite">
        {copyState === 'copied' ? 'Link copied' : copyState === 'failed' ? 'Could not copy the link: select it and copy it by hand.' : ''}
      </span>
      {inApp && patient && (
        <VideoConsultModal
          isOpen={callOpen}
          onClose={() => setCallOpen(false)}
          patient={patient}
          practiceId={practiceId}
          practiceName={practiceName}
          clinicianName={getClinicianDisplayName(user)}
          visitId={visitId}
          roomUrl={stored}
        />
      )}
    </div>
  );
};

export default VideoLinkPanel;
