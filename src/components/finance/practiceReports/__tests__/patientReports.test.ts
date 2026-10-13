/**
 * Demographics and new patients (parity R26) and spend and patients by town (parity R28): where patients live, which
 * language they speak and how they came to the practice, how many new files a month brings, and what a patient spends,
 * with billed always equal to Overview's billed. Invented names, addresses and amounts only.
 */
import { describe, expect, it } from 'vitest';
import { summarizeRevenue, toCents } from '../../../../services/ledgerService';
import { invoice } from '../../../../services/__tests__/ledgerTestUtils';
import { REGION_NOT_RECORDED, TOWN_NOT_RECORDED, patientTown, townFromAddress, townReader } from '../patientTowns';
import {
  LANGUAGE_NOT_RECORDED,
  countBy,
  dimensionTable,
  openedIn,
  openedPerMonth,
  patientFacts,
  patientListTable,
  patientSource,
  type PatientRecord
} from '../patientDemographics';
import { NO_PATIENT, NO_PATIENT_LABEL, patientSpendTable, spendByTown, spendPerPatient, townSpendTable } from '../patientSpend';

const record = (overrides: Partial<PatientRecord> = {}): PatientRecord => ({
  id: 'p1', firstName: 'Pat', lastName: 'Testing', homeLanguage: 'English', homeAddress: '12 Test Street, Klein Windhoek, Windhoek',
  postalAddress: null, town: null, createdAt: '2026-10-02T08:00:00+02:00', legacyAccountNumber: null, ...overrides
});

describe('the town of a patient', () => {
  it('reads the town from the last part of the address, without postal codes, house numbers or the country', () => {
    expect(townFromAddress('12 Test Street, Klein Windhoek, WINDHOEK 9000')).toBe('Windhoek');
    expect(townFromAddress('Erf 1234, Extension 5, ondangwa')).toBe('Ondangwa');
    expect(townFromAddress('P.O. Box 123, Oshakati')).toBe('Oshakati');
    expect(townFromAddress('Oshakati, P.O. Box 123')).toBe('Oshakati');
    expect(townFromAddress('Walvis Bay, Namibia')).toBe('Walvis Bay');
    expect(townFromAddress('9000 Lüderitz')).toBe('Lüderitz');
    expect(townFromAddress('Windhoek')).toBe('Windhoek');
  });

  it('does not guess a town from a street or a box alone', () => {
    expect(townFromAddress('12 Main Street')).toBeNull();
    expect(townFromAddress('PO Box 55')).toBeNull();
    expect(townFromAddress('Erf 45 Extension 9')).toBeNull();
    expect(townFromAddress('   ')).toBeNull();
  });

  it('uses the town on the file first, then the home address, then the postal address', () => {
    expect(patientTown({ town: ' keetmanshoop ', homeAddress: '1 Road, Windhoek' })).toBe('Keetmanshoop');
    expect(patientTown({ town: null, homeAddress: null, postalAddress: 'PO Box 1, Rundu' })).toBe('Rundu');
    expect(patientTown({ homeAddress: null, postalAddress: null })).toBe(TOWN_NOT_RECORDED);
  });

  it('prefers a place on the Namibian towns list, in its usual spelling, wherever it is in the address', () => {
    expect(townFromAddress('7 Beach Road, Walvisbaai')).toBe('Walvis Bay');
    expect(townFromAddress('Swakopmund, Vineta')).toBe('Swakopmund');
    expect(patientTown({ town: 'luderitz' })).toBe('Lüderitz');
    // A place that is not on the list is still read, in title case
    expect(townFromAddress('Plot 9, SOME NEW SETTLEMENT')).toBe('Some New Settlement');
  });

  it('takes the region on the file, else the region of the town on the list, else says it is not recorded', () => {
    const reader = townReader();
    expect(reader.region({ region: 'Khomas' }, 'Walvis Bay')).toBe('Khomas');
    expect(reader.region({ region: 'Caprivi' }, 'Windhoek')).toBe('Zambezi');
    expect(reader.region({ region: null }, 'Walvis Bay')).toBe('Erongo');
    expect(reader.region({ region: 'Atlantis' }, 'Some New Settlement')).toBe(REGION_NOT_RECORDED);
    expect(reader.region({}, TOWN_NOT_RECORDED)).toBe(REGION_NOT_RECORDED);
  });
});

