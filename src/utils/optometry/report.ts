/**
 * The optometry report: frames sold (from the stock ledger), presbyopic patients by age (from their latest spectacle
 * prescription) and how long the labs take (from the lab orders' history). Pure; tested in __tests__/report.test.ts.
 */
import { ageOn } from '../patientLists/listDates';
import type { StockMovement } from '../stock/stockRows';
import type { FrameDetails } from './frames';
import { orderTurnaround, type LabOrderEvent, type LabOrderStatus } from './labOrders';

// ---------------------------------------------------------------------------------------------------
// Frames sold
// ---------------------------------------------------------------------------------------------------

export interface FrameSalesRow {
  brand: string;
  units: number;
  /** What the frames cost the practice (the ledger's value at average cost), in cents */
  costCents: number;
}

export interface FrameSales {
  rows: FrameSalesRow[];
  units: number;
  costCents: number;
}

/**
 * Frames billed in the period per brand, net of lines taken off invoices again. `movements` are the period's stock
 * movements; only frame items (in `frames`) count.
 */
export function framesSold(movements: readonly Pick<StockMovement, 'itemId' | 'kind' | 'quantity' | 'valueCents'>[], frames: ReadonlyMap<string, FrameDetails>): FrameSales {
  const byBrand = new Map<string, { units: number; costCents: number }>();
  for (const movement of movements) {
    if (movement.kind !== 'sold' && movement.kind !== 'sale_reversed') continue;
    const frame = frames.get(movement.itemId);
    if (!frame) continue;
    const brand = frame.brand.trim() || 'No brand';
    const row = byBrand.get(brand) ?? { units: 0, costCents: 0 };
    // A sale takes units and value off stock (negative); a reversal puts them back
    row.units -= movement.quantity;
    row.costCents -= movement.valueCents;
    byBrand.set(brand, row);
  }
  const rows = [...byBrand.entries()]
    .map(([brand, row]) => ({ brand, units: row.units, costCents: row.costCents }))
    .filter(row => row.units !== 0 || row.costCents !== 0)
    .sort((a, b) => b.units - a.units || a.brand.localeCompare(b.brand));
  return {
    rows,
    units: rows.reduce((sum, row) => sum + row.units, 0),
    costCents: rows.reduce((sum, row) => sum + row.costCents, 0)
  };
}

// ---------------------------------------------------------------------------------------------------
// Presbyopic patients by age
// ---------------------------------------------------------------------------------------------------

export interface AgeBand {
  label: string;
  /** Inclusive; null = no upper end */
  from: number;
  to: number | null;
}

/** Five-year bands from 40, where reading additions usually begin */
export const AGE_BANDS: readonly AgeBand[] = [
  { label: 'Under 40', from: 0, to: 39 },
  { label: '40 to 44', from: 40, to: 44 },
  { label: '45 to 49', from: 45, to: 49 },
  { label: '50 to 54', from: 50, to: 54 },
  { label: '55 to 59', from: 55, to: 59 },
  { label: '60 to 64', from: 60, to: 64 },
  { label: '65 and over', from: 65, to: null }
];

export interface LatestSpectacleRx {
  patientId: string;
  dateOfBirth: string | null;
  /** The larger reading addition of the two eyes; null without one */
  add: number | null;
  /** The day the prescription was written (for the list of patients) */
  prescribedOn?: string | null;
}

export interface PresbyopiaRow {
  band: string;
  patients: number;
  /** Mean reading addition in the band, 2 decimals */
  averageAdd: number | null;
}

export interface PresbyopiaReport {
  rows: PresbyopiaRow[];
  /** Presbyopic patients without a date of birth */
  unknownAge: number;
  presbyopic: number;
  /** Patients with a spectacle prescription */
  withPrescription: number;
}

/** Patients whose latest spectacle prescription has a reading addition, by their age today. */
export function presbyopiaByAge(latest: readonly LatestSpectacleRx[], today: string): PresbyopiaReport {
  const groups = AGE_BANDS.map(band => ({ band, adds: [] as number[] }));
  let unknownAge = 0;
  let presbyopic = 0;
  for (const rx of latest) {
    if (!rx.add) continue;
    presbyopic += 1;
    const age = ageOn(rx.dateOfBirth, today);
    const group = age === null ? undefined : groups.find(({ band }) => age >= band.from && (band.to === null || age <= band.to));
    if (group) group.adds.push(rx.add);
    else unknownAge += 1;
  }
  return {
    rows: groups.map(({ band, adds }) => ({
      band: band.label,
      patients: adds.length,
      averageAdd: adds.length > 0 ? Math.round((adds.reduce((sum, add) => sum + add, 0) / adds.length) * 100) / 100 : null
    })),
    unknownAge,
    presbyopic,
    withPrescription: latest.length
  };
}

