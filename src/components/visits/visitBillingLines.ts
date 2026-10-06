/**
 * Billing lines for the visit screens (AddVisitTabs and EditVisitTabs). Every amount comes from the
 * shared billing module: the tariff's own price and can_be_multiplied rule, unit price x quantity in
 * whole cents. There is no fallback price and no discount for extra units.
 */
import type { Database } from '../../types/database.types';
import type { ServiceSelection } from '../../types/billing';
import {
  MATERIAL_FACTOR_PERCENT,
  computeLine,
  materialFactorUnitPrice,
  normalizeMultiplyRule,
  parseTariffPrice,
  selectBillableTariffs,
  type LineInput,
  type LineResult,
  type MultiplyRule,
  type TariffRow
} from '../../utils/billing/pricing';
import { formatNad, fromCents, sumCents, toCents } from '../../utils/billing/money';

const INFECTION_CONTROL_CODE = '8109';
const MATERIAL_FACTOR_CODE = '8346';

/** The practice_tariffs_with_types fields the visit screens bill from. */
export interface VisitTariff {
  id: string;
  code: string;
  description?: string | null;
  price: unknown;
  can_be_multiplied?: unknown;
  requires_tooth_number?: unknown;
  business_rule_formula?: string | null;
  example_calculation?: string | null;
  is_active?: boolean | null;
  effective_from?: string | null;
  effective_to?: string | null;
}

/** A new billing line, or why it cannot be billed (the screen shows the message and adds nothing). */
export type LineOutcome =
  | { ok: true; service: ServiceSelection; warnings: string[] }
  | { ok: false; message: string };

type InvoiceServiceInsert = Database['public']['Tables']['invoice_services']['Insert'];

// The screens look codes up among the billable tariffs, so "missing" also covers inactive, expired,
// not yet effective and conflicting rows
const notInTariffListMessage = (code: string): string =>
  `Code ${code} has no tariff in effect for this visit date in the practice's tariff list, so it was not added. Ask an administrator to check the tariff list.`;

const noPriceMessage = (code: string): string =>
  `Code ${code} has no valid price in the tariff list, so it was not added. Ask an administrator to fix the tariff.`;

const refusedMessage = (line: LineResult): string => `${line.errors.join(' ')} The line was not added.`;

const medicalAidFlags = (hasMedicalAid: boolean) => ({
  medicalAidCovered: hasMedicalAid,
  coveragePercentage: hasMedicalAid ? 100 : 0
});

/**
 * The tariff rows that may be billed on `serviceDate` (yyyy-MM-dd): active, in effect and one version
 * per code (selectBillableTariffs), each with its cleaned, cent-rounded price. Inactive, expired,
 * superseded and conflicting rows are left out, so a lookup by code finds the current tariff.
 */
export function billableVisitTariffs<T extends VisitTariff>(rows: readonly T[], serviceDate: string): T[] {
  const { tariffs } = selectBillableTariffs(rows as unknown as readonly TariffRow[], serviceDate);
  const rowById = new Map<string, T>();
  rows.forEach(row => {
    if (!rowById.has(row.id)) rowById.set(row.id, row);
  });
  return tariffs.flatMap(tariff => {
    const row = rowById.get(tariff.id);
    return row ? [{ ...row, price: tariff.unitPrice }] : [];
  });
}

/** The visit's billing total, added up in whole cents so it equals the sum of the lines shown. */
export function sumServiceTotals(services: readonly ServiceSelection[]): number {
  return fromCents(sumCents(services.map(service => (Number.isFinite(service.totalPrice) ? toCents(service.totalPrice) : 0))));
}

/** computeLine input for `quantity` of a tariff (its own price and quantity rule); null without a usable price. */
export function tariffLineInput(tariff: VisitTariff, quantity: number, hasMedicalAid: boolean): LineInput | null {
  const unitPrice = parseTariffPrice(tariff.price);
  if (unitPrice === null) return null;
  return {
    code: tariff.code,
    unitPrice,
    quantity,
    multiplyRule: normalizeMultiplyRule(tariff.can_be_multiplied),
    hasMedicalAid,
    businessRule: tariff.business_rule_formula ?? null
  };
}

