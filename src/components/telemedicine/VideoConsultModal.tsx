import React, { useEffect, useRef, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { format } from 'date-fns';
import { communicationService, getCommunicationErrorMessage } from '../../services/communicationService';
import { formatPhoneForDisplay, normalizePhoneNumber } from '../patients/patientContact';
import { TelemedicineRoom } from './TelemedicineRoom';
import { buildTelemedicineInviteMessage, createTelemedicineRoomUrl } from './telemedicineLinks';

export interface VideoConsultPatient {
  id: string;
  firstName: string;
  lastName: string;
  cellNumber?: string | null;
}

interface VideoConsultModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: VideoConsultPatient;
  practiceId?: string | null;
  practiceName?: string | null;
  /** Shown in the call and named in the SMS, e.g. "Dr. Hilma Amalwa" (see getClinicianDisplayName) */
  clinicianName?: string | null;
  /** Links the SMS log to this visit when the consult belongs to one */
  visitId?: string | null;
  /** A video booking's own room (visits.video_link, a OneHealth room): used instead of a new private room */
  roomUrl?: string | null;
  /** Called after the clinician ends the call (e.g. to refresh a list) */
  onCallEnded?: () => void;
}

interface SessionRoom {
  url: string;
  smsSentTo?: string;
  smsSentAt?: Date;
}

// One room per patient and practice for this browser session: reopening the dialog keeps the link
// that may already have been sent to the patient instead of silently creating a new room.
const sessionRooms = new Map<string, SessionRoom>();

type View = 'setup' | 'confirm-sms' | 'call';
type SmsState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'sent'; to: string }
  | { status: 'failed'; message: string };

// Above the patient modal and, when opened from the call, above the call itself (mounted later)
const DIALOG_Z_INDEX = 2147483647;

/**
 * Start a video consult with a patient: a private room link (unguessable, reused for this patient
 * during the session), copy it, open the call inside HPMS, and optionally text the link to the
 * patient through the centralized SMS gateway after an explicit confirmation of number and text.
 */
