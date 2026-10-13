import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { ListSheet } from '../patientLists/ListSheet';
import * as listLook from '../patientLists/listStyles';
import * as stockLook from '../stock/stockUi';
import { DEFAULT_LAYOUT, labelsPerPage, layoutById, layoutsFor, type LabelLayout, type LabelPurpose } from '../../utils/labels/labelLayouts';
import { labelSheetHtml, planLabelSheet, type LabelData } from '../../utils/labels/labelSheet';
import { printLabels } from './printLabels';

interface LabelPrintSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** The labels, in print order; null while they are being prepared */
  labels: readonly LabelData[] | null;
  /** Decides the layouts offered first; the choice is remembered per purpose on this computer */
  purpose: LabelPurpose;
  /** The host page's buttons and fields: cyan (Stock, optometry) or purple (Messages > Lists) */
  look?: 'cyan' | 'purple';
  /** Shown above the choices, e.g. the patients who have no address */
  children?: React.ReactNode;
}

const LOOKS = {
  cyan: { input: stockLook.INPUT, label: stockLook.LABEL, primary: stockLook.PRIMARY, secondary: stockLook.SECONDARY, quiet: stockLook.QUIET, accent: 'text-cyan-600 focus:ring-cyan-500' },
  purple: {
    input: listLook.INPUT,
    label: listLook.LABEL,
    primary: listLook.PRIMARY_BUTTON,
    secondary: listLook.SECONDARY_BUTTON,
    quiet: listLook.QUIET_BUTTON,
    accent: 'text-purple-600 focus:ring-purple-500'
  }
} as const;

const STORE_KEY = 'onehealth.labels.v1';

interface Remembered {
  layouts?: Partial<Record<LabelPurpose, string>>;
  offsets?: Record<string, { xMm: number; yMm: number }>;
}

/** The layout and lining-up chosen on this computer (a convenience: printing works the same without it) */
function readRemembered(): Remembered {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Remembered) : {};
  } catch {
    return {};
  }
}

function remember(change: (current: Remembered) => Remembered): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(change(readRemembered())));
  } catch {
    // Private windows and blocked storage: the choice is simply not remembered
  }
}

/** The sheet last chosen for a purpose on this computer, else the usual one for it */
function rememberedLayout(purpose: LabelPurpose): string {
  const saved = readRemembered().layouts?.[purpose];
  return saved && layoutById(saved) ? saved : DEFAULT_LAYOUT[purpose];
}

const rememberedOffset = (layoutId: string): { xMm: number; yMm: number } => readRemembered().offsets?.[layoutId] ?? { xMm: 0, yMm: 0 };

const MM_PER_PX = 25.4 / 96;
const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;
const numberIn = (text: string, min: number, max: number): number | null => {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) && value >= min && value <= max ? value : null;
};

/** The first page as it will print, scaled down to fit the dialog */
const Preview: React.FC<{ html: string; layout: LabelLayout; pages: number }> = ({ html, layout, pages }) => {
  const widthPx = layout.pageWidthMm / MM_PER_PX;
  const heightPx = layout.pageHeightMm / MM_PER_PX;
  const scale = Math.min(280 / widthPx, 220 / heightPx, 1.8);
  return (
    <figure className="flex flex-col items-center gap-2">
      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200" style={{ width: widthPx * scale, height: heightPx * scale }}>
        <iframe
          title="The first page as it will print"
          srcDoc={html}
          sandbox=""
          tabIndex={-1}
          className="pointer-events-none origin-top-left border-0 bg-white"
          style={{ width: widthPx, height: heightPx, transform: `scale(${scale})` }}
        />
      </div>
      <figcaption className="text-xs text-gray-500">{pages > 1 ? `Page 1 of ${pages}` : 'Preview'}</figcaption>
    </figure>
  );
};

/**
 * L14 / O9: the one label printer. Choose an A4 label sheet or a label printer, where to start on a part-used sheet
 * and how many copies; the labels print in a new window. Used by Stock (barcode and shelf labels), optometry (frame
 * tags) and Messages > Lists (mailing labels).
 */
