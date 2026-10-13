/**
 * A consent form: the practice's consent template (letter_templates, kind 'consent') merged for the patient and the
 * visit, then signed on the screen with a finger or a mouse. Every word of the printed form is decided here (tested);
 * src/components/letters/letterPdf.ts draws it on the practice letterhead with the signature above the line.
 *
 * What is kept on the file (patient_consents.content, proposals/2026-10-13-patient-file-extras.sql) is this document,
 * signature included, so the form can always be printed again exactly as it was signed.
 */
import { buildMergedLetter, formatLetterDate, type LetterContext, type LetterDocument } from './letters';
import type { LetterParts } from '../templates/listLetters';
import { windhoekClock } from '../patientLists/listDates';

export type ConsentSigner = 'patient' | 'parent_or_guardian' | 'other';

export const CONSENT_SIGNERS: ReadonlyArray<{ value: ConsentSigner; label: string }> = [
  { value: 'patient', label: 'The patient' },
  { value: 'parent_or_guardian', label: 'A parent or guardian' },
  { value: 'other', label: 'Someone else for the patient' }
];

export const isConsentSigner = (value: unknown): value is ConsentSigner => CONSENT_SIGNERS.some(signer => signer.value === value);

export const MAX_SIGNER_NAME = 120;

export interface ConsentSignature {
  signedBy: ConsentSigner;
  /** The name of the person who signs, as they write it */
  signerName: string;
  /** The signature drawn on the screen, as a PNG data URL */
  image: string;
  signedAt: Date;
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** "13 October 2026 at 10:42", in Windhoek time whatever the device's clock zone. */
export function signedAtText(when: Date): string {
  const clock = windhoekClock(when);
  return `${formatLetterDate(clock.dateKey)} at ${pad2(Math.floor(clock.minutes / 60))}:${pad2(clock.minutes % 60)}`;
}

/** Who signed, as printed under the signature. */
export function signerRoleLine(signedBy: ConsentSigner, patientName: string): string {
  if (signedBy === 'patient') return 'The patient';
  if (signedBy === 'parent_or_guardian') return `Parent or guardian of ${patientName}`;
  return `For ${patientName}`;
}

/** What still stops the form being signed, in plain words (the database checks the same limits). */
export function consentSignatureProblems(signature: Partial<ConsentSignature>): string[] {
  const problems: string[] = [];
  const name = (signature.signerName ?? '').replace(/\s+/g, ' ').trim();
  if (!isConsentSigner(signature.signedBy)) problems.push('Say who signs: the patient, a parent or guardian, or someone else for the patient.');
  if (!name) problems.push('Give the name of the person who signs.');
  else if (name.length > MAX_SIGNER_NAME) problems.push(`Keep the name to ${MAX_SIGNER_NAME} characters.`);
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]{20,}$/.test(signature.image ?? '')) problems.push('The signature is missing: sign in the box.');
  return problems;
}

export interface ConsentInput {
  /** The template's name, the form's title on the file ("Consent to treatment") */
  name: string;
  /** The template's parts, merged for this patient (mergeLetterParts) */
  parts: LetterParts;
}

/**
 * The form on the practice letterhead. Before it is signed (signature null) the signature block says how it is signed,
 * for the preview; once signed it carries the signature, who signed and when, and the staff member who witnessed it
 * (the signed-in practitioner or staff member: ctx.author).
 */
export function buildConsentDocument(input: ConsentInput, ctx: LetterContext, signature: ConsentSignature | null): LetterDocument {
  const name = input.name.trim() || 'Consent';
  const letter = buildMergedLetter({ kind: 'letter', name, ...input.parts }, ctx);
  const witness = [ctx.author.name, ctx.author.title, ctx.author.hpcnaNumber ? `HPCNA no ${ctx.author.hpcnaNumber}` : null]
    .filter(part => part && part.trim())
    .join(', ');
  const signerName = signature?.signerName.replace(/\s+/g, ' ').trim() ?? '';
  return {
    ...letter,
    kind: 'consent',
    closing: 'Signature:',
    signatureLines: signature
      ? [signerName, signerRoleLine(signature.signedBy, ctx.patient.name), `Signed on ${signedAtText(signature.signedAt)}`, `Witness: ${witness}`]
      : ['Signed on the screen by the patient, or a parent or guardian', `Witness: ${witness}`],
    signatureImage: signature?.image ?? null,
    recordTitle: name.slice(0, 200),
    email: { ...letter.email, subject: `${name}: ${ctx.patient.name}` }
  };
}
