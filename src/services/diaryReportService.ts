/**
 * Data for the diary report (src/utils/diary/diaryReport.ts has the rules): the period's bookings with
 * their lengths, blocked time, working hours and opening hours. Read only.
 */
import { loadDiaryBlocks, loadVisitsInRange } from './diaryService';
import { plainWords } from '../utils/plainErrors';
import { loadDiaryStatuses } from './diaryListsService';
import { loadDiarySettings, loadPracticeBusinessHours, loadWorkingHours } from './diarySettingsService';
import { resolveBookingLength } from '../utils/diary/bookingLength';
import { buildDiaryReport, reportOutcome, type PractitionerReportRow, type ReportBooking } from '../utils/diary/diaryReport';
import { countByDiaryStatus, type DiaryStatusCount } from '../utils/diary/diaryStatuses';
import { toDateKey } from '../utils/diary/diaryTime';
import { practiceHoursResolver } from '../utils/diary/nextFreeSlot';
import { visitDay } from '../utils/diary/visitOverlap';
import { practitionerHoursResolver } from '../utils/diary/workingHours';

export interface DiaryReport {
  from: string;
  to: string;
  rows: PractitionerReportRow[];
  /** Every booking of the period by id, for the lists the numbers open */
  bookingsById: Map<string, ReportBooking>;
  /** The practice's own statuses and the bookings of the period last given each ([] when it has none) */
  statusCounts: DiaryStatusCount[];
}

export type DiaryReportLoad = { state: 'ready'; report: DiaryReport } | { state: 'error'; message: string };

const patientName = (patient: { first_name: string | null; last_name: string | null } | null | undefined): string =>
  [patient?.first_name, patient?.last_name].filter(Boolean).join(' ').trim() || 'Patient without a name';

export async function loadDiaryReport(
  practiceId: string,
  from: string,
  to: string,
  practitioners: Array<{ id: string; name: string }>
): Promise<DiaryReportLoad> {
  try {
    const [visits, blocks, hours, settings, businessHours, statuses] = await Promise.all([
      loadVisitsInRange(practiceId, from, to),
      loadDiaryBlocks(practiceId, from, to),
      loadWorkingHours(practiceId),
      loadDiarySettings(practiceId),
      loadPracticeBusinessHours(practiceId),
      loadDiaryStatuses(practiceId)
    ]);
    const lengths = settings.settings.lengths;
    const bookings: ReportBooking[] = visits.map((visit) => ({
      id: visit.id,
      patientId: visit.patient_id,
      patientName: patientName(visit.patient),
      practitionerId: visit.doctor_id,
      date: visitDay(visit),
      time: (visit.scheduled_time || visit.visit_time || '').slice(0, 5) || null,
      outcome: reportOutcome(visit),
      minutes: resolveBookingLength(visit, lengths),
      statusId: visit.diary_status_id ?? null
    }));
    const practiceHours = practiceHoursResolver(businessHours);
    const rows = buildDiaryReport({
      bookings,
      practitioners,
      from,
      to,
      hoursFor: (practitionerId) => practitionerHoursResolver(hours.rows, practitionerId, practiceHours),
      blocks: blocks.state === 'ready' ? blocks.blocks : [],
      today: toDateKey(new Date())
    });
    const inPeriod = bookings.filter((booking) => booking.date >= from && booking.date <= to);
    return {
      state: 'ready',
      report: {
        from,
        to,
        rows,
        bookingsById: new Map(bookings.map((booking) => [booking.id, booking])),
        statusCounts: countByDiaryStatus(inPeriod, statuses.items)
      }
    };
  } catch (error) {
    return { state: 'error', message: error instanceof Error ? plainWords(error.message) : String(error) };
  }
}