export const LabelPrintSheet: React.FC<LabelPrintSheetProps> = ({ open, onClose, title, subtitle, labels, purpose, look = 'cyan', children }) => {
  const style = LOOKS[look];
  const id = useId();
  const options = useMemo(() => layoutsFor(purpose), [purpose]);
  const [layoutId, setLayoutId] = useState<string>(() => rememberedLayout(purpose));
  const layout = layoutById(layoutId) ?? options[0];
  const [startText, setStartText] = useState('1');
  const [copiesText, setCopiesText] = useState('1');
  const [offset, setOffset] = useState(() => rememberedOffset(layout.id));
  const [offsetText, setOffsetText] = useState(() => ({ x: String(offset.xMm), y: String(offset.yMm) }));
  const [outlines, setOutlines] = useState(false);

  // A screen that switches what it prints (barcode or shelf labels) gets that purpose's sheet and its lining up
  const shownPurpose = useRef(purpose);
  useEffect(() => {
    if (shownPurpose.current === purpose) return;
    shownPurpose.current = purpose;
    const next = rememberedLayout(purpose);
    const saved = rememberedOffset(next);
    setLayoutId(next);
    setOffset(saved);
    setOffsetText({ x: String(saved.xMm), y: String(saved.yMm) });
  }, [purpose]);

  const perPage = labelsPerPage(layout);
  const startAt = layout.kind === 'sheet' ? numberIn(startText, 1, perPage) : 1;
  const copies = numberIn(copiesText, 1, 100);
  const xMm = numberIn(offsetText.x, -15, 15);
  const yMm = numberIn(offsetText.y, -15, 15);
  const problem = startAt === null || !Number.isInteger(startAt)
    ? `Start at a label from 1 to ${perPage}.`
    : copies === null || !Number.isInteger(copies)
      ? 'Copies: a whole number from 1 to 100.'
      : xMm === null || yMm === null
        ? 'Move the print by -15 to 15 mm.'
        : null;

  const sheetOptions = useMemo(() => ({
    layout,
    labels: labels ?? [],
    startAt: startAt ?? 1,
    copies: copies ?? 1,
    outlines,
    offset: { xMm: xMm ?? 0, yMm: yMm ?? 0 },
    title
  }), [layout, labels, startAt, copies, outlines, xMm, yMm, title]);
  const plan = useMemo(() => planLabelSheet(sheetOptions), [sheetOptions]);
  const previewHtml = useMemo(() => (labels && labels.length > 0 ? labelSheetHtml({ ...sheetOptions, labels: labels.slice(0, perPage) }) : ''), [sheetOptions, labels, perPage]);

  const chooseLayout = (next: string) => {
    setLayoutId(next);
    remember(current => ({ ...current, layouts: { ...current.layouts, [purpose]: next } }));
    const saved = rememberedOffset(next);
    setOffset(saved);
    setOffsetText({ x: String(saved.xMm), y: String(saved.yMm) });
  };

  const print = () => {
    if (problem || !labels || labels.length === 0) {
      if (problem) toast.error(problem);
      return;
    }
    if (xMm !== offset.xMm || yMm !== offset.yMm) {
      const chosen = { xMm: xMm ?? 0, yMm: yMm ?? 0 };
      setOffset(chosen);
      remember(current => ({ ...current, offsets: { ...current.offsets, [layout.id]: chosen } }));
    }
    if (!printLabels(sheetOptions)) toast.error('The print window was blocked. Allow pop-ups for this site and try again.');
  };

  const sheets = options.filter(option => option.kind === 'sheet');
  const rolls = options.filter(option => option.kind === 'roll');
  const count = labels?.length ?? 0;

  return (
    <ListSheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={style.secondary}>Close</button>
          <button type="button" onClick={print} disabled={!labels || count === 0 || problem !== null} className={style.primary}>
            <Icon icon="solar:printer-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            {plan.labelCount > 0 ? `Print ${plural(plan.labelCount, 'label')}` : 'Print labels'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {children}
        {labels === null ? (
          <p className="text-sm text-gray-500" role="status">Preparing the labels…</p>
        ) : count === 0 ? (
          <p className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-700" role="status">There is nothing to print on a label.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-4">
              <div>
                <label htmlFor={`${id}-layout`} className={style.label}>Label sheet or printer</label>
                <select id={`${id}-layout`} value={layout.id} onChange={event => chooseLayout(event.target.value)} className={style.input} aria-describedby={`${id}-layout-hint`}>
                  <optgroup label="A4 label sheets">
                    {sheets.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </optgroup>
                  <optgroup label="Label printer (one label at a time)">
                    {rolls.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </optgroup>
                </select>
                <p id={`${id}-layout-hint`} className="mt-1 text-xs text-gray-500">{layout.hint}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {layout.kind === 'sheet' && (
                  <div>
                    <label htmlFor={`${id}-start`} className={style.label}>Start at label</label>
                    <input id={`${id}-start`} value={startText} onChange={event => setStartText(event.target.value)} inputMode="numeric" className={style.input}
                      aria-describedby={`${id}-start-hint`} aria-invalid={startAt === null ? true : undefined} />
                    <p id={`${id}-start-hint`} className="mt-1 text-xs text-gray-500">1 is the top left, counting across. Use up a part-used sheet.</p>
                  </div>
                )}
                <div>
                  <label htmlFor={`${id}-copies`} className={style.label}>Copies of each</label>
                  <input id={`${id}-copies`} value={copiesText} onChange={event => setCopiesText(event.target.value)} inputMode="numeric" className={style.input}
                    aria-invalid={copies === null ? true : undefined} />
                </div>
              </div>
              <details className="rounded-xl border border-gray-200 px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium text-gray-700">Line up the printing</summary>
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={`${id}-x`} className={style.label}>Move right (mm)</label>
                      <input id={`${id}-x`} value={offsetText.x} onChange={event => setOffsetText(current => ({ ...current, x: event.target.value }))} inputMode="decimal" className={style.input} />
                    </div>
                    <div>
                      <label htmlFor={`${id}-y`} className={style.label}>Move down (mm)</label>
                      <input id={`${id}-y`} value={offsetText.y} onChange={event => setOffsetText(current => ({ ...current, y: event.target.value }))} inputMode="decimal" className={style.input} />
                    </div>
                  </div>
                  <label className="flex items-start gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={outlines} onChange={event => setOutlines(event.target.checked)} className={`mt-0.5 h-4 w-4 rounded border-gray-300 ${style.accent}`} />
                    <span>Print the outline of each label, to test on plain paper held against a sheet</span>
                  </label>
                  <p className="text-xs text-gray-500">The move is remembered for this sheet on this computer. Use minus to move left or up.</p>
                </div>
              </details>
              <p className="text-sm text-gray-700" aria-live="polite">
                {plural(plan.labelCount, 'label')} on {plural(plan.pageCount, layout.kind === 'sheet' ? 'sheet' : 'page')}
                {plan.skipped > 0 ? `, starting at label ${plan.skipped + 1}` : ''}.
              </p>
              {plan.tooLong > 0 && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
                  {plural(plan.tooLong, 'barcode')} {plan.tooLong === 1 ? 'is' : 'are'} too long for this label to scan well. Choose a wider label.
                </p>
              )}
              {plan.unencodable > 0 && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
                  {plural(plan.unencodable, 'code')} cannot be a barcode (unusual characters): {plan.unencodable === 1 ? 'it prints' : 'they print'} as text.
                </p>
              )}
            </div>
            {previewHtml && <Preview html={previewHtml} layout={layout} pages={plan.pageCount} />}
          </div>
        )}
      </div>
    </ListSheet>
  );
};

export default LabelPrintSheet;