export interface PresbyopicPatient {
  patientId: string;
  /** Age today; null without a date of birth */
  age: number | null;
  /** The age band (AGE_BANDS), or "No date of birth" */
  band: string;
  add: number;
  prescribedOn: string | null;
}

export const NO_BIRTH_DATE_BAND = 'No date of birth';

/**
 * The patients behind the counts: everyone whose latest spectacle prescription has a reading addition, youngest
 * first (those who have just started to need reading glasses are the ones to call about progressive lenses), those
 * without a date of birth last.
 */
export function presbyopicPatients(latest: readonly LatestSpectacleRx[], today: string): PresbyopicPatient[] {
  return latest
    .flatMap(rx => {
      if (!rx.add) return [];
      const age = ageOn(rx.dateOfBirth, today);
      const band = age === null ? undefined : AGE_BANDS.find(entry => age >= entry.from && (entry.to === null || age <= entry.to));
      return [{ patientId: rx.patientId, age, band: band?.label ?? NO_BIRTH_DATE_BAND, add: rx.add, prescribedOn: rx.prescribedOn ?? null }];
    })
    .sort((a, b) => (a.age ?? Number.MAX_SAFE_INTEGER) - (b.age ?? Number.MAX_SAFE_INTEGER) || b.add - a.add);
}

// ---------------------------------------------------------------------------------------------------
// Lab turnaround
// ---------------------------------------------------------------------------------------------------

export interface ReportLabOrder {
  orderedOn: string;
  status: LabOrderStatus;
  supplierId: string | null;
  supplierName: string | null;
  events: readonly LabOrderEvent[];
}

export interface LabTurnaroundRow {
  lab: string;
  orders: number;
  backFromLab: number;
  averageDaysAtLab: number | null;
  remakes: number;
}

export interface LabTurnaround {
  orders: number;
  cancelled: number;
  backFromLab: number;
  averageDaysAtLab: number | null;
  medianDaysAtLab: number | null;
  averageDaysToCollect: number | null;
  remakes: number;
  /** Remakes per order sent (not cancelled), as a percentage with 1 decimal */
  remakeRate: number | null;
  byLab: LabTurnaroundRow[];
}

const average = (values: readonly number[]): number | null =>
  values.length > 0 ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;

const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 10) / 10;
};

/** How long the orders placed in a period took at the lab, to collection, and how many came back for a remake. */
export function labTurnaround(orders: readonly ReportLabOrder[]): LabTurnaround {
  const sent = orders.filter(order => order.status !== 'cancelled' || order.events.some(event => event.status === 'received'));
  const measured = sent.map(order => ({ order, turnaround: orderTurnaround(order.orderedOn, order.events) }));
  const daysAtLab = measured.flatMap(({ turnaround }) => (turnaround.daysAtLab === null ? [] : [turnaround.daysAtLab]));
  const daysToCollect = measured.flatMap(({ turnaround }) => (turnaround.daysToCollect === null ? [] : [turnaround.daysToCollect]));
  const remakes = measured.reduce((sum, { turnaround }) => sum + turnaround.remakes, 0);

  const labs = new Map<string, { lab: string; orders: number; days: number[]; remakes: number }>();
  for (const { order, turnaround } of measured) {
    const keyOf = order.supplierId ?? '';
    const row = labs.get(keyOf) ?? { lab: order.supplierName?.trim() || 'No lab named', orders: 0, days: [], remakes: 0 };
    row.orders += 1;
    if (turnaround.daysAtLab !== null) row.days.push(turnaround.daysAtLab);
    row.remakes += turnaround.remakes;
    labs.set(keyOf, row);
  }

  return {
    orders: orders.length,
    cancelled: orders.length - sent.length,
    backFromLab: daysAtLab.length,
    averageDaysAtLab: average(daysAtLab),
    medianDaysAtLab: median(daysAtLab),
    averageDaysToCollect: average(daysToCollect),
    remakes,
    remakeRate: sent.length > 0 ? Math.round((remakes / sent.length) * 1000) / 10 : null,
    byLab: [...labs.values()]
      .map(row => ({ lab: row.lab, orders: row.orders, backFromLab: row.days.length, averageDaysAtLab: average(row.days), remakes: row.remakes }))
      .sort((a, b) => b.orders - a.orders || a.lab.localeCompare(b.lab))
  };
}
