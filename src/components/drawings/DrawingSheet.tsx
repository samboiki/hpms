import React, { useEffect, useMemo, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { saveVisitDrawing } from '../../services/drawingService';
import {
  DRAWING_CAPTION_MAX,
  DRAWING_COLOURS,
  DRAWING_WIDTHS,
  drawingTemplate,
  drawingTemplatesFor,
  hasInk,
  type DrawingTemplateId,
  type Stroke
} from '../../utils/clinical/drawings';
import { DrawingPad, drawingToPng } from './DrawingPad';
import { templateArt } from './drawingTemplates';

interface DrawingSheetProps {
  practiceId: string | null;
  patientId: string;
  visitId: string;
  /** Tooth charts are offered to dental practices only */
  isDental: boolean;
  onClose: () => void;
  /** After the drawing was kept with the visit */
  onSaved: () => void;
}

// Above the full-screen visit window
const SHEET_Z_INDEX = 2147483648;

const CHIP_CLASS = 'rounded-lg px-3 py-1.5 text-sm font-medium ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500';
const TOOL_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500';

/**
 * A new drawing for the visit (parity C9): the template (a body chart, a tooth chart for a dental practice, or a blank
 * page), a pen in three colours and two thicknesses, Undo and Clear, and a line on what it shows. Saved as a picture
 * with the visit's notes; the patient file's Media tab lists it.
 */
export const DrawingSheet: React.FC<DrawingSheetProps> = ({ practiceId, patientId, visitId, isDental, onClose, onSaved }) => {
  const templates = useMemo(() => drawingTemplatesFor(isDental), [isDental]);
  const [templateId, setTemplateId] = useState<DrawingTemplateId>(templates[0].id);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [colour, setColour] = useState(DRAWING_COLOURS[0].value);
  const [width, setWidth] = useState(DRAWING_WIDTHS[0].value);
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const template = drawingTemplate(templateId);
  const art = useMemo(() => templateArt(templateId), [templateId]);
  const inked = hasInk(strokes);

  // Escape never throws a drawing away (nor closes the visit underneath): an empty sheet closes, a drawn one stays
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      if (!inked && !saving) onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [inked, saving, onClose]);

  const chooseTemplate = (id: DrawingTemplateId) => {
    if (id === templateId) return;
    if (inked && !window.confirm(`Start again on "${drawingTemplate(id).label}"? The lines drawn are cleared.`)) return;
    setStrokes([]);
    setTemplateId(id);
  };

  const close = () => {
    if (inked && !window.confirm('Close without saving the drawing?')) return;
    onClose();
  };

  const save = async () => {
    if (!inked || saving) return;
    setSaving(true);
    setError(null);
    try {
      const png = await drawingToPng(art, template.aspect, strokes);
      const result = await saveVisitDrawing({ practiceId, patientId, visitId, png, templateId, caption });
      if (!result.ok) {
        setError(plainWords(result.message));
        return;
      }
      toast.success('Drawing saved with the visit');
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? plainWords(saveError.message) : 'The drawing could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="drawing-sheet-title" className="fixed inset-0 overflow-y-auto bg-gray-50" style={{ zIndex: SHEET_Z_INDEX }}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:py-6">
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md">
              <Icon icon="solar:pen-new-square-bold-duotone" className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="drawing-sheet-title" className="text-lg font-semibold text-gray-800">New drawing</h2>
              <p className="text-sm text-gray-600">Draw with a finger, a pen or the mouse. It is saved with the visit.</p>
            </div>
          </div>
          <button type="button" onClick={close} disabled={saving} aria-label="Close the drawing" className="flex-none rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500">
            <Icon icon="solar:close-circle-bold-duotone" className="h-6 w-6" aria-hidden="true" />
          </button>
        </header>

        <div role="group" aria-label="Template" className="flex flex-wrap gap-2">
          {templates.map((item) => {
            const on = item.id === templateId;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={on}
                onClick={() => chooseTemplate(item.id)}
                disabled={saving}
                className={`${CHIP_CLASS} ${on ? 'bg-purple-600 text-white ring-purple-600' : 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50'}`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Pen colour" className="flex items-center gap-1.5">
            {DRAWING_COLOURS.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={colour === item.value}
                aria-label={`${item.label} pen`}
                title={`${item.label} pen`}
                onClick={() => setColour(item.value)}
                className={`h-8 w-8 rounded-full ring-2 ring-offset-2 focus-visible:outline-none focus-visible:ring-purple-500 ${colour === item.value ? 'ring-purple-500' : 'ring-transparent'}`}
                style={{ backgroundColor: item.value }}
              />
            ))}
          </div>
          <div role="group" aria-label="Pen thickness" className="flex items-center gap-1.5">
            {DRAWING_WIDTHS.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={width === item.value}
                onClick={() => setWidth(item.value)}
                className={`${CHIP_CLASS} ${width === item.value ? 'bg-purple-600 text-white ring-purple-600' : 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setStrokes((current) => current.slice(0, -1))} disabled={!inked || saving} className={TOOL_CLASS}>
            <Icon icon="solar:undo-left-round-bold-duotone" className="h-4 w-4 text-purple-500" aria-hidden="true" />
            Undo
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Clear every line drawn?')) setStrokes([]);
            }}
            disabled={!inked || saving}
            className={TOOL_CLASS}
          >
            <Icon icon="solar:eraser-bold-duotone" className="h-4 w-4 text-purple-500" aria-hidden="true" />
            Clear
          </button>
        </div>

        <DrawingPad
          aspect={template.aspect}
          art={art}
          strokes={strokes}
          onStrokesChange={setStrokes}
          colour={colour}
          width={width}
          disabled={saving}
          label={`Drawing area on ${template.label}: draw with a finger, a pen or the mouse`}
        />

        <div>
          <label htmlFor="drawing-caption" className="block text-sm font-semibold text-gray-700 mb-2">
            What it shows (optional)
          </label>
          <input
            id="drawing-caption"
            value={caption}
            maxLength={DRAWING_CAPTION_MAX}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="For example: rash on the left forearm"
            className="w-full rounded-lg border-0 bg-gray-100 px-3 py-2 text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3 pb-4">
          <button type="button" onClick={close} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!inked || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
          >
            <Icon
              icon={saving ? 'solar:refresh-bold-duotone' : 'solar:check-circle-bold-duotone'}
              className={`h-5 w-5 ${saving ? 'animate-spin motion-reduce:animate-none' : ''}`}
              aria-hidden="true"
            />
            {saving ? 'Saving...' : 'Save drawing'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DrawingSheet;