const VideoConsultModal: React.FC<VideoConsultModalProps> = ({
  isOpen,
  onClose,
  patient,
  practiceId,
  practiceName,
  clinicianName,
  visitId,
  roomUrl,
  onCallEnded
}) => {
  const [view, setView] = useState<View>('setup');
  // Where the SMS confirmation returns to: the dialog or a running call
  const [smsReturnView, setSmsReturnView] = useState<'setup' | 'call'>('setup');
  const [room, setRoom] = useState<SessionRoom | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [sms, setSms] = useState<SmsState>({ status: 'idle' });
  const linkInputRef = useRef<HTMLInputElement>(null);

  // A booking's own room is kept per link; otherwise one room per patient and practice
  const roomKey = roomUrl ? `link:${roomUrl}` : `${practiceId ?? ''}:${patient.id}`;
  const patientName = `${patient.firstName} ${patient.lastName}`.trim() || 'Patient';
  const smsNumber = normalizePhoneNumber(patient.cellNumber);

  useEffect(() => {
    if (!isOpen) return;
    setView('setup');
    setSms({ status: 'idle' });
    setCopyState('idle');
    const existing = sessionRooms.get(roomKey);
    if (existing) {
      setRoom(existing);
      setRoomError(null);
      return;
    }
    if (roomUrl) {
      const booked: SessionRoom = { url: roomUrl };
      sessionRooms.set(roomKey, booked);
      setRoom(booked);
      setRoomError(null);
      return;
    }
    try {
      const created: SessionRoom = { url: createTelemedicineRoomUrl(practiceId) };
      sessionRooms.set(roomKey, created);
      setRoom(created);
      setRoomError(null);
    } catch (error) {
      console.error('[VideoConsultModal] Could not create a video room:', error);
      setRoom(null);
      setRoomError(error instanceof Error ? plainWords(error.message) : 'Could not create a video room.');
    }
  }, [isOpen, roomKey, practiceId, roomUrl]);

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = setTimeout(() => setCopyState('idle'), 2500);
    return () => clearTimeout(timer);
  }, [copyState]);

  const isSending = sms.status === 'sending';
  // The call stays up while the SMS confirmation is shown on top of it
  const isInCall = view === 'call' || (view === 'confirm-sms' && smsReturnView === 'call');
  const showDialog = isOpen && view !== 'call';

  // Escape closes this dialog (or steps back from the SMS confirmation) without closing the
  // patient file or page underneath
  useEffect(() => {
    if (!showDialog) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      if (isSending) return;
      if (view === 'confirm-sms') {
        setView(smsReturnView);
      } else {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape, true);
    return () => document.removeEventListener('keydown', handleEscape, true);
  }, [showDialog, view, smsReturnView, isSending, onClose]);

  if (!isOpen) return null;

  const smsDisabledReason = !patient.cellNumber?.trim()
    ? 'No cell number on file for this patient'
    : !smsNumber
      ? `The cell number on file (${patient.cellNumber}) is not a valid phone number`
      : !practiceId
        ? 'Practice not found, so the SMS cannot be sent'
        : !room
          ? 'No video link yet'
          : undefined;

  const message = room
    ? buildTelemedicineInviteMessage({ roomUrl: room.url, patientFirstName: patient.firstName, clinicianName, practiceName })
    : '';

  const copyLink = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.url);
      setCopyState('copied');
    } catch (error) {
      console.error('[VideoConsultModal] Could not copy the room link:', error);
      setCopyState('failed');
      // Let the user copy it by hand
      linkInputRef.current?.select();
    }
  };

  const openSmsConfirmation = (from: 'setup' | 'call') => {
    if (smsDisabledReason) return;
    setSms({ status: 'idle' });
    setSmsReturnView(from);
    setView('confirm-sms');
  };

  const sendSms = async () => {
    if (!room || !smsNumber || !practiceId || isSending) return;
    setSms({ status: 'sending' });
    try {
      const result = await communicationService.sendSMS({
        practiceId,
        recipientPhone: smsNumber,
        messageContent: message,
        messageType: 'custom',
        patientId: patient.id,
        ...(visitId ? { visitId } : {}),
        tags: ['telemedicine_invite']
      });
      if (result.success) {
        const sentRoom: SessionRoom = { ...room, smsSentTo: smsNumber, smsSentAt: new Date() };
        sessionRooms.set(roomKey, sentRoom);
        setRoom(sentRoom);
        setSms({ status: 'sent', to: smsNumber });
      } else {
        setSms({ status: 'failed', message: getCommunicationErrorMessage('sms', result.error) });
      }
    } catch (error) {
      console.error('[VideoConsultModal] SMS send failed:', error);
      setSms({ status: 'failed', message: 'Could not send the SMS. Check your connection and try again.' });
    }
  };

  const endCall = () => {
    setView('setup');
    onClose();
    onCallEnded?.();
  };

  const renderSetup = () => (
    <>
      <div className="p-6 space-y-5">
        {roomError ? (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-sm text-red-700" role="alert">
            <Icon icon="solar:danger-triangle-bold-duotone" className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span>{roomError}</span>
          </div>
        ) : (
          room && (
            <div>
              <label htmlFor="video-consult-link" className="block text-sm font-semibold text-gray-700 mb-1">
                Patient link
              </label>
              <div className="flex gap-2">
                <input
                  id="video-consult-link"
                  ref={linkInputRef}
                  readOnly
                  value={room.url}
                  onFocus={(event) => event.target.select()}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 font-mono text-xs text-gray-800"
                />
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Icon
                    icon={copyState === 'copied' ? 'solar:check-circle-bold-duotone' : 'solar:copy-bold-duotone'}
                    className="w-4 h-4"
                    aria-hidden="true"
                  />
                  {copyState === 'copied' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500" aria-live="polite">
                {copyState === 'failed'
                  ? 'Could not copy automatically. The link is selected: press Ctrl+C to copy it.'
                  : 'Anyone with this link can join the call. Share it only with the patient.'}
              </p>
            </div>
          )
        )}

        {room?.smsSentTo && room.smsSentAt && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 text-sm text-emerald-800">
            <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span>
              Link sent by SMS to {formatPhoneForDisplay(room.smsSentTo)} at {format(room.smsSentAt, 'HH:mm')}.
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
        <span title={smsDisabledReason} className="sm:mr-auto">
          <button
            type="button"
            onClick={() => openSmsConfirmation('setup')}
            disabled={!!smsDisabledReason}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon icon="solar:chat-round-dots-bold-duotone" className="w-4 h-4" aria-hidden="true" />
            {room?.smsSentTo ? 'Send link again by SMS' : 'Send link to patient by SMS'}
          </button>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          Close
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => setView('call')}
          disabled={!room}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon icon="solar:videocamera-record-bold-duotone" className="w-4 h-4" aria-hidden="true" />
          Start video call
        </button>
      </div>
    </>
  );

  const renderSmsConfirmation = () => (
    <>
      <div className="p-6 space-y-4">
        {sms.status === 'sent' ? (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-50 text-emerald-800" role="status">
            <Icon icon="solar:check-circle-bold-duotone" className="w-6 h-6 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">SMS sent to {formatPhoneForDisplay(sms.to)}</p>
              <p className="text-sm">{patientName} can now join with the link.</p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600">Check the number and the message. Nothing is sent until you press Send SMS.</p>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="font-semibold text-gray-700">To</dt>
                <dd className="mt-0.5 font-mono text-gray-900">
                  {smsNumber ? formatPhoneForDisplay(smsNumber) : '-'}
                  <span className="ml-2 font-sans text-gray-500">({patientName})</span>
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-700">Message</dt>
                <dd className="mt-1 p-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 whitespace-pre-wrap break-words">
                  {message}
                </dd>
                <dd className="mt-1 text-xs text-gray-500">{message.length} characters</dd>
              </div>
            </dl>
            {sms.status === 'failed' && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-sm text-red-700" role="alert">
                <Icon icon="solar:danger-triangle-bold-duotone" className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                <span>{sms.message}</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
        {sms.status === 'sent' ? (
          <button
            type="button"
            autoFocus
            onClick={() => setView(smsReturnView)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-sm font-semibold text-white"
          >
            {smsReturnView === 'call' ? 'Back to call' : 'Done'}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setView(smsReturnView)}
              disabled={isSending}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={sendSms}
              disabled={isSending || !!smsDisabledReason}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Icon
                icon={isSending ? 'solar:refresh-bold-duotone' : 'solar:plain-bold-duotone'}
                className={`w-4 h-4 ${isSending ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {isSending ? 'Sending...' : sms.status === 'failed' ? 'Try again' : 'Send SMS'}
            </button>
          </>
        )}
      </div>
    </>
  );

  const dialog = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      style={{ zIndex: DIALOG_Z_INDEX }}
      onClick={() => {
        if (view === 'setup') onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-consult-title"
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-6 py-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-white/20 rounded-lg">
              <Icon
                icon={view === 'confirm-sms' ? 'solar:chat-round-dots-bold-duotone' : 'solar:videocamera-bold-duotone'}
                className="w-5 h-5"
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0">
              <h2 id="video-consult-title" className="text-lg font-semibold truncate">
                {view === 'confirm-sms' ? 'Send video link by SMS' : 'Video consultation'}
              </h2>
              <p className="text-sm text-white/80 truncate">{patientName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => (view === 'confirm-sms' ? setView(smsReturnView) : onClose())}
            disabled={isSending}
            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 disabled:opacity-50"
            aria-label={view === 'confirm-sms' ? 'Cancel SMS' : 'Close'}
          >
            <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        {view === 'confirm-sms' ? renderSmsConfirmation() : renderSetup()}
      </div>
    </div>
  );

  return (
    <>
      {isInCall && room && (
        <TelemedicineRoom
          roomUrl={room.url}
          patientName={patientName}
          doctorName={clinicianName?.trim() || 'Clinician'}
          appointmentId={visitId ?? undefined}
          onEnd={endCall}
          onContinueInNewTab={() => {
            // The call goes on in the browser tab; just close the in-app view
            setView('setup');
            onClose();
          }}
          onSendLink={() => openSmsConfirmation('call')}
          sendLinkDisabledReason={smsDisabledReason}
        />
      )}
      {showDialog && createPortal(dialog, document.body)}
    </>
  );
};

export default VideoConsultModal;
