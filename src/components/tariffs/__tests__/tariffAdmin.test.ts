import { describe, it, expect, vi } from 'vitest';
import { fundOptions, fundTariffRowsToSave, practiceTariffRowsToSave, scheduleVersions } from '../tariffAdmin';
import { planScheduleImport, readScheduleRows, type Sheet } from '../../../utils/billing/tariffImport';

// The service module is imported for its types only; nothing here may reach the database
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

const NAMAF_2026: Sheet = [
  ['Item', 'Description', 'N$'],
  ['8101', 'Full mouth examination', 267.4],
  ['8109', 'Infection control', 36.1],
  ['8369', 'Resin - three surfaces, posterior', 696.2],
  ['8999', 'A code new in 2026', 100]
];
const plan = planScheduleImport(
  readScheduleRows(NAMAF_2026, { headerRow: 0, codeColumn: 0, descriptionColumn: 1, priceColumn: 2 }),
  [
    { code: '8101', price: 254.7, effective_from: '2025-01-01' },
    { code: '8109', price: 34.4, effective_from: '2025-01-01' },
    { code: '8369', price: 696.2, effective_from: '2026-01-01' }
  ],
  '2026-01-01',
  { dental: true }
);

// Business rule: the yearly NAMAF update changes prices and nothing else. A code keeps its quantity rule, tooth flag
// and notes; a code new to the list starts at quantity 1 without a tooth until an administrator sets it, so it can
// never be multiplied or blocked by mistake.
describe('practiceTariffRowsToSave', () => {
  const existing = [
    { id: 'a', code: '8109', price: 32.7, effective_from: '2024-01-01', can_be_multiplied: 'SOMETIMES', requires_tooth_number: 'YES', notes: 'old' },
    { id: 'b', code: '8109', price: 34.4, effective_from: '2025-01-01', can_be_multiplied: 'YES', requires_tooth_number: 'NO', unit: 'per staff member', notes: 'current' },
    { id: 'c', code: '8101', price: 254.7, effective_from: '2025-01-01', can_be_multiplied: 'NO', requires_tooth_number: 'NO' }
  ];

  it('saves new versions of changed and new codes only, from the start date, with the latest rules', () => {
    const rows = practiceTariffRowsToSave(plan.rows, existing, { practiceTypeId: 'dental-type', startDate: '2026-01-01', endDate: null });
    expect(rows.map(row => [row.code, row.price, row.can_be_multiplied, row.requires_tooth_number])).toEqual([
      ['8101', 267.4, 'NO', 'NO'],
      ['8109', 36.1, 'YES', 'NO'],
      ['8999', 100, 'NO', 'NO']
    ]);
    expect(rows[1]).toMatchObject({ unit: 'per staff member', notes: 'current', effective_from: '2026-01-01', effective_to: null, is_active: true, practice_type_id: 'dental-type' });
  });
});

describe('fundTariffRowsToSave', () => {
  it("saves the fund's new and changed prices with the fund code, plan option, scope and source", () => {
    const rows = fundTariffRowsToSave(plan.rows, {
      practiceTypeId: 'dental-type',
      practiceId: null,
      fundReference: ' mag1 ',
      planOption: '  ',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      source: 'Imported from psemas.xlsx'
    });
    expect(rows.map(row => row.code)).toEqual(['8101', '8109', '8999']);
    expect(rows[0]).toEqual({
      practice_type_id: 'dental-type',
      practice_id: null,
      fund_reference: 'MAG1',
      plan_option: null,
      code: '8101',
      description: 'Full mouth examination',
      unit_price: 267.4,
      effective_from: '2026-01-01',
      effective_to: '2026-12-31',
      source: 'Imported from psemas.xlsx'
    });
  });
});

describe('scheduleVersions and fundOptions', () => {
  it('groups price rows into the versions staff imported, newest first, ignoring inactive rows', () => {
    const versions = scheduleVersions([
      { id: '1', fund_reference: 'MAG1', code: '8101', unit_price: 148.3, effective_from: '2023-12-13', source: 'claims' },
      { id: '2', fund_reference: 'MAG1', code: '8109', unit_price: 20, effective_from: '2023-12-13', source: 'claims' },
      { id: '3', fund_reference: 'MAG1', code: '8101', unit_price: 155, effective_from: '2026-01-01', source: 'file' },
      { id: '4', fund_reference: 'MAG1', code: '8110', unit_price: 44.7, effective_from: '2023-12-13', source: 'claims', is_active: false }
    ]);
    expect(versions.map(version => [version.effectiveFrom, version.codeCount, version.ids])).toEqual([
      ['2026-01-01', 1, ['3']],
      ['2023-12-13', 2, ['1', '2']]
    ]);
  });

  it('offers the funds that have a claim code, named, plus codes already used in a schedule', () => {
    expect(
      fundOptions(
        [
          { name: 'PSEMAS', medical_aid_reference: 'MAG1' },
          { name: 'No code fund', medical_aid_reference: null },
          { name: 'Namibia Health Plan', medical_aid_reference: 'nhpm' }
        ],
        [{ fund_reference: 'PROS' }, { fund_reference: 'MAG1' }]
      )
    ).toEqual([
      { reference: 'NHPM', label: 'Namibia Health Plan (NHPM)' },
      { reference: 'PROS', label: 'PROS' },
      { reference: 'MAG1', label: 'PSEMAS (MAG1)' }
    ]);
  });
});
