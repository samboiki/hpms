import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  canWriteImagingReport,
  checkImagingReport,
  describeImagingReport,
  IMAGING_REPORT_MAX,
  IMAGING_REPORT_ROLES,
  imagingLabelLines,
  imagingReportFromRow,
  imagingRequestReference,
  imagingTypeLabel,
  RADIOLOGIST_NAME_MAX
} from '../imagingReports';

const SQL = readFileSync('proposals/2026-10-13-imaging-reports.sql', 'utf8');
const TODAY = '2026-10-13';
const REQUEST = { requestDate: '2026-10-01', status: 'pending' };
const draft = (overrides: Partial<{ report: string; radiologist: string; reportedOn: string }> = {}) => ({
  report: 'No fracture seen. Soft tissues normal.',
  radiologist: 'Dr A Example',
  reportedOn: '2026-10-12',
  ...overrides
});

// The screen says why a report cannot be saved before save_imaging_report refuses it: the two must agree, or staff
// either see a refusal they were not warned about or are stopped for nothing
describe('the report checks on the screen are the database checks', () => {
  it('uses the same length limits and roles as save_imaging_report', () => {
    expect(SQL).toContain(`char_length(v_report) > ${IMAGING_REPORT_MAX}`);
    expect(SQL).toContain(`char_length(v_radiologist) > ${RADIOLOGIST_NAME_MAX}`);
    const roles = IMAGING_REPORT_ROLES.map((role) => `'${role}'`).join(', ');
    expect(SQL).toContain(`NOT IN (${roles})`);
  });

  it('accepts a report dated between the request and today', () => {
    expect(checkImagingReport(draft(), REQUEST, TODAY)).toEqual([]);
    expect(checkImagingReport(draft({ reportedOn: '2026-10-01' }), REQUEST, TODAY)).toEqual([]);
    expect(checkImagingReport(draft({ reportedOn: TODAY }), REQUEST, TODAY)).toEqual([]);
  });

  it('refuses an empty report, a report dated in the future or before the request, and a cancelled request', () => {
    expect(checkImagingReport(draft({ report: '   ' }), REQUEST, TODAY)).toEqual(['Write the report.']);
    expect(checkImagingReport(draft({ reportedOn: '2026-10-14' }), REQUEST, TODAY)).toEqual(['The report date cannot be in the future.']);
    expect(checkImagingReport(draft({ reportedOn: '2026-09-30' }), REQUEST, TODAY)).toEqual(['The report cannot be dated before the request.']);
    expect(checkImagingReport(draft(), { ...REQUEST, status: 'cancelled' }, TODAY)).toEqual(['This request was cancelled.']);
  });

  it('counts the report and the radiologist as the database keeps them (trimmed, spaces collapsed)', () => {
    expect(checkImagingReport(draft({ report: ` ${'x'.repeat(IMAGING_REPORT_MAX)} ` }), REQUEST, TODAY)).toEqual([]);
    expect(checkImagingReport(draft({ report: 'x'.repeat(IMAGING_REPORT_MAX + 1) }), REQUEST, TODAY)).toHaveLength(1);
    // 120 letters with runs of spaces between them: the database keeps single spaces, so it fits
    expect(checkImagingReport(draft({ radiologist: `${'a'.repeat(60)}     ${'b'.repeat(59)}` }), REQUEST, TODAY)).toEqual([]);
    expect(checkImagingReport(draft({ radiologist: 'a'.repeat(RADIOLOGIST_NAME_MAX + 1) }), REQUEST, TODAY)).toHaveLength(1);
  });

  it('lets practitioners, nurses and practice administrators report, never reception', () => {
    expect(['doctor', 'nurse', 'admin'].every(canWriteImagingReport)).toBe(true);
    expect(canWriteImagingReport('receptionist')).toBe(false);
    expect(canWriteImagingReport(undefined)).toBe(false);
  });
});

describe('a request\'s report as staff read it', () => {
  it('has no report while the text is blank, so an empty column never shows as "reported"', () => {
    expect(imagingReportFromRow({ report_text: '  ', radiologist_name: 'Dr A Example' })).toBeNull();
    expect(imagingReportFromRow({})).toBeNull();
  });

  it('dates a report typed before the update by the day the request was completed', () => {
    expect(imagingReportFromRow({ report_text: 'Normal study.', completed_date: '2026-10-05' })?.reportedOn).toBe('2026-10-05');
    expect(imagingReportFromRow({ report_text: 'Normal study.', reported_on: '2026-10-06', completed_date: '2026-10-05' })?.reportedOn).toBe('2026-10-06');
  });

  it('says whose report it is and from when', () => {
    const report = imagingReportFromRow({ report_text: 'Normal study.', radiologist_name: ' Dr A Example ', reported_on: '2026-10-12' });
    expect(report && describeImagingReport(report)).toBe('Report of 12 Oct 2026 by Dr A Example');
    const entered = imagingReportFromRow({ report_text: 'Normal study.', reported_on: '2026-10-12', reported_at: '2026-10-13T07:12:00Z' });
    expect(entered && describeImagingReport(entered)).toMatch(/^Report of 12 Oct 2026, entered 13 Oct 2026, \d\d:\d\d$/);
  });
});

// A film packet or an envelope goes to another building and comes back: the label must identify the patient without
// printing the placeholders of a file opened with a name and cell number only
describe('the label on a request\'s film packet or envelope', () => {
  const patient = { title: 'Ms', initials: 'M', firstName: 'Maria', lastName: 'Example', idNumber: '85051400123', dateOfBirth: '1985-05-14' };
  const base = {
    patient,
    todayKey: TODAY,
    imagingType: 'x_ray',
    bodyPart: 'Left wrist',
    requestDate: '2026-10-01',
    requestId: '1a2b3c4d-0000-4000-8000-000000000000',
    practiceName: 'Example Practice'
  };

  it('prints the patient, their ID number, the examination, the request day and reference, and the practice', () => {
    expect(imagingLabelLines(base)).toEqual([
      'Ms M Example',
      'ID 85051400123',
      'X-Ray: Left wrist',
      'Requested 1 Oct 2026, IR-1A2B3C4D',
      'Example Practice'
    ]);
  });

  it('uses the date of birth when there is no ID number', () => {
    expect(imagingLabelLines({ ...base, patient: { ...patient, idNumber: null } })[1]).toBe('Born 14 May 1985');
  });

  it('never prints a temporary file\'s placeholder ID number or birthday', () => {
    const lines = imagingLabelLines({ ...base, patient: { ...patient, idNumber: 'TEMP-1760000000000-abc123def', dateOfBirth: '1990-01-01' } });
    expect(lines.join('\n')).not.toMatch(/TEMP-|1990/);
    expect(lines[1]).toBe('X-Ray: Left wrist');
  });

  it('leaves out a body part that was never given and a practice without a name', () => {
    const lines = imagingLabelLines({ ...base, bodyPart: 'Not specified', practiceName: null });
    expect(lines).toContain('X-Ray');
    expect(lines).not.toContain('Example Practice');
  });

  it('gives each request a short reference that is the same on the label and on the screen', () => {
    expect(imagingRequestReference('1a2b3c4d-0000-4000-8000-000000000000')).toBe('IR-1A2B3C4D');
    expect(imagingTypeLabel('ct_scan')).toBe('CT Scan');
    expect(imagingTypeLabel('something_new')).toBe('Imaging');
  });
});
