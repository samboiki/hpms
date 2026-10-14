import React, { useId, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import type { ServiceSelection } from '../../types/billing';
import { formatServiceDate, isValidDateKey } from '../../utils/billing/dates';
import { formatNad, fromCents, hasAtMostDecimals } from '../../utils/billing/money';
import type { TreatingPractitionerOption } from '../../utils/billing/invoiceRights';
import { MAX_FEE_REASON_LENGTH, type InvoiceLineAmounts } from '../../utils/billing/invoiceLineRow';
import { icd10CodesOf, icd10SelectionOf, type Icd10Selection } from '../../utils/billing/icd10';
import { MAX_AUTHORISATION_LENGTH, PAID_BY_LABELS, isPaidBy, parseAuthorisationNumber, type PaidBy } from '../../utils/billing/lineSplit';
import { lineTeethLabel } from '../../utils/dental/lineTeeth';
import { surfaceCodeProblem, surfaceCountForCode } from '../../utils/dental/workTypes';
import Icd10CodeInput from '../billing/Icd10CodeInput';
import { SurfacePicker } from '../dental/ToothForms';
import ToothIcon from '../dental/ToothIcon';
import { describeReferrer, referralState } from '../../utils/billing/referrals';
import type { LineAuthorisation } from '../../utils/billing/authorisations';
import { feeChangeProblem } from './visitBillingLines';
import type { LineIcd10, LinePeople } from './useVisitBilling';

export interface LineDetailChanges {
  serviceDate?: string;
  practitionerId?: string;
  discountAmount?: number;
  /** The narrative printed under the line on the invoice (invoice_services.notes) */
  notes?: string;
  /** ICD-10 codes, main code first */
  icd10Codes?: string[];
  /** A new fee per unit with its reason; null puts the line back on the fee it had before */
  fee?: { unitPrice: number; reason: string } | null;
  /** Who pays the line when one side pays all of it; null: the fund's co-payment and levy */
  paidBy?: PaidBy | null;
  /** The fund's authorisation number for the line; empty for none */
  authorisationNumber?: string;
  /** Surfaces of the line's one tooth (dental); null or empty for none */
  toothSurfaces?: string | null;
  /** The assistant and the anaesthetist on the line (users.id); null for none */
  assistantId?: string | null;
  anaesthetistId?: string | null;
  /** The line's own referral from the patient's register; null: the visit's */
  referralId?: string | null;
}

interface BillingLineDetailsProps {
  service: ServiceSelection;
  /** The visit's date and practitioner: what a line uses unless it has its own */
  visitDate: string;
  visitPractitionerId: string | null;
  practitioners: readonly TreatingPractitionerOption[];
  /** True once the database stores a line's own date, practitioner and discount, and the invoice is not locked */
  editable: boolean;
  hasMedicalAid: boolean;
  /** The line's split (fund, patient, discount); null when it cannot be priced */
  amounts: InvoiceLineAmounts | null;
  today: string;
  onChange: (changes: LineDetailChanges) => void;
  /** The line's ICD-10 codes: its own or the suggested ones */
  icd10?: LineIcd10;
  /** True once the database stores a line's ICD-10 codes and changed fee, and the invoice is not locked */
  codesEditable?: boolean;
  /** The signed-in user has billing rights, so may change the fee */
  canChangeFee?: boolean;
  /** True once the database stores who pays a line and its authorisation number, and the invoice is not locked */
  portionsEditable?: boolean;
  /** True once the database stores a line's tooth surfaces and quadrant, and the invoice is not locked */
  teethEditable?: boolean;
  /** The number the line takes from the patient's authorisations when it has none of its own */
  authorisation?: LineAuthorisation | null;
  /** The assistant, anaesthetist and own referral a line can name (parity D7) */
  people?: LinePeople;
  /** What the line still needs because of its code's rules: the fund's authorisation number, the lab slip, the time (codeRules.ts) */
  ruleNotices?: readonly string[];
}

/** The longest narrative kept under a line: it is printed on the invoice. */
export const MAX_NARRATIVE_LENGTH = 200;

const parseAmount = (text: string): number | null => {
  const clean = text.replace(/[N$\s,]/gi, '');
  if (clean === '') return 0;
  const value = Number(clean);
  return Number.isFinite(value) && value >= 0 && hasAtMostDecimals(value, 2) ? value : null;
};

const INPUT = 'mt-0.5 block w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900';

/** A price as the fee field shows it ("450.00"); a stored price may arrive as text. */
const priceText = (value: unknown): string => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : '';
};

