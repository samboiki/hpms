// Tariff rows for the quote and bundle tests: real 2025 NAMAF dental prices and quantity rules.
import type { VisitTariff } from '../../visits/visitBillingLines';

export const tariff = (code: string, price: string, overrides: Partial<VisitTariff> = {}): VisitTariff => ({
  id: crypto.randomUUID(),
  code,
  description: `Tariff ${code}`,
  price,
  can_be_multiplied: 'NO',
  requires_tooth_number: 'NO',
  business_rule_formula: null,
  example_calculation: null,
  ...overrides
});

/** The practice's dental tariffs in effect today. */
export const dentalTariffs = (): VisitTariff[] => [
  tariff('8101', '254.70', { description: 'Full mouth examination, charting and treatment planning' }),
  tariff('8104', '137.40', { description: 'Examination or consultation for a specific problem' }),
  tariff('8107', '135.40', { description: 'Intra-oral radiographs, per film', can_be_multiplied: 'YES' }),
  tariff('8109', '34.40', { description: 'Infection control, per visit', can_be_multiplied: 'SOMETIMES' }),
  tariff('8110', '76.80', { description: 'Provision of sterilised and wrapped instrumentation' }),
  tariff('8131', '208.20', { description: 'Palliative treatment for dental pain' }),
  tariff('8145', '40.40', { description: 'Local anaesthetic, per visit', can_be_multiplied: 'YES' }),
  tariff('8159', '410.30', { description: 'Scaling and polishing' }),
  tariff('8201', '208.20', { description: 'Single tooth extraction', requires_tooth_number: 'YES' }),
  tariff('8346', '0', { description: 'Restorative material' }),
  tariff('8367', '448.70', { description: 'Resin - one surface, posterior', requires_tooth_number: 'YES' })
];

/** The same tariff list with every price multiplied (an annual tariff increase), new row ids. */
export const raisedTariffs = (tariffs: readonly VisitTariff[], factor: number): VisitTariff[] =>
  tariffs.map(row => ({
    ...row,
    id: crypto.randomUUID(),
    price: (Math.round(Number(row.price) * factor * 100) / 100).toFixed(2)
  }));
