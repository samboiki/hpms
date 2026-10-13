import React, { useEffect, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { patientListService, type PatientListRecord } from '../../services/patientListService';
import { validateRule, type BirthdayWindow, type SmartRule } from '../../utils/patientLists/listRules';
import { describeRule } from './listDisplay';
import { lookFor } from './listPresets';
import { CARD, INPUT, LABEL, PRIMARY_BUTTON, QUIET_BUTTON, SECONDARY_BUTTON } from './listStyles';

interface ListRuleEditorProps {
  list: PatientListRecord;
  /** Visit types seen in the practice's completed visits, for the recall rule */
  visitTypes: readonly string[];
  onSaved: (list: PatientListRecord) => void;
}

const WINDOWS: Array<{ value: BirthdayWindow; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' }
];

const NumberField: React.FC<{
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}> = ({ id, label, value, onChange, min, max, step = 1, suffix }) => (
  <div>
    <label htmlFor={id} className={LABEL}>
      {label}
    </label>
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : ''}
        onChange={(event) => onChange(event.target.value === '' ? Number.NaN : Number(event.target.value))}
        className={`${INPUT} w-28`}
      />
      {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
    </div>
  </div>
);

/** Tariff codes typed as "8159, 8161"; the typed text is kept so a trailing comma does not vanish while typing. */
const CodesField: React.FC<{ codes: readonly string[]; onChange: (codes: string[]) => void }> = ({ codes, onChange }) => {
  const [text, setText] = useState(codes.join(', '));
  return (
    <div>
      <label htmlFor="rule-codes" className={LABEL}>
        Tariff codes
      </label>
      <input
        id="rule-codes"
        type="text"
        inputMode="numeric"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          onChange(event.target.value.split(/[\s,;]+/).filter(Boolean));
        }}
        placeholder="8159, 8161"
        className={`${INPUT} w-full sm:w-64`}
      />
      <p className="mt-1 text-xs text-gray-500">Separate codes with commas, e.g. 8159 for scale and polish.</p>
    </div>
  );
};

const visitTypeLabel = (type: string): string => {
  const words = type.replace(/[-_]/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Shows what a smart list includes, and lets staff adjust the numbers (e.g. 6 -> 12 months). */
export const ListRuleEditor: React.FC<ListRuleEditorProps> = ({ list, visitTypes, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SmartRule | null>(list.rule);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(list.rule);
    setEditing(false);
  }, [list.id, list.rule]);

  if (list.ruleError || !list.rule || !draft) {
    return (
      <div className={`${CARD} flex items-start gap-2 p-4 text-sm text-red-700`} role="alert">
        <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p>
          This list&apos;s rule cannot be read ({list.ruleError ?? 'no rule'}), so it shows nobody. Delete the list and
          create it again.
        </p>
      </div>
    );
  }

  const look = lookFor(list.rule);
  const save = async () => {
    const validation = validateRule(draft);
    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }
    setSaving(true);
    try {
      const saved = await patientListService.updateList(list.id, { rule: validation.rule });
      onSaved(saved);
      toast.success('Rule saved. The list is updated straight away.');
      setEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'Could not save the rule.');
    } finally {
      setSaving(false);
    }
  };

  const set = (changes: Partial<Record<string, unknown>>) =>
    setDraft((previous) => (previous ? ({ ...previous, ...changes } as SmartRule) : previous));

  return (
    <section className={`${CARD} p-4 sm:p-5`} aria-label="Who is on this list">
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${look.tile}`}>
          <Icon icon={look.icon} className={`h-5 w-5 ${look.iconColor}`} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Fills itself with</p>
          <p className="text-sm text-gray-900">{describeRule(list.rule)}</p>
        </div>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className={QUIET_BUTTON}>
            <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Adjust
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
          {draft.type === 'birthday' && (
            <div className="inline-flex rounded-xl bg-gray-100 p-1" role="radiogroup" aria-label="Birthdays">
              {WINDOWS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={draft.window === option.value}
                  onClick={() => set({ window: option.value })}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                    draft.window === option.value ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          {(draft.type === 'recall_due' || draft.type === 'lapsed') && (
            <NumberField
              id="rule-months"
              label={draft.type === 'recall_due' ? 'No completed visit for' : 'Not seen for at least'}
              value={draft.months}
              onChange={(months) => set({ months })}
              min={1}
              max={60}
              suffix="months"
            />
          )}
          {draft.type === 'recall_due' && (
            <div>
              <p className={LABEL}>Visits that count as a check-up</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  aria-pressed={draft.visitTypes.length === 0}
                  onClick={() => set({ visitTypes: [] })}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
                    draft.visitTypes.length === 0 ? 'bg-purple-600 text-white ring-purple-600' : 'bg-white text-gray-700 ring-gray-200'
                  }`}
                >
                  Any visit
                </button>
                {visitTypes.map((type) => {
                  const active = draft.visitTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        set({
                          visitTypes: active ? draft.visitTypes.filter((item) => item !== type) : [...draft.visitTypes, type]
                        })
                      }
                      className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
                        active ? 'bg-purple-600 text-white ring-purple-600' : 'bg-white text-gray-700 ring-gray-200'
                      }`}
                    >
                      {visitTypeLabel(type)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {draft.type === 'recall_by_code' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CodesField codes={draft.codes} onChange={(codes) => set({ codes })} />
              <NumberField
                id="rule-code-months"
                label="Last had it at least"
                value={draft.months}
                onChange={(months) => set({ months })}
                min={1}
                max={60}
                suffix="months ago"
              />
            </div>
          )}
          {draft.type === 'outstanding_balance' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                id="rule-min-amount"
                label="Owes at least (N$)"
                value={draft.minAmount}
                onChange={(minAmount) => set({ minAmount })}
                min={0}
                max={1000000}
                step={0.01}
              />
              <NumberField
                id="rule-min-days"
                label="Unpaid for at least"
                value={draft.minDays}
                onChange={(minDays) => set({ minDays })}
                min={0}
                max={3650}
                suffix="days"
              />
            </div>
          )}
          {draft.type === 'missed_appointment' && (
            <NumberField
              id="rule-within-days"
              label="Missed in the last"
              value={draft.withinDays}
              onChange={(withinDays) => set({ withinDays })}
              min={1}
              max={365}
              suffix="days"
            />
          )}
          {draft.type === 'regular_follow_up' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                id="rule-every-days"
                label="Due when the last visit was"
                value={draft.everyDays}
                onChange={(everyDays) => set({ everyDays })}
                min={7}
                max={365}
                suffix="days ago or more"
              />
              <NumberField
                id="rule-min-visits"
                label="Regular means at least"
                value={draft.minVisitsInYear}
                onChange={(minVisitsInYear) => set({ minVisitsInYear })}
                min={1}
                max={52}
                suffix="visits a year"
              />
            </div>
          )}
          {draft.type === 'repeat_medicine_due' && (
            <NumberField
              id="rule-due-within-days"
              label="Repeat due within"
              value={draft.withinDays}
              onChange={(withinDays) => set({ withinDays })}
              min={0}
              max={60}
              suffix="days (0 = due today or overdue)"
            />
          )}
          {draft.type === 'contact_lenses_running_out' && (
            <NumberField
              id="rule-lenses-within-days"
              label="Lenses run out within"
              value={draft.withinDays}
              onChange={(withinDays) => set({ withinDays })}
              min={0}
              max={60}
              suffix="days (0 = today, or already out)"
            />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setDraft(list.rule);
                setEditing(false);
              }}
              className={SECONDARY_BUTTON}
            >
              Cancel
            </button>
            <button type="button" onClick={() => void save()} disabled={saving} className={PRIMARY_BUTTON}>
              {saving && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save rule
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default ListRuleEditor;
