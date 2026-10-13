import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toothSummary, type ChartModel } from '../../utils/dental/chart';
import { DENTITION_LABELS, chartRows, isUpperTooth, toothName, type ChartRow, type Dentition } from '../../utils/dental/fdi';
import { nextTooth } from './chartNavigation';
import ToothGlyph from './ToothGlyph';

/** 'open': one tap opens the tooth (the Teeth view); 'select': taps choose teeth (billing, the tooth picker). */
export type ChartMode = 'open' | 'select';

export interface OdontogramProps {
  dentition: Dentition;
  model: ChartModel;
  mode: ChartMode;
  /** The open tooth, or the teeth chosen */
  selected: ReadonlySet<string>;
  onToothClick: (tooth: string) => void;
  /** Billing: the codes on this visit, per tooth */
  onVisit?: ReadonlyMap<string, readonly string[]>;
}

/** "Upper right" for 18: the side of the mouth, as toothName says it ("Upper right wisdom tooth"). */
const quadrantName = (tooth: string): string => toothName(tooth).split(' ').slice(0, 2).join(' ');

/**
 * The tooth chart, one component for the Teeth view, the visit's Billing tab and the tooth picker. It faces the
 * patient (their right on the left of the screen), upper teeth over lower teeth, numbered by FDI. Phones show one
 * quadrant per row, eight teeth wide; from 768 px the two quadrants of a jaw share a row. Milk teeth sit between the
 * permanent arches at the same tooth width. Every tooth is a button; the chart is one Tab stop and the arrow keys
 * move between teeth.
 */
const Odontogram: React.FC<OdontogramProps> = ({ dentition, model, mode, selected, onToothClick, onVisit }) => {
  const rows = useMemo(() => chartRows(dentition), [dentition]);
  const allTeeth = useMemo(() => rows.flatMap(row => row.teeth), [rows]);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const [active, setActive] = useState<string | null>(null);
  // The Tab stop: the tooth last moved to, else the first chosen tooth, else the first tooth
  const tabStop = active && allTeeth.includes(active) ? active : allTeeth.find(tooth => selected.has(tooth)) ?? allTeeth[0];

  useEffect(() => {
    if (active && !allTeeth.includes(active)) setActive(null);
  }, [active, allTeeth]);

  const move = (tooth: string, key: string) => {
    const next = nextTooth(rows, tooth, key);
    if (!next) return false;
    setActive(next);
    buttons.current.get(next)?.focus();
    return true;
  };

  const cell = (tooth: string) => (
    <ToothCell
      key={tooth}
      tooth={tooth}
      model={model}
      mode={mode}
      chosen={selected.has(tooth)}
      visitCodes={onVisit?.get(tooth) ?? []}
      tabbable={tooth === tabStop}
      register={element => {
        if (element) buttons.current.set(tooth, element);
        else buttons.current.delete(tooth);
      }}
      onClick={() => onToothClick(tooth)}
      onFocus={() => setActive(tooth)}
      onKey={key => move(tooth, key)}
    />
  );

  const upperRows = rows.filter(row => row.key === 'upper' || row.key === 'upper-milk');
  const lowerRows = rows.filter(row => row.key === 'lower' || row.key === 'lower-milk');
  return (
    <div className="mx-auto w-full max-w-4xl select-none" role="group" aria-label={`Tooth chart, ${DENTITION_LABELS[dentition].toLowerCase()} teeth`}>
      <div className="mb-1 hidden justify-between px-1 text-[11px] font-medium uppercase tracking-wide text-gray-400 md:flex" aria-hidden="true">
        <span>Patient's right</span>
        <span>Patient's left</span>
      </div>
      <div className="space-y-2">
        {upperRows.map(row => (
          <TeethRow key={row.key} row={row} cell={cell} />
        ))}
      </div>
      <div className="my-2 border-t border-dashed border-gray-300" aria-hidden="true" />
      <div className="space-y-2">
        {lowerRows.map(row => (
          <TeethRow key={row.key} row={row} cell={cell} />
        ))}
      </div>
    </div>
  );
};

