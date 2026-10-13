import { describe, expect, it } from 'vitest';
import type { FrameDetails } from '../frames';
import type { LabOrderEvent } from '../labOrders';
import { framesSold, labTurnaround, presbyopiaByAge, type ReportLabOrder } from '../report';

const TODAY = '2026-10-08';

// Business rule: the owner reads frames sold per brand to decide what to stock; a line taken off an invoice again is
// not a sale, and medicines or lens cleaner sold from stock are not frames
describe('frames sold', () => {
  const frames = new Map<string, FrameDetails>([
    ['f1', { brand: 'Kenzo', model: 'A', colour: null, size: null }],
    ['f2', { brand: 'Kenzo', model: 'B', colour: null, size: null }],
    ['f3', { brand: 'Ray-Ban', model: 'C', colour: null, size: null }]
  ]);

  it('counts sales per brand, net of reversals, with what the frames cost', () => {
    const report = framesSold([
      { itemId: 'f1', kind: 'sold', quantity: -1, valueCents: -45000 },
      { itemId: 'f2', kind: 'sold', quantity: -1, valueCents: -50000 },
      { itemId: 'f3', kind: 'sold', quantity: -1, valueCents: -90000 },
      { itemId: 'f3', kind: 'sale_reversed', quantity: 1, valueCents: 90000 },
      { itemId: 'f1', kind: 'received', quantity: 5, valueCents: 225000 },
      { itemId: 'cleaner', kind: 'sold', quantity: -3, valueCents: -6000 }
    ], frames);
    expect(report).toEqual({ rows: [{ brand: 'Kenzo', units: 2, costCents: 95000 }], units: 2, costCents: 95000 });
  });
});

describe('presbyopic patients by age', () => {
  it('counts patients whose latest prescription has a reading addition, in five-year bands, by their age today', () => {
    const report = presbyopiaByAge([
      { patientId: 'a', dateOfBirth: '1980-01-01', add: 1.25 }, // 46
      { patientId: 'b', dateOfBirth: '1979-06-01', add: 1.75 }, // 47
      { patientId: 'c', dateOfBirth: '1950-01-01', add: 2.5 }, // 76
      { patientId: 'd', dateOfBirth: '1990-01-01', add: null }, // not presbyopic
      { patientId: 'e', dateOfBirth: null, add: 2 }
    ], TODAY);
    expect(report.rows.find(row => row.band === '45 to 49')).toEqual({ band: '45 to 49', patients: 2, averageAdd: 1.5 });
    expect(report.rows.find(row => row.band === '65 and over')).toEqual({ band: '65 and over', patients: 1, averageAdd: 2.5 });
    expect(report.rows.find(row => row.band === 'Under 40')).toEqual({ band: 'Under 40', patients: 0, averageAdd: null });
    expect(report).toMatchObject({ unknownAge: 1, presbyopic: 4, withPrescription: 5 });
  });
});

describe('lab turnaround', () => {
  const event = (status: LabOrderEvent['status'], on: string): LabOrderEvent => ({
    status, fromStatus: null, reason: null, on, changedAt: `${on}T09:00:00Z`, changedBy: null
  });
  const order = (values: Partial<ReportLabOrder>): ReportLabOrder => ({
    orderedOn: '2026-09-01', status: 'collected', supplierId: 'lab1', supplierName: 'Lab One', events: [], ...values
  });

  it('averages the days at the lab and to collection, and counts remakes per order sent', () => {
    const report = labTurnaround([
      order({ events: [event('received', '2026-09-05'), event('collected', '2026-09-07')] }),
      order({ events: [event('received', '2026-09-11'), event('remake', '2026-09-12'), event('received', '2026-09-20'), event('collected', '2026-09-21')] }),
      order({ status: 'ordered', supplierId: 'lab2', supplierName: 'Lab Two' }),
      order({ status: 'cancelled' })
    ]);
    expect(report).toMatchObject({
      orders: 4,
      cancelled: 1,
      backFromLab: 2,
      averageDaysAtLab: 7,
      medianDaysAtLab: 7,
      averageDaysToCollect: 13,
      remakes: 1,
      remakeRate: 33.3
    });
    expect(report.byLab).toEqual([
      { lab: 'Lab One', orders: 2, backFromLab: 2, averageDaysAtLab: 7, remakes: 1 },
      { lab: 'Lab Two', orders: 1, backFromLab: 0, averageDaysAtLab: null, remakes: 0 }
    ]);
  });
});
