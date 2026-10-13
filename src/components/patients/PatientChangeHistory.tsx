import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { SECTION_COLORS } from '../../config/sectionColors';
import { isMissingTableError } from '../../utils/diary/dbErrors';
import { isStaffAdmin } from '../settings/UserManagement/staffUtils';
import { EmptyState, ErrorState, FilterPill, LoadingState } from '../finance/FinanceUI';
import { SECONDARY } from '../stock/stockUi';
import { ICON_TONES, type TileTone } from '../ui/tileTones';
import { MedicalAidLogo } from '../ui/MedicalAidLogo';
import { formatAuditTime } from '../billing/invoiceAudit';
import { loadFundMoveReasons } from '../../services/fundMoveService';
import {
  AUDIT_LOG_COLUMNS,
  CHANGE_GROUPS,
  belongsToPatient,
  describeHistory,
  describeWho,
  earlierLookups,
  patientHistoryFilter,
  peopleIn,
  staffNames,
  tableOfGroup,
  type AuditLogRow,
  type AuditValues,
  type ChangeEntry,
  type ChangeGroup,
  type EarlierLookup,
  type StaffMember
} from './changeHistory';

interface PatientChangeHistoryProps {
  patientId: string;
  /** Opens one of this patient's visits in the visit screen */
  onOpenVisit?: (visitId: string) => void;
}

type GroupChoice = ChangeGroup | 'all';

type Load = { status: 'loading' } | { status: 'ready' } | { status: 'not_set_up' } | { status: 'error' };

/** What has been read so far for one filter */
interface History {
  /** The patient's visits now (a vitals reading belongs to the patient through them; only these can be opened) */
  visitIds: Set<string>;
  rows: AuditLogRow[];
  /** Where the next page starts */
  offset: number;
  hasMore: boolean;
  earlier: Map<string, AuditValues | null>;
  staff: Record<string, StaffMember>;
  /** People already looked up, found or not */
  asked: Set<string>;
  /** The reasons of moves of many patients to another fund, by fundMoveKey, and the medical aids already looked up */
  fundMoves: Map<string, string>;
  movesAsked: Set<string>;
}

const PAGE_SIZE = 50;
/** Pages read for one "Show more" when a page held only saves that changed nothing worth showing */
const MAX_PAGES = 4;

const EMPTY_TITLES: Record<GroupChoice, string> = {
  all: 'No changes recorded yet',
  patient: 'No changes to the patient file yet',
  visits: 'No visit changes yet',
  medicalAid: 'No medical aid changes yet',
  vitals: 'No vital signs recorded yet'
};

const KIND_TONES: Record<ChangeEntry['kind'], TileTone> = { added: 'green', changed: 'violet', removed: 'red' };
const KIND_HEADINGS: Record<ChangeEntry['kind'], string> = { added: 'What was recorded', changed: 'What changed', removed: 'What was removed' };
const GROUP_ICONS: Record<ChangeGroup, string> = Object.fromEntries(CHANGE_GROUPS.map(group => [group.key, group.icon])) as Record<ChangeGroup, string>;

const LINK_BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-cyan-700 hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500';

async function loadVisitIds(patientId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('visits').select('id').eq('patient_id', patientId).limit(1000);
  if (error) throw error;
  return new Set((data ?? []).map(visit => visit.id));
}

/** One page, newest first; one row more than a page says whether there is more */
async function loadPage(filter: string, group: GroupChoice, offset: number): Promise<{ rows: AuditLogRow[]; hasMore: boolean }> {
  let query = supabase.from('patient_audit_logs').select(AUDIT_LOG_COLUMNS).or(filter);
  if (group !== 'all') query = query.eq('table_name', tableOfGroup(group));
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + PAGE_SIZE);
  if (error) throw error;
  const rows = (data ?? []) as unknown as AuditLogRow[];
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}