const TeethRow: React.FC<{ row: ChartRow; cell: (tooth: string) => React.ReactNode }> = ({ row, cell }) => {
  const half = row.teeth.length / 2;
  const quadrants = [row.teeth.slice(0, half), row.teeth.slice(half)];
  return (
    // Milk teeth (5 per quadrant) take 5/8 of the width, so their teeth are as wide as the permanent ones
    <div role="group" aria-label={row.label} className={row.milk ? 'mx-auto w-[62.5%]' : 'w-full'}>
      <div className="grid grid-cols-1 gap-y-2 md:grid-cols-2 md:gap-y-0">
        {quadrants.map((teeth, index) => (
          // A line down the middle of the mouth between the two quadrants (side by side from 768 px)
          <div key={teeth[0]} className={index === 1 ? 'md:border-l md:border-gray-300' : ''}>
            <p className="mb-0.5 px-1 text-[11px] font-medium text-gray-500 md:hidden" aria-hidden="true">
              {quadrantName(teeth[0])}
              {row.milk ? ' (milk)' : ''}
            </p>
            <div className={`grid ${row.milk ? 'grid-cols-5' : 'grid-cols-8'}`}>{teeth.map(tooth => cell(tooth))}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface ToothCellProps {
  tooth: string;
  model: ChartModel;
  mode: ChartMode;
  chosen: boolean;
  visitCodes: readonly string[];
  tabbable: boolean;
  register: (element: HTMLButtonElement | null) => void;
  onClick: () => void;
  onFocus: () => void;
  /** True when the key moved the focus */
  onKey: (key: string) => boolean;
}

const ToothCell: React.FC<ToothCellProps> = ({ tooth, model, mode, chosen, visitCodes, tabbable, register, onClick, onFocus, onKey }) => {
  const record = model.teeth.get(tooth);
  const upper = isUpperTooth(tooth);
  const planned = (record?.plan.length ?? 0) > 0;
  const onThisVisit = visitCodes.length > 0 ? `; on this visit: ${visitCodes.join(', ')}` : '';
  const number = (
    <span className="flex h-5 items-center justify-center gap-0.5">
      <span
        className={`rounded-md px-1 text-xs font-semibold leading-5 tabular-nums ${
          chosen && mode === 'select' ? 'bg-cyan-700 text-white' : planned ? 'text-amber-800' : record?.missing ? 'text-gray-400' : 'text-gray-700'
        }`}
      >
        {tooth}
      </span>
      {visitCodes.length > 0 && (
        <span className="rounded-full bg-teal-700 px-1 text-[10px] font-semibold leading-4 text-white" aria-hidden="true">
          {visitCodes.length}
        </span>
      )}
    </span>
  );
  return (
    <div className="flex justify-center">
      <button
        ref={register}
        type="button"
        tabIndex={tabbable ? 0 : -1}
        onClick={onClick}
        onFocus={onFocus}
        onKeyDown={event => {
          if (onKey(event.key)) event.preventDefault();
        }}
        aria-label={`Tooth ${tooth}, ${toothName(tooth)}: ${toothSummary(record)}${onThisVisit}`}
        aria-pressed={mode === 'select' ? chosen : undefined}
        aria-haspopup={mode === 'open' ? 'dialog' : undefined}
        className={`relative flex w-full max-w-[60px] flex-col items-center gap-0.5 rounded-lg px-0.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 motion-reduce:transition-none ${
          chosen ? 'bg-cyan-50 ring-2 ring-inset ring-cyan-600' : 'hover:bg-gray-50'
        }`}
      >
        {upper && number}
        <ToothGlyph tooth={tooth} record={record} className="block h-auto w-full" />
        {!upper && number}
        {chosen && mode === 'select' && (
          // A tick as well as the ring, so a chosen tooth does not depend on colour (beside the root tips, which are narrow)
          <svg viewBox="0 0 16 16" className={`absolute right-0.5 h-3.5 w-3.5 ${upper ? 'top-6' : 'bottom-6'}`} aria-hidden="true" focusable="false">
            <circle cx={8} cy={8} r={7.5} fill="#0e7490" />
            <path d="M4.6 8.2l2.3 2.3 4.6-4.8" fill="none" stroke="#ffffff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </div>
  );
};

export default Odontogram;
