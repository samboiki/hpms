import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import FormModal from '../../modals/FormModal';
import { DiaryNotEnabled } from './DiaryNotEnabled';
import {
  loadDiaryBlocks,
  loadPracticeBranches,
  removeDiaryBlock,
  saveDiaryBlock,
  type PracticeBranch
} from '../../../services/diaryService';
import {
  DIARY_BLOCK_REASON_MAX,
  describeDiaryBlock,
  validateDiaryBlockInput,
  type DiaryBlock,
  type DiaryBlockInput,
  type DiaryBlockRecurrence,
  type DiaryBlockScope
} from '../../../utils/diary/blockedTime';
import { addDaysToKey, formatDiaryDate, parseDateKey, toDateKey, weekdayOfKey } from '../../../utils/diary/diaryTime';

export interface BlockTimePractitioner {
  id: string;
  name: string;
}

interface BlockTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  practiceId: string | null;
  practitioners: BlockTimePractitioner[];
  /** The day the diary shows; the form starts there */
  defaultDate: Date;
  /** The practitioner the diary is filtered to, if any */
  defaultPractitionerId?: string | null;
  /** After a block is added or removed, so the diary shows it */
  onChanged: () => void;
}

const QUICK_REASONS = ['Leave', 'Lunch', 'Meeting', 'Training', 'Sick', 'Practice closed'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const INPUT_CLASS =
  'w-full px-4 py-2.5 bg-gray-100 border-0 rounded-lg text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors';
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 mb-1';

type ListState =
  | { state: 'loading' }
  | { state: 'ready'; blocks: DiaryBlock[] }
  | { state: 'not_enabled' }
  | { state: 'error'; message: string };

// The date field shows the browser's own format (often month first), so the day is also written out
const dayFirst = (key: string): string => {
  const date = parseDateKey(key);
  return date ? `${WEEKDAYS[date.getDay()]} ${formatDiaryDate(key)}` : '';
};

const scopeFromValue = (value: string): DiaryBlockScope => {
  if (value.startsWith('doctor:')) return { kind: 'doctor', doctorId: value.slice('doctor:'.length) };
  if (value.startsWith('branch:')) return { kind: 'branch', branchId: value.slice('branch:'.length) };
  return { kind: 'practice' };
};

/**
 * "Block time": mark a practitioner unavailable (leave, a meeting, lunch every weekday) or the
 * practice or a branch closed, and remove blocks. The diary greys blocked time and asks before a
 * booking is made in it.
 */
export const BlockTimeModal: React.FC<BlockTimeModalProps> = ({ isOpen, onClose, ...rest }) => (
  <FormModal isOpen={isOpen} onClose={onClose} title="Block time" icon="solar:forbidden-circle-bold-duotone" className="max-w-2xl">
    {/* FormModal renders its content only while open, so the form starts fresh every time */}
    <BlockTimeContent {...rest} />
  </FormModal>
);

const BlockTimeContent: React.FC<Omit<BlockTimeModalProps, 'isOpen' | 'onClose'>> = ({
  practiceId,
  practitioners,
  defaultDate,
  defaultPractitionerId,
  onChanged
}) => {
  const firstDay = toDateKey(defaultDate);
  const [scopeValue, setScopeValue] = useState<string>(() => {
    const preferred = practitioners.find((p) => p.id === defaultPractitionerId) ?? practitioners[0];
    return preferred ? `doctor:${preferred.id}` : 'practice';
  });
  const [reason, setReason] = useState('');
  const [recurrence, setRecurrence] = useState<DiaryBlockRecurrence>('none');
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(firstDay);
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState('13:00');
  const [endTime, setEndTime] = useState('14:00');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [branches, setBranches] = useState<PracticeBranch[]>([]);
  const [list, setList] = useState<ListState>({ state: 'loading' });
  const [version, setVersion] = useState(0);

  // Blocks from today for a year (repeating blocks without an end are always included)
  useEffect(() => {
    if (!practiceId) {
      setList({ state: 'error', message: "Your practice couldn't be identified. Reload the page and try again." });
      return;
    }
    let cancelled = false;
    const today = toDateKey(new Date());
    loadDiaryBlocks(practiceId, today, addDaysToKey(today, 365)).then((loaded) => {
      if (!cancelled) setList(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId, version]);

  useEffect(() => {
    if (!practiceId) return;
    let cancelled = false;
    loadPracticeBranches(practiceId).then((loaded) => {
      if (!cancelled) setBranches(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId]);

  const practitionerName = useCallback(
    (id: string | null) => (id ? practitioners.find((p) => p.id === id)?.name ?? null : null),
    [practitioners]
  );

  const changeRecurrence = (next: DiaryBlockRecurrence) => {
    setRecurrence(next);
    // A one-off block needs a last day; a repeating one runs on until a date is given
    if (next === 'none' && !endDate) setEndDate(startDate);
    if (next !== 'none' && endDate === startDate) setEndDate('');
  };

  const changeStartDate = (next: string) => {
    setStartDate(next);
    if (recurrence === 'none' && (!endDate || endDate < next)) setEndDate(next);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const input: DiaryBlockInput = {
      scope: scopeFromValue(scopeValue),
      reason,
      startDate,
      endDate: endDate || null,
      allDay,
      startTime: allDay ? null : startTime,
      endTime: allDay ? null : endTime,
      recurrence
    };
    const checked = validateDiaryBlockInput(input);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    if (!practiceId) {
      setErrors(["Your practice couldn't be identified. Reload the page and try again."]);
      return;
    }
    setSaving(true);
    const result = await saveDiaryBlock(practiceId, input);
    setSaving(false);
    if (!result.ok) {
      if (result.notEnabled) setList({ state: 'not_enabled' });
      setErrors([result.message]);
      return;
    }
    setErrors([]);
    setReason('');
    toast.success('Blocked time saved');
    setVersion((current) => current + 1);
    onChanged();
  };

  const handleRemove = async (block: DiaryBlock) => {
    const description = describeDiaryBlock(block, practitionerName(block.doctorId));
    const repeats = block.recurrence !== 'none' ? ' This removes every repeat.' : '';
    if (!window.confirm(`Remove this blocked time?\n\n${description}.${repeats}`)) return;
    setRemovingId(block.id);
    const result = await removeDiaryBlock(block.id);
    setRemovingId(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success('Blocked time removed');
    setVersion((current) => current + 1);
    onChanged();
  };

  if (list.state === 'not_enabled') return <DiaryNotEnabled />;

  const weekdayName = WEEKDAYS[weekdayOfKey(startDate)] ?? 'week';

  return (
    // flex/gap rather than space-y-6: a phone rule in index.css drops the modal's side padding
    // around a direct .space-y-6 child
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSave} noValidate className="space-y-4">
        <div>
          <label htmlFor="block-who" className={LABEL_CLASS}>Who is unavailable</label>
          <select id="block-who" value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} className={INPUT_CLASS}>
            {practitioners.map((practitioner) => (
              <option key={practitioner.id} value={`doctor:${practitioner.id}`}>
                {practitioner.name}
              </option>
            ))}
            {/* With one branch, "Whole practice" already says it */}
            {branches.length > 1 &&
              branches.map((branch) => (
                <option key={branch.id} value={`branch:${branch.id}`}>
                  {branch.name} branch closed
                </option>
              ))}
            <option value="practice">Whole practice closed</option>
          </select>
        </div>

        <div>
          <label htmlFor="block-reason" className={LABEL_CLASS}>Reason</label>
          <input
            id="block-reason"
            type="text"
            value={reason}
            maxLength={DIARY_BLOCK_REASON_MAX}
            onChange={(e) => setReason(e.target.value)}
            placeholder="For example: Annual leave"
            className={INPUT_CLASS}
          />
          <div className="mt-2 flex flex-wrap gap-2" aria-label="Common reasons">
            {QUICK_REASONS.map((quick) => (
              <button
                key={quick}
                type="button"
                aria-pressed={reason === quick}
                onClick={() => setReason(quick)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                  reason === quick
                    ? 'border-purple-300 bg-purple-50 text-purple-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {quick}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="block-repeat" className={LABEL_CLASS}>Repeat</label>
          <select
            id="block-repeat"
            value={recurrence}
            onChange={(e) => changeRecurrence(e.target.value as DiaryBlockRecurrence)}
            className={INPUT_CLASS}
          >
            <option value="none">Does not repeat</option>
            <option value="weekdays">Every weekday (Monday to Friday)</option>
            <option value="weekly">Every {weekdayName}</option>
            <option value="daily">Every day</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="block-start-date" className={LABEL_CLASS}>{recurrence === 'none' ? 'First day' : 'Starts on'}</label>
            <input id="block-start-date" type="date" value={startDate} onChange={(e) => changeStartDate(e.target.value)} className={INPUT_CLASS} />
            <p className="mt-1 text-xs text-gray-500">{dayFirst(startDate)}</p>
          </div>
          <div>
            <label htmlFor="block-end-date" className={LABEL_CLASS}>{recurrence === 'none' ? 'Last day' : 'Until (optional)'}</label>
            <input
              id="block-end-date"
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-xs text-gray-500">{endDate ? dayFirst(endDate) : 'No end date'}</p>
          </div>
        </div>

        <div>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            All day
          </label>
          {!allDay && (
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="block-start-time" className={LABEL_CLASS}>From</label>
                <input id="block-start-time" type="time" step={900} value={startTime} onChange={(e) => setStartTime(e.target.value)} className={INPUT_CLASS} />
              </div>
              <div>
                <label htmlFor="block-end-time" className={LABEL_CLASS}>To</label>
                <input id="block-end-time" type="time" step={900} value={endTime} onChange={(e) => setEndTime(e.target.value)} className={INPUT_CLASS} />
              </div>
            </div>
          )}
        </div>

        {errors.length > 0 && (
          <ul role="alert" className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errors.map((message) => (
              <li key={message} className="flex items-start gap-2">
                <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                <span className="min-w-0 break-words">{message}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg hover:from-purple-600 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
          >
            <Icon
              icon={saving ? 'solar:refresh-bold-duotone' : 'solar:forbidden-circle-bold-duotone'}
              className={`h-5 w-5 ${saving ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {saving ? 'Saving...' : 'Save blocked time'}
          </button>
        </div>
      </form>

      <section aria-labelledby="blocked-time-list" className="border-t border-gray-100 pt-4">
        <h3 id="blocked-time-list" className="text-sm font-semibold text-gray-900">Blocked time from today</h3>
        {list.state === 'loading' && <p className="mt-2 text-sm text-gray-500">Loading...</p>}
        {list.state === 'error' && <p className="mt-2 text-sm text-red-600">Could not load blocked time: {list.message}</p>}
        {list.state === 'ready' && list.blocks.length === 0 && <p className="mt-2 text-sm text-gray-500">Nothing is blocked.</p>}
        {list.state === 'ready' && list.blocks.length > 0 && (
          <ul className="mt-2 space-y-2">
            {list.blocks.map((block) => {
              const description = describeDiaryBlock(block, practitionerName(block.doctorId));
              return (
                <li key={block.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <span className="min-w-0 break-words text-sm text-gray-700">{description}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(block)}
                    disabled={removingId === block.id}
                    aria-label={`Remove: ${description}`}
                    title="Remove"
                    className="flex-none rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  >
                    <Icon icon="solar:trash-bin-trash-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

export default BlockTimeModal;
