import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { ListSheet } from '../patientLists/ListSheet';
import { EmptyState } from '../finance/FinanceUI';
import { refreshAfterSave } from '../../lib/queryClient';
import { setBedStatus } from '../../services/inpatientService';
import {
  boardCounts,
  boardState,
  canDo,
  canTakePatient,
  dayOfStay,
  labelOf,
  WARD_TYPES,
  type BoardState
} from '../../utils/inpatient/inpatientRules';
import { Chip } from '../stock/stockParts';
import { CARD, PRIMARY, SECONDARY, dayTime, errorText, nad } from '../stock/stockUi';
import { toCents } from '../../utils/billing/money';
import { patientName, rateOf, type BoardWard } from './inpatientData';

/** Each state's look on the board; the words are always shown, colour is never the only signal */
const STATE_LOOK: Record<BoardState, { label: string; tile: string; chip: 'green' | 'red' | 'amber' | 'gray' | 'violet'; icon: string }> = {
  free: { label: 'Free', tile: 'bg-emerald-50 hover:bg-emerald-100', chip: 'green', icon: 'solar:bed-bold-duotone' },
  occupied: { label: 'Occupied', tile: 'bg-rose-50 hover:bg-rose-100', chip: 'red', icon: 'solar:user-heart-bold-duotone' },
  cleaning: { label: 'Needs cleaning', tile: 'bg-amber-50 hover:bg-amber-100', chip: 'amber', icon: 'solar:broom-bold-duotone' },
  outOfUse: { label: 'Out of use', tile: 'bg-gray-100 hover:bg-gray-200', chip: 'gray', icon: 'solar:forbidden-circle-bold-duotone' },
  reserved: { label: 'Reserved', tile: 'bg-violet-50 hover:bg-violet-100', chip: 'violet', icon: 'solar:bookmark-bold-duotone' }
};

interface BedBoardTabProps {
  wards: BoardWard[];
  role: string | null;
  onOpenAdmission: (admissionId: string) => void;
  onAdmit: (bedId: string) => void;
  onSetUp?: () => void;
}

