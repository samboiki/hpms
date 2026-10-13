import React, { useEffect, useRef, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { compressPhoto, photoFileProblem } from './patientPhoto';

/** Phones and tablets: the camera app opens straight from the file field, which is simpler than a live preview */
const isTouchDevice = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

const canUseWebcam = (): boolean =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';

interface WebcamProps {
  onTaken: (photo: Blob) => void;
  onClose: () => void;
  onFallback: () => void;
}

/** A desktop webcam: a live picture and one "Take photo" button */
const WebcamDialog: React.FC<WebcamProps> = ({ onTaken, onClose, onFallback }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [taking, setTaking] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then(opened => {
        if (!active) {
          opened.getTracks().forEach(track => track.stop());
          return;
        }
        stream = opened;
        const video = videoRef.current;
        if (video) {
          video.srcObject = opened;
          void video.play().catch(() => undefined);
        }
      })
      .catch(error => {
        console.error('The camera could not be opened:', error);
        if (active) setProblem('The camera could not be opened. Allow the camera for this site, or choose a photo from a file instead.');
      });
    return () => {
      active = false;
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const take = async () => {
    const video = videoRef.current;
    if (!video) return;
    setTaking(true);
    try {
      onTaken(await compressPhoto(video));
    } catch (error) {
      setProblem(error instanceof Error ? plainWords(error.message) : 'The photo could not be taken. Try again.');
      setTaking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="patient-photo-camera-title">
      <div className="w-full max-w-md rounded-xl bg-white p-4 text-gray-900 shadow-xl">
        <h3 id="patient-photo-camera-title" className="mb-3 text-lg font-semibold">Take the patient's photo</h3>
        {problem ? (
          <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="alert">{problem}</p>
        ) : (
          <div className="mb-3 overflow-hidden rounded-lg bg-gray-900">
            <video
              ref={videoRef}
              className="aspect-[4/3] w-full object-cover"
              playsInline
              muted
              onLoadedData={() => setReady(true)}
              aria-label="Camera preview"
            />
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          {problem ? (
            <button type="button" onClick={onFallback} className="rounded-lg bg-[#01b9d5] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              Choose a file
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void take()}
              disabled={!ready || taking}
              className="flex items-center gap-2 rounded-lg bg-[#01b9d5] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              <Icon icon="solar:camera-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              {taking ? 'Taking...' : 'Take photo'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface Props {
  /** A prepared (small JPEG) photo */
  onPhoto: (photo: Blob) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  /** The host page's button classes, so the buttons look like the ones around them */
  buttonClassName: string;
  idPrefix: string;
}

/** "Take photo" (the camera: phone, tablet or webcam) and "Upload photo" (a file); both give a small JPEG */
export const PatientPhotoCapture: React.FC<Props> = ({ onPhoto, onError, disabled = false, buttonClassName, idPrefix }) => {
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);

  const acceptFile = async (file: File | undefined) => {
    if (!file) return;
    const problem = photoFileProblem(file);
    if (problem) {
      onError(problem);
      return;
    }
    setPreparing(true);
    try {
      onPhoto(await compressPhoto(file));
    } catch (error) {
      onError(error instanceof Error ? plainWords(error.message) : 'This photo could not be read. Try another one.');
    } finally {
      setPreparing(false);
    }
  };

  const takePhoto = () => {
    if (!isTouchDevice() && canUseWebcam()) setWebcamOpen(true);
    else cameraInput.current?.click();
  };

  const busy = disabled || preparing;
  return (
    <>
      <button type="button" onClick={takePhoto} disabled={busy} className={buttonClassName}>
        <Icon icon="solar:camera-bold-duotone" className="h-4 w-4" aria-hidden="true" />
        <span>Take photo</span>
      </button>
      <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className={buttonClassName}>
        <Icon icon="solar:gallery-add-bold-duotone" className="h-4 w-4" aria-hidden="true" />
        <span>{preparing ? 'Preparing...' : 'Upload photo'}</span>
      </button>
      <input
        ref={cameraInput}
        id={`${idPrefix}-camera`}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={event => {
          void acceptFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <input
        ref={fileInput}
        id={`${idPrefix}-file`}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={event => {
          void acceptFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {webcamOpen && (
        <WebcamDialog
          onTaken={photo => {
            setWebcamOpen(false);
            onPhoto(photo);
          }}
          onClose={() => setWebcamOpen(false)}
          onFallback={() => {
            setWebcamOpen(false);
            fileInput.current?.click();
          }}
        />
      )}
    </>
  );
};
