import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { daysBetweenKeys, todayKey } from '../../../utils/billing/dates';
import { toCents } from '../../../utils/billing/money';
import { fundLabel } from '../../../utils/remittance/funds';
import { MedicalAidLogo } from '../../ui/MedicalAidLogo';
import { CATEGORY_LABELS, type ReasonCategory } from '../../../utils/remittance/reasonCodes';
import { EmptyState, ErrorState, FilterPill, LoadingState, SectionCard } from '../FinanceUI';
import { RejectionSheet } from './RejectionSheet';
import { loadRejections, type RejectionItem, type SetupState } from './remittanceService';
import { ACTION_ICONS, ACTION_LABELS, CATEGORY_TONE, Chip, formatDateKey, nad, REJECTION_STATUS_LABELS, REJECTION_STATUS_TONE } from './remittanceUi';

interface RejectionsSectionProps {
  practiceId: string;
  setup: SetupState;
  canApproveWriteOffs: boolean;
  /** Only this patient's items (a link from the patient file) */
  patientId?: string | null;
  onShowAllPatients?: () => void;
  /** An item was settled (written off, billed to the patient, resubmitted): Finance reloads its figures */
  onChanged?: () => void;
}

const cents = (value: number | string | null | undefined): number => toCents(Number(value ?? 0) || 0);

/**
 * The work queue of lines the funds did not pay: soonest deadline first, with the amount at stake,
 * the reason in plain English and what to do. Open an item to resubmit, bill the patient, write off
 * or wait.
 */
export const RejectionsSection: React.FC<RejectionsSectionProps> = ({ practiceId, setup, canApproveWriteOffs, patientId, onShowAllPatients, onChanged }) => {
  const [scope, setScope] = useState<'open' | 'done'>('open');
  const [items, setItems] = useState<RejectionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ReasonCategory | 'all'>('all');
  const [opened, setOpened] = useState<RejectionItem | null>(null);

  const load = useCallback(async () => {
    if (setup !== 'ready') return;
    setError(null);
    setItems(null);
    try {
      setItems(await loadRejections(practiceId, scope));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the rejection queue.');
    }
  }, [practiceId, scope, setup]);

  useEffect(() => {
    void load();
  }, [load]);

  const today = todayKey();
  const forPatient = useMemo(() => (items ?? []).filter(item => !patientId || item.patient_id === patientId), [items, patientId]);
  const counts = useMemo(() => {
    const map = new Map<ReasonCategory, number>();
    forPatient.forEach(item => map.set(item.category, (map.get(item.category) ?? 0) + 1));
    return [...map.entries()];
  }, [forPatient]);

  if (setup !== 'ready') {
    return <EmptyState icon="solar:danger-triangle-bold-duotone" title="The rejection queue is not set up yet" message="Rejected and pended lines are queued here once remittance import is set up in the database." />;
  }

  const visible = forPatient.filter(item => category === 'all' || item.category === category);
  const atStake = visible.reduce((sum, item) => sum + cents(item.at_stake), 0);

  return (
    <>
      <SectionCard
        title="Rejections"
        subtitle={scope === 'open' ? `${visible.length} to act on · ${nad(atStake)} at stake · soonest deadline first` : 'Resubmitted, billed, written off, paid later or closed'}
        icon="solar:danger-triangle-bold-duotone"
        tone="amber"
      >
        {patientId && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-900">
            <Icon icon="solar:user-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            <span>One patient{forPatient[0] ? `: ${forPatient[0].patientName}` : ''}</span>
            {onShowAllPatients && (
              <button type="button" onClick={onShowAllPatients} className="ml-auto font-medium text-cyan-700 hover:underline">
                Show all patients
              </button>
            )}
          </div>
        )}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <FilterPill active={scope === 'open'} onClick={() => { setScope('open'); setCategory('all'); }}>To do</FilterPill>
          <FilterPill active={scope === 'done'} onClick={() => { setScope('done'); setCategory('all'); }}>Done</FilterPill>
          <span className="mx-1 hidden h-4 w-px bg-gray-200 sm:inline-block" aria-hidden="true" />
          <FilterPill active={category === 'all'} onClick={() => setCategory('all')}>All reasons</FilterPill>
          {counts.map(([key, count]) => (
            <FilterPill key={key} active={category === key} onClick={() => setCategory(key)} count={count}>{CATEGORY_LABELS[key]}</FilterPill>
          ))}
        </div>
        {error ? (
          <ErrorState title="Could not load the rejection queue" message={error} onRetry={load} />
        ) : !items ? (
          <LoadingState label="Loading the rejection queue" rows={4} />
        ) : visible.length === 0 ? (
          <EmptyState compact icon="solar:check-circle-bold-duotone" title={scope === 'open' ? 'Nothing to act on' : 'Nothing done yet'} message="Lines a fund does not pay arrive here when a remittance or response is posted." />
        ) : (
          <ul className="space-y-2">
            {visible.map(item => {
              const deadline = item.resubmit_by && scope === 'open' ? daysBetweenKeys(today, item.resubmit_by) : null;
              const followUp = item.status === 'waiting' && item.follow_up_on ? item.follow_up_on : null;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setOpened(item)}
                    className="grid w-full grid-cols-1 gap-2 rounded-xl border border-gray-200 p-3 text-left hover:border-cyan-300 hover:bg-cyan-50/40 focus:outline-none focus:ring-2 focus:ring-cyan-500 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_auto] md:items-center md:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{item.patientName}</p>
                      <p className="flex min-w-0 items-center gap-1.5 text-xs text-gray-500">
                        <MedicalAidLogo name={item.fund_code} />
                        <span className="truncate">
                          {fundLabel(item.fund_code)} · {formatDateKey(item.service_date)} · code {item.tariff_code ?? '-'}{item.invoiceNumber ? ` · ${item.invoiceNumber}` : ''}
                        </span>
                      </p>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Chip tone={CATEGORY_TONE[item.category]}>{CATEGORY_LABELS[item.category]}</Chip>
                        {item.reason_codes.length > 0 && <span className="text-xs text-gray-500">{item.reason_codes.join('/')}</span>}
                        {item.needs_approval && <Chip tone="red" icon="solar:shield-user-bold-duotone">Needs admin or doctor</Chip>}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-sm text-gray-700">{item.plain_reason}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end">
                      <span className="font-semibold tabular-nums text-gray-900">{nad(cents(item.at_stake))}</span>
                      {scope === 'open' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                          <Icon icon={ACTION_ICONS[item.suggested_action]} className="h-4 w-4" aria-hidden="true" />
                          {ACTION_LABELS[item.suggested_action]}
                        </span>
                      ) : (
                        <Chip tone={REJECTION_STATUS_TONE[item.status]}>{REJECTION_STATUS_LABELS[item.status]}</Chip>
                      )}
                      {deadline !== null && (
                        <Chip tone={deadline < 0 ? 'red' : deadline <= 14 ? 'amber' : 'gray'} icon="solar:calendar-bold-duotone">
                          {deadline < 0 ? 'Deadline passed' : `${deadline} days to resubmit`}
                        </Chip>
                      )}
                      {followUp && <Chip tone="violet" icon="solar:hourglass-bold-duotone">Check {formatDateKey(followUp)}</Chip>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
      {opened && (
        <RejectionSheet
          item={opened}
          canApproveWriteOffs={canApproveWriteOffs}
          onClose={() => setOpened(null)}
          onChanged={() => {
            setOpened(null);
            void load();
            onChanged?.();
          }}
        />
      )}
    </>
  );
};