describe('demographics and new patients', () => {
  const facts = patientFacts([
    record({ id: 'p1' }),
    record({ id: 'p2', homeLanguage: ' oshiwambo ', homeAddress: 'House 5, Ongwediva', createdAt: '2026-10-05T08:00:00+02:00' }),
    record({ id: 'p3', homeLanguage: '', homeAddress: null, createdAt: '2026-09-20T08:00:00+02:00', legacyAccountNumber: 'OLD-12' }),
    record({ id: 'p4', homeLanguage: 'Afrikaans', homeAddress: 'Plot 3, Ongwediva', createdAt: '2026-08-01T08:00:00+02:00' })
  ], { referred: new Set(['p2']), bookedOnline: new Set(['p1', 'p2']) });

  it('says how each patient came, from what the file holds: a referral first, then an online booking, then an old file number', () => {
    expect(patientSource({ referred: true, bookedOnline: true, hadFileBefore: true })).toBe('referred');
    expect(patientSource({ referred: false, bookedOnline: true, hadFileBefore: true })).toBe('online');
    expect(patientSource({ referred: false, bookedOnline: false, hadFileBefore: true })).toBe('previous_file');
    expect(patientSource({ referred: false, bookedOnline: false, hadFileBefore: false })).toBe('not_recorded');
    expect(facts.map(fact => [fact.id, fact.source, fact.language, fact.town])).toEqual([
      ['p1', 'online', 'English', 'Windhoek'],
      ['p2', 'referred', 'Oshiwambo', 'Ongwediva'],
      ['p3', 'previous_file', LANGUAGE_NOT_RECORDED, TOWN_NOT_RECORDED],
      ['p4', 'not_recorded', 'Afrikaans', 'Ongwediva']
    ]);
  });

  it('counts new files per month of the period, months without any included, split by how the patients came', () => {
    const months = openedPerMonth(facts, { startKey: '2026-09-01', endKey: '2026-10-31' });
    expect(months.map(month => [month.monthKey, month.count, month.bySource.online, month.bySource.referred, month.bySource.previous_file])).toEqual([
      ['2026-09', 1, 0, 0, 1],
      ['2026-10', 2, 1, 1, 0]
    ]);
    expect(openedIn(facts, { startKey: '2026-10-01', endKey: '2026-10-31' }).map(fact => fact.id)).toEqual(['p1', 'p2']);
  });

  it('groups patients by town with "not recorded" last, and the shares add up', () => {
    const groups = countBy(facts, 'town');
    expect(groups).toEqual([{ key: 'Ongwediva', count: 2 }, { key: 'Windhoek', count: 1 }, { key: TOWN_NOT_RECORDED, count: 1 }]);
    const table = dimensionTable(groups, { dimension: 'town', title: 'Patients by town', basis: 'Every patient', notes: [] });
    expect(table.table.totals).toEqual(['Total', 4, 1]);
    expect(table.table.rows[0]).toEqual(['Ongwediva', 2, 0.5]);
  });

  it('lists the patients (a marketing list) with each row opening the patient file', () => {
    const list = patientListTable(facts, { title: 'Patients on file', basis: 'Every patient', notes: [] });
    expect(list.targets[0]).toEqual({ kind: 'patient', id: 'p4' });
    expect(list.table.rows[0]).toEqual(['2026-08-01', 'Pat Testing', 'Afrikaans', 'Ongwediva', 'Oshana', 'Not recorded', 'Not answered']);
  });

  it('groups by region, from the file or the town, with files whose region cannot be told last', () => {
    const withRegions = patientFacts([
      record({ id: 'p1', town: 'Ongwediva', region: 'Oshana' }),
      record({ id: 'p2', town: 'Oshakati', region: null }),
      record({ id: 'p3', region: null }),
      record({ id: 'p4', homeAddress: null })
    ], { referred: new Set(), bookedOnline: new Set() });
    // The town on the file comes before the town in the address
    expect(withRegions.map(fact => [fact.town, fact.region])).toEqual([
      ['Ongwediva', 'Oshana'], ['Oshakati', 'Oshana'], ['Windhoek', 'Khomas'], [TOWN_NOT_RECORDED, REGION_NOT_RECORDED]
    ]);
    expect(countBy(withRegions, 'region')).toEqual([{ key: 'Oshana', count: 2 }, { key: 'Khomas', count: 1 }, { key: REGION_NOT_RECORDED, count: 1 }]);
    const list = patientListTable(withRegions, { title: 'Patients on file', basis: 'Every patient', notes: [] });
    expect(list.table.columns.map(column => column.header)).toEqual(['File opened', 'Patient', 'Home language', 'Town', 'Region', 'Came to us through', 'Heard about us through']);
  });
});

