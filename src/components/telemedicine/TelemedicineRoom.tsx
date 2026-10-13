import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { withJitsiDisplayName } from './telemedicineLinks';

interface TelemedicineRoomProps {
  /** Room URL the patient joins (the clinician's view adds their display name) */
  roomUrl: string;
  patientName: string;
  doctorName: string;
  /** Visit or appointment this call belongs to (kept for logging) */
  appointmentId?: string;
  onEnd: () => void;
  /** Called when the clinician moves the call to a browser tab (the call goes on there). Defaults to onEnd. */
  onContinueInNewTab?: () => void;
  /** Opens the SMS confirmation for the patient's link; the button is hidden when omitted */
  onSendLink?: () => void;
  /** Reason the SMS button is disabled (e.g. no cell number); shown as its tooltip */
  sendLinkDisabledReason?: string;
}

// Above the patient modal and the full-screen visit modal; mounted last, so it also sits above
// other max-z overlays such as the floating visit tracker
const ROOM_Z_INDEX = 2147483647;

export const TelemedicineRoom: React.FC<TelemedicineRoomProps> = ({
  roomUrl,
  patientName,
  doctorName,
  onEnd,
  onContinueInNewTab,
  onSendLink,
  sendLinkDisabledReason
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [duration, setDuration] = useState(0);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    // Start duration timer
    intervalRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Escape must not close the patient file underneath and drop the call
  useEffect(() => {
    const swallowEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
      }
    };
    document.addEventListener('keydown', swallowEscape, true);
    return () => document.removeEventListener('keydown', swallowEscape, true);
  }, []);

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = setTimeout(() => setCopyState('idle'), 2500);
    return () => clearTimeout(timer);
  }, [copyState]);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopyState('copied');
    } catch (error) {
      console.error('[TelemedicineRoom] Could not copy the room link:', error);
      setCopyState('failed');
    }
  };

  const room = (
    <div
      className="fixed inset-0 bg-gray-900 flex flex-col"
      style={{ zIndex: ROOM_Z_INDEX }}
      role="dialog"
      aria-modal="true"
      aria-label="Video consultation"
    >
      {/* Header */}
      <div className="bg-gray-800 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-white font-medium">Video consultation</span>
          </div>
          <div className="text-gray-300 text-sm truncate">
            {doctorName} with {patientName}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-white font-mono mr-2" aria-label="Call duration">{formatDuration(duration)}</span>
          <button
            type="button"
            onClick={copyLink}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2 text-sm"
            title="Copy the link the patient uses to join"
          >
            <Icon icon={copyState === 'copied' ? 'solar:check-circle-bold-duotone' : 'solar:copy-bold-duotone'} className="w-4 h-4" />
            {copyState === 'copied' ? 'Link copied' : copyState === 'failed' ? 'Copy failed' : 'Copy patient link'}
          </button>
          {onSendLink && (
            <span title={sendLinkDisabledReason}>
              <button
                type="button"
                onClick={onSendLink}
                disabled={!!sendLinkDisabledReason}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon icon="solar:chat-round-dots-bold-duotone" className="w-4 h-4" />
                Send link by SMS
              </button>
            </span>
          )}
          <a
            href={roomUrl}
            target="_blank"
            rel="noopener noreferrer"
            // Leave the in-app room so the clinician is not in the call twice
            onClick={onContinueInNewTab ?? onEnd}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2 text-sm"
            title="Continue the call in a separate browser tab (use this if the video does not load here)"
          >
            <Icon icon="solar:square-arrow-right-up-bold-duotone" className="w-4 h-4" />
            Continue in new tab
          </a>
          <button
            type="button"
            onClick={onEnd}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2"
          >
            <Icon icon="solar:phone-bold-duotone" className="w-5 h-5" />
            End call
          </button>
        </div>
      </div>

      {/* Video Container - Jitsi iframe */}
      <div className="flex-1 relative">
        <iframe
          src={withJitsiDisplayName(roomUrl, doctorName)}
          title={`Video consultation with ${patientName}`}
          className="w-full h-full"
          allow="camera; microphone; display-capture; autoplay; clipboard-write; clipboard-read; fullscreen"
          allowFullScreen
          onLoad={() => setIsConnected(true)}
        />

        {!isConnected && (
          <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
            <div className="text-center">
              <Icon icon="solar:refresh-circle-bold-duotone" className="w-12 h-12 text-gray-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-300">Connecting to video room...</p>
            </div>
          </div>
        )}
      </div>

      {/* The previous mute/camera/share buttons here only changed their own colour, never the call.
          Those controls live in the Jitsi toolbar inside the video window. */}
      <div className="bg-gray-800 px-4 py-2 text-center text-xs text-gray-400">
        Use the toolbar inside the video window to mute, turn the camera off or share your screen.
      </div>
    </div>
  );

  // Portal: renders above whichever modal opened the call (patient file, Communications page)
  return createPortal(room, document.body);
};