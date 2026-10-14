import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { refreshAfterSave } from '../../lib/queryClient';
import { checkInVisitor, checkOutVisitor, type AdmissionDetail, type WardBoard } from '../../services/inpatientService';
import { labelOf, VISIT_PURPOSES, visitorWarnings } from '../../utils/inpatient/inpatientRules';
import { Field } from '../stock/stockParts';
import { INPUT, PRIMARY, QUIET, SECONDARY, dayTime, errorText } from '../stock/stockUi';

const EMPTY = { visitor_name: '', relationship: '', contact_number: '', visitor_id_number: '', purpose: 'regular_visit', notes: '' };

/** Who is visiting now (sign out) and who came; visiting hours and the number at a time are warnings, never a refusal */
export const VisitorsPanel: React.FC<{ data: AdmissionDetail; board: WardBoard }> = ({ data, board }) => {
  const active = data.admission.admission_status === 'active';
  const [adding, setAdding] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof EMPTY, value: string) => setValues(current => ({ ...current, [key]: value }));
  const inNow = data.visitors.filter(visitor => !visitor.check_out_time);
  const wardId = data.allocations.find(allocation => allocation.is_current)?.ward_id;
  const ward = board.wards.find(item => item.id === wardId);
  const warnings = ward
    ? visitorWarnings({ visitingStart: ward.visiting_hours_start, visitingEnd: ward.visiting_hours_end, maxVisitors: ward.max_visitors_per_patient }, inNow.length)
    : [];

  const run = async (action: () => Promise<unknown>, done: string, after: () => void = () => undefined) => {
    setSaving(true);
    try {
      await action();
      await refreshAfterSave('inpatient');
      after();
      toast.success(done);
    } catch (error) {
      toast.error(errorText(error, 'Could not save.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {active && !adding && (
        <button type="button" onClick={() => setAdding(true)} className={PRIMARY}>
          <Icon icon="solar:login-2-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Sign a visitor in
        </button>
      )}
      {adding && (
        <form
          onSubmit={event => {
            event.preventDefault();
            void run(() => checkInVisitor(data.admission.id, values), `${values.visitor_name || 'Visitor'} signed in.`, () => {
              setValues(EMPTY);
              setAdding(false);
            });
          }}
          className="space-y-3 rounded-xl bg-gray-50 p-3"
          noValidate
          aria-label="Sign a visitor in"
        >
          {warnings.length > 0 && (
            <ul className="space-y-1 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">
              {warnings.map(warning => <li key={warning}>{warning}</li>)}
              <li className="text-xs">You can still sign them in (a caregiver or an emergency).</li>
            </ul>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name">
              {props => <input {...props} value={values.visitor_name} onChange={event => set('visitor_name', event.target.value)} className={INPUT} maxLength={120} autoFocus />}
            </Field>
            <Field label="Relationship">
              {props => <input {...props} value={values.relationship} onChange={event => set('relationship', event.target.value)} className={INPUT} maxLength={60} placeholder="e.g. Daughter" />}
            </Field>
            <Field label="Phone" hint="Optional">
              {props => <input {...props} type="tel" value={values.contact_number} onChange={event => set('contact_number', event.target.value)} className={INPUT} maxLength={30} />}
            </Field>
            <Field label="Why">
              {props => (
                <select {...props} value={values.purpose} onChange={event => set('purpose', event.target.value)} className={INPUT}>
                  {VISIT_PURPOSES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              )}
            </Field>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setAdding(false)} className={SECONDARY}>Cancel</button>
            <button type="submit" disabled={saving} className={PRIMARY}>Sign in</button>
          </div>
        </form>
      )}

      <section aria-label="Visiting now">
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Visiting now ({inNow.length})</h3>
        {inNow.length === 0 ? <p className="text-sm text-gray-500">Nobody.</p> : (
          <ul className="divide-y divide-gray-100">
            {inNow.map(visitor => (
              <li key={visitor.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="text-gray-900">
                  {visitor.visitor_name}{visitor.relationship ? ` (${visitor.relationship})` : ''}
                  <span className="text-gray-500"> · since {dayTime(visitor.check_in_time)}</span>
                </span>
                <button type="button" disabled={saving} onClick={() => void run(() => checkOutVisitor(visitor.id), `${visitor.visitor_name} signed out.`)} className={QUIET}>
                  <Icon icon="solar:logout-2-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.visitors.length > inNow.length && (
        <details className="rounded-xl bg-gray-50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">Earlier visitors ({data.visitors.length - inNow.length})</summary>
          <ul className="mt-2 space-y-1 text-sm text-gray-700">
            {data.visitors.filter(visitor => visitor.check_out_time).map(visitor => (
              <li key={visitor.id}>
                {visitor.visitor_name}{visitor.relationship ? ` (${visitor.relationship})` : ''}: {dayTime(visitor.check_in_time)} to {dayTime(visitor.check_out_time)}
                {visitor.purpose && visitor.purpose !== 'regular_visit' ? ` · ${labelOf(VISIT_PURPOSES, visitor.purpose)}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};
