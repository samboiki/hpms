import { useEffect, useMemo, useRef } from 'react';
import type { ServiceSelection } from '../../types/billing';
import { invoiceLinesAmounts, type InvoiceLineAmounts } from '../../utils/billing/invoiceLineRow';
import { copayFor, shareOf, type CopayRule } from '../../utils/billing/lineSplit';
import { findDuplicateLines, type DuplicateWarning } from '../../utils/billing/invoiceDuplicates';
import type { PatientFundKey } from '../../utils/billing/fundPricing';
import { MATERIAL_FACTOR_CODE, isDentalPractice } from '../../utils/billing/tariffRules';
import { canRaiseInvoices } from '../../utils/billing/invoiceRights';
import { NO_PRACTITIONER_BILLING, rateOf, type PractitionerBillingMap } from '../../utils/billing/practitionerBilling';
import { describeIcd10Source, suggestLineIcd10 } from '../../utils/billing/icd10Defaults';
import { authorisationNotices, suggestLineAuthorisations, type LineAuthorisation } from '../../utils/billing/authorisations';
import type { PatientReferral } from '../../utils/billing/referrals';
import { lineSurfaces } from '../../utils/dental/lineTeeth';
import { usePatientClaimRegisters, type PatientClaimRegisters } from '../../hooks/usePatientClaimRegisters';
import { linesWithoutTooth, listTeeth } from '../dental/toothBilling';
import type { LineDetailChanges } from './BillingLineDetails';
import type { BillingTotals } from './InvoiceBillingSummary';
import { useInvoiceContext, type InvoiceContextState } from './useInvoiceContext';
import { changeLineFee, priceLinesAtRate, type VisitTariff } from './visitBillingLines';

/** A line's ICD-10 codes as the Billing tab shows and saves them. */
export interface LineIcd10 {
  /** Main code first; empty when there is nothing to go on */
  codes: string[];
  /** True while nobody has set the line's codes: they are a suggestion (saved with the invoice as shown) */
  suggested: boolean;
  /** Where the codes came from, in plain words; null for codes set on the line */
  sourceLabel: string | null;
}

/** Who else is on a line (parity D7), as the Billing tab offers it */
export interface LinePeople {
  /** True once the database keeps a line's own referral, assistant and anaesthetist, and the invoice is not locked */
  editable: boolean;
  /** The patient's referrals (not removed) to pick a line's own referring practitioner from */
  referrals: PatientReferral[];
}

export interface VisitBilling {
  invoiceContext: InvoiceContextState;
  copayRule: CopayRule | null;
  /** Each line's split (null when the line cannot be priced) */
  lineAmounts: Map<string, InvoiceLineAmounts | null>;
  totals: BillingTotals;
  duplicates: DuplicateWarning[];
  /** A line's own date, practitioner and discount can be changed (database ready, invoice not locked) */
  lineDetailsEditable: boolean;
  /** A line's ICD-10 codes and fee can be changed (database ready, invoice not locked) */
  lineCodesEditable: boolean;
  /** Who pays a line and its authorisation number can be changed (database ready, invoice not locked) */
  linePortionsEditable: boolean;
  /** A line's tooth surfaces and quadrant can be kept (database ready, invoice not locked) */
  lineTeethEditable: boolean;
  /** The signed-in user may change a line's fee: billing rights (invoiceRights.ts) */
  canChangeFee: boolean;
  /** Each line's ICD-10 codes: its own, else those confirmed on its claim line, else the suggestion */
  lineIcd10: Map<string, LineIcd10>;
  /** The lines as the invoice saves them: each carries the ICD-10 codes and the authorisation number the tab shows for it */
  servicesForInvoice: ServiceSelection[];
  /** The patient's referral and authorisation registers (parity C10, D15) */
  registers: PatientClaimRegisters;
  /** The number each line without its own takes from the patient's authorisations (claim field 31) */
  lineAuthorisations: Map<string, LineAuthorisation>;
  /** Authorisations that ended, have not started or are used up for these lines, in plain words */
  authorisationNotices: string[];
  /** The people who can be put on a line */
  linePeople: LinePeople;
  /** Why the lines cannot be saved yet (toothSaveProblem); null when they can */
  toothProblem: string | null;
  /** The lines with one line's details changed; its 8346 material line follows its date, practitioner and fee */
  withLineDetails: (serviceId: string, changes: LineDetailChanges) => ServiceSelection[];
}

