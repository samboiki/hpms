import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { EmptyState, ErrorState, FilterPill, LoadingState, SegmentedTabs } from '../../finance/FinanceUI';
import { SECTION_COLORS } from '../../../config/sectionColors';
import { INPUT, LABEL, PRIMARY, QUIET, errorText } from '../../stock/stockUi';
import { FundMoveHistoryList } from './FundMoveHistoryList';
import {
  FundMovesNotSetUpError,
  applyFundMove,
  loadFundMembers,
  loadFundMoves,
  loadFundOptions,
  loadFundProviders,
  type FundMoveRecord
} from '../../../services/fundMoveService';
import {
  MEMBER_SCOPE_LABELS,
  OPTION_NOT_RECORDED,
  describeChoice,
  describeFundMoveResult,
  fundMovePayload,
  fundMoveProblem,
  groupFunds,
  patientsToMove,
  type FundMemberRow,
  type FundMoveTarget,
  type FundProvider,
  type MemberScope
} from '../../../utils/accounts/fundMoves';
import { isMainMemberRelationship } from '../../../utils/patients/medicalAidMember';

type View = 'move' | 'moves';

const CARD = 'rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5';
const STEP = 'mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900';
const SCOPES = Object.keys(MEMBER_SCOPE_LABELS) as MemberScope[];

interface Props {
  practiceId: string;
  onClose: () => void;
  /** Patients' medical aids changed: the patient list reads them again */
  onPatientsChanged: () => void;
}

/**
 * Patients > More > Move to another fund, for practice administrators (parity A21): choose the fund and options the
 * patients are on now (with who: main members, dependants, a name), see who moves and untick anyone who should not,
 * choose the fund and option they move to, and say why. Each patient's change history keeps the reason. The database
 * moves only files still as the list showed them and never touches claims already sent; claims not sent yet go to the
 * new fund's batch.
 */
