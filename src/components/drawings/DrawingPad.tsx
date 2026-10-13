import React, { useCallback, useEffect, useRef } from 'react';
import { toStrokePoint, type Stroke, type StrokePoint } from '../../utils/clinical/drawings';
import { templateImageSource, type TemplateArt } from './drawingTemplates';

interface DrawingPadProps {
  /** Width divided by height */
  aspect: number;
  /** The template under the pen, or null for a blank page */
  art: TemplateArt | null;
  strokes: Stroke[];
  onStrokesChange: (strokes: Stroke[]) => void;
  colour: string;
  /** Thickness as thousandths of the drawing's width */
  width: number;
  /** What the drawing area is, for screen readers */
  label: string;
  disabled?: boolean;
}

/** Paints strokes on a canvas of the given size (CSS pixels; the context is already scaled for the screen) */
export function paintStrokes(context: CanvasRenderingContext2D, strokes: readonly Stroke[], width: number, height: number): void {
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    const lineWidth = Math.max(1, (stroke.width / 1000) * width);
    context.strokeStyle = stroke.colour;
    context.fillStyle = stroke.colour;
    context.lineWidth = lineWidth;
    const [first, ...rest] = stroke.points;
    if (rest.length === 0) {
      // A tap is a dot
      context.beginPath();
      context.arc(first[0] * width, first[1] * height, lineWidth / 2, 0, Math.PI * 2);
      context.fill();
      continue;
    }
    context.beginPath();
    context.moveTo(first[0] * width, first[1] * height);
    for (const point of rest) context.lineTo(point[0] * width, point[1] * height);
    context.stroke();
  }
}

const loadImage = (source: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The template could not be drawn.'));
    image.src = source;
  });

/** The drawing as a PNG: white, the template, then the lines, at a fixed width so every saved drawing reads the same */
export async function drawingToPng(art: TemplateArt | null, aspect: number, strokes: readonly Stroke[], outputWidth = 1600): Promise<Blob> {
  const width = outputWidth;
  const height = Math.round(outputWidth / aspect);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot save drawings.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  if (art) context.drawImage(await loadImage(templateImageSource(art)), 0, 0, width, height);
  paintStrokes(context, strokes, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The drawing could not be made into a picture.'))), 'image/png');
  });
}

/**
 * Where a practitioner draws (parity C9), with a finger, a pen or the mouse, over the template. Lines are kept as shares
 * of the drawing's width and height, so turning a tablet or resizing the window redraws them in place.
 */
export const DrawingPad: React.FC<DrawingPadProps> = ({ aspect, art, strokes, onStrokesChange, colour, width, label, disabled = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const current = useRef<Stroke | null>(null);
  const size = useRef({ width: 0, height: 0 });

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const { width: cssWidth, height: cssHeight } = size.current;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    const ratio = cssWidth > 0 ? canvas.width / cssWidth : 1;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    paintStrokes(context, current.current ? [...strokes, current.current] : strokes, cssWidth, cssHeight);
  }, [strokes]);

  // Sharp on high-density screens; redrawn whenever the drawing changes size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fit = () => {
      const box = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      size.current = { width: box.width, height: box.height };
      canvas.width = Math.max(1, Math.round(box.width * ratio));
      canvas.height = Math.max(1, Math.round(box.height * ratio));
      redraw();
    };
    fit();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', fit);
      return () => window.removeEventListener('resize', fit);
    }
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const pointOf = (event: React.PointerEvent<HTMLCanvasElement> | PointerEvent): StrokePoint => {
    const box = canvasRef.current?.getBoundingClientRect();
    return box ? toStrokePoint(event.clientX - box.left, event.clientY - box.top, box.width, box.height) : [0, 0];
  };

  return (
    <div className="relative mx-auto w-full overflow-hidden rounded-xl border border-gray-200 bg-white" style={{ aspectRatio: `${aspect}`, maxWidth: `min(100%, calc(62vh * ${aspect}))` }}>
      {art && (
        <img
          src={templateImageSource(art)}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
        />
      )}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className={`absolute inset-0 h-full w-full touch-none ${disabled ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
        onPointerDown={(event) => {
          if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          current.current = { colour, width, points: [pointOf(event)] };
          redraw();
        }}
        onPointerMove={(event) => {
          if (!current.current) return;
          const native = event.nativeEvent;
          const events = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [native];
          for (const item of events.length > 0 ? events : [native]) current.current.points.push(pointOf(item));
          redraw();
        }}
        onPointerUp={() => {
          const finished = current.current;
          current.current = null;
          if (finished) onStrokesChange([...strokes, finished]);
        }}
        onPointerCancel={() => {
          current.current = null;
          redraw();
        }}
      />
    </div>
  );
};

export default DrawingPad;