/** Each record's last entry before a change, from this patient's own history only */
async function loadEarlier(filter: string, lookups: readonly EarlierLookup[], patientId: string, visitIds: ReadonlySet<string>) {
  return Promise.all(
    lookups.map(async lookup => {
      const { data, error } = await supabase
        .from('patient_audit_logs')
        .select(AUDIT_LOG_COLUMNS)
        .or(filter)
        .eq('table_name', lookup.table)
        .eq('record_id', lookup.recordId)
        .lt('created_at', lookup.before)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const found = ((data ?? []) as unknown as AuditLogRow[])[0];
      const values = found && belongsToPatient(found, patientId, visitIds) ? found.new_values ?? found.old_values : null;
      return [lookup.key, values] as const;
    })
  );
}

async function loadStaff(ids: readonly string[]): Promise<Record<string, StaffMember>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase.from('users').select('id, full_name, role').in('id', [...ids]);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map(user => [user.id, { full_name: user.full_name, role: user.role }]));
}

/**
 * Reads the next page (the first when `base` is null) with what its entries need: each change's earlier values and
 * the names of the people in it. Reads on while a page shows nothing new, up to MAX_PAGES.
 */
async function readHistory(patientId: string, group: GroupChoice, base: History | null): Promise<History> {
  const visitIds = base?.visitIds ?? (await loadVisitIds(patientId));
  const filter = patientHistoryFilter(patientId, visitIds);
  if (!filter) throw new Error('This patient file has no valid id.');
  const earlier = new Map(base?.earlier ?? []);
  const asked = new Set(base?.asked ?? []);
  let staff = { ...(base?.staff ?? {}) };
  const fundMoves = new Map(base?.fundMoves ?? []);
  const movesAsked = new Set(base?.movesAsked ?? []);
  let rows = base?.rows ?? [];
  let offset = base?.offset ?? 0;
  let hasMore = true;
  const shownBefore = base ? describeHistory({ rows, patientId, visitIds, earlier }).length : 0;

  for (let page = 0; page < MAX_PAGES && hasMore; page += 1) {
    const result = await loadPage(filter, group, offset);
    offset += PAGE_SIZE;
    hasMore = result.hasMore;
    const seen = new Set(rows.map(row => row.id));
    rows = [...rows, ...result.rows.filter(row => !seen.has(row.id) && belongsToPatient(row, patientId, visitIds))];

    const lookups = earlierLookups(rows).filter(lookup => !earlier.has(lookup.key));
    for (const [key, values] of await loadEarlier(filter, lookups, patientId, visitIds)) earlier.set(key, values);
    const people = peopleIn(rows, earlier.values()).filter(person => !asked.has(person));
    people.forEach(person => asked.add(person));
    staff = { ...staff, ...(await loadStaff(people)) };
    // Medical aid changes made by moving many patients to another fund show the move's reason
    const aidIds = rows.filter(row => row.table_name === 'medical_aid_details' && row.action === 'UPDATE' && row.record_id && !movesAsked.has(row.record_id));
    if (aidIds.length > 0) {
      aidIds.forEach(row => movesAsked.add(row.record_id as string));
      try {
        for (const [key, reason] of await loadFundMoveReasons(aidIds.map(row => row.record_id as string))) fundMoves.set(key, reason);
      } catch (error) {
        // The history still shows; only the reasons of fund moves are missing
        console.error('Could not load the reasons of fund moves:', error);
      }
    }

    if (describeHistory({ rows, patientId, visitIds, earlier }).length > shownBefore) break;
  }
  return { visitIds, rows, offset, hasMore, earlier, staff, asked, fundMoves, movesAsked };
}

const failure = (error: unknown): Load => {
  if (isMissingTableError(error, 'patient_audit_logs')) return { status: 'not_set_up' };
  console.error('Could not load the change history:', error);
  return { status: 'error' };
};

interface ChangeRowProps {
  entry: ChangeEntry;
  who: string;
  open: boolean;
  onToggle: () => void;
  /** Set when the entry's visit is one of this patient's visits now */
  onOpenVisit?: () => void;
  /** The entry's visit is no longer one of this patient's visits (removed, or moved to another file) */
  visitGone: boolean;
}

