/**
 * Demo data for a demo practice: patients, 18 months of visits with billing and claims, vitals, labs, prescriptions,
 * imaging, staff timesheets, leave and payslips, practice expenses and stock, so every screen shows a full flow.
 *
 * Runs in the browser with the signed-in user's session (the app's own Supabase client). Sign in to the app,
 * then open http://localhost:5000/vite.svg in the same browser (same session, but no hot reload, so edits to the
 * code cannot interrupt a long run) and in its console:
 *   const seed = await import('/scripts/seed-demo/demoSeed.ts');
 *   await seed.planDemoSeed();          // builds every row and returns counts; writes nothing
 *   await seed.runDemoSeed();           // writes the rows; safe to run again (fixed ids, duplicates skipped)
 *   await seed.countDemoSeed();         // seeded rows currently in the database
 *   await seed.removeDemoSeed();        // deletes every seeded row again
 * Every build uses the moment in SEEDED_AT, so a later run rebuilds exactly the rows already stored. For a brand-new
 * seed after removeDemoSeed(), pass { now: new Date().toISOString() } and then put that moment in SEEDED_AT.
 *
 * Safety:
 * - it refuses to run unless the practice name contains "test" or "demo";
 * - seeded patients have no phone number and no email, so no SMS or email can ever be sent to them;
 * - every seeded row's id starts with "5eed" and has "-2610-" as its second group, so it can be found and removed;
 * - older medical aid claims are placed in seeded batches already marked as sent, so they are never sent again;
 *   the database's batching trigger files new invoice lines into the fund's open batch, so after the invoice lines
 *   are written restoreSeededClaimBatches() takes every seeded claim back out of real open batches.
 * Some rows (leave requests, payslip line items) can only be written by an administrator: run
 * runDemoSeed({ tables: ['leave_requests', 'payslip_items'] }) signed in as an admin to add them.
 */
import { addDays, addMonths, differenceInCalendarDays, differenceInYears, endOfMonth, format, getDay, parseISO, startOfMonth } from 'date-fns';
import { supabase } from '../../src/lib/supabase';
import type { TablesInsert } from '../../src/types/database.types';
import {
  billableVisitTariffs,
  buildInfectionControlLine,
  buildMaterialFactorLine,
  buildTariffLine,
  sumServiceTotals,
  toInvoiceServiceRow,
  type VisitTariff
} from '../../src/components/visits/visitBillingLines';
import type { ServiceSelection } from '../../src/types/billing';
import { fromCents, toCents } from '../../src/utils/billing/money';
import { classifyWorkedHours, hourlyBasicWage, timesheetPayLines, type HoursSummary } from '../../src/utils/hr/labourAct';
import { isNamibiaPublicHoliday } from '../../src/utils/hr/namibiaHolidays';
import { applyNamibianStatutoryDeductions, type PayLine } from '../../src/utils/hr/namibiaPayroll';
import { getResultStatus } from '../../src/utils/labResultStatus';
import * as seedData from './seedData';

// ---------------------------------------------------------------------------------------------------------------
// Ids: fixed per row, so the seed can be re-run (duplicates are skipped) and removed exactly
// ---------------------------------------------------------------------------------------------------------------

const SEED_VERSION = '2610';
export const SEED_TABLES = [
  'patients', 'medical_aid_details', 'batch_headers', 'visits', 'vitals', 'invoices_enhanced', 'invoice_services',
  'lab_requests', 'lab_results', 'medications', 'imaging_requests', 'employee_salaries', 'timesheets',
  'timesheet_entries', 'leave_requests', 'payslips', 'payslip_items', 'practice_expenses', 'practice_inventory'
] as const;
export type SeedTable = typeof SEED_TABLES[number];

const tableCode = (table: SeedTable): string => (SEED_TABLES.indexOf(table) + 1).toString(16).padStart(2, '0');
export const seedId = (table: SeedTable, n: number): string =>
  `5eed${tableCode(table)}00-${SEED_VERSION}-4000-8000-${n.toString(16).padStart(12, '0')}`;
const idRange = (table: SeedTable): [string, string] => [seedId(table, 0), seedId(table, 0xffffffffffff)];

/**
 * The moment the demo data now in the database was built. Every later build (resuming a run, the admin-only rows,
 * restoring claim batches) must use the same moment, or the rows come out different: "today" decides which visits
 * are history and which are upcoming bookings. Pass `now` only for a brand-new seed after removeDemoSeed(), and then
 * put that moment here.
 */
export const SEEDED_AT = '2026-10-06T02:36:16.213Z';

// ---------------------------------------------------------------------------------------------------------------
// Deterministic random numbers, so every run builds the same rows
// ---------------------------------------------------------------------------------------------------------------

function createRng(seed: number) {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number): number => min + Math.floor(next() * (max - min + 1)),
    chance: (probability: number): boolean => next() < probability,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    weighted: <T>(items: ReadonlyArray<readonly [T, number]>): T => {
      const total = items.reduce((sum, [, weight]) => sum + weight, 0);
      let roll = next() * total;
      for (const [item, weight] of items) {
        roll -= weight;
        if (roll <= 0) return item;
      }
      return items[items.length - 1][0];
    },
    between: (min: number, max: number, decimals = 0): number => Number((min + next() * (max - min)).toFixed(decimals))
  };
}
type Rng = ReturnType<typeof createRng>;

const money = (value: number): number => fromCents(toCents(value));
const dateKey = (date: Date): string => format(date, 'yyyy-MM-dd');
const timeKey = (minutes: number): string => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const atTime = (day: string, time: string): string => new Date(`${day}T${time}:00`).toISOString();

// ---------------------------------------------------------------------------------------------------------------
// Context: the signed-in user's practice, staff, tariffs and funds
// ---------------------------------------------------------------------------------------------------------------

interface StaffMember { id: string; role: string; fullName: string; employeeNumber: string | null }
interface Fund { id: string; name: string; reference: string; email: string | null }

export interface SeedContext {
  practiceId: string;
  practiceName: string;
  practiceNumber: string;
  staff: StaffMember[];
  doctors: StaffMember[];
  admins: StaffMember[];
  branchId: string | null;
  funds: Fund[];
  tariffRows: VisitTariff[];
  leaveTypes: Record<string, string>;
  salaries: Record<string, number>;
  batchDefaults: { transaction_type: string | null; source_software: string | null; source_software_version: string | null; system_identification: number | null };
  today: string;
  nowIso: string;
}

const must = <T>(result: { data: T; error: { message: string } | null }, what: string): NonNullable<T> => {
  if (result.error) throw new Error(`Could not load ${what}: ${result.error.message}`);
  if (result.data === null || result.data === undefined) throw new Error(`Could not load ${what}`);
  return result.data as NonNullable<T>;
};