/** A line for a tariff picked on the visit screen, priced by computeLine. */
export function buildTariffLine(
  tariff: VisitTariff,
  quantity: number,
  toothNumber: string,
  hasMedicalAid: boolean
): LineOutcome {
  const input = tariffLineInput(tariff, quantity, hasMedicalAid);
  if (!input) return { ok: false, message: noPriceMessage(tariff.code) };
  const requiresTooth = tariff.requires_tooth_number === 'YES';
  const line = computeLine({ ...input, requiresTooth, toothNumbers: toothNumber ? [toothNumber] : [] });
  if (!line.ok) return { ok: false, message: refusedMessage(line) };
  return {
    ok: true,
    warnings: line.warnings,
    service: {
      id: crypto.randomUUID(),
      tariffId: tariff.id,
      code: tariff.code,
      description: `${tariff.description}${toothNumber ? ` (Tooth ${toothNumber})` : ''}`,
      category: 'Dental Service',
      subcategory: 'General',
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      totalPrice: line.total,
      requiresPreAuth: false,
      ...medicalAidFlags(hasMedicalAid),
      businessRule: tariff.business_rule_formula ?? undefined,
      exampleCalculation: tariff.example_calculation ?? undefined,
      requiresTeethNumbers: requiresTooth,
      // SOMETIMES / PROGRESSIVE codes may have quantity > 1; invoiceService refuses that only for NO codes
      canBeMultiplied: input.multiplyRule !== 'NO',
      teethNumbers: toothNumber ? [toothNumber] : undefined
    }
  };
}

/** The 8109 infection-control line (once per visit), priced from the 8109 tariff; no tariff, no line. */
export function buildInfectionControlLine(
  tariffs: readonly VisitTariff[],
  hasMedicalAid: boolean,
  parentServiceId?: string
): LineOutcome {
  const tariff = tariffs.find(item => item.code === INFECTION_CONTROL_CODE);
  if (!tariff) return { ok: false, message: notInTariffListMessage(INFECTION_CONTROL_CODE) };
  const input = tariffLineInput(tariff, 1, hasMedicalAid);
  if (!input) return { ok: false, message: noPriceMessage(INFECTION_CONTROL_CODE) };
  const line = computeLine(input);
  if (!line.ok) return { ok: false, message: refusedMessage(line) };
  return {
    ok: true,
    warnings: line.warnings,
    service: {
      id: crypto.randomUUID(),
      tariffId: tariff.id,
      code: INFECTION_CONTROL_CODE,
      description: 'Infection control per visit (Auto-added)',
      category: 'Dental Service',
      subcategory: 'Infection Control',
      unitPrice: line.unitPrice,
      quantity: 1,
      totalPrice: line.total,
      requiresPreAuth: false,
      ...medicalAidFlags(hasMedicalAid),
      businessRule: 'Automatically added per visit',
      exampleCalculation: `Fixed rate: ${formatNad(line.unitPrice)}`,
      requiresTeethNumbers: false,
      canBeMultiplied: false,
      teethNumbers: undefined,
      isAutoGenerated: true,
      isRequired: true,
      ...(parentServiceId ? { parentServiceId } : {})
    }
  };
}

/** The 8346 amount: MATERIAL_FACTOR_PERCENT of the procedure's unit price, rounded to the cent, x quantity. */
export function priceMaterialFactor(procedureUnitPrice: number, quantity: number, hasMedicalAid: boolean): LineResult {
  const unitPrice =
    Number.isFinite(procedureUnitPrice) && procedureUnitPrice >= 0 ? materialFactorUnitPrice(procedureUnitPrice) : Number.NaN;
  return computeLine({ code: MATERIAL_FACTOR_CODE, unitPrice, quantity, multiplyRule: 'YES', hasMedicalAid });
}

/** The 8346 line for a restorative procedure line: same quantity and teeth; it needs the 8346 tariff. */
export function buildMaterialFactorLine(
  tariffs: readonly VisitTariff[],
  procedure: ServiceSelection,
  hasMedicalAid: boolean
): LineOutcome {
  const tariff = tariffs.find(item => item.code === MATERIAL_FACTOR_CODE);
  if (!tariff) return { ok: false, message: notInTariffListMessage(MATERIAL_FACTOR_CODE) };
  const line = priceMaterialFactor(procedure.unitPrice, procedure.quantity, hasMedicalAid);
  if (!line.ok) return { ok: false, message: refusedMessage(line) };
  const teeth = procedure.teethNumbers ?? [];
  return {
    ok: true,
    warnings: line.warnings,
    service: {
      id: crypto.randomUUID(),
      tariffId: tariff.id,
      code: MATERIAL_FACTOR_CODE,
      description: `Material factor (${MATERIAL_FACTOR_PERCENT}% of ${procedure.code})${teeth.length > 0 ? ` - Tooth ${teeth.join(', ')}` : ''}`,
      category: 'Dental Service',
      subcategory: 'Material Factor',
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      totalPrice: line.total,
      requiresPreAuth: false,
      ...medicalAidFlags(hasMedicalAid),
      businessRule: `${MATERIAL_FACTOR_PERCENT}% material factor of primary service`,
      exampleCalculation: `${formatNad(procedure.unitPrice)} x ${MATERIAL_FACTOR_PERCENT}% = ${formatNad(line.unitPrice)}`,
      requiresTeethNumbers: teeth.length > 0,
      // It follows the procedure's quantity, so it may be multiplied exactly when the procedure may
      canBeMultiplied: procedure.canBeMultiplied,
      teethNumbers: teeth.length > 0 ? [...teeth] : undefined,
      isAutoGenerated: true,
      parentServiceId: procedure.id
    }
  };
}

