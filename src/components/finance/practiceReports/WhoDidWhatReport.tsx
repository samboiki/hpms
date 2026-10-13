import React, { useEffect, useMemo, useState } from 'react';
import type { PeriodLabels } from '../financeNav';
import { Field, inputClass } from '../receipts/ArUi';
import { STAFF_ROLE_LABELS } from '../../settings/UserManagement/staffUtils';
import { AREA_LABELS, activityEntries, activityTable, type ActivityArea } from './userActivity';
import { loadUserActivity } from './practiceReportsService';
import { ReportFrame } from './ReportFrame';
import { useReportOpener } from './ReportOpener';
import { useReportLoad } from './useReportLoad';

interface Props {
  practiceId: string;
  practiceName: string;
  labels: PeriodLabels;
  staff: ReadonlyArray<{ id: string; name: string; role: string | null; active: boolean }>;
  staffNames: Record<string, string>;
  /** Report names by their download key, for the downloads in the list */
  reportNames: Readonly<Record<string, string>>;
}

const AREAS = Object.keys(AREA_LABELS) as ActivityArea[];

/**
 * Who did what (parity R17, Q8): one staff member's postings and changes over the period, for the practice's
 * administrators (the database refuses anyone else). Its notes say what is not recorded anywhere (NOT_RECORDED).
 */
export const WhoDidWhatReport: React.FC<Props> = ({ practiceId, practiceName, labels, staff, staffNames, reportNames }) => {
  const range = labels.ranges.current;
  const people = useMemo(() => [...staff].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)), [staff]);
  const [userId, setUserId] = useState('');
  const [area, setArea] = useState<ActivityArea | ''>('');
  useEffect(() => {
    if (!userId && people[0]) setUserId(people[0].id);
  }, [people, userId]);

  const { status, data, retry } = useReportLoad(
    userId ? () => loadUserActivity(practiceId, userId, range) : null,
    `${practiceId}|${userId}|${range.startKey}|${range.endKey}`,
    'Who did what is not set up in this database yet (proposals/2026-10-12-who-did-what.sql).'
  );
  const { open, element } = useReportOpener({ practiceId, practiceName, patientNames: data?.patientNames ?? {}, onChanged: retry });

  const entries = useMemo(() => activityEntries(data?.rows ?? [], reportNames, staffNames), [data, reportNames, staffNames]);
  const person = staffNames[userId] ?? 'Staff member';
  const report = useMemo(
    () => (data ? activityTable(area ? entries.filter(entry => entry.area === area) : entries, person, labels.current, data.patientNames) : null),
    [data, entries, area, person, labels]
  );

  return (
    <>
      <ReportFrame
        title="Who did what"
        subtitle={`One person's postings and changes, ${labels.current}`}
        icon="solar:user-check-bold-duotone"
        tone="violet"
        exportKey="who_did_what"
        practiceId={practiceId}
        practiceName={practiceName}
        range={range}
        exportFilters={{ user: userId || null, area: area || null }}
        status={userId ? status : { state: 'ready' }}
        onRetry={retry}
        report={userId ? report : null}
        empty={{ title: 'Nothing recorded for this person in the period', hint: 'Invoices, payments, adjustments, patient-file changes, claims, cash-ups, downloads, files opened or exported and sign-ins appear here.' }}
        onOpen={open}
        resetKey={`${userId}|${area}`}
        controls={
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Who" htmlFor="who-did-what-person">
              <select id="who-did-what-person" className={inputClass} value={userId} onChange={event => setUserId(event.target.value)}>
                {people.map(member => (
                  <option key={member.id} value={member.id}>
                    {`${member.name}${member.role ? ` (${STAFF_ROLE_LABELS[member.role] ?? member.role})` : ''}${member.active ? '' : ', no longer active'}`}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="What" htmlFor="who-did-what-area">
              <select id="who-did-what-area" className={inputClass} value={area} onChange={event => setArea(event.target.value as ActivityArea | '')}>
                <option value="">Everything</option>
                {AREAS.map(key => <option key={key} value={key}>{AREA_LABELS[key]}</option>)}
              </select>
            </Field>
          </div>
        }
      />
      {element}
    </>
  );
};