describe('spend per patient and by town', () => {
  const RANGE = { startKey: '2026-10-01', endKey: '2026-10-31' };
  const invoices = [
    invoice({ id: 'i1', patientId: 'p1', issueDate: '2026-10-02', total: 300, medicalAidTotal: 200 }),
    invoice({ id: 'i2', patientId: 'p1', issueDate: '2026-10-09', total: 100.5 }),
    invoice({ id: 'i3', patientId: 'p2', issueDate: '2026-10-15', total: 600 }),
    invoice({ id: 'i4', patientId: null, issueDate: '2026-10-16', total: 50 }),
    invoice({ id: 'i5', patientId: 'p2', issueDate: '2026-10-20', total: 999, status: 'cancelled', rawStatus: 'cancelled' }),
    invoice({ id: 'i6', patientId: 'p2', issueDate: '2026-09-30', total: 999 })
  ];

  it('bills each patient the whole invoice (both portions), so the total is Overview\'s billed for the same days', () => {
    const summary = spendPerPatient(invoices, RANGE);
    expect(summary.billedCents).toBe(toCents(summarizeRevenue(invoices, RANGE).billed));
    expect(summary.patients).toEqual([
      { key: 'p2', invoices: 1, billedCents: 60000 },
      { key: 'p1', invoices: 2, billedCents: 40050 },
      { key: NO_PATIENT, invoices: 1, billedCents: 5000 }
    ]);
    expect(summary.patientsBilled).toBe(2);
  });

  it('lists every town with patients on file, billed or not, and averages per patient billed (invoices without a patient apart)', () => {
    const summary = spendPerPatient(invoices, RANGE);
    const townOf = (patientId: string) => ({ p1: 'Windhoek', p2: 'Oshakati' } as Record<string, string>)[patientId] ?? TOWN_NOT_RECORDED;
    const towns = spendByTown(summary, townOf, new Map([['Windhoek', 3], ['Oshakati', 1], ['Rundu', 2]]));
    expect(towns.map(row => [row.town, row.patientsOnFile, row.patientsBilled, row.billedCents])).toEqual([
      ['Oshakati', 1, 1, 60000],
      ['Windhoek', 3, 1, 40050],
      ['Rundu', 2, 0, 0],
      [NO_PATIENT_LABEL, 0, 0, 5000]
    ]);
    const table = townSpendTable(towns, summary, { basis: 'Oct 2026', notes: [] });
    // Average per patient billed: (600 + 400.50) / 2 patients; the invoice without a patient is in the total only
    expect(table.table.totals).toEqual(['Total', 6, 2, 4, 1050.5, 500.25, 1]);
    const patients = patientSpendTable(summary.patients, { basis: 'Oct 2026', notes: [], nameOf: id => `Patient ${id}`, townOf });
    expect(patients.targets).toEqual([{ kind: 'patient', id: 'p2' }, { kind: 'patient', id: 'p1' }]);
    expect(patients.table.rows[1]).toEqual(['Patient p1', 'Windhoek', 2, 400.5, 200.25]);
  });
});
