import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { QUIET_BUTTON } from '../patientLists/listStyles';

interface SignaturePadProps {
  /** The signature as a PNG data URL after each stroke, or null once cleared */
  onChange: (image: string | null) => void;
  /** Who is asked to sign, for the instructions and screen readers ("the patient") */
  signerLabel?: string;
  disabled?: boolean;
}

/** The kept signature: 3 wide to 1 high, as the PDF prints it (letterPdf.ts), small enough to keep with the form */
const EXPORT_WIDTH = 600;
const EXPORT_HEIGHT = 200;

/**
 * A box to sign in with a finger, a stylus or the mouse (pointer events). The page does not scroll while signing. Each
 * finished stroke hands the signature on as a PNG on white; "Clear" starts again.
 */
export const SignaturePad: React.FC<SignaturePadProps> = ({ onChange, signerLabel = 'the patient', disabled = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<{ x: number; y: number } | null>(null);
  // The latest handler, so a parent's re-render never resets the box (and wipes a signature) through the effect below
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [hasInk, setHasInk] = useState(false);
  const hintId = useId();

  // The drawing surface follows the box's size and the screen's pixel density, so lines stay sharp
  const prepare = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = Math.max(Math.round(rect.width * ratio), 1);
    canvas.height = Math.max(Math.round(rect.height * ratio), 1);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 2.2;
    context.strokeStyle = '#111827';
    context.fillStyle = '#111827';
  }, []);

  useEffect(() => {
    prepare();
    // A new size would stretch the strokes drawn so far, so a resize starts the signature again
    const onResize = () => {
      prepare();
      setHasInk(false);
      onChangeRef.current(null);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [prepare]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const exportImage = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const copy = document.createElement('canvas');
    copy.width = EXPORT_WIDTH;
    copy.height = EXPORT_HEIGHT;
    const context = copy.getContext('2d');
    if (!context) return null;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
    context.drawImage(canvas, 0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
    return copy.toDataURL('image/png');
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const start = point(event);
    drawing.current = start;
    const context = event.currentTarget.getContext('2d');
    // A tap leaves a dot
    context?.beginPath();
    context?.arc(start.x, start.y, 1.1, 0, Math.PI * 2);
    context?.fill();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;
    event.preventDefault();
    const next = point(event);
    const context = event.currentTarget.getContext('2d');
    if (context) {
      context.beginPath();
      context.moveTo(drawing.current.x, drawing.current.y);
      context.lineTo(next.x, next.y);
      context.stroke();
    }
    drawing.current = next;
  };

  const finishStroke = () => {
    if (!drawing.current) return;
    drawing.current = null;
    setHasInk(true);
    onChangeRef.current(exportImage());
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (canvas && context) {
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.restore();
    }
    setHasInk(false);
    onChangeRef.current(null);
  };

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Signature box: ${signerLabel} signs here with a finger, a stylus or the mouse`}
          aria-describedby={hintId}
          className={`block aspect-[3/1] w-full touch-none rounded-xl border-2 border-dashed bg-white ${
            disabled ? 'cursor-not-allowed border-gray-200 opacity-60' : 'cursor-crosshair border-purple-300'
          }`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          onPointerLeave={finishStroke}
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm text-gray-400" aria-hidden="true">
            Sign here
          </span>
        )}
        <span className="pointer-events-none absolute bottom-6 left-4 right-4 border-b border-gray-300" aria-hidden="true" />
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <p id={hintId} className="text-xs text-gray-500">
          {hasInk ? 'Signed. Clear to sign again.' : `Ask ${signerLabel} to sign in the box.`}
        </p>
        <button type="button" className={QUIET_BUTTON} onClick={clear} disabled={!hasInk || disabled}>
          <Icon icon="solar:eraser-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Clear
        </button>
      </div>
    </div>
  );
};

export default SignaturePad;