export const FundMoveDialog: React.FC<Props> = ({ practiceId, onClose, onPatientsChanged }) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>('move');
  const [rows, setRows] = useState<FundMemberRow[] | null>(null);
  const [providers, setProviders] = useState<FundProvider[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [moves, setMoves] = useState<FundMoveRecord[] | null>(null);
  const [movesError, setMovesError] = useState<string | null>(null);
  const [notSetUp, setNotSetUp] = useState(false);

  // Who moves
  const [fundKey, setFundKey] = useState('');
  const [optionKeys, setOptionKeys] = useState<string[]>([]);
  const [scope, setScope] = useState<MemberScope>('everyone');
  const [search, setSearch] = useState('');
  // Medical aid rows unticked in the list
  const [left, setLeft] = useState<Set<string>>(new Set());
  // Where to, and why
  const [targetProviderId, setTargetProviderId] = useState('');
  const [targetOption, setTargetOption] = useState('');
  const [targetOptions, setTargetOptions] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [moving, setMoving] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  // Escape and the backdrop do nothing while the move runs
  const busyRef = useRef(moving);
  useEffect(() => {
    busyRef.current = moving;
  }, [moving]);

  const loadPatients = useCallback(async () => {
    setLoadError(null);
    try {
      const [members, funds] = await Promise.all([loadFundMembers(practiceId), loadFundProviders()]);
      setRows(members);
      setProviders(funds);
    } catch (error) {
      setLoadError(errorText(error, "The patients' medical aids could not be read."));
    }
  }, [practiceId]);

  const loadMoves = useCallback(async () => {
    setMovesError(null);
    try {
      setMoves(await loadFundMoves(practiceId));
    } catch (error) {
      if (error instanceof FundMovesNotSetUpError) {
        setNotSetUp(true);
        setMoves([]);
      } else {
        setMovesError(errorText(error, 'The moves could not be read.'));
      }
    }
  }, [practiceId]);

  useEffect(() => {
    void loadPatients();
    void loadMoves();
  }, [loadPatients, loadMoves]);

  // The options of the fund they move to, as the patient forms offer them
  useEffect(() => {
    setTargetOptions([]);
    if (!targetProviderId) return;
    let active = true;
    loadFundOptions(targetProviderId)
      .then(options => {
        if (active) setTargetOptions(options);
      })
      .catch(error => console.warn("The fund's options were not loaded:", errorText(error, '')));
    return () => {
      active = false;
    };
  }, [targetProviderId]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || busyRef.current) return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previous?.focus();
    };
  }, [onClose]);

  const groups = useMemo(() => (rows && providers ? groupFunds(rows, providers) : []), [rows, providers]);
  const group = groups.find(item => item.key === fundKey) ?? null;
  const target = useMemo<FundMoveTarget | null>(
    () => (targetProviderId ? { providerId: targetProviderId, option: targetOption } : null),
    [targetProviderId, targetOption]
  );
  const candidates = useMemo(
    () => (rows && providers && fundKey ? patientsToMove(rows, providers, { fundKey, optionKeys, scope, search }, target) : []),
    [rows, providers, fundKey, optionKeys, scope, search, target]
  );
  const selected = candidates.filter(row => !left.has(row.medicalAidId));
  const problem = fundMoveProblem({ selected: selected.length, target, reason });
  const targetName = providers?.find(provider => provider.id === targetProviderId)?.name ?? '';

  const chooseFund = (key: string) => {
    setFundKey(key);
    setOptionKeys([]);
    setLeft(new Set());
    setConfirming(false);
  };
  const toggleOption = (key: string) => {
    setOptionKeys(current => (current.includes(key) ? current.filter(item => item !== key) : [...current, key]));
    setConfirming(false);
  };
  const toggleRow = (medicalAidId: string) => {
    setLeft(current => {
      const next = new Set(current);
      if (next.has(medicalAidId)) next.delete(medicalAidId);
      else next.add(medicalAidId);
      return next;
    });
    setConfirming(false);
  };

  const move = async () => {
    if (!group || !target || problem) return;
    setMoving(true);
    try {
      const result = await applyFundMove(practiceId, fundMovePayload(selected, target, reason, describeChoice(group, { optionKeys, scope })));
      const message = describeFundMoveResult(result);
      toast.success(message, { duration: 8000 });
      setLastResult(message);
      setConfirming(false);
      setReason('');
      setLeft(new Set());
      onPatientsChanged();
      void loadPatients();
      void loadMoves();
    } catch (error) {
      if (error instanceof FundMovesNotSetUpError) setNotSetUp(true);
      toast.error(errorText(error, 'The patients could not be moved.'));
    } finally {
      setMoving(false);
    }
  };

  const movePanel = loadError ? (
    <ErrorState title="The patients could not be read" message={loadError} onRetry={() => void loadPatients()} />
  ) : !rows || !providers ? (
    <LoadingState label="Reading the patients' medical aids" rows={3} />
  ) : groups.length === 0 ? (
    <EmptyState icon="solar:shield-check-bold-duotone" title="No patients with a medical aid" message="Patients with a medical aid on their file can be moved here." />
  ) : (
    <div className="space-y-4">
      {lastResult && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-900">
          {lastResult}
        </p>
      )}

      <section className={CARD} aria-labelledby={`${titleId}-from`}>
        <h3 id={`${titleId}-from`} className={STEP}>
          <Icon icon="solar:users-group-rounded-bold-duotone" className="h-5 w-5 text-cyan-600" aria-hidden="true" />
          1. Who moves
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor={`${titleId}-fund`} className={LABEL}>
              Patients on
            </label>
            <select id={`${titleId}-fund`} className={INPUT} value={fundKey} onChange={event => chooseFund(event.target.value)}>
              <option value="">Choose the fund they are on now</option>
              {groups.map(item => (
                <option key={item.key} value={item.key}>
                  {item.label} ({item.count})
                </option>
              ))}
            </select>
            {group && group.spellings.length > 1 && <p className="mt-1 text-xs text-gray-500">Written on the files as: {group.spellings.join(', ')}</p>}
          </div>
          <div>
            <label htmlFor={`${titleId}-scope`} className={LABEL}>
              Members
            </label>
            <select id={`${titleId}-scope`} className={INPUT} value={scope} onChange={event => setScope(event.target.value as MemberScope)}>
              {SCOPES.map(value => (
                <option key={value} value={value}>
                  {MEMBER_SCOPE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {group && (
          <>
            <fieldset className="mt-4">
              <legend className={LABEL}>Options (none chosen: every option)</legend>
              <div className="flex flex-wrap gap-2">
                {group.options.map(option => (
                  <FilterPill key={option.key || 'none'} active={optionKeys.includes(option.key)} onClick={() => toggleOption(option.key)} count={option.count}>
                    {option.label}
                  </FilterPill>
                ))}
              </div>
            </fieldset>
            <div className="mt-4 md:max-w-sm">
              <label htmlFor={`${titleId}-search`} className={LABEL}>
                Only names containing
              </label>
              <input id={`${titleId}-search`} type="search" className={INPUT} value={search} onChange={event => setSearch(event.target.value)} placeholder="Leave empty for everyone" />
            </div>
          </>
        )}
      </section>

      <section className={CARD} aria-labelledby={`${titleId}-to`}>
        <h3 id={`${titleId}-to`} className={STEP}>
          <Icon icon="solar:transfer-horizontal-bold-duotone" className="h-5 w-5 text-cyan-600" aria-hidden="true" />
          2. Where to
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor={`${titleId}-target`} className={LABEL}>
              Fund
            </label>
            <select
              id={`${titleId}-target`}
              className={INPUT}
              value={targetProviderId}
              onChange={event => {
                setTargetProviderId(event.target.value);
                setConfirming(false);
              }}
            >
              <option value="">Choose the fund they move to</option>
              {providers.map(provider => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${titleId}-option`} className={LABEL}>
              Option
            </label>
            <input
              id={`${titleId}-option`}
              className={INPUT}
              list={`${titleId}-options`}
              value={targetOption}
              maxLength={100}
              onChange={event => {
                setTargetOption(event.target.value);
                setConfirming(false);
              }}
              placeholder="Leave empty to keep each patient's option"
            />
            <datalist id={`${titleId}-options`}>
              {targetOptions.map(option => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor={`${titleId}-reason`} className={LABEL}>
            Why they move
          </label>
          <textarea
            id={`${titleId}-reason`}
            rows={2}
            maxLength={500}
            className={INPUT}
            value={reason}
            onChange={event => setReason(event.target.value)}
            placeholder="For example: the fund merged the Standard option into Plus from 1 January"
          />
          <p className="mt-1 text-xs text-gray-500">Kept in each patient's change history.</p>
        </div>
      </section>

      {group && (
        <section className={CARD} aria-labelledby={`${titleId}-list`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 id={`${titleId}-list`} className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Icon icon="solar:checklist-minimalistic-bold-duotone" className="h-5 w-5 text-cyan-600" aria-hidden="true" />
              3. Check the list ({selected.length} of {candidates.length} ticked)
            </h3>
            {candidates.length > 0 && (
              <div className="flex gap-1">
                <button type="button" className={QUIET} onClick={() => setLeft(new Set())}>
                  Tick all
                </button>
                <button type="button" className={QUIET} onClick={() => setLeft(new Set(candidates.map(row => row.medicalAidId)))}>
                  Untick all
                </button>
              </div>
            )}
          </div>
          {candidates.length === 0 ? (
            <p className="text-sm text-gray-600">Nobody matches this choice{target ? ' who is not already there' : ''}.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-xl ring-1 ring-gray-100">
              {candidates.map(row => (
                <li key={row.medicalAidId}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-gray-50">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 flex-none rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                      checked={!left.has(row.medicalAidId)}
                      onChange={() => toggleRow(row.medicalAidId)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-medium text-gray-900">{row.patientName}</span>
                      <span className="block break-words text-xs text-gray-500">
                        {row.planType.trim() || OPTION_NOT_RECORDED}
                        {isMainMemberRelationship(row.relationship) ? ' · main member' : row.relationship ? ' · dependant' : ''}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 space-y-2">
            {confirming && !problem ? (
              <div className="space-y-2 rounded-xl bg-amber-50 p-3">
                <p className="text-sm text-amber-900">
                  Move {selected.length} {selected.length === 1 ? 'patient' : 'patients'} from {describeChoice(group, { optionKeys, scope })} to {targetName}
                  {targetOption.trim() ? `, option ${targetOption.trim()}` : ''}? Claims already sent to a fund stay as they are; claims not sent yet go to
                  the new fund&apos;s batch.
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" className={QUIET} onClick={() => setConfirming(false)} disabled={moving}>
                    Not now
                  </button>
                  <button type="button" className={PRIMARY} onClick={() => void move()} disabled={moving}>
                    {moving ? 'Moving…' : `Move ${selected.length} ${selected.length === 1 ? 'patient' : 'patients'}`}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-3">
                {problem && <p className="text-sm text-gray-600">{problem}.</p>}
                <button type="button" className={PRIMARY} onClick={() => setConfirming(true)} disabled={!!problem || notSetUp}>
                  <Icon icon="solar:transfer-horizontal-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  Move {selected.length} {selected.length === 1 ? 'patient' : 'patients'}
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9000] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onMouseDown={() => {
        if (!busyRef.current) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={event => event.stopPropagation()}
        className="flex max-h-[100dvh] w-full flex-col rounded-t-2xl bg-gray-50 text-gray-900 shadow-xl focus:outline-none sm:max-h-[92vh] sm:max-w-5xl sm:rounded-2xl"
      >
        <div className="flex items-start gap-3 rounded-t-2xl border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
          <div className={`flex-none rounded-xl p-2.5 text-white ${SECTION_COLORS.patients.iconBox}`}>
            <Icon icon="solar:transfer-horizontal-bold-duotone" className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold leading-snug">
              Move to another fund
            </h2>
            <p className="text-sm text-gray-500">Move many patients to another fund or option in one step, when a fund merges or renames its options.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={moving}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50"
            aria-label="Close"
          >
            <Icon icon="solar:close-circle-bold-duotone" className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <div className="border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
          <SegmentedTabs<View>
            value={view}
            onChange={setView}
            ariaLabel="Fund moves"
            options={[
              { value: 'move', label: 'Move patients', icon: 'solar:transfer-horizontal-bold-duotone' },
              { value: 'moves', label: moves ? `Earlier moves (${moves.length})` : 'Earlier moves', icon: 'solar:history-bold-duotone' }
            ]}
          />
        </div>

        <div role="tabpanel" aria-label={view === 'move' ? 'Move patients' : 'Earlier moves'} className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {notSetUp && (
            <p role="status" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Moving patients to another fund is not set up in this database yet. The list can be checked; the move can be made once it is.
            </p>
          )}
          {view === 'move' ? (
            movePanel
          ) : movesError ? (
            <ErrorState title="The moves could not be read" message={movesError} onRetry={() => void loadMoves()} />
          ) : !moves ? (
            <LoadingState label="Loading the moves" rows={2} />
          ) : (
            <FundMoveHistoryList records={moves} />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default FundMoveDialog;