/**
 * Under a billing line: the date of the service and who gave it (the visit's unless changed), its ICD-10 codes, a fee
 * changed from the price list, the discount, what the patient pays and the note printed under it. "Change" opens a
 * small editor for this line only; the defaults stay out of the way.
 */
const BillingLineDetails: React.FC<BillingLineDetailsProps> = ({
  service,
  visitDate,
  visitPractitionerId,
  practitioners,
  editable,
  hasMedicalAid,
  amounts,
  today,
  onChange,
  icd10,
  codesEditable = false,
  canChangeFee = false,
  portionsEditable = false,
  teethEditable = false,
  authorisation = null,
  people,
  ruleNotices
}) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [authorisationText, setAuthorisationText] = useState(service.authorisationNumber ?? '');
  const [authorisationError, setAuthorisationError] = useState<string | null>(null);
  const [notesText, setNotesText] = useState(service.notes ?? '');
  const [codesDraft, setCodesDraft] = useState<Icd10Selection>(icd10SelectionOf(icd10?.codes ?? []));
  const [feeText, setFeeText] = useState(priceText(service.unitPrice));
  const [reasonText, setReasonText] = useState(service.feeOverride?.reason ?? '');
  const [feeError, setFeeError] = useState<string | null>(null);

  const date = service.serviceDate || visitDate;
  const practitionerId = service.practitionerId || visitPractitionerId;
  const practitioner = practitioners.find(option => option.id === practitionerId);
  const ownDate = Boolean(service.serviceDate) && service.serviceDate !== visitDate;
  const ownPractitioner = Boolean(service.practitionerId) && service.practitionerId !== visitPractitionerId;
  const codes = icd10?.codes ?? [];
  // A line the patient pays all of is not sent to the medical aid, so it needs no diagnosis code for a claim
  const claimed = hasMedicalAid && service.paidBy !== 'patient';
  // What the box offers first when the line has no code of its own, and why (never filled in by itself)
  const offeredCodes = icd10?.suggested ? codes : icd10?.offered;
  const offeredLabel = icd10?.suggested ? null : icd10?.offeredLabel;
  const narrative = service.notes?.trim() ?? '';
  const feeChangeable = codesEditable && canChangeFee && !service.isAutoGenerated;
  // Who pays and the authorisation number matter only for a medical aid patient; an 8346 line follows its procedure
  const portionChangeable = portionsEditable && hasMedicalAid && !service.isAutoGenerated;
  // Surfaces belong to one tooth and matter for a code billed by surfaces (a filling): marked here when the chart did not
  const oneTooth = (service.teethNumbers ?? []).filter(tooth => tooth.trim()).length === 1 ? (service.teethNumbers ?? [])[0].trim() : null;
  const surfacesChangeable =
    teethEditable && !service.isAutoGenerated && oneTooth !== null && (surfaceCountForCode(service.code) !== null || Boolean(service.toothSurfaces));
  // The assistant, anaesthetist and the line's own referral (D7); a material line follows its procedure
  const peopleChangeable = Boolean(people?.editable) && !service.isAutoGenerated;
  const nameOf = (userId: string | undefined) => (userId ? practitioners.find(option => option.id === userId)?.label ?? 'A former colleague' : null);
  const assistantName = nameOf(service.assistantId);
  const anaesthetistName = nameOf(service.anaesthetistId);
  const ownReferral = service.referralId ? people?.referrals.find(referral => referral.id === service.referralId) ?? null : null;
  // The number from the patient's authorisations, while the line has none of its own
  const registerNumber = service.authorisationNumber === undefined ? authorisation?.number ?? null : null;
  const canEdit = editable || codesEditable || portionChangeable || surfacesChangeable || peopleChangeable;
  // Tooth surfaces and the quadrant in words ("Tooth 46, MO"); the code must be the one for that many surfaces
  const teethLabel = service.toothSurfaces || service.toothQuadrant ? lineTeethLabel({ teeth: service.teethNumbers, surfaces: service.toothSurfaces, quadrant: service.toothQuadrant }) : '';
  const surfaceProblem = surfaceCodeProblem(service.code, service.toothSurfaces);

  const toggle = () => {
    if (!open) {
      // The editor starts from what the line shows now
      setCodesDraft(icd10SelectionOf(codes));
      setNotesText(service.notes ?? '');
      setFeeText(priceText(service.unitPrice));
      setReasonText(service.feeOverride?.reason ?? '');
      setFeeError(null);
      setAuthorisationText(service.authorisationNumber ?? '');
      setAuthorisationError(null);
    }
    setOpen(value => !value);
  };

  const applyAuthorisation = () => {
    const parsed = parseAuthorisationNumber(authorisationText);
    if (!parsed.ok) {
      setAuthorisationError(plainWords(parsed.message));
      return;
    }
    setAuthorisationError(null);
    if ((parsed.value ?? '') !== (service.authorisationNumber ?? '')) onChange({ authorisationNumber: parsed.value ?? '' });
  };

  const changeCodes = (selection: Icd10Selection) => {
    setCodesDraft(selection);
    onChange({ icd10Codes: icd10CodesOf(selection) });
  };

  const applyFee = () => {
    const value = parseAmount(feeText);
    if (value === null) {
      setFeeError('Enter the fee as an amount such as 400 or 400.00.');
      return;
    }
    const problem = feeChangeProblem(service, value, reasonText);
    if (problem) {
      setFeeError(problem);
      return;
    }
    setFeeError(null);
    onChange({ fee: { unitPrice: value, reason: reasonText.trim() } });
  };

  const undoFee = () => {
    if (!service.feeOverride) return;
    setFeeError(null);
    setFeeText(priceText(service.feeOverride.fromUnitPrice));
    setReasonText('');
    onChange({ fee: null });
  };

  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        <span className={`inline-flex items-center gap-1 ${ownDate ? 'font-medium text-cyan-700' : ''}`}>
          <Icon icon="solar:calendar-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
          {formatServiceDate(date)}
        </span>
        <span className={`inline-flex items-center gap-1 ${ownPractitioner ? 'font-medium text-cyan-700' : ''}`}>
          <Icon icon="solar:stethoscope-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
          {practitioner?.label ?? 'Practitioner not chosen'}
        </span>
        {practitioner?.ownPracticeNumber && (
          <span className="inline-flex items-center gap-1 font-medium text-cyan-700">
            <Icon icon="solar:buildings-2-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
            Bills under practice no {practitioner.ownPracticeNumber}
          </span>
        )}
        {teethLabel && (
          <span className="inline-flex items-center gap-1 font-medium text-cyan-700">
            <ToothIcon className="h-3.5 w-3.5" />
            {teethLabel}
          </span>
        )}
        {icd10 && codes.length > 0 && (
          <span className={`inline-flex items-center gap-1 ${icd10.suggested ? '' : 'font-medium text-cyan-700'}`}>
            <Icon icon="solar:clipboard-heart-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
            ICD-10 {codes.join(', ')}
            {icd10.suggested && icd10.sourceLabel ? ` (${icd10.sourceLabel})` : ''}
          </span>
        )}
        {icd10 && codes.length === 0 && (
          <span className={`inline-flex items-center gap-1 ${claimed ? 'text-amber-700' : ''}`}>
            <Icon icon="solar:clipboard-heart-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
            {claimed ? 'Needs ICD-10: the medical aid needs a diagnosis code' : 'No ICD-10 code'}
          </span>
        )}
        {service.feeOverride && (
          <span className="inline-flex items-center gap-1 font-medium text-cyan-700">
            <Icon icon="solar:tag-price-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
            Fee changed from {formatNad(service.feeOverride.fromUnitPrice)}: {service.feeOverride.reason}
          </span>
        )}
        {amounts && amounts.discountCents > 0 && <span className="text-emerald-700">Discount {formatNad(fromCents(amounts.discountCents))}</span>}
        {hasMedicalAid && service.paidBy && (
          <span className={`inline-flex items-center gap-1 font-medium ${service.paidBy === 'patient' ? 'text-amber-800' : 'text-cyan-700'}`}>
            <Icon icon={service.paidBy === 'patient' ? 'solar:user-hand-up-bold-duotone' : 'solar:shield-check-bold-duotone'} className="h-3.5 w-3.5" aria-hidden="true" />
            {PAID_BY_LABELS[service.paidBy]}
          </span>
        )}
        {hasMedicalAid && amounts && !service.paidBy && amounts.patientCents > 0 && (
          <span className="text-amber-700">
            Medical aid {formatNad(fromCents(amounts.fundCents))}, patient {formatNad(fromCents(amounts.patientCents))}
          </span>
        )}
        {hasMedicalAid && service.authorisationNumber && (
          <span className="inline-flex items-center gap-1 font-medium text-cyan-700">
            <Icon icon="solar:verified-check-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
            Authorisation {service.authorisationNumber}
          </span>
        )}
        {hasMedicalAid && registerNumber && (
          <span className="inline-flex items-center gap-1">
            <Icon icon="solar:verified-check-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
            Authorisation {registerNumber} (from the patient&apos;s authorisations)
          </span>
        )}
        {assistantName && (
          <span className="inline-flex items-center gap-1 font-medium text-cyan-700">
            <Icon icon="solar:users-group-rounded-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
            Assistant {assistantName}
          </span>
        )}
        {anaesthetistName && (
          <span className="inline-flex items-center gap-1 font-medium text-cyan-700">
            <Icon icon="solar:syringe-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
            Anaesthetist {anaesthetistName}
          </span>
        )}
        {hasMedicalAid && service.referralId && (
          <span className="inline-flex items-center gap-1 font-medium text-cyan-700">
            <Icon icon="solar:document-medicine-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
            {ownReferral ? `Referred by ${ownReferral.referringName}` : 'Own referral (no longer on the file)'}
          </span>
        )}
        {service.linkedFrom && (
          <span className="inline-flex items-center gap-1">
            <Icon icon="solar:link-round-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
            Added with {service.linkedFrom}
          </span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={`${id}-editor`}
            className="font-medium text-cyan-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
          >
            {open ? 'Close' : 'Change'}
          </button>
        )}
      </div>
      {narrative && (
        <p className="mt-0.5 flex items-start gap-1 text-xs italic text-gray-600">
          <Icon icon="solar:notes-bold-duotone" className="mt-px h-3.5 w-3.5 flex-shrink-0 not-italic" aria-hidden="true" />
          <span className="break-words">{narrative}</span>
        </p>
      )}
      {surfaceProblem && (
        <p className="mt-0.5 flex items-start gap-1 text-xs font-medium text-amber-800">
          <Icon icon="solar:danger-triangle-bold-duotone" className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span>{surfaceProblem.message}</span>
        </p>
      )}
      {ruleNotices?.map(notice => (
        <p key={notice} className="mt-0.5 flex items-start gap-1 text-xs font-medium text-amber-800">
          <Icon icon="solar:danger-triangle-bold-duotone" className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </p>
      ))}

      {open && canEdit && (
        <div id={`${id}-editor`} className="mt-2 min-w-[15rem] space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
          {editable && (
            <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
              <label className="text-xs text-gray-600">
                Date of service
                <input
                  type="date"
                  value={date}
                  max={today}
                  onChange={event => {
                    const value = event.target.value;
                    if (isValidDateKey(value) && value <= today) onChange({ serviceDate: value });
                  }}
                  className={INPUT}
                />
              </label>
              <label className="text-xs text-gray-600">
                Treating practitioner
                <select value={practitionerId ?? ''} onChange={event => onChange({ practitionerId: event.target.value })} className={INPUT}>
                  {!practitionerId && <option value="">Choose a practitioner</option>}
                  {practitioners.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                      {option.id === visitPractitionerId ? ' (visit)' : ''}
                      {option.ownPracticeNumber ? ' - own practice number' : ''}
                      {option.hpcnaNumber ? '' : ' - no HPCNA number'}
                    </option>
                  ))}
                </select>
                {practitioner?.warning && <span className="mt-0.5 block text-amber-700">{practitioner.warning}</span>}
              </label>
            </div>
          )}

          {surfacesChangeable && oneTooth !== null && (
            <div className="text-xs text-gray-600">
              <SurfacePicker tooth={oneTooth} value={service.toothSurfaces ?? ''} onChange={next => onChange({ toothSurfaces: next || null })} />
              <span className="mt-0.5 block text-gray-500">The surfaces of tooth {oneTooth}: printed on the invoice and sent to the medical aid with the code.</span>
            </div>
          )}

          {codesEditable && (
            <Icd10CodeInput
              value={codesDraft}
              onChange={changeCodes}
              label="ICD-10 code"
              required={hasMedicalAid}
              showRequiredError={hasMedicalAid}
              suggestedCodes={offeredCodes}
              suggestedReason={offeredLabel ? offeredLabel.charAt(0).toUpperCase() + offeredLabel.slice(1) : undefined}
              tariffCode={service.code}
            />
          )}

          {portionChangeable && (
            <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
              <label className="text-xs text-gray-600">
                Who pays this line
                <select
                  value={service.paidBy ?? 'split'}
                  onChange={event => onChange({ paidBy: isPaidBy(event.target.value) ? event.target.value : null })}
                  className={INPUT}
                >
                  <option value="split">{PAID_BY_LABELS.split}</option>
                  <option value="fund">{PAID_BY_LABELS.fund}</option>
                  <option value="patient">{PAID_BY_LABELS.patient}</option>
                </select>
                {service.paidBy === 'patient' && <span className="mt-0.5 block text-gray-500">This line is not sent to the medical aid.</span>}
              </label>
              <div className="text-xs text-gray-600">
                <label>
                  Authorisation number (if the fund gave one)
                  <input
                    type="text"
                    value={authorisationText}
                    maxLength={MAX_AUTHORISATION_LENGTH}
                    placeholder={registerNumber ? `From the patient's authorisations: ${registerNumber}` : 'For example: 123456'}
                    onChange={event => setAuthorisationText(event.target.value)}
                    onBlur={applyAuthorisation}
                    aria-invalid={authorisationError ? true : undefined}
                    aria-describedby={authorisationError ? `${id}-authorisation-error` : undefined}
                    className={INPUT}
                  />
                </label>
                {authorisationError && (
                  <span id={`${id}-authorisation-error`} className="mt-0.5 block text-red-700" role="alert">
                    {authorisationError}
                  </span>
                )}
                {registerNumber && !authorisationError && (
                  <span className="mt-0.5 block text-gray-500">
                    The claim carries {registerNumber} unless you type another number.{' '}
                    <button
                      type="button"
                      onClick={() => onChange({ authorisationNumber: '' })}
                      className="font-medium text-cyan-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
                    >
                      Not on this line
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}

          {peopleChangeable && people && (
            <fieldset className="text-xs text-gray-600">
              <legend className="mb-0.5">People on this line</legend>
              <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
                <label>
                  Assistant
                  <select value={service.assistantId ?? ''} onChange={event => onChange({ assistantId: event.target.value || null })} className={INPUT}>
                    <option value="">None</option>
                    {practitioners.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </label>
                <label>
                  Anaesthetist
                  <select value={service.anaesthetistId ?? ''} onChange={event => onChange({ anaesthetistId: event.target.value || null })} className={INPUT}>
                    <option value="">None</option>
                    {practitioners.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </label>
                {hasMedicalAid && (
                  <label>
                    Referring practitioner
                    <select value={service.referralId ?? ''} onChange={event => onChange({ referralId: event.target.value || null })} className={INPUT}>
                      <option value="">As the visit&apos;s referral</option>
                      {service.referralId && !ownReferral && <option value={service.referralId}>A referral no longer on the file</option>}
                      {people.referrals.map(referral => (
                        <option key={referral.id} value={referral.id}>
                          {describeReferrer(referral)}
                          {referralState(referral, date) === 'expired' ? ' (expired on this date)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {hasMedicalAid && people.referrals.length === 0 && (
                <span className="mt-0.5 block text-gray-500">Referrals are recorded on the patient file, Billing tab.</span>
              )}
            </fieldset>
          )}

          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            {feeChangeable && (
              <fieldset className="text-xs text-gray-600">
                <legend className="mb-0.5">Fee per unit (N$)</legend>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="w-28">
                    <span className="sr-only">New fee per unit in N$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={feeText}
                      onChange={event => setFeeText(event.target.value)}
                      aria-invalid={feeError ? true : undefined}
                      aria-describedby={feeError ? `${id}-fee-error` : undefined}
                      className={INPUT}
                    />
                  </label>
                  <label className="min-w-[10rem] flex-1">
                    Reason
                    <input
                      type="text"
                      value={reasonText}
                      maxLength={MAX_FEE_REASON_LENGTH}
                      placeholder="For example: pensioner rate"
                      onChange={event => setReasonText(event.target.value)}
                      className={INPUT}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={applyFee}
                    className="rounded border border-cyan-600 bg-white px-2 py-1 text-sm font-medium text-cyan-700 hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                  >
                    Use this fee
                  </button>
                  {service.feeOverride && (
                    <button
                      type="button"
                      onClick={undoFee}
                      className="rounded px-2 py-1 text-sm font-medium text-gray-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    >
                      Back to {formatNad(service.feeOverride.fromUnitPrice)}
                    </button>
                  )}
                </div>
                {feeError ? (
                  <span id={`${id}-fee-error`} className="mt-0.5 block text-red-700" role="alert">
                    {feeError}
                  </span>
                ) : (
                  hasMedicalAid && <span className="mt-0.5 block text-gray-500">The medical aid is claimed this fee.</span>
                )}
              </fieldset>
            )}
            <label className="text-xs text-gray-600">
              Note printed under this line
              <input
                type="text"
                value={notesText}
                maxLength={MAX_NARRATIVE_LENGTH}
                placeholder="For example: after-hours visit"
                onChange={event => setNotesText(event.target.value)}
                onBlur={() => {
                  if (notesText.trim() !== narrative) onChange({ notes: notesText.trim() });
                }}
                className={INPUT}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingLineDetails;