/**
 * Why a dental visit's billing lines cannot be saved yet: a line whose code needs a tooth carries none (lines saved
 * before the code's tooth flag was corrected). A fund rejects that claim line ("tooth number required"), so the save
 * is refused with the codes named; null when the lines can be saved. Other disciplines bill no teeth.
 */
export function toothSaveProblem(
  lines: readonly ServiceSelection[],
  tariffs: readonly VisitTariff[],
  practiceType: string | null | undefined
): string | null {
  if (!isDentalPractice(practiceType)) return null;
  const codes = [...new Set(linesWithoutTooth(lines, tariffs).map(line => line.code.trim()))];
  return codes.length > 0 ? `Choose the tooth for ${listTeeth(codes)} before saving.` : null;
}

/**
 * The billing figures both visit screens show under their lines (AddVisitTabs, EditVisitTabs): who pays what per
 * line (co-payment), the totals, services already billed to the patient on another invoice, whether a line's own
 * date, practitioner, discount, ICD-10 codes and fee can be changed, and the codes each line carries.
 * A line nobody has given codes starts with the practice's usual code for its tariff code, else the visit diagnosis's
 * codes (suggestLineIcd10, the rule claim review uses too); what the tab shows is what the invoice saves.
 */
export function useVisitBilling(params: {
  services: readonly ServiceSelection[];
  practiceId: string | null;
  patientId: string | null;
  visitId: string | null;
  visitDateKey: string;
  visitPractitionerId: string | null;
  hasMedicalAid: boolean;
  /** The patient's fund (fund pricing), for the co-payment */
  fund: PatientFundKey | null;
  /** practices.practice_type: dental practices also get the built-in dental ICD-10 suggestions */
  practiceType?: string | null;
  /** The visit's diagnosis as typed: ICD-10 codes written in it are suggested for lines without their own */
  diagnosis?: string | null;
  /** The billable tariffs (each line's quantity rule when its fee changes) */
  tariffs?: readonly VisitTariff[];
  /** Who is billing: a changed fee is recorded against them, and only staff with billing rights may change one */
  user?: { id: string; role?: string | null; is_active?: boolean | null } | null;
  /** Each practitioner's own practice number and rate (useFundPricing loads it); none: the practice's, the list */
  practitionerBilling?: PractitionerBillingMap;
  /**
   * Called with the lines priced again when the visit's practitioner changes to one with another rate: the lines that
   * follow the visit's practitioner move to the new rate (parity D31). Without it nothing is re-priced.
   */
  onServicesChange?: (lines: ServiceSelection[]) => void;
}): VisitBilling {
  const { services, hasMedicalAid, visitDateKey } = params;
  const billingSettings = params.practitionerBilling ?? NO_PRACTITIONER_BILLING;
  const loadedContext = useInvoiceContext({
    practiceId: params.practiceId,
    patientId: params.patientId,
    visitId: params.visitId,
    keepPractitionerIds: [params.visitPractitionerId]
  });
  // The practitioners to choose per line, each with the practice number they bill under and their rate (D31)
  const invoiceContext = useMemo<InvoiceContextState>(
    () =>
      billingSettings.size === 0
        ? loadedContext
        : {
            ...loadedContext,
            practitioners: loadedContext.practitioners.map(option => ({
              ...option,
              ownPracticeNumber: billingSettings.get(option.id)?.practiceNumber ?? null,
              ratePercent: billingSettings.get(option.id)?.ratePercent ?? null
            }))
          },
    [loadedContext, billingSettings]
  );
  const copayRule = hasMedicalAid ? copayFor(invoiceContext.copayRules, params.fund) : null;
  const { copayPercent, copayAmount, levy } = shareOf(copayRule);

  // Every line's split as the invoice saves it: the co-payment per line and the fund's levy once (invoiceLinesAmounts)
  const priced = useMemo(
    () => invoiceLinesAmounts(services, { hasMedicalAid, copayPercent, copayAmount, levy }),
    [services, hasMedicalAid, copayPercent, copayAmount, levy]
  );
  const lineAmounts = useMemo(() => new Map(services.map((service, index) => [service.id, priced.amounts[index]])), [services, priced]);

  const totals = useMemo(() => {
    const sum = (pick: (amounts: InvoiceLineAmounts, index: number) => number) =>
      priced.amounts.reduce((total, amounts, index) => total + (amounts ? pick(amounts, index) : 0), 0);
    return {
      totalCents: sum(amounts => amounts.totalCents),
      fundCents: sum(amounts => amounts.fundCents),
      patientCents: sum(amounts => amounts.patientCents),
      discountCents: sum(amounts => amounts.discountCents),
      levyCents: priced.levyCents,
      // The lines the patient pays all of (never claimed)
      patientOnlyCents: sum((amounts, index) => (services[index]?.paidBy === 'patient' ? amounts.totalCents : 0))
    };
  }, [priced, services]);

  const duplicates = useMemo(
    () =>
      findDuplicateLines(
        services.map(service => ({ key: service.id, code: service.code, serviceDate: service.serviceDate || visitDateKey, teeth: service.teethNumbers ?? [] })),
        invoiceContext.billedLines,
        { excludeInvoiceId: invoiceContext.invoice?.id ?? null }
      ),
    [services, visitDateKey, invoiceContext.billedLines, invoiceContext.invoice]
  );

  const dental = isDentalPractice(params.practiceType);
  const diagnosis = params.diagnosis ?? null;
  const practiceDefaults = invoiceContext.icd10Defaults;
  const claimCodes = invoiceContext.invoice?.claimCodes;
  const lineIcd10 = useMemo(() => {
    const byLine = new Map<string, LineIcd10>();
    services.forEach(service => {
      if (service.icd10Codes !== undefined) {
        byLine.set(service.id, { codes: service.icd10Codes, suggested: false, sourceLabel: null });
        return;
      }
      // An older invoice line without codes keeps those confirmed at claim review for its claim line
      const confirmed = claimCodes?.get(service.id);
      if (confirmed && confirmed.length > 0) {
        byLine.set(service.id, { codes: confirmed, suggested: true, sourceLabel: 'confirmed at claim review' });
        return;
      }
      const suggestion = suggestLineIcd10(service.code, { practiceDefaults, dental, diagnosis });
      byLine.set(service.id, { codes: suggestion.codes, suggested: suggestion.codes.length > 0, sourceLabel: describeIcd10Source(suggestion.source, service.code) });
    });
    return byLine;
  }, [services, claimCodes, practiceDefaults, dental, diagnosis]);

  // The patient's authorisations (parity D15, F18): a medical aid line without its own number takes the register's when
  // the fund, its date and its code match and visits are left (suggestLineAuthorisations); a private patient's take none
  const registers = usePatientClaimRegisters(params.patientId);
  const authorisationContext = useMemo(
    () => ({
      authorisations: registers.authorisations,
      usage: registers.usage,
      fundReference: hasMedicalAid ? params.fund?.reference ?? null : null,
      visitDate: visitDateKey,
      visitKey: params.visitId
    }),
    [registers.authorisations, registers.usage, hasMedicalAid, params.fund?.reference, visitDateKey, params.visitId]
  );
  const lineAuthorisations = useMemo(() => suggestLineAuthorisations(services, authorisationContext), [services, authorisationContext]);
  const notices = useMemo(() => authorisationNotices(services, authorisationContext), [services, authorisationContext]);

  const servicesForInvoice = useMemo(
    () =>
      services.map(service => {
        const codes = service.icd10Codes === undefined ? lineIcd10.get(service.id)?.codes ?? [] : null;
        const registerNumber = service.authorisationNumber === undefined ? lineAuthorisations.get(service.id)?.number : undefined;
        if (!codes?.length && !registerNumber) return service;
        return { ...service, ...(codes?.length ? { icd10Codes: codes } : {}), ...(registerNumber ? { authorisationNumber: registerNumber } : {}) };
      }),
    [services, lineIcd10, lineAuthorisations]
  );
  const linePeople = useMemo<LinePeople>(
    () => ({
      editable: invoiceContext.setup.linePeople === true && !invoiceContext.invoice?.lock,
      referrals: registers.referrals.filter(referral => !referral.removedAt)
    }),
    [invoiceContext.setup.linePeople, invoiceContext.invoice?.lock, registers.referrals]
  );

  const tariffs = params.tariffs;
  const toothProblem = useMemo(() => toothSaveProblem(services, tariffs ?? [], params.practiceType), [services, tariffs, params.practiceType]);

  const withLineDetails = (serviceId: string, changes: LineDetailChanges): ServiceSelection[] => {
    const {
      fee,
      paidBy: payer,
      authorisationNumber: authorisation,
      toothSurfaces: surfaces,
      assistantId: assistant,
      anaesthetistId: anaesthetist,
      referralId: referral,
      ...rest
    } = changes;
    // "Back to the fund's rules" (null) clears the payer. An emptied authorisation number stays empty (''): the line
    // then takes none from the patient's authorisations either. A person or referral taken off (null) is cleared.
    const plain: Partial<ServiceSelection> = {
      ...rest,
      ...(payer !== undefined ? { paidBy: payer ?? undefined } : {}),
      ...(authorisation !== undefined ? { authorisationNumber: authorisation.trim() } : {}),
      ...(assistant !== undefined ? { assistantId: assistant ?? undefined } : {}),
      ...(anaesthetist !== undefined ? { anaesthetistId: anaesthetist ?? undefined } : {}),
      ...(referral !== undefined ? { referralId: referral ?? undefined } : {})
    };
    let lines: readonly ServiceSelection[] = services;
    if (fee !== undefined) {
      // BillingLineDetails checks the fee first (feeChangeProblem), so a refusal here leaves the lines unchanged
      const by = params.user?.id;
      if (fee && !by) return [...services];
      const result = changeLineFee(services, serviceId, fee && by ? { ...fee, by, at: new Date().toISOString() } : null, params.tariffs ?? [], hasMedicalAid);
      if (result.error) return [...services];
      lines = result.services;
    }
    const updated = lines.map(service => {
      if (service.id === serviceId) {
        // Surfaces belong to the line's one tooth, in the chart's order (lineTeeth.ts); none clears them
        return surfaces === undefined ? { ...service, ...plain } : { ...service, ...plain, toothSurfaces: lineSurfaces(service.teethNumbers, surfaces) ?? undefined };
      }
      if (service.isAutoGenerated && service.parentServiceId === serviceId && service.code === MATERIAL_FACTOR_CODE) {
        // The material line belongs to its procedure: same date, practitioner, payer, authorisation and referral
        const { serviceDate, practitionerId } = plain;
        return {
          ...service,
          ...(serviceDate !== undefined ? { serviceDate } : {}),
          ...(practitionerId !== undefined ? { practitionerId } : {}),
          ...('paidBy' in plain ? { paidBy: plain.paidBy } : {}),
          ...('authorisationNumber' in plain ? { authorisationNumber: plain.authorisationNumber } : {}),
          ...('referralId' in plain ? { referralId: plain.referralId } : {})
        };
      }
      return service;
    });
    // Another practitioner treats the line: it is priced at their rate (none: the price list), its 8346 with it (D31)
    if (rest.practitionerId === undefined || billingSettings.size === 0) return updated;
    const treatedBy = rest.practitionerId || params.visitPractitionerId;
    return priceLinesAtRate(updated, new Set([serviceId]), rateOf(treatedBy, billingSettings), params.tariffs ?? [], hasMedicalAid);
  };

  // The visit's practitioner changed to one with another rate: the lines that follow the visit's practitioner (no
  // practitioner of their own) move to the new rate, as if added for them (D31). Not on the first load: a visit opened
  // with its practitioner keeps the prices it was saved with.
  const visitPractitioner = params.visitPractitionerId ?? null;
  const pricedFor = useRef(visitPractitioner);
  const tariffList = params.tariffs;
  const onServicesChange = params.onServicesChange;
  useEffect(() => {
    const before = pricedFor.current;
    if (before === visitPractitioner) return;
    pricedFor.current = visitPractitioner;
    if (!before || !visitPractitioner || !onServicesChange) return;
    const rate = rateOf(visitPractitioner, billingSettings);
    if (rate === rateOf(before, billingSettings)) return;
    const following = new Set(services.filter(line => !line.practitionerId).map(line => line.id));
    const repriced = priceLinesAtRate(services, following, rate, tariffList ?? [], hasMedicalAid);
    if (repriced.some((line, index) => line !== services[index])) onServicesChange(repriced);
  }, [visitPractitioner, services, billingSettings, tariffList, hasMedicalAid, onServicesChange]);

  const locked = Boolean(invoiceContext.invoice?.lock);
  return {
    invoiceContext,
    copayRule,
    lineAmounts,
    totals,
    duplicates,
    lineDetailsEditable: invoiceContext.setup.lineDetails && !locked,
    lineCodesEditable: invoiceContext.setup.lineCodes && !locked,
    linePortionsEditable: invoiceContext.setup.linePortions === true && !locked,
    lineTeethEditable: invoiceContext.setup.lineTeeth === true && !locked,
    canChangeFee: canRaiseInvoices(params.user),
    lineIcd10,
    servicesForInvoice,
    registers,
    lineAuthorisations,
    authorisationNotices: notices,
    linePeople,
    toothProblem,
    withLineDetails
  };
}