/** A line's quantity rule: from its tariff when the tariff is loaded, otherwise its stored flag. */
export function serviceMultiplyRule(service: ServiceSelection, tariffs: readonly VisitTariff[]): MultiplyRule {
  const tariff = tariffs.find(item => item.id === service.tariffId);
  if (tariff) return normalizeMultiplyRule(tariff.can_be_multiplied);
  return service.canBeMultiplied ? 'YES' : 'NO';
}

const isMaterialLineOf = (service: ServiceSelection, procedureId: string): boolean =>
  service.code === MATERIAL_FACTOR_CODE && service.isAutoGenerated === true && service.parentServiceId === procedureId;

/**
 * Sets one line's quantity, priced by computeLine at the line's own unit price; its auto-added 8346
 * line follows. When the change is refused the lines come back unchanged and `line.errors` says why.
 */
export function changeLineQuantity(
  services: readonly ServiceSelection[],
  serviceId: string,
  quantity: number,
  tariffs: readonly VisitTariff[],
  hasMedicalAid: boolean
): { services: ServiceSelection[]; line: LineResult | null } {
  const target = services.find(service => service.id === serviceId);
  if (!target) return { services: [...services], line: null };
  const line = computeLine({
    code: target.code,
    unitPrice: target.unitPrice,
    quantity,
    multiplyRule: serviceMultiplyRule(target, tariffs),
    requiresTooth: target.requiresTeethNumbers ?? false,
    toothNumbers: target.teethNumbers,
    hasMedicalAid,
    businessRule: target.businessRule ?? null
  });
  if (!line.ok) return { services: [...services], line };
  const material = services.some(service => isMaterialLineOf(service, serviceId))
    ? priceMaterialFactor(line.unitPrice, line.quantity, hasMedicalAid)
    : null;
  if (material && !material.ok) return { services: [...services], line: material };
  return {
    services: services.map(service => {
      if (service.id === serviceId) return { ...service, quantity: line.quantity, totalPrice: line.total };
      if (material && isMaterialLineOf(service, serviceId)) {
        return { ...service, unitPrice: material.unitPrice, quantity: material.quantity, totalPrice: material.total };
      }
      return service;
    }),
    line
  };
}

/**
 * The invoice_services row for a line, as invoiceService writes it when it creates an invoice: the
 * amounts from computeLine (a medical aid patient's line goes to the fund, a private patient pays it
 * all) and the tooth numbers the claim needs. Check lines with findInvoiceLineProblems first; a line
 * computeLine refuses throws rather than being saved as N$ 0.00.
 */
export function toInvoiceServiceRow(service: ServiceSelection, invoiceId: string, hasMedicalAid: boolean): InvoiceServiceInsert {
  const line = computeLine({
    code: service.code,
    unitPrice: service.unitPrice,
    quantity: service.quantity,
    multiplyRule: 'YES',
    hasMedicalAid
  });
  if (!line.ok) throw new Error(line.errors.join(' '));
  // system_transaction_number is left out, as in invoiceService: an insert trigger numbers the lines in
  // sequence (ADD_SYSTEM_TRANSACTION_NUMBER.sql). The generated types don't know about that trigger.
  return {
    invoice_id: invoiceId,
    tariff_id: service.tariffId,
    code: service.code,
    description: service.description,
    quantity: service.quantity,
    unit_price: line.unitPrice,
    total_price: line.total,
    medical_aid_covered: line.medicalAidAmount,
    patient_portion: line.patientAmount,
    notes: service.notes || '',
    tooth_number: service.teethNumbers ? service.teethNumbers.join(',') : null
  } as InvoiceServiceInsert;
}
