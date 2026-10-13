import { describe, expect, it } from 'vitest';
import type { DispensingRecord } from '../repeats';
import type { StockMovement } from '../stockRows';
import { buildScheduledRegisters, scriptLine, type ScheduledRegisterInput } from '../scheduledRegister';

const movement = (values: Partial<StockMovement>): StockMovement => ({
  id: 'm', itemId: 'tram', kind: 'received', quantity: 0, valueCents: 0, vatCents: null, batchNo: null, expiryDate: null, reasonCode: null, reason: null,
  occurredOn: '2026-10-01', documentRef: null, deliveryId: null, invoiceId: null, invoiceLineId: null, creditNoteId: null, patientId: null,
  practitionerId: null, dispensingId: null, countId: null, createdBy: null, createdAt: '2026-10-01T08:00:00Z', ...values
});

const script = (values: Partial<DispensingRecord>): DispensingRecord => ({
  id: 'd', number: 'RX2026-0001', patientId: 'p1', visitId: 'v1', itemId: 'tram', quantity: 10, directions: 'Take 1 tablet at night',
  directionsCode: null, prescribedAs: null, daysSupply: 10, repeatsAllowed: 0, repeatOf: null, isChronic: false, validUntil: null,
  prescriberId: 'dr', billed: true, unitPriceCents: null, dispensedOn: '2026-10-05', createdAt: '2026-10-05T09:00:00Z', cancelledAt: null,
  cancelReason: null, ...values
});

const input = (values: Partial<ScheduledRegisterInput>): ScheduledRegisterInput => ({
  items: [
    { id: 'tram', name: 'Tramadol 50 mg', scheduleLabel: 'S5', unit: 'capsule' },
    { id: 'code', name: 'Codeine syrup', scheduleLabel: 'S3', unit: 'ml' },
    { id: 'idle', name: 'Alprazolam 0.5 mg', scheduleLabel: 'S5', unit: 'tablet' }
  ],
  movements: [],
  dispensings: [],
  invoiceVisits: new Map([['inv1', 'v1']]),
  visitBranches: new Map([['v1', 'Katutura branch'], ['v2', 'Main branch']]),
  patients: new Map([['p1', 'Test Patient A'], ['p2', 'Test Patient B']]),
  staff: new Map([['dr', 'Dr Test'], ['nurse', 'Nurse Test']]),
  deliverySuppliers: new Map([['grv1', 'Test Wholesaler']]),
  from: '2026-10-01',
  to: '2026-10-31',
  ...values
});

// Business rule: a dispensing practice must be able to show every scheduled medicine received and issued in a
// period, to whom, on whose script and where, with balances that match the stock figures
describe('the register of all scheduled medicines', () => {
  const registers = buildScheduledRegisters(input({
    movements: [
      movement({ id: 'open', kind: 'received', quantity: 100, occurredOn: '2026-09-02', deliveryId: 'grv1', documentRef: 'GRV2026-0001' }),
      // Billed on the visit's invoice: the stock moved through the invoice line, the script is the billed dispensing
      movement({ id: 'sale', kind: 'sold', quantity: -10, occurredOn: '2026-10-05', invoiceId: 'inv1', documentRef: 'INV-7', patientId: 'p1', practitionerId: 'dr', createdAt: '2026-10-05T09:01:00Z' }),
      // Given without a bill: the dispensing record moved the stock itself
      movement({ id: 'free', kind: 'dispensed', quantity: -5, occurredOn: '2026-10-06', dispensingId: 'd2', documentRef: 'RX2026-0002', patientId: 'p2', createdBy: 'nurse', createdAt: '2026-10-06T10:00:00Z' }),
      movement({ id: 'lost', kind: 'adjusted', quantity: -1, occurredOn: '2026-10-07', reason: 'Broken bottle', createdBy: 'dr', createdAt: '2026-10-07T10:00:00Z' }),
      movement({ id: 'syrup', itemId: 'code', kind: 'received', quantity: 200, occurredOn: '2026-10-02', deliveryId: 'grv1', documentRef: 'GRV2026-0002' })
    ],
    dispensings: [
      script({ id: 'd1', number: 'RX2026-0001', quantity: 10, prescribedAs: 'Tramadol 50 mg nocte 10 days', repeatsAllowed: 2 }),
      script({ id: 'd2', number: 'RX2026-0002', patientId: 'p2', visitId: 'v2', quantity: 5, billed: false, repeatOf: 'd1', prescriberId: 'dr' })
    ]
  }));

  it('gives every medicine that has stock or moved its own page, in name order', () => {
    expect(registers.map(entry => entry.item.name)).toEqual(['Codeine syrup', 'Tramadol 50 mg']);
    const tramadol = registers[1].register;
    expect([tramadol.opening, tramadol.received, tramadol.issued, tramadol.closing]).toEqual([100, 0, 16, 84]);
    expect(registers[1].toPatients).toBe(15);
  });

  it('names the script, the prescriber and the branch of every issue to a patient', () => {
    const rows = registers[1].register.rows;
    expect(rows.map(row => [row.id, row.party, row.where, row.balance])).toEqual([
      ['sale', 'Test Patient A', 'Katutura branch', 90],
      ['free', 'Test Patient B', 'Main branch', 85],
      ['lost', null, null, 84]
    ]);
    expect(scriptLine(rows[0].script)).toBe('RX2026-0001: Take 1 tablet at night (prescribed as Tramadol 50 mg nocte 10 days); 2 repeats allowed');
    expect(scriptLine(rows[1].script)).toBe('RX2026-0002: Take 1 tablet at night; Repeat of RX2026-0001');
    expect(rows[1].script?.prescriber).toBe('Dr Test');
    expect(rows[2].note).toBe('Adjustment; Broken bottle');
  });

  // Business rule: moving stock between the practice's own stores is not a receipt or an issue, so the register
  // (a legal record of what came in and went out) must not list it or let it change the balance
  it("leaves out moves between the practice's own stores", () => {
    const moved = buildScheduledRegisters(input({
      movements: [
        movement({ id: 'in', kind: 'received', quantity: 50, occurredOn: '2026-10-02' }),
        movement({ id: 'out', kind: 'transfer_out', quantity: -20, occurredOn: '2026-10-03' }),
        movement({ id: 'back', kind: 'transfer_in', quantity: 20, occurredOn: '2026-10-03' })
      ]
    }));
    expect(moved[0].register.rows.map(row => row.id)).toEqual(['in']);
    expect([moved[0].register.received, moved[0].register.issued, moved[0].register.closing]).toEqual([50, 0, 50]);
  });

  it('names the supplier of a receipt', () => {
    expect(registers[0].register.rows[0]).toMatchObject({ party: 'Test Wholesaler', received: 200, documentRef: 'GRV2026-0002' });
  });
});
