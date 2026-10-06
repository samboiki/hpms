import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  PERIOD_PRESET_LABELS,
  dateKeyFrom,
  type DateRange,
  type PeriodPreset,
  type PeriodRanges,
  type PeriodSelection
} from '../../services/ledgerService';
import { formatRangeLabel } from './financeFormat';

const PRESETS: Exclude<PeriodPreset, 'custom'>[] = ['this_month', 'last_month', 'last_3_months', 'last_12_months', 'this_year'];

interface PeriodSelectorProps {
  value: PeriodSelection;
  ranges: PeriodRanges;
  onChange: (selection: PeriodSelection) => void;
}

/** Reporting period: preset rows plus a custom range, with the comparison period spelled out */
export const PeriodSelector: React.FC<PeriodSelectorProps> = ({ value, ranges, onChange }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(ranges.current);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) setDraft(ranges.current);
    setOpen(!open);
  };

  const draftValid = !!dateKeyFrom(draft.startKey) && !!dateKeyFrom(draft.endKey);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:border-cyan-300 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
      >
        <Icon icon="solar:calendar-bold-duotone" className="w-4 h-4 text-cyan-600" aria-hidden="true" />
        <span className="font-medium">{PERIOD_PRESET_LABELS[value.preset]}</span>
        <span className="text-gray-500 hidden sm:inline">{formatRangeLabel(ranges.current)}</span>
        <Icon icon="solar:alt-arrow-down-bold-duotone" className="w-3 h-3 text-gray-500" aria-hidden="true" />
      </button>

      {open && (
        <div role="dialog" aria-label="Reporting period" className="absolute left-0 lg:left-auto lg:right-0 mt-2 w-[calc(100vw-2rem)] max-w-xs bg-white rounded-xl shadow-xl border border-gray-200 p-2 z-30">
          <ul className="space-y-0.5">
            {PRESETS.map(preset => {
              const selected = value.preset === preset;
              return (
                <li key={preset}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ preset });
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      selected ? 'bg-cyan-50 text-cyan-800 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {PERIOD_PRESET_LABELS[preset]}
                    {selected && <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 text-cyan-600" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-gray-100 mt-2 pt-3 px-2 pb-1">
            <p className="text-xs font-semibold text-gray-700 mb-2">Custom range</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-gray-500">
                From
                <input
                  type="date"
                  value={draft.startKey}
                  onChange={event => setDraft(prev => ({ ...prev, startKey: event.target.value }))}
                  className="mt-1 w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </label>
              <label className="text-xs text-gray-500">
                To
                <input
                  type="date"
                  value={draft.endKey}
                  onChange={event => setDraft(prev => ({ ...prev, endKey: event.target.value }))}
                  className="mt-1 w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={!draftValid}
              onClick={() => {
                onChange({ preset: 'custom', custom: draft });
                setOpen(false);
              }}
              className="mt-2 w-full px-3 py-2 text-sm font-medium bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply custom range
            </button>
            <p className="text-xs text-gray-500 mt-3">
              Compared with {formatRangeLabel(ranges.previous)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