/** The live bed board: every ward with its beds, free, occupied, being cleaned or out of use */
export const BedBoardTab: React.FC<BedBoardTabProps> = ({ wards, role, onOpenAdmission, onAdmit, onSetUp }) => {
  const [picked, setPicked] = useState<{ ward: BoardWard; entry: BoardWard['beds'][number] } | null>(null);
  const shown = wards.filter(ward => ward.ward.is_active !== false);

  if (shown.length === 0) {
    return (
      <EmptyState
        icon="solar:bed-bold-duotone"
        title="No wards yet"
        message="An administrator adds the wards and their beds under Wards and beds; then the board shows who is where."
        action={onSetUp && <button type="button" onClick={onSetUp} className={PRIMARY}>Set up wards</button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      {shown.map(ward => {
        const counts = boardCounts(ward.beds.map(entry => entry.board));
        const beds = ward.beds.filter(entry => entry.bed.is_active !== false);
        return (
          <section key={ward.ward.id} className={`${CARD} p-3 sm:p-5`} aria-label={ward.ward.ward_name}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900">{ward.ward.ward_name}</h2>
                <p className="text-xs text-gray-500">
                  {[labelOf(WARD_TYPES, ward.ward.ward_type), ward.ward.floor_number !== null ? `Floor ${ward.ward.floor_number}` : '',
                    ward.ward.visiting_hours_start && ward.ward.visiting_hours_end
                      ? `Visiting ${ward.ward.visiting_hours_start.slice(0, 5)} to ${ward.ward.visiting_hours_end.slice(0, 5)}` : ''].filter(Boolean).join(' · ')}
                </p>
              </div>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{counts.free + counts.reserved}</span> free of {counts.total}
              </p>
            </div>
            {beds.length === 0 ? (
              <p className="text-sm text-gray-500">This ward has no beds yet.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                {beds.map(entry => {
                  const state = boardState(entry.board);
                  const look = STATE_LOOK[state];
                  return (
                    <li key={entry.bed.id}>
                      <button
                        type="button"
                        onClick={() => (entry.admission ? onOpenAdmission(entry.admission.id) : setPicked({ ward, entry }))}
                        className={`flex h-full w-full flex-col items-start gap-1 rounded-xl p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${look.tile}`}
                        aria-label={`Bed ${entry.bed.bed_number}: ${look.label}${entry.admission ? `, ${patientName(entry.admission)}` : ''}`}
                      >
                        <span className="flex w-full items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-gray-900">{entry.bed.bed_number}</span>
                          <Icon icon={look.icon} className="h-4 w-4 text-gray-500" aria-hidden="true" />
                        </span>
                        {entry.admission ? (
                          <>
                            <span className="w-full truncate text-sm text-gray-800">{patientName(entry.admission)}</span>
                            <span className="text-xs text-gray-500">Day {dayOfStay(entry.admission.admission_date)}</span>
                            {(entry.admission.fall_risk || entry.admission.isolation_required || entry.admission.allergy_alert) && (
                              <span className="flex flex-wrap gap-1">
                                {entry.admission.isolation_required && <Chip tone="red">Isolation</Chip>}
                                {entry.admission.fall_risk && <Chip tone="amber">Fall risk</Chip>}
                                {entry.admission.allergy_alert && <Chip tone="red">Allergy</Chip>}
                              </span>
                            )}
                          </>
                        ) : (
                          <Chip tone={look.chip}>{look.label}</Chip>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      {picked && (
        <BedSheet
          ward={picked.ward}
          entry={picked.entry}
          role={role}
          onClose={() => setPicked(null)}
          onAdmit={() => {
            const bedId = picked.entry.bed.id;
            setPicked(null);
            onAdmit(bedId);
          }}
        />
      )}
    </div>
  );
};

/** A bed nobody is in: admit into it, mark it clean, send it for cleaning, take it out of use or reserve it */
const BedSheet: React.FC<{
  ward: BoardWard;
  entry: BoardWard['beds'][number];
  role: string | null;
  onClose: () => void;
  onAdmit: () => void;
}> = ({ ward, entry, role, onClose, onAdmit }) => {
  const [saving, setSaving] = useState(false);
  const state = boardState(entry.board);
  const rate = rateOf(entry.bed);

  const change = async (status: string, done: string) => {
    setSaving(true);
    try {
      await setBedStatus(entry.bed.id, status);
      await refreshAfterSave('inpatient');
      toast.success(done);
      onClose();
    } catch (error) {
      toast.error(errorText(error, 'Could not change the bed.'));
    } finally {
      setSaving(false);
    }
  };

  const actions: Array<{ status: string; label: string; done: string; icon: string; show: boolean }> = [
    { status: 'available', label: state === 'cleaning' ? 'Cleaned: mark free' : 'Mark free', done: `Bed ${entry.bed.bed_number} is free.`,
      icon: 'solar:check-circle-bold-duotone', show: state !== 'free' },
    { status: 'cleaning', label: 'Needs cleaning', done: `Bed ${entry.bed.bed_number} needs cleaning.`, icon: 'solar:broom-bold-duotone', show: state !== 'cleaning' },
    { status: 'reserved', label: 'Reserve', done: `Bed ${entry.bed.bed_number} is reserved.`, icon: 'solar:bookmark-bold-duotone',
      show: state !== 'reserved' && canDo(role, 'bedOutOfUse') },
    { status: 'maintenance', label: 'Out of use', done: `Bed ${entry.bed.bed_number} is out of use.`, icon: 'solar:forbidden-circle-bold-duotone',
      show: state !== 'outOfUse' && canDo(role, 'bedOutOfUse') }
  ];

  return (
    <ListSheet
      open
      onClose={onClose}
      title={`Bed ${entry.bed.bed_number}`}
      subtitle={`${ward.ward.ward_name} · ${STATE_LOOK[state].label}`}
      dismissible={!saving}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={SECONDARY}>Close</button>
          {canTakePatient(entry.board) && canDo(role, 'admit') && (
            <button type="button" onClick={onAdmit} className={PRIMARY}>
              <Icon icon="solar:user-plus-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Admit to this bed
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-gray-500">Room</dt>
            <dd className="text-gray-900">{entry.bed.room_number || '-'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Daily rate</dt>
            <dd className="text-gray-900">{rate === null ? 'Not set' : nad(toCents(rate))}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-gray-500">Last cleaned</dt>
            <dd className="text-gray-900">{entry.bed.last_cleaned_at ? dayTime(entry.bed.last_cleaned_at) : 'Not recorded'}</dd>
          </div>
        </dl>
        {state === 'occupied' && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This bed is marked occupied but no patient is recorded in it. Mark it free once you have checked the ward.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {actions.filter(action => action.show).map(action => (
            <button key={action.status} type="button" disabled={saving} onClick={() => void change(action.status, action.done)} className={SECONDARY}>
              <Icon icon={action.icon} className="h-4 w-4" aria-hidden="true" />
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </ListSheet>
  );
};