export async function loadSeedContext(nowIso: string = SEEDED_AT): Promise<SeedContext> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Sign in first: the seed writes with your session.');
  const me = must(await supabase.from('users').select('practice_id').eq('id', auth.user.id).single(), 'your user');
  if (!me.practice_id) throw new Error('Your user has no practice.');
  const practice = must(await supabase.from('practices').select('id, name, practice_number, practice_type_id').eq('id', me.practice_id).single(), 'the practice');
  if (!/\b(test|demo)\b/i.test(practice.name ?? '')) {
    throw new Error(`Refusing to seed "${practice.name}": demo data only goes into a practice whose name contains "test" or "demo".`);
  }

  const users = must(await supabase.from('users').select('id, role, full_name, employee_number, is_active').eq('practice_id', practice.id), 'staff');
  const staff = users
    .filter(user => user.is_active !== false)
    .map(user => ({ id: user.id, role: user.role ?? 'staff', fullName: user.full_name ?? 'Staff member', employeeNumber: user.employee_number ?? null }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const doctors = staff.filter(member => member.role === 'doctor');
  if (doctors.length === 0) throw new Error('The practice has no active doctor to book visits with.');

  const branches = must(await supabase.from('branches').select('id, is_active').eq('practice_id', practice.id), 'branches');
  const providers = must(await supabase.from('medical_aid_providers').select('id, name, medical_aid_reference, email'), 'medical aid funds');
  if (!practice.practice_type_id) throw new Error(`"${practice.name}" has no practice type, so its tariff list is unknown.`);
  const tariffRows = must(await supabase.from('practice_tariffs').select('*').eq('practice_type_id', practice.practice_type_id), 'tariffs') as VisitTariff[];
  const leaveTypes = must(await supabase.from('leave_types').select('id, code').eq('practice_id', practice.id), 'leave types');
  const salaryRows = must(await supabase.from('employee_salaries').select('user_id, basic_salary, is_active').in('user_id', staff.map(member => member.id)), 'salaries');
  const batch = await supabase.from('batch_headers').select('transaction_type, source_software, source_software_version, system_identification').eq('practice_id', practice.id).limit(1).maybeSingle();

  const now = new Date(nowIso);
  return {
    practiceId: practice.id,
    practiceName: practice.name,
    practiceNumber: practice.practice_number ?? '',
    staff,
    doctors,
    admins: staff.filter(member => member.role === 'admin'),
    branchId: branches.filter(branch => branch.is_active !== false).map(branch => branch.id).sort()[0] ?? null,
    funds: providers
      .filter(provider => provider.medical_aid_reference && seedData.FUND_WEIGHTS[provider.medical_aid_reference])
      .map(provider => ({ id: provider.id, name: provider.name, reference: provider.medical_aid_reference as string, email: provider.email ?? null }))
      .sort((a, b) => a.reference.localeCompare(b.reference)),
    tariffRows,
    leaveTypes: Object.fromEntries(leaveTypes.map(type => [type.code, type.id])),
    salaries: Object.fromEntries(salaryRows.filter(row => row.is_active).map(row => [row.user_id, Number(row.basic_salary)])),
    batchDefaults: {
      transaction_type: batch.data?.transaction_type ?? 'D',
      source_software: batch.data?.source_software ?? 'OneHealth',
      source_software_version: batch.data?.source_software_version ?? '2.1',
      system_identification: batch.data?.system_identification ?? 1
    },
    today: dateKey(now),
    nowIso: now.toISOString()
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Building the rows
// ---------------------------------------------------------------------------------------------------------------

type Row = Record<string, unknown>;
export type SeedRows = Record<SeedTable, Row[]>;

interface PatientPlan {
  id: string;
  dob: Date;
  gender: 'male' | 'female';
  surname: string;
  joined: string;
  fund: Fund | null;
  visits: number;
}

export interface SeedOptions {
  patients?: number;
  historyMonths?: number;
  futureDays?: number;
  /** ISO time to build the data as of (default SEEDED_AT); only for a brand-new seed */
  now?: string;
}

export function buildSeedRows(ctx: SeedContext, options: SeedOptions = {}): SeedRows {
  const rng = createRng(20261006);
  const rows = Object.fromEntries(SEED_TABLES.map(table => [table, [] as Row[]])) as SeedRows;
  const counters = Object.fromEntries(SEED_TABLES.map(table => [table, 0])) as Record<SeedTable, number>;
  const nextId = (table: SeedTable): string => seedId(table, ++counters[table]);

  const today = parseISO(ctx.today);
  const start = startOfMonth(addMonths(today, -(options.historyMonths ?? 18)));
  const end = addDays(today, options.futureDays ?? 28);
  const patientCount = options.patients ?? 420;

  // Patients ------------------------------------------------------------------------------------------------
  const patients: PatientPlan[] = [];
  for (let index = 0; index < patientCount; index++) {
    const gender = rng.chance(0.54) ? 'female' : 'male';
    const firstName = rng.pick(gender === 'female' ? seedData.FEMALE_FIRST_NAMES : seedData.MALE_FIRST_NAMES);
    const surname = rng.pick(seedData.SURNAMES);
    const age = rng.weighted<[number, number]>([[[1, 12], 14], [[13, 17], 7], [[18, 35], 30], [[36, 55], 29], [[56, 75], 16], [[76, 90], 4]]);
    const dob = addDays(today, -(rng.int(age[0], age[1]) * 365 + rng.int(0, 364)));
    // About a third were already patients before the period; the rest join through it, more of them recently
    const joined = rng.chance(0.32)
      ? addDays(start, -rng.int(30, 2000))
      : addDays(start, Math.floor(Math.pow(rng.next(), 0.8) * differenceInCalendarDays(today, start)));
    const ageNow = differenceInYears(today, dob);
    const fund = rng.chance(ageNow < 18 ? 0.7 : 0.62)
      ? ctx.funds.length > 0 ? rng.weighted(ctx.funds.map(item => [item, seedData.FUND_WEIGHTS[item.reference] ?? 10] as const)) : null
      : null;
    const id = nextId('patients');
    const work = ageNow >= 18 && ageNow < 63 ? rng.pick(seedData.OCCUPATIONS) : null;
    const inWindhoek = rng.chance(0.82);
    const idNumber = `${format(dob, 'yyMMdd')}${String(rng.int(0, 99999)).padStart(5, '0')}`;

    rows.patients.push({
      id,
      practice_id: ctx.practiceId,
      first_name: firstName,
      last_name: surname,
      gender,
      date_of_birth: dateKey(dob),
      id_number: idNumber,
      home_language: rng.weighted(seedData.LANGUAGES),
      marital_status: ageNow < 21 ? 'single' : rng.weighted([['married', 45], ['single', 40], ['divorced', 8], ['widowed', ageNow > 60 ? 15 : 3]] as const),
      occupation: work?.occupation ?? (ageNow < 18 ? 'Learner' : ageNow >= 63 ? 'Pensioner' : 'Unemployed'),
      employer: work?.employer ?? null,
      home_address: inWindhoek
        ? `${rng.int(1, 240)} ${rng.pick(seedData.STREETS)}, ${rng.pick(seedData.WINDHOEK_SUBURBS)}, Windhoek`
        : `${rng.int(1, 120)} Main Street, ${rng.pick(seedData.OTHER_TOWNS)}`,
      postal_address: `P.O. Box ${rng.int(1000, 99999)}, ${inWindhoek ? 'Windhoek' : 'Okahandja'}`,
      // No contact details: seeded patients can never be sent an SMS or email
      cell_number: null,
      email: null,
      created_at: atTime(dateKey(joined), timeKey(rng.int(8 * 60, 16 * 60))),
      updated_at: atTime(dateKey(joined), '17:00')
    });

    if (fund) {
      const principal = ageNow >= 21 && rng.chance(0.75);
      rows.medical_aid_details.push({
        id: nextId('medical_aid_details'),
        patient_id: id,
        medical_aid_provider_id: fund.id,
        provider: fund.name,
        scheme: fund.name,
        plan_type: rng.pick(seedData.PLAN_TYPES[fund.reference] ?? ['Standard']),
        membership_number: `${fund.reference.slice(0, 3)}${rng.int(1000000, 9999999)}`,
        relationship_to_main: principal ? 'self' : ageNow < 21 ? 'child' : 'spouse',
        main_member_name: principal ? `${firstName} ${surname}` : `${rng.pick(seedData.MALE_FIRST_NAMES)} ${surname}`,
        // Required by the table: the principal member's own ID number, or the main member's for dependants
        main_member_id_number: principal ? idNumber : `${rng.int(60, 99)}${String(rng.int(101, 1228)).padStart(4, '0')}${String(rng.int(0, 99999)).padStart(5, '0')}`,
        created_at: atTime(dateKey(joined), '12:00')
      });
    }
    patients.push({ id, dob, gender, surname, joined: dateKey(joined), fund, visits: 0 });
  }

  // Visits, billing, claims and clinical records ----------------------------------------------------------
  const tariffCache = new Map<string, VisitTariff[]>();
  const tariffsFor = (day: string): VisitTariff[] => {
    const monthKey = day.slice(0, 7);
    if (!tariffCache.has(monthKey)) tariffCache.set(monthKey, billableVisitTariffs(ctx.tariffRows, `${monthKey}-15`));
    return tariffCache.get(monthKey) as VisitTariff[];
  };
  const batches = new Map<string, { id: string; fund: Fund; month: string; invoices: number; cents: number; number: number }>();
  const batchNumbers = new Map<string, number>();
  const invoiceSequence = new Map<string, number>();
  let skippedLines = 0;
  const upcoming: Array<{ index: number; scenario: seedData.Scenario; patient: PatientPlan; day: Date }> = [];

  for (let day = start; day <= end; day = addDays(day, 1)) {
    const key = dateKey(day);
    const weekday = getDay(day);
    if (weekday === 0 || isNamibiaPublicHoliday(key)) continue; // closed on Sundays and public holidays
    const saturday = weekday === 6;
    const monthIndex = (day.getFullYear() - start.getFullYear()) * 12 + day.getMonth() - start.getMonth();
    const festive = (day.getMonth() === 11 && day.getDate() >= 15) || (day.getMonth() === 0 && day.getDate() <= 10);
    let count = saturday ? rng.int(2, 5) : Math.round(6 + monthIndex * 0.25 + rng.int(-2, 3));
    if (festive) count = Math.round(count * 0.55);

    const onDuty = saturday ? [ctx.doctors[monthIndex % ctx.doctors.length]] : ctx.doctors;
    const lastSlot = saturday ? 12 * 60 : 16 * 60 + 30;
    const slots: Array<{ doctor: StaffMember; minutes: number }> = [];
    for (const doctor of onDuty) {
      for (let minutes = 8 * 60; minutes <= lastSlot; minutes += 30) slots.push({ doctor, minutes });
    }
    const chosen: typeof slots = [];
    while (chosen.length < Math.min(count, slots.length)) {
      const slot = slots.splice(rng.int(0, slots.length - 1), 1)[0];
      chosen.push(slot);
    }
    chosen.sort((a, b) => a.minutes - b.minutes);

    for (const { doctor, minutes } of chosen) {
      const isPast = key < ctx.today;
      const eligible = patients.filter(patient => patient.joined <= key);
      if (eligible.length === 0) continue;
      const newcomers = eligible.filter(patient => patient.visits === 0 && differenceInCalendarDays(day, parseISO(patient.joined)) <= 45);
      const patient = newcomers.length > 0 && rng.chance(0.35) ? rng.pick(newcomers) : rng.pick(eligible);
      const age = differenceInYears(day, patient.dob);
      const candidates = seedData.SCENARIOS.filter(scenario =>
        (scenario.minAge === undefined || age >= scenario.minAge) &&
        (scenario.maxAge === undefined || age <= scenario.maxAge) &&
        (patient.visits > 0 || (scenario.key !== 'review' && scenario.key !== 'rct')));
      const scenario = rng.weighted(candidates.map(item => [item, item.weight] as const));
      const tooth = rng.pick(scenario.teeth);
      const time = timeKey(minutes);
      const walkIn = scenario.visitType === 'emergency';
      const drawn = !isPast ? 'scheduled' : walkIn ? 'completed' : rng.weighted([['completed', 86], ['cancelled', 8], ['no-show', 6]] as const);
      // The live visits table does not accept 'no-show' yet (visits_status_check), so a missed visit is stored as cancelled
      const missed = drawn === 'no-show';
      const status = missed ? 'cancelled' : drawn;
      const completed = status === 'completed';
      const bookedDaysBefore = walkIn ? 0 : rng.int(1, 21);
      const bookedAt = new Date(Math.min(
        new Date(atTime(dateKey(addDays(day, -bookedDaysBefore)), timeKey(rng.int(8 * 60, 17 * 60)))).getTime(),
        walkIn ? new Date(atTime(key, time)).getTime() - 30 * 60 * 1000 : Number.POSITIVE_INFINITY,
        new Date(ctx.nowIso).getTime() - 60 * 60 * 1000
      )).toISOString();
      const visitId = nextId('visits');
      const meds = completed ? scenario.medications ?? [] : [];
      // Only tooth-specific treatment names a tooth in the diagnosis
      const toothText = ['caries', 'caries_large', 'pulpitis', 'rct', 'extraction', 'trauma', 'pericoronitis'].includes(scenario.key) ? ` (tooth ${tooth})` : '';

      rows.visits.push({
        id: visitId,
        patient_id: patient.id,
        doctor_id: doctor.id,
        practice_id: ctx.practiceId,
        branch_id: rng.chance(0.35) ? ctx.branchId : null,
        visit_date: key,
        visit_time: `${time}:00`,
        scheduled_date: key,
        scheduled_time: `${time}:00`,
        visit_type: scenario.visitType,
        status,
        // Past visits are history: no reminder automation is needed for them
        is_scheduled: !isPast,
        is_confirmed: true,
        is_checked_in: completed,
        is_ready: false,
        is_handoff: false,
        is_cancelled: status === 'cancelled',
        chief_complaint: scenario.complaint,
        diagnosis: completed ? `${scenario.diagnosis}${toothText}` : null,
        treatment_plan: completed ? scenario.plan : null,
        prescription: meds.length > 0 ? meds.map(med => `${med.name}: ${med.dosage}, ${med.frequency.toLowerCase()}, ${med.duration}`).join('; ') : null,
        notes: drawn === 'cancelled'
          ? `[Cancelled: ${rng.pick(['patient asked to rebook', 'patient unwell', 'transport problems', 'work commitments'])}]`
          : missed ? '[Cancelled: did not attend (no-show)]' : null,
        encounter_date: completed ? key : null,
        created_at: bookedAt,
        updated_at: isPast ? atTime(key, timeKey(Math.min(minutes + 45, 23 * 60))) : bookedAt
      });
      if (!isPast) upcoming.push({ index: rows.visits.length - 1, scenario, patient, day });
      if (isPast && drawn !== 'cancelled') patient.visits++;
      if (!completed) continue;

      // Vitals
      if (rng.chance(scenario.vitalsChance)) {
        const adult = age >= 16;
        const weight = adult ? rng.between(52, 112, 1) : rng.between(14, 55, 1);
        const height = adult ? rng.between(152, 191, 1) : rng.between(98, 165, 1);
        const febrile = scenario.key === 'pericoronitis' || scenario.key === 'pulpitis' ? rng.chance(0.35) : rng.chance(0.03);
        const hypertensive = adult && age > 40 && rng.chance(0.28);
        rows.vitals.push({
          id: nextId('vitals'),
          visit_id: visitId,
          blood_pressure: hypertensive ? `${rng.int(142, 168)}/${rng.int(91, 104)}` : `${rng.int(108, 134)}/${rng.int(68, 86)}`,
          pulse_rate: rng.int(62, febrile ? 104 : 92),
          temperature: febrile ? rng.between(37.9, 38.9, 1) : rng.between(36.2, 37.2, 1),
          respiratory_rate: rng.int(14, 20),
          oxygen_saturation: rng.int(95, 99),
          weight,
          height,
          bmi: Number((weight / Math.pow(height / 100, 2)).toFixed(1)),
          created_at: atTime(key, timeKey(minutes + 5))
        });
      }

      // Billing lines, priced exactly as the visit screen prices them
      const hasAid = patient.fund !== null;
      const tariffs = tariffsFor(key);
      const services: ServiceSelection[] = [];
      const infection = buildInfectionControlLine(tariffs, hasAid);
      if (infection.ok) services.push(infection.service); else skippedLines++;
      for (const line of scenario.lines) {
        const code = line.code === '8101' && patient.visits > 2 && scenario.key === 'checkup' ? '8104' : line.code;
        const tariff = tariffs.find(item => item.code === code);
        if (!tariff) { skippedLines++; continue; }
        const outcome = buildTariffLine(tariff, line.quantity ?? 1, line.tooth === 'tooth' || tariff.requires_tooth_number === 'YES' ? tooth : '', hasAid);
        if (!outcome.ok) { skippedLines++; continue; }
        services.push(outcome.service);
        if (line.material) {
          const material = buildMaterialFactorLine(tariffs, outcome.service, hasAid);
          if (material.ok) services.push(material.service); else skippedLines++;
        }
      }
      const total = sumServiceTotals(services);
      if (services.length > 0 && total > 0) {
        const invoiceId = nextId('invoices_enhanced');
        const monthKey = format(day, 'yyMM');
        const sequence = (invoiceSequence.get(monthKey) ?? 0) + 1;
        invoiceSequence.set(monthKey, sequence);
        const ageDays = differenceInCalendarDays(today, day);
        const createdAt = atTime(key, timeKey(Math.min(minutes + 40, 23 * 60)));

        let paymentStatus = 'pending';
        let paymentMethod: string | null = null;
        let paidAt: string | null = null;
        let medicalAidStatus: string | null = null;
        let batchId: string | null = null;
        let claimNumber: string | null = null;

        if (rng.chance(0.01)) {
          paymentStatus = 'cancelled';
        } else if (hasAid && patient.fund) {
          // Claims older than three weeks went out in that month's batch; the fund pays 30 to 70 days later
          medicalAidStatus = 'not_submitted';
          if (ageDays > 21) {
            const batchKey = `${patient.fund.reference}|${key.slice(0, 7)}`;
            if (!batches.has(batchKey)) {
              const number = (batchNumbers.get(patient.fund.reference) ?? 100) + 1;
              batchNumbers.set(patient.fund.reference, number);
              batches.set(batchKey, { id: nextId('batch_headers'), fund: patient.fund, month: key.slice(0, 7), invoices: 0, cents: 0, number });
            }
            const batchInfo = batches.get(batchKey)!;
            batchInfo.invoices++;
            batchInfo.cents += toCents(total);
            batchId = batchInfo.id;
            claimNumber = `${patient.fund.reference}-${batchInfo.number}-${String(batchInfo.invoices).padStart(4, '0')}`;
            medicalAidStatus = 'submitted';
            const paidByFund = ageDays > 75 ? rng.chance(0.93) : ageDays > 40 ? rng.chance(0.45) : false;
            if (paidByFund) {
              paymentStatus = 'paid';
              paymentMethod = 'medical_aid';
              medicalAidStatus = 'approved'; // the claim was accepted and paid by the fund
              paidAt = atTime(dateKey(addDays(day, rng.int(32, 70))), timeKey(rng.int(9 * 60, 15 * 60)));
            } else if (ageDays > 75) {
              paymentStatus = 'overdue';
            }
          }
        } else {
          const roll = rng.next();
          if (roll < 0.75) {
            paymentStatus = 'paid';
            paymentMethod = rng.weighted([['cash', 45], ['card', 42], ['eft', 13]] as const);
            paidAt = new Date(new Date(createdAt).getTime() + rng.int(5, 25) * 60 * 1000).toISOString();
          } else if (roll < 0.9 && ageDays > 3) {
            paymentStatus = 'paid';
            paymentMethod = 'eft';
            paidAt = atTime(dateKey(addDays(day, rng.int(2, Math.min(14, ageDays)))), timeKey(rng.int(8 * 60, 18 * 60)));
          } else if (ageDays > 30) {
            paymentStatus = 'overdue';
          }
        }
        if (paidAt && paidAt > ctx.nowIso) {
          paymentStatus = 'pending';
          paymentMethod = null;
          paidAt = null;
          if (medicalAidStatus === 'approved') medicalAidStatus = 'submitted';
        }

        rows.invoices_enhanced.push({
          id: invoiceId,
          invoice_number: `INV${monthKey}S${String(sequence).padStart(4, '0')}`,
          patient_id: patient.id,
          visit_id: visitId,
          practice_id: ctx.practiceId,
          practitioner_id: doctor.id,
          issue_date: key,
          due_date: dateKey(addDays(day, 30)),
          subtotal: total,
          tax: 0,
          total,
          medical_aid_total: hasAid ? total : 0,
          patient_total: hasAid ? 0 : total,
          payment_status: paymentStatus,
          payment_method: paymentMethod,
          medical_aid_status: medicalAidStatus,
          medical_aid_claim_number: claimNumber,
          batch_id: batchId,
          notes: null,
          created_at: createdAt,
          updated_at: paidAt ?? createdAt
        });
        services.forEach(service => {
          rows.invoice_services.push({
            ...toInvoiceServiceRow(service, invoiceId, hasAid),
            id: nextId('invoice_services'),
            created_at: createdAt,
            updated_at: createdAt
          });
        });
      }

      // Prescriptions
      meds.forEach(med => {
        rows.medications.push({
          id: nextId('medications'),
          visit_id: visitId,
          patient_id: patient.id,
          medication_name: med.name,
          dosage: med.dosage,
          frequency: med.frequency,
          duration: med.duration,
          instructions: med.instructions,
          prescribed_by: doctor.id,
          prescribed_date: key,
          status: differenceInCalendarDays(today, day) > 14 ? 'completed' : 'active',
          created_at: atTime(key, timeKey(minutes + 30))
        });
      });

      // Laboratory
      const labChance = scenario.key === 'lesion' ? 1 : scenario.key === 'extraction' ? 0.15 : scenario.key === 'gingivitis' ? 0.3 : 0;
      if (scenario.lab && rng.chance(labChance)) {
        const labId = nextId('lab_requests');
        const resultsIn = differenceInCalendarDays(today, day) > 3;
        rows.lab_requests.push({
          id: labId,
          patient_id: patient.id,
          visit_id: visitId,
          practice_id: ctx.practiceId,
          request_date: key,
          preferred_date: dateKey(addDays(day, scenario.key === 'lesion' ? 7 : 2)),
          lab_facility: scenario.lab.facility,
          notes: scenario.lab.notes,
          status: resultsIn ? 'completed' : 'pending',
          created_at: atTime(key, timeKey(minutes + 35))
        });
        if (resultsIn) {
          for (const test of scenario.lab.results) {
            const abnormal = rng.chance(test.abnormalChance);
            const [low, high] = abnormal ? test.abnormal : test.normal;
            const benign = rng.chance(0.8);
            const value = test.unit ? String(rng.between(low, high, 1)) : benign ? 'Benign: chronic inflammation, no dysplasia' : 'Mild epithelial dysplasia: refer to maxillofacial surgeon';
            rows.lab_results.push({
              id: nextId('lab_results'),
              lab_request_id: labId,
              test_name: test.test,
              test_value: value,
              test_unit: test.unit || null,
              reference_range: test.range || null,
              // The table accepts normal, high, low or critical; dysplasia needs an urgent referral
              status: test.unit ? getResultStatus(value, test.range) : benign ? 'normal' : 'critical',
              created_at: atTime(dateKey(addDays(day, rng.int(1, 3))), '14:00')
            });
          }
        }
      }

      // Imaging referral
      if (scenario.imaging) {
        const done = differenceInCalendarDays(today, day) > 5;
        rows.imaging_requests.push({
          id: nextId('imaging_requests'),
          patient_id: patient.id,
          visit_id: visitId,
          imaging_type: scenario.imaging.type,
          body_part: scenario.imaging.bodyPart,
          clinical_indication: scenario.imaging.indication,
          clinical_history: scenario.complaint,
          facility_name: scenario.imaging.facility,
          priority: 'routine',
          status: done ? 'completed' : 'pending',
          request_date: key,
          preferred_date: dateKey(addDays(day, 3)),
          completed_date: done ? dateKey(addDays(day, rng.int(2, 5))) : null,
          report_text: done ? scenario.imaging.report : null,
          requested_by: doctor.id,
          created_at: atTime(key, timeKey(minutes + 35))
        });
      }
    }
  }

  // Upcoming bookings. A new patient counts as new until a visit is completed, and booked visits are not completed
  // yet, so the loop above gives the few newest patients a third of every future day. Patients book one appointment
  // ahead: extra bookings move to someone without one, and emergencies are walk-ins, never booked ahead. This uses its
  // own random numbers, so every past visit, invoice and claim (and the staff rows after them) stays exactly as it was.
  const bookingRng = createRng(20261106);
  const booked = new Set<string>();
  const dropped = new Set<number>();
  for (const { index, scenario, patient, day } of upcoming) {
    if (scenario.visitType === 'emergency') { dropped.add(index); continue; }
    if (!booked.has(patient.id)) { booked.add(patient.id); continue; }
    const visitDay = dateKey(day);
    const candidates = patients.filter(other => {
      const age = differenceInYears(day, other.dob);
      return !booked.has(other.id) && other.joined <= visitDay &&
        (scenario.minAge === undefined || age >= scenario.minAge) &&
        (scenario.maxAge === undefined || age <= scenario.maxAge) &&
        (other.visits > 0 || (scenario.key !== 'review' && scenario.key !== 'rct'));
    });
    if (candidates.length === 0) { dropped.add(index); continue; }
    const replacement = bookingRng.pick(candidates);
    booked.add(replacement.id);
    rows.visits[index] = { ...rows.visits[index], patient_id: replacement.id };
  }
  rows.visits = rows.visits.filter((_, index) => !dropped.has(index));

  // Sent claim batches for the older claims
  for (const batchInfo of batches.values()) {
    const sentOn = addDays(endOfMonth(parseISO(`${batchInfo.month}-01`)), 3);
    rows.batch_headers.push({
      id: batchInfo.id,
      practice_id: ctx.practiceId,
      practice_number: ctx.practiceNumber,
      batch_number: batchInfo.number,
      batch_date: dateKey(sentOn),
      medical_aid_reference: batchInfo.fund.reference,
      status: 'sent',
      total_invoices: batchInfo.invoices,
      total_amount: fromCents(batchInfo.cents),
      recipient_email: batchInfo.fund.email,
      sent_at: atTime(dateKey(sentOn), '10:00'),
      confirmed_at: differenceInCalendarDays(today, sentOn) > 14 ? atTime(dateKey(addDays(sentOn, 2)), '09:00') : null,
      ...ctx.batchDefaults,
      created_at: atTime(dateKey(sentOn), '09:30')
    });
  }

  buildHrRows(ctx, rows, nextId, rng, start, today);
  buildPracticeCostRows(ctx, rows, nextId, rng, start, today);

  if (skippedLines > 0) console.info(`[demo seed] ${skippedLines} billing lines were left out because their tariff was missing or refused`);
  return rows;
}

// ---------------------------------------------------------------------------------------------------------------
// Staff: salaries, leave, timesheets and payslips (with Labour Act overtime and NamRA PAYE)
// ---------------------------------------------------------------------------------------------------------------

const ROLE_SALARY: Record<string, number> = { doctor: 68000, receptionist: 11800, admin: 19500, nurse: 24500 };
const ROLE_ALLOWANCES: Record<string, PayLine[]> = {
  doctor: [{ name: 'Transport allowance', amount: 3500 }, { name: 'Cellphone allowance', amount: 800 }],
  receptionist: [{ name: 'Transport allowance', amount: 1200 }],
  admin: [{ name: 'Transport allowance', amount: 2000 }, { name: 'Housing allowance', amount: 1500 }],
  nurse: [{ name: 'Transport allowance', amount: 1500 }]
};

function buildHrRows(ctx: SeedContext, rows: SeedRows, nextId: (table: SeedTable) => string, rng: Rng, start: Date, today: Date) {
  const lastFullMonth = startOfMonth(addMonths(today, -1));
  const approver = ctx.admins[0] ?? ctx.staff[0];

  ctx.staff.forEach((member, staffIndex) => {
    const basic = ctx.salaries[member.id] ?? ROLE_SALARY[member.role] ?? 15000;
    if (ctx.salaries[member.id] === undefined) {
      rows.employee_salaries.push({
        id: nextId('employee_salaries'),
        user_id: member.id,
        basic_salary: basic,
        currency: 'NAD',
        effective_from: dateKey(start),
        is_active: true,
        created_by: approver.id,
        created_at: atTime(dateKey(start), '09:00')
      });
    }

    // Leave: two weeks over the festive season (staggered), a week mid-year, and a couple of sick days a year
    const leaveDays = new Set<string>();
    const addLeave = (from: Date, days: number, code: string, reason: string, status: 'approved' | 'pending') => {
      const dates: string[] = [];
      for (let offset = 0, taken = 0; taken < days; offset++) {
        const date = addDays(from, offset);
        if (getDay(date) === 0 || getDay(date) === 6 || isNamibiaPublicHoliday(dateKey(date))) continue;
        dates.push(dateKey(date));
        taken++;
      }
      if (status === 'approved') dates.forEach(date => leaveDays.add(date));
      const typeId = ctx.leaveTypes[code];
      if (!typeId) return;
      rows.leave_requests.push({
        id: nextId('leave_requests'),
        user_id: member.id,
        leave_type_id: typeId,
        start_date: dates[0],
        end_date: dates[dates.length - 1],
        days_requested: dates.length,
        is_half_day: false,
        reason,
        status,
        approver_id: status === 'approved' ? approver.id : null,
        approved_at: status === 'approved' ? atTime(dateKey(addDays(from, -10)), '10:00') : null,
        created_at: atTime(dateKey(addDays(from, -21)), '09:00')
      });
    };
    for (let year = start.getFullYear(); year <= today.getFullYear(); year++) {
      const festiveStart = new Date(year, 11, 15 + (staffIndex % 3) * 3);
      if (festiveStart < today && festiveStart >= start) addLeave(festiveStart, 8, 'ANNUAL', 'Festive season leave', 'approved');
      const winter = new Date(year, 6, 6 + staffIndex * 4);
      if (winter < today && winter >= start) addLeave(winter, 5, 'ANNUAL', 'Family visit up north', 'approved');
      for (let sick = 0; sick < 2; sick++) {
        const sickDay = addDays(new Date(year, 0, 1), rng.int(20, 340));
        if (sickDay < today && sickDay >= start) addLeave(sickDay, rng.int(1, 2), 'SICK', 'Flu', 'approved');
      }
    }
    if (staffIndex < 2) addLeave(new Date(today.getFullYear(), 11, 18), 7, 'ANNUAL', 'Festive season leave', 'pending');

    // Timesheets and payslips, month by month
    let ytdGross = 0, ytdDeductions = 0, ytdNet = 0;
    for (let month = startOfMonth(start); month <= lastFullMonth; month = addMonths(month, 1)) {
      if (month.getMonth() === 2) { ytdGross = 0; ytdDeductions = 0; ytdNet = 0; } // tax year starts 1 March
      const monthEnd = endOfMonth(month);
      const approved = month < lastFullMonth;
      const timesheetId = nextId('timesheets');
      const entries: Row[] = [];
      const worked: Array<{ date: string; hours: number; timeIn: string; timeOut: string }> = [];

      for (let date = month; date <= monthEnd; date = addDays(date, 1)) {
        const key = dateKey(date);
        const weekday = getDay(date);
        const holiday = isNamibiaPublicHoliday(key);
        if (leaveDays.has(key)) continue;
        let shift: [string, string, string] | null = null;
        if (weekday >= 1 && weekday <= 5 && !holiday) {
          if (member.role === 'doctor') shift = rng.chance(0.2) ? ['08:00', '18:30', 'Clinic session, ran late'] : ['08:00', '17:00', 'Clinic session'];
          else if (member.role === 'receptionist') shift = ['07:30', '16:30', 'Front desk'];
          else shift = ['08:00', '16:30', 'Practice administration'];
        } else if (weekday === 6 && !holiday) {
          const saturdayIndex = Math.floor(date.getDate() / 7);
          if ((member.role === 'doctor' && ctx.doctors[saturdayIndex % ctx.doctors.length]?.id === member.id) ||
              (member.role === 'receptionist' && (saturdayIndex + staffIndex) % 2 === 0)) {
            shift = ['08:00', '12:30', 'Saturday clinic'];
          }
        } else if ((weekday === 0 || holiday) && member.role === 'doctor' && rng.chance(0.08)) {
          shift = ['09:00', '11:30', 'Emergency call-out'];
        }
        if (!shift) continue;
        const [timeIn, timeOut, task] = shift;
        const [inH, inM] = timeIn.split(':').map(Number);
        const [outH, outM] = timeOut.split(':').map(Number);
        const hours = (outH * 60 + outM - inH * 60 - inM) / 60;
        worked.push({ date: key, hours, timeIn, timeOut });
        entries.push({ date: key, start_time: timeIn, end_time: timeOut, total_hours: hours, task_description: task, is_holiday: holiday, break_duration: 0 });
      }

      const summary: HoursSummary = classifyWorkedHours(worked, isNamibiaPublicHoliday);
      const overtimeDays = new Set(summary.days.filter(item => item.overtimeHours > 0).map(item => item.date));
      rows.timesheets.push({
        id: timesheetId,
        user_id: member.id,
        period_start: dateKey(month),
        period_end: dateKey(monthEnd),
        total_hours: summary.totalHours,
        regular_hours: summary.ordinaryHours,
        overtime_hours: summary.overtimeHours,
        status: approved ? 'approved' : 'submitted',
        submitted_at: atTime(dateKey(addDays(monthEnd, 1)), '08:30'),
        approved_at: approved ? atTime(dateKey(addDays(monthEnd, 3)), '11:00') : null,
        approver_id: approved ? approver.id : null,
        created_at: atTime(dateKey(month), '08:00')
      });
      entries.forEach(entry => rows.timesheet_entries.push({
        ...entry,
        id: nextId('timesheet_entries'),
        timesheet_id: timesheetId,
        is_overtime: overtimeDays.has(entry.date as string),
        created_at: atTime(entry.date as string, '17:30')
      }));

      // Payslip: salary, allowances, approved timesheet pay, pension and medical aid, then PAYE and SSC by law
      const earnings: PayLine[] = [...(ROLE_ALLOWANCES[member.role] ?? [])];
      if (approved) timesheetPayLines(summary, hourlyBasicWage(basic)).forEach(line => earnings.push({ name: line.name, code: line.code, amount: line.amount }));
      earnings.push({ name: 'Pension fund (employer 7.5%)', amount: money(basic * 0.075), isCompanyContribution: true });
      const statutory = applyNamibianStatutoryDeductions({
        basicSalary: basic,
        earnings,
        deductions: [
          { name: 'Pension fund (7.5%)', amount: money(basic * 0.075) },
          { name: 'Medical aid contribution', amount: member.role === 'doctor' ? 2450 : 1380 }
        ],
        payPeriodEnd: monthEnd
      });
      const gross = money(basic + statutory.earnings.filter(line => !line.isCompanyContribution).reduce((sum, line) => sum + line.amount, 0));
      const deductionsTotal = money(statutory.deductions.reduce((sum, line) => sum + line.amount, 0));
      const net = money(gross - deductionsTotal);
      ytdGross = money(ytdGross + gross);
      ytdDeductions = money(ytdDeductions + deductionsTotal);
      ytdNet = money(ytdNet + net);
      const payslipId = nextId('payslips');
      rows.payslips.push({
        id: payslipId,
        user_id: member.id,
        pay_period_start: dateKey(month),
        pay_period_end: dateKey(monthEnd),
        payment_date: dateKey(monthEnd),
        basic_salary: basic,
        gross_earnings: gross,
        total_deductions: deductionsTotal,
        net_pay: net,
        ytd_gross_earnings: ytdGross,
        ytd_total_deductions: ytdDeductions,
        ytd_net_pay: ytdNet,
        status: 'paid',
        payment_method: 'bank_transfer',
        practice_name: ctx.practiceName,
        employee_code: member.employeeNumber,
        approved_by: approver.id,
        approved_at: atTime(dateKey(addDays(monthEnd, -2)), '10:00'),
        earnings_details: [{ name: 'Basic Salary', amount: basic, isCompanyContribution: false }, ...statutory.earnings.map(line => ({ name: line.name, amount: line.amount, isCompanyContribution: !!line.isCompanyContribution }))],
        deductions_details: statutory.deductions.map(line => ({ name: line.name, amount: line.amount })),
        created_at: atTime(dateKey(addDays(monthEnd, -3)), '09:00')
      });
      const items: Array<[string, string, number]> = [
        ['Basic Salary', 'earning', basic],
        ...statutory.earnings.map(line => [line.name, line.isCompanyContribution ? 'company_contribution' : 'earning', line.amount] as [string, string, number]),
        ...statutory.deductions.map(line => [line.name, 'deduction', line.amount] as [string, string, number])
      ];
      items.forEach(([name, type, amount]) => rows.payslip_items.push({
        id: nextId('payslip_items'),
        payslip_id: payslipId,
        component_name: name,
        type,
        amount,
        created_at: atTime(dateKey(addDays(monthEnd, -3)), '09:00')
      }));
    }
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Practice running costs and stock
// ---------------------------------------------------------------------------------------------------------------

function buildPracticeCostRows(ctx: SeedContext, rows: SeedRows, nextId: (table: SeedTable) => string, rng: Rng, start: Date, today: Date) {
  const createdBy = (ctx.admins[0] ?? ctx.staff[0]).id;
  for (let month = startOfMonth(start); month <= today; month = addMonths(month, 1)) {
    for (const template of seedData.EXPENSES) {
      if (template.months && !template.months.includes(month.getMonth() + 1)) continue;
      const due = addDays(month, Math.min(template.dueDay, endOfMonth(month).getDate()) - 1);
      const dueKey = dateKey(due);
      const paid = dueKey < dateKey(today);
      const amount = template.amount[0] === template.amount[1] ? template.amount[0] : rng.between(template.amount[0], template.amount[1], 2);
      rows.practice_expenses.push({
        id: nextId('practice_expenses'),
        practice_id: ctx.practiceId,
        name: template.name,
        description: `${template.name} - ${format(month, 'MMMM yyyy')}`,
        amount,
        currency: 'NAD',
        expense_type: template.type,
        expense_category: template.cadence,
        payment_method: template.method,
        payment_frequency: template.frequency,
        vendor_name: template.vendor,
        is_recurring: template.cadence !== 'one_time',
        is_active: true,
        expense_date: dueKey,
        due_date: dueKey,
        status: paid ? 'paid' : 'pending',
        paid_date: paid ? dateKey(addDays(due, rng.int(-2, 3))) : null,
        created_by: createdBy,
        created_at: atTime(dateKey(month), '08:00')
      });
    }
  }

  seedData.INVENTORY.forEach(item => {
    rows.practice_inventory.push({
      id: nextId('practice_inventory'),
      practice_id: ctx.practiceId,
      name: item.name,
      sku: item.sku,
      category: item.category,
      unit: item.unit,
      unit_cost: item.unitCost,
      quantity: item.quantity,
      total_value: money(item.unitCost * item.quantity),
      reorder_level: item.reorderLevel,
      supplier: item.supplier,
      location: item.location,
      expiry_date: item.expiresInMonths !== undefined ? dateKey(addMonths(today, item.expiresInMonths)) : null,
      last_updated: atTime(dateKey(addDays(today, -rng.int(1, 30))), '15:00'),
      created_at: atTime(dateKey(start), '09:00')
    });
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Writing, counting and removing
// ---------------------------------------------------------------------------------------------------------------

const CHUNK = 250;
// Each invoice line fires the claim-batching trigger, so big inserts hit the database's statement time limit
const CHUNK_BY_TABLE: Partial<Record<SeedTable, number>> = { invoice_services: 40 };

/** Builds every row and reports how many each table would get. Writes nothing. */
export async function planDemoSeed(options: SeedOptions = {}): Promise<Record<SeedTable, number>> {
  const rows = buildSeedRows(await loadSeedContext(options.now), options);
  return Object.fromEntries(SEED_TABLES.map(table => [table, rows[table].length])) as Record<SeedTable, number>;
}

export interface SeedProgress { table: SeedTable; written: number; total: number }

/**
 * Writes the seed, table by table in dependency order. Rows that already exist (same id) are skipped, so an
 * interrupted run can simply be started again. Pass `tables` to write only some tables.
 */
export async function runDemoSeed(options: SeedOptions & { tables?: SeedTable[]; onProgress?: (progress: SeedProgress) => void } = {}): Promise<Record<string, number>> {
  const ctx = await loadSeedContext(options.now);
  const rows = buildSeedRows(ctx, options);
  const selected = options.tables ?? SEED_TABLES;
  const written: Record<string, number> = {};

  // A staff member's own timesheet or payslip for a month always wins over a seeded one
  const [{ data: existingTimesheets }, { data: existingPayslips }] = await Promise.all([
    supabase.from('timesheets').select('id, user_id, period_end').in('user_id', ctx.staff.map(member => member.id)),
    supabase.from('payslips').select('id, user_id, pay_period_end').in('user_id', ctx.staff.map(member => member.id))
  ]);
  const isSeeded = (id: unknown): boolean => String(id).startsWith('5eed');
  const ownTimesheet = new Set((existingTimesheets ?? []).filter(row => !isSeeded(row.id)).map(row => `${row.user_id}|${row.period_end}`));
  const ownPayslip = new Set((existingPayslips ?? []).filter(row => !isSeeded(row.id)).map(row => `${row.user_id}|${row.pay_period_end}`));
  const skippedTimesheets = new Set(rows.timesheets.filter(row => ownTimesheet.has(`${row.user_id}|${row.period_end}`)).map(row => row.id));
  const skippedPayslips = new Set(rows.payslips.filter(row => ownPayslip.has(`${row.user_id}|${row.pay_period_end}`)).map(row => row.id));

  for (const table of SEED_TABLES) {
    if (!selected.includes(table)) continue;
    let tableRows = rows[table];
    if (table === 'timesheets') tableRows = tableRows.filter(row => !skippedTimesheets.has(row.id));
    if (table === 'timesheet_entries') tableRows = tableRows.filter(row => !skippedTimesheets.has(row.timesheet_id));
    if (table === 'payslips') tableRows = tableRows.filter(row => !skippedPayslips.has(row.id));
    if (table === 'payslip_items') tableRows = tableRows.filter(row => !skippedPayslips.has(row.payslip_id));
    const chunkSize = CHUNK_BY_TABLE[table] ?? CHUNK;
    for (let index = 0; index < tableRows.length; index += chunkSize) {
      const chunk = tableRows.slice(index, index + chunkSize);
      const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw new Error(`Seeding ${table} stopped at row ${index + 1} of ${tableRows.length}: ${error.message}`);
      options.onProgress?.({ table, written: Math.min(index + chunkSize, tableRows.length), total: tableRows.length });
    }
    written[table] = tableRows.length;
    if (table === 'invoice_services') {
      const restored = await restoreSeededClaimBatches(rows);
      written.claim_lines_removed_from_open_batches = restored.removedClaimLines;
    }
  }
  return written;
}

/**
 * The database files every new invoice line into the fund's OPEN claim batch (a trigger on invoice_services),
 * even when the invoice already sits in a sent batch, and points the invoice at that open batch. Seeded claims
 * must never sit in a real open batch: submitting it would send them to the fund. This removes the claim lines
 * the trigger added for seeded invoices and puts each seeded invoice back in its own seeded batch (or none).
 */
export async function restoreSeededClaimBatches(rows?: SeedRows): Promise<{ removedClaimLines: number; restoredInvoices: number }> {
  const built = rows ?? buildSeedRows(await loadSeedContext());
  const [from, to] = idRange('invoices_enhanced');
  const removed = await supabase.from('batch_details').delete({ count: 'exact' }).gte('invoice_id', from).lte('invoice_id', to);
  if (removed.error) throw new Error(`Could not take seeded claims out of open batches: ${removed.error.message}`);

  // Writing the seeded invoices back in full puts each one in its own batch again and restores its payment time:
  // adding invoice lines makes the database stamp the invoice with the current time, and Finance reads the time
  // an invoice was marked paid from updated_at
  let restored = 0;
  for (let index = 0; index < built.invoices_enhanced.length; index += CHUNK) {
    const chunk = built.invoices_enhanced.slice(index, index + CHUNK) as TablesInsert<'invoices_enhanced'>[];
    const { error } = await supabase.from('invoices_enhanced').upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(`Could not restore seeded invoices: ${error.message}`);
    restored += chunk.length;
  }
  return { removedClaimLines: removed.count ?? 0, restoredInvoices: restored };
}

/** How many seeded rows each table holds now. */
export async function countDemoSeed(): Promise<Record<string, number | string>> {
  const counts: Record<string, number | string> = {};
  for (const table of SEED_TABLES) {
    const [from, to] = idRange(table);
    const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true }).gte('id', from).lte('id', to);
    counts[table] = error ? `error: ${error.message}` : count ?? 0;
  }
  return counts;
}

/**
 * Deletes every seeded row, children first. Claim lines the database added for seeded invoices (batch_details)
 * are removed with them. Rows created by other people are never touched: only ids with the seed prefix match.
 */
export async function removeDemoSeed(): Promise<Record<string, number | string>> {
  const removed: Record<string, number | string> = {};
  const [invoiceFrom, invoiceTo] = idRange('invoices_enhanced');
  const details = await supabase.from('batch_details').delete({ count: 'exact' }).gte('invoice_id', invoiceFrom).lte('invoice_id', invoiceTo);
  removed.batch_details = details.error ? `error: ${details.error.message}` : details.count ?? 0;
  for (const table of [...SEED_TABLES].reverse()) {
    const [from, to] = idRange(table);
    const { count, error } = await supabase.from(table).delete({ count: 'exact' }).gte('id', from).lte('id', to);
    removed[table] = error ? `error: ${error.message}` : count ?? 0;
  }
  return removed;
}
