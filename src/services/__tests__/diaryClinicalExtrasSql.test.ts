import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VIDEO_LINK_MAX, VIDEO_LINK_MIN } from '../../utils/diary/videoBookings';
import { WAITING_DAYS_AHEAD_MAX, WAITING_NOTE_MAX } from '../../utils/diary/waitingList';
import { IMAGING_REPORT_COLUMNS } from '../imagingReportService';

const read = (name: string) => readFileSync(`proposals/${name}`, 'utf8');
const VIDEO = read('2026-10-13-video-bookings.sql');
const WAITING = read('2026-10-13-diary-waiting-list.sql');
const PREVISIT = read('2026-10-13-previsit-questionnaire.sql');
const IMAGING = read('2026-10-13-imaging-reports.sql');
const CONFIRMATIONS = read('2026-10-13-video-link-in-confirmations.sql');

/** The SQL that runs (between BEGIN; and ROLLBACK;), comments dropped, one statement per entry with single spaces */
const statements = (sql: string): string[] =>
  sql
    .slice(sql.indexOf('\nBEGIN;'), sql.lastIndexOf('ROLLBACK;'))
    .replace(/--.*$/gm, '')
    .split(';')
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

const grantsToAnon = (sql: string): string[] => statements(sql).filter((statement) => /^GRANT\b/.test(statement) && /\banon\b/.test(statement));

// Everything in this part of OneHealth is for signed-in staff, except the one function behind the patient's
// questionnaire link: anything else the public key could run would open patient data to anyone with the app's address
describe('what the public key may run', () => {
  it('is nothing in the video, waiting list, imaging and confirmation updates', () => {
    for (const sql of [VIDEO, WAITING, IMAGING, CONFIRMATIONS]) expect(grantsToAnon(sql)).toEqual([]);
  });

  it('is only the questionnaire link function in the questionnaire update', () => {
    expect(grantsToAnon(PREVISIT)).toEqual(['GRANT EXECUTE ON FUNCTION public.previsit_questionnaire(text, jsonb) TO anon, authenticated, service_role']);
  });

  it('is taken away explicitly from every function staff call, since Postgres grants new functions to everyone', () => {
    expect(statements(WAITING)).toContain(
      'REVOKE ALL ON FUNCTION public.save_waiting_list_entry(uuid, jsonb), public.record_waiting_list_offer(uuid, date, time, uuid), public.close_waiting_list_entry(uuid, text, uuid) FROM PUBLIC, anon'
    );
    expect(statements(PREVISIT)).toContain(
      'REVOKE ALL ON FUNCTION public.save_previsit_questionnaire(uuid, text, jsonb), public.create_previsit_link(uuid), public.save_previsit_answers(uuid, jsonb) FROM PUBLIC, anon'
    );
    expect(statements(IMAGING)).toContain('REVOKE ALL ON FUNCTION public.save_imaging_report(uuid, text, text, date) FROM PUBLIC, anon');
  });
});

// Staff write the waiting list and the questionnaires only through the functions, which check the practice and the
// rules; a direct write would skip both
describe('the new tables', () => {
  it('let signed-in staff read and never write directly, and keep patient-app logins out', () => {
    expect(statements(WAITING)).toEqual(expect.arrayContaining([
      'ALTER TABLE public.diary_waiting_list ENABLE ROW LEVEL SECURITY',
      'REVOKE ALL ON public.diary_waiting_list FROM PUBLIC, anon, authenticated',
      'GRANT SELECT ON public.diary_waiting_list TO authenticated'
    ]));
    expect(WAITING).toMatch(/CREATE POLICY portal_staff_only ON public\.diary_waiting_list AS RESTRICTIVE FOR ALL TO authenticated/);
    expect(statements(PREVISIT)).toEqual(expect.arrayContaining([
      'REVOKE ALL ON public.previsit_questionnaires, public.previsit_answers, public.previsit_links FROM PUBLIC, anon, authenticated',
      'GRANT SELECT ON public.previsit_questionnaires, public.previsit_answers, public.previsit_links TO authenticated'
    ]));
  });

  it('leave the policies of the existing tables they extend as they were', () => {
    expect(VIDEO).not.toMatch(/(CREATE|DROP|ALTER) POLICY/);
    expect(IMAGING).not.toMatch(/(CREATE|DROP|ALTER) POLICY/);
    expect(CONFIRMATIONS).not.toMatch(/(CREATE|DROP|ALTER) POLICY/);
  });
});

// The screen checks first so staff see why; the database checks again. The limits must be the same in both
describe('the limits on the screen are the database limits', () => {
  it('for a video booking\'s room link', () => {
    expect(VIDEO).toContain(`char_length(video_link) BETWEEN ${VIDEO_LINK_MIN} AND ${VIDEO_LINK_MAX}`);
    expect(VIDEO).toContain("video_link ~ '^https://");
  });

  it('for the waiting list note and how far ahead a patient can wait', () => {
    expect(WAITING).toContain(`char_length(v_note) > ${WAITING_NOTE_MAX}`);
    expect(WAITING).toContain(`v_until > v_today + ${WAITING_DAYS_AHEAD_MAX}`);
  });

  it('for the report columns the Imaging tabs read', () => {
    for (const column of IMAGING_REPORT_COLUMNS.split(', ').filter((name) => !['report_text', 'radiologist_name'].includes(name))) {
      expect(IMAGING).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
  });
});
