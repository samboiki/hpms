/**
 * The scheduled-medicine register for every scheduled medicine at once: for a period, each medicine's balance
 * brought forward, every receipt and issue in the order recorded (from the stock ledger, so it cannot differ from the
 * stock figures), and for each issue to a patient the script it was dispensed on (its number, directions, what was
 * prescribed, the prescriber, repeats) and where it was dispensed (the visit's branch). Printable as one register,
 * medicine after medicine. Pure; tested in __tests__/scheduledRegister.test.ts.
 */
import { MOVEMENT_LABELS, isTransferMovement } from './ledger';
import { buildRegister, type Register, type RegisterEntry } from './register';
import type { DispensingRecord } from './repeats';
import type { StockMovement } from './stockRows';

export interface ScheduledItem {
  id: string;
  name: string;
  scheduleLabel: string | null;
  unit: string;
}

export interface ScriptDetails {
  /** The dispensing record's number, printed on the label: "RX2026-0012" */
  number: string;
  directions: string;
  prescribedAs: string | null;
  prescriber: string | null;
  /** "Repeat of RX2026-0003", "2 repeats allowed", or null */
  repeats: string | null;
  cancelled: boolean;
}

export interface ScheduledEntry extends RegisterEntry {
  itemId: string;
  /** The branch it was dispensed at (the visit's), when known */
  where: string | null;
  script: ScriptDetails | null;
}

export interface MedicineRegister {
  item: ScheduledItem;
  register: Register<ScheduledEntry>;
  /** Issues to patients in the period (dispensed or billed), net of those taken back */
  toPatients: number;
}

export interface ScheduledRegisterInput {
  items: readonly ScheduledItem[];
  /** Every movement of these items up to the end of the period (the balance brought forward needs the earlier ones) */
  movements: readonly StockMovement[];
  /** The dispensing records of these items in the period (billed ones too), and the first scripts their repeats name */
  dispensings: readonly DispensingRecord[];
  /** Invoice id -> the visit it bills (a billed dispensing is on its visit's invoice) */
  invoiceVisits: ReadonlyMap<string, string>;
  /** Visit id -> its branch's name */
  visitBranches: ReadonlyMap<string, string>;
  patients: ReadonlyMap<string, string>;
  staff: ReadonlyMap<string, string>;
  /** Delivery id -> the supplier's name */
  deliverySuppliers: ReadonlyMap<string, string>;
  from: string;
  to: string;
}

const PATIENT_KINDS = new Set(['sold', 'sale_reversed', 'dispensed', 'dispense_reversed']);

function scriptOf(record: DispensingRecord, byId: ReadonlyMap<string, DispensingRecord>, staff: ReadonlyMap<string, string>): ScriptDetails {
  const first = record.repeatOf ? byId.get(record.repeatOf) ?? null : null;
  const repeats = record.repeatOf
    ? `Repeat of ${first?.number ?? 'an earlier script'}`
    : record.repeatsAllowed > 0
      ? `${record.repeatsAllowed} repeat${record.repeatsAllowed === 1 ? '' : 's'} allowed`
      : null;
  return {
    number: record.number,
    directions: record.directions,
    prescribedAs: record.prescribedAs,
    prescriber: record.prescriberId ? staff.get(record.prescriberId) ?? null : null,
    repeats,
    cancelled: record.cancelledAt !== null
  };
}

/**
 * Pairs each issue with its dispensing record: directly for medicine given without a bill, and for a billed one the
 * record of the same patient, medicine and visit (the invoice's), the same quantity first. Each record is used once.
 */
function matchScripts(movements: readonly StockMovement[], input: ScheduledRegisterInput): Map<string, DispensingRecord> {
  const byId = new Map(input.dispensings.map(record => [record.id, record]));
  const matched = new Map<string, DispensingRecord>();
  const used = new Set<string>();
  for (const movement of movements) {
    if (movement.dispensingId) {
      const record = byId.get(movement.dispensingId);
      if (record) matched.set(movement.id, record);
    }
  }
  const sales = movements
    .filter(movement => movement.kind === 'sold' && movement.invoiceId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const movement of sales) {
    const visitId = input.invoiceVisits.get(movement.invoiceId ?? '') ?? null;
    if (!visitId) continue;
    const candidates = input.dispensings.filter(
      record => record.billed && !used.has(record.id) && record.itemId === movement.itemId && record.patientId === movement.patientId && record.visitId === visitId
    );
    const record = candidates.find(entry => entry.quantity === -movement.quantity) ?? candidates[0];
    if (record) {
      used.add(record.id);
      matched.set(movement.id, record);
    }
  }
  return matched;
}

export function buildScheduledRegisters(input: ScheduledRegisterInput): MedicineRegister[] {
  const byId = new Map(input.dispensings.map(record => [record.id, record]));
  const scripts = matchScripts(input.movements, input);
  return [...input.items]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(item => {
      const entries = input.movements
        // Moves between the practice's own stores are neither receipts nor issues (as in the single medicine's register)
        .filter(movement => movement.itemId === item.id && movement.occurredOn <= input.to && !isTransferMovement(movement.kind))
        .map((movement): ScheduledEntry => {
          const record = scripts.get(movement.id) ?? null;
          const visitId = record?.visitId ?? (movement.invoiceId ? input.invoiceVisits.get(movement.invoiceId) ?? null : null);
          const party = movement.patientId
            ? input.patients.get(movement.patientId) ?? 'Patient'
            : movement.deliveryId
              ? input.deliverySuppliers.get(movement.deliveryId) ?? null
              : null;
          const byWhom = movement.practitionerId ?? movement.createdBy;
          return {
            id: movement.id,
            itemId: item.id,
            kind: movement.kind,
            quantity: movement.quantity,
            valueCents: movement.valueCents,
            occurredOn: movement.occurredOn,
            createdAt: movement.createdAt,
            documentRef: movement.documentRef,
            party,
            by: byWhom ? input.staff.get(byWhom) ?? null : null,
            note: [MOVEMENT_LABELS[movement.kind], movement.reason, movement.batchNo ? `batch ${movement.batchNo}` : null].filter(Boolean).join('; '),
            where: visitId ? input.visitBranches.get(visitId) ?? null : null,
            script: record ? scriptOf(record, byId, input.staff) : null
          };
        });
      const register = buildRegister(entries, input.from, input.to);
      const toPatients = register.rows.reduce((sum, row) => sum + (PATIENT_KINDS.has(row.kind) ? -row.quantity : 0), 0);
      return { item, register, toPatients };
    })
    // A medicine with nothing on hand and nothing moving in the period has no page in the register
    .filter(entry => entry.register.opening !== 0 || entry.register.rows.length > 0);
}

/** The script in one line for the register: "RX2026-0012: Take 1 tablet at night (prescribed as Tramadol 50 mg); 2 repeats allowed" */
export function scriptLine(script: ScriptDetails | null): string | null {
  if (!script) return null;
  const parts = [`${script.number}: ${script.directions}`];
  if (script.prescribedAs) parts[0] += ` (prescribed as ${script.prescribedAs})`;
  if (script.repeats) parts.push(script.repeats);
  if (script.cancelled) parts.push('cancelled');
  return parts.join('; ');
}