const ChangeRow: React.FC<ChangeRowProps> = ({ entry, who, open, onToggle, onOpenVisit, visitGone }) => {
  const detailsId = useId();
  return (
    <li className="rounded-xl transition-colors hover:bg-gray-50 motion-reduce:transition-none">
      <div className="flex flex-col gap-1 p-2 sm:flex-row sm:items-start sm:gap-3 sm:p-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={detailsId}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          <span className={`mt-0.5 flex-none rounded-lg p-2 ${ICON_TONES[KIND_TONES[entry.kind]]}`}>
            <Icon icon={GROUP_ICONS[entry.group]} className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block break-words text-sm font-medium text-gray-900">{entry.title}</span>
            <span className="block text-xs text-gray-500">
              {who} · {formatAuditTime(entry.at)}
            </span>
          </span>
          <Icon
            icon="solar:alt-arrow-down-bold-duotone"
            className={`mt-1 h-4 w-4 flex-none text-gray-400 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        {onOpenVisit && (
          <button type="button" onClick={onOpenVisit} aria-label={`Open visit (${entry.title})`} className={`${LINK_BUTTON} ml-11 self-start sm:ml-0`}>
            <Icon icon="solar:document-text-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Open visit
          </button>
        )}
      </div>
      {open && (
        <div id={detailsId} className="mb-2 ml-2 mr-2 rounded-lg bg-gray-50 px-3 py-2 text-sm sm:ml-14 sm:mr-3">
          {entry.details.length > 0 && (
            <>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{KIND_HEADINGS[entry.kind]}</p>
              <dl className="space-y-1.5">
                {entry.details.map(detail => (
                  <div key={detail.label} className="grid gap-x-3 sm:grid-cols-[11rem_1fr]">
                    <dt className="text-gray-500">{detail.label}</dt>
                    <dd className="min-w-0 break-words text-gray-900">
                      {detail.before !== null && detail.after !== null ? (
                        <>
                          <span className="block">
                            <span className="text-gray-500">Before: </span>
                            <Value text={detail.before} fund={detail.fund} />
                          </span>
                          <span className="block">
                            <span className="text-gray-500">After: </span>
                            <Value text={detail.after} fund={detail.fund} />
                          </span>
                        </>
                      ) : (
                        <Value text={detail.after ?? detail.before ?? ''} fund={detail.fund} />
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          {entry.note && <p className="text-gray-600">{entry.note}</p>}
          {entry.reason && (
            <p className="mt-1 text-gray-600">
              <span className="text-gray-500">Moved with other patients to another fund. Reason: </span>
              {entry.reason}
            </p>
          )}
          {visitGone && (
            <p className="mt-1 text-gray-600">{entry.kind === 'removed' ? 'This visit was removed, so it cannot be opened.' : 'This visit is no longer in this file.'}</p>
          )}
        </div>
      )}
    </li>
  );
};

/** A value as written, a fund with its logo */
const Value: React.FC<{ text: string; fund?: boolean }> = ({ text, fund }) =>
  fund ? (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <MedicalAidLogo name={text} />
      {text}
    </span>
  ) : (
    <span className="whitespace-pre-wrap">{text}</span>
  );

/**
 * The patient file's Change history tab: who changed the file, its visits, vital signs and medical aid, and when,
 * newest first, 50 at a time. Practice administrators only (the audit_logs policy limits it to them too); a change's
 * values before and after are one tap away, never in the list.
 */
const PatientChangeHistory: React.FC<PatientChangeHistoryProps> = ({ patientId, onOpenVisit }) => {
  const canSee = isStaffAdmin(useAuthStore(state => state.user));
  const [group, setGroup] = useState<GroupChoice>('all');
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [history, setHistory] = useState<History | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());
  const [attempt, setAttempt] = useState(0);
  const request = useRef(0);

  useEffect(() => {
    if (!canSee) return;
    const id = ++request.current;
    setLoad({ status: 'loading' });
    setHistory(null);
    setOpenIds(new Set());
    setLoadingMore(false);
    setMoreFailed(false);
    readHistory(patientId, group, null)
      .then(result => {
        if (request.current !== id) return;
        setHistory(result);
        setLoad({ status: 'ready' });
      })
      .catch(error => {
        if (request.current === id) setLoad(failure(error));
      });
  }, [patientId, group, canSee, attempt]);

  const entries = useMemo(
    () =>
      history
        ? describeHistory({
            rows: history.rows,
            patientId,
            visitIds: history.visitIds,
            earlier: history.earlier,
            names: staffNames(history.staff),
            fundMoves: history.fundMoves
          })
        : [],
    [history, patientId]
  );

  if (!canSee) {
    return (
      <p className="flex items-center justify-center gap-2 py-10 text-center text-sm text-gray-600" role="note">
        <Icon icon="solar:lock-keyhole-minimalistic-bold-duotone" className="h-5 w-5 flex-none text-gray-400" aria-hidden="true" />
        The change history of a patient file is shown to practice administrators only.
      </p>
    );
  }

  const showMore = async () => {
    if (!history) return;
    const id = request.current;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const result = await readHistory(patientId, group, history);
      if (request.current === id) setHistory(result);
    } catch (error) {
      console.error('Could not load more of the change history:', error);
      if (request.current === id) setMoreFailed(true);
    } finally {
      if (request.current === id) setLoadingMore(false);
    }
  };

  const toggle = (entryId: string) =>
    setOpenIds(current => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });

  const groups: Array<{ key: GroupChoice; label: string; icon: string }> = [{ key: 'all', label: 'All', icon: 'solar:list-bold-duotone' }, ...CHANGE_GROUPS];

  return (
    <section aria-labelledby="change-history-title" className="space-y-4">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl text-white shadow-sm ${SECTION_COLORS.patients.iconBox}`}>
          <Icon icon="solar:history-bold-duotone" className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 id="change-history-title" className="text-lg font-semibold text-gray-900">
            Change history
          </h3>
          <p className="text-xs text-gray-500">Who changed this file, its visits, vital signs and medical aid, newest first. Tap a change to see the values.</p>
        </div>
      </div>

      <div role="group" aria-label="Show changes to" className="flex flex-wrap gap-2">
        {groups.map(choice => (
          <FilterPill key={choice.key} active={group === choice.key} onClick={() => setGroup(choice.key)} icon={choice.icon}>
            {choice.label}
          </FilterPill>
        ))}
      </div>

      {load.status === 'loading' && <LoadingState label="Loading the change history" rows={4} />}
      {load.status === 'not_set_up' && (
        <EmptyState icon="solar:history-bold-duotone" title="The change history is not set up yet" message="This database does not record changes to patient files yet." />
      )}
      {load.status === 'error' && (
        <ErrorState title="Could not load the change history" message="Check the connection and try again." onRetry={() => setAttempt(value => value + 1)} />
      )}

      {load.status === 'ready' && history && (
        <>
          {entries.length === 0 ? (
            history.hasMore ? (
              <EmptyState icon="solar:history-bold-duotone" title="Nothing changed in the latest saves" message="Show more to look further back." />
            ) : (
              <EmptyState icon="solar:history-bold-duotone" title={EMPTY_TITLES[group]} message="Changes appear here with who made them and when." />
            )
          ) : (
            <ul className="space-y-1" aria-label="Changes, newest first">
              {entries.map(entry => {
                const visitId = entry.visitId;
                const visitHere = visitId !== null && history.visitIds.has(visitId);
                return (
                  <ChangeRow
                    key={entry.id}
                    entry={entry}
                    who={describeWho(entry.userId, history.staff)}
                    open={openIds.has(entry.id)}
                    onToggle={() => toggle(entry.id)}
                    onOpenVisit={onOpenVisit && visitId && visitHere ? () => onOpenVisit(visitId) : undefined}
                    visitGone={visitId !== null && !visitHere}
                  />
                );
              })}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {history.hasMore && (
              <button type="button" className={SECONDARY} onClick={() => void showMore()} disabled={loadingMore} aria-busy={loadingMore}>
                <Icon icon="solar:alt-arrow-down-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                {loadingMore ? 'Loading...' : 'Show more'}
              </button>
            )}
            <p className="text-xs text-gray-500" aria-live="polite">
              {moreFailed
                ? 'Could not load more changes. Try again.'
                : entries.length > 0 && (history.hasMore ? `Showing the latest ${entries.length} changes.` : `Showing all ${entries.length} ${entries.length === 1 ? 'change' : 'changes'}.`)}
            </p>
          </div>
        </>
      )}
    </section>
  );
};

export default PatientChangeHistory;
