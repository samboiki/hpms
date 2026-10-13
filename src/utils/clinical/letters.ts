/**
 * Letters written from a visit: a referral letter, a general letter ("to whom it may concern"), a letter from one of
 * the practice's templates and the sick note (in the practice's own wording when it keeps a sick note template).
 * Every word of the printed letter is decided here (tested); src/components/letters/letterPdf.ts only draws it on the
 * practice's letterhead.
 *
 * Privacy: the email subject and body never carry a diagnosis, and the sick note shows a diagnosis
 * only when the practitioner wrote one on the sick note itself (an employer is not entitled to it).
 */
import { isValidDateKey, daysBetweenKeys, addDaysToKey } from '../billing/dates';

/** 'consent': a consent form signed on the screen (src/utils/clinical/consent.ts) */
export type LetterKind = 'referral' | 'letter' | 'sick_note' | 'consent';
export type ReferralUrgency = 'routine' | 'soon' | 'urgent';

export const URGENCY_LABELS: Readonly<Record<ReferralUrgency, string>> = {
  routine: 'Routine',
  soon: 'Soon (within 2 weeks)',
  urgent: 'Urgent'
};

export interface LetterPractice {
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  postalCode: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  practiceNumber: string | null;
  primaryColor: string | null;
}

export interface LetterAuthor {
  name: string;
  /** e.g. "General practitioner" (users.job_title) */
  title?: string | null;
  /** Health Professions Council of Namibia registration number (users.hpcsa_number) */
  hpcnaNumber?: string | null;
}

export interface LetterPatient {
  name: string;
  dateOfBirth?: string | null;
  idNumber?: string | null;
}

/** What the letter can say about the patient's record (all optional, all already on file) */
export interface LetterContext {
  practice: LetterPractice;
  author: LetterAuthor;
  patient: LetterPatient;
  /** yyyy-MM-dd, the Windhoek date the letter is written */
  letterDate: string;
  visitDate?: string | null;
  diagnosis?: string | null;
  /** "Amlodipine 5 mg, once daily" */
  medicines?: readonly string[];
  /** "Penicillin (severe: anaphylaxis)" */
  allergies?: readonly string[];
  noKnownAllergies?: boolean;
  /** "Essential (primary) hypertension (I10)" */
  problems?: readonly string[];
}

export interface ReferralInput {
  toName: string;
  toPractice: string;
  toSpecialty: string;
  toEmail: string;
  urgency: ReferralUrgency;
  reason: string;
  history: string;
  includeDiagnosis: boolean;
  includeMedicines: boolean;
  includeAllergies: boolean;
  includeProblems: boolean;
  /** yyyy-MM-dd or '' */
  validUntil: string;
}

export interface GeneralLetterInput {
  toName: string;
  toEmail: string;
  subject: string;
  body: string;
}

export interface SickNoteInput {
  formNumber: string | null;
  fromDate: string;
  toDate: string;
  diagnosis: string | null;
  diagnosisCode: string | null;
}

export interface LetterSection {
  heading: string;
  lines: string[];
}

export interface LetterDocument {
  kind: LetterKind;
  /** Big title on the letterhead: "REFERRAL LETTER", "LETTER", "MEDICAL CERTIFICATE" */
  title: string;
  /** "No 0042" for sick notes */
  reference: string | null;
  dateText: string;
  recipientLines: string[];
  /** Bold line under the recipient: "Re: Ndapewa Shilongo (born 14 May 1990)" */
  subjectLine: string;
  salutation: string;
  paragraphs: string[];
  sections: LetterSection[];
  closing: string;
  signatureLines: string[];
  /** A signature drawn on the screen (PNG data URL), printed above the signature line; consent forms only */
  signatureImage?: string | null;
  practiceName: string;
  practiceLines: string[];
  primaryColor: string;
  fileName: string;
  /** Short title kept on the patient file ("Referral to Dr M Iipinge") */
  recordTitle: string;
  email: { subject: string; text: string; html: string };
}

const DEFAULT_COLOUR = '#01b9d4';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const present = (value: string | null | undefined): value is string => Boolean(value && value.trim());

/** The closing as printed: "Kind regards," but "Signature:" as written (letterPdf.ts and LetterPreview.tsx) */
export const closingLine = (closing: string): string => (/[:,.]$/.test(closing) ? closing : `${closing},`);

/** "7 October 2026" (day first, as letters are dated in Namibia) */
export function formatLetterDate(key: string | null | undefined): string {
  if (!isValidDateKey(key)) return '';
  const [year, month, day] = key.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fileSafe = (value: string): string => value.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'patient';

/** The practice's address and contacts under its name on a letterhead (letters, receipts and statements alike) */
export const practiceLinesOf = (practice: Omit<LetterPractice, 'name' | 'primaryColor'>): string[] => {
  const place = [practice.city, practice.country].filter(present).join(', ');
  return [
    practice.address,
    place ? `${place}${present(practice.postalCode) ? ` ${practice.postalCode}` : ''}` : null,
    present(practice.contactPhone) ? `Tel: ${practice.contactPhone}` : null,
    present(practice.contactEmail) ? `Email: ${practice.contactEmail}` : null,
    present(practice.practiceNumber) ? `Practice no: ${practice.practiceNumber}` : null
  ].filter(present);
};

const signatureLinesOf = (author: LetterAuthor): string[] =>
  [author.name, author.title, present(author.hpcnaNumber) ? `HPCNA no: ${author.hpcnaNumber}` : null].filter(present);

const patientSubject = (patient: LetterPatient): string => {
  const born = formatLetterDate(patient.dateOfBirth);
  const details = [born ? `born ${born}` : null, present(patient.idNumber) ? `ID ${patient.idNumber}` : null].filter(present);
  return `Re: ${patient.name}${details.length ? ` (${details.join(', ')})` : ''}`;
};

const emailFor = (practice: LetterPractice, author: LetterAuthor, intro: string, attachmentName: string): LetterDocument['email'] => {
  const contact = [present(practice.contactPhone) ? practice.contactPhone : null, present(practice.contactEmail) ? practice.contactEmail : null]
    .filter(present)
    .join(' or ');
  const lines = [
    'Good day,',
    intro,
    `The letter is attached (${attachmentName}).`,
    contact ? `Questions: ${practice.name}, ${contact}.` : `Questions: ${practice.name}.`,
    'Kind regards,',
    author.name,
    practice.name
  ];
  return {
    subject: '',
    text: lines.join('\n\n'),
    html: lines.map(line => `<p>${escapeHtml(line)}</p>`).join('')
  };
};

const base = (ctx: LetterContext) => ({
  dateText: formatLetterDate(ctx.letterDate),
  practiceName: ctx.practice.name,
  practiceLines: practiceLinesOf(ctx.practice),
  primaryColor: present(ctx.practice.primaryColor) ? ctx.practice.primaryColor : DEFAULT_COLOUR,
  signatureLines: signatureLinesOf(ctx.author),
  closing: 'Kind regards'
});

/** Paragraphs are separated by a blank line; a single line break inside one is a space. */
const paragraphsOf = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);

// ---------------------------------------------------------------------------------------------
// Referral letter
// ---------------------------------------------------------------------------------------------

export function validateReferral(input: ReferralInput, letterDate: string): string[] {
  const problems: string[] = [];
  if (!input.toName.trim()) problems.push('Who is the patient referred to?');
  if (input.reason.trim().length < 3) problems.push('Give the reason for the referral.');
  if (input.toEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.toEmail.trim())) problems.push('The email address is not complete.');
  if (input.validUntil && (!isValidDateKey(input.validUntil) || input.validUntil < letterDate)) {
    problems.push('The referral cannot expire before the date of the letter.');
  }
  return problems;
}

export function buildReferralLetter(input: ReferralInput, ctx: LetterContext): LetterDocument {
  const common = base(ctx);
  const recipientLines = [input.toName.trim(), input.toSpecialty.trim(), input.toPractice.trim()].filter(present);
  const addressee = input.toName.trim();
  const salutation = /^(dr|prof|doctor)\b/i.test(addressee) ? `Dear ${addressee}` : 'Dear colleague';
  const seen = formatLetterDate(ctx.visitDate);

  const paragraphs = [
    `Thank you for seeing ${ctx.patient.name}${seen ? `, whom I saw on ${seen}` : ''}.`,
    `Reason for referral: ${input.reason.trim()}`
  ];
  if (input.urgency !== 'routine') paragraphs.push(`Urgency: ${URGENCY_LABELS[input.urgency]}.`);

  const sections: LetterSection[] = [];
  if (present(input.history)) sections.push({ heading: 'History and findings', lines: [input.history.trim()] });
  if (input.includeDiagnosis && present(ctx.diagnosis)) sections.push({ heading: 'Working diagnosis', lines: [ctx.diagnosis.trim()] });
  if (input.includeProblems && ctx.problems && ctx.problems.length > 0) sections.push({ heading: 'Active problems', lines: [...ctx.problems] });
  if (input.includeMedicines) {
    sections.push({ heading: 'Current medicines', lines: ctx.medicines && ctx.medicines.length > 0 ? [...ctx.medicines] : ['None recorded'] });
  }
  if (input.includeAllergies) {
    const lines = ctx.allergies && ctx.allergies.length > 0
      ? [...ctx.allergies]
      : [ctx.noKnownAllergies ? 'No known allergies' : 'Allergies not recorded'];
    sections.push({ heading: 'Allergies', lines });
  }
  if (input.validUntil) sections.push({ heading: 'Referral valid until', lines: [formatLetterDate(input.validUntil)] });

  const fileName = `referral-${fileSafe(ctx.patient.name)}-${ctx.letterDate}.pdf`;
  const email = emailFor(ctx.practice, ctx.author, `Please find a referral for ${ctx.patient.name} from ${ctx.author.name}.`, fileName);
  return {
    kind: 'referral',
    title: 'REFERRAL LETTER',
    reference: null,
    ...common,
    recipientLines,
    subjectLine: patientSubject(ctx.patient),
    salutation,
    paragraphs,
    sections,
    fileName,
    recordTitle: `Referral to ${addressee}${present(input.toSpecialty) ? ` (${input.toSpecialty.trim()})` : ''}`,
    email: { ...email, subject: `Referral: ${ctx.patient.name}` }
  };
}

// ---------------------------------------------------------------------------------------------
// General letter
// ---------------------------------------------------------------------------------------------

export function validateGeneralLetter(input: GeneralLetterInput): string[] {
  const problems: string[] = [];
  if (!input.subject.trim()) problems.push('Give the letter a subject.');
  if (input.body.trim().length < 3) problems.push('Write the letter.');
  if (input.toEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.toEmail.trim())) problems.push('The email address is not complete.');
  return problems;
}

export function buildGeneralLetter(input: GeneralLetterInput, ctx: LetterContext): LetterDocument {
  const common = base(ctx);
  const toName = input.toName.trim();
  const fileName = `letter-${fileSafe(ctx.patient.name)}-${ctx.letterDate}.pdf`;
  const email = emailFor(ctx.practice, ctx.author, `Please find a letter about ${ctx.patient.name} from ${ctx.author.name}.`, fileName);
  return {
    kind: 'letter',
    title: 'LETTER',
    reference: null,
    ...common,
    recipientLines: toName ? [toName] : [],
    subjectLine: `${patientSubject(ctx.patient)}: ${input.subject.trim()}`,
    salutation: toName ? `Dear ${toName}` : 'To whom it may concern',
    paragraphs: paragraphsOf(input.body),
    sections: [],
    fileName,
    recordTitle: input.subject.trim(),
    email: { ...email, subject: `${input.subject.trim()}: ${ctx.patient.name}` }
  };
}

// ---------------------------------------------------------------------------------------------
// A letter from one of the practice's templates (its parts already merged: utils/templates/mergeFields.ts)
// ---------------------------------------------------------------------------------------------

export interface MergedLetterInput {
  /** 'referral' for a referral template, 'letter' for the others */
  kind: 'referral' | 'letter';
  /** The template's name, kept on the patient file ("Fit to return to work") */
  name: string;
  /** The big title on the letterhead */
  title: string;
  /** The "To" block, one line each; '' for none */
  recipient: string;
  /** The bold line above the greeting; '' for none */
  subject: string;
  /** "To whom it may concern"; '' for none */
  greeting: string;
  /** Paragraphs separated by a blank line */
  body: string;
}

export function buildMergedLetter(input: MergedLetterInput, ctx: LetterContext): LetterDocument {
  const common = base(ctx);
  const name = input.name.trim() || 'Letter';
  const fileName = `${fileSafe(name).toLowerCase()}-${fileSafe(ctx.patient.name)}-${ctx.letterDate}.pdf`;
  const email = emailFor(ctx.practice, ctx.author, `Please find a letter about ${ctx.patient.name} from ${ctx.author.name}.`, fileName);
  return {
    kind: input.kind,
    title: input.title.trim() || 'LETTER',
    reference: null,
    ...common,
    recipientLines: input.recipient.split(/\n/).map(line => line.trim()).filter(Boolean),
    subjectLine: input.subject.trim(),
    salutation: input.greeting.trim(),
    paragraphs: paragraphsOf(input.body),
    sections: [],
    fileName,
    recordTitle: name.slice(0, 200),
    email: { ...email, subject: `${name}: ${ctx.patient.name}` }
  };
}

// ---------------------------------------------------------------------------------------------
// Sick note (the visit's leave form, printed)
// ---------------------------------------------------------------------------------------------

/** The practice's own sick note wording (its sick note template, merged for this note). */
export interface SickNoteWording {
  title: string;
  subject: string;
  greeting: string;
  /** Merged, with fields that had no value already taken out */
  body: string;
  /** The wording itself shows the diagnosis, so it is not added again below it */
  showsDiagnosis: boolean;
}

export function buildSickNote(input: SickNoteInput, ctx: LetterContext, wording: SickNoteWording | null = null): LetterDocument {
  const common = base(ctx);
  const valid = isValidDateKey(input.fromDate) && isValidDateKey(input.toDate) && input.toDate >= input.fromDate;
  const days = valid ? daysBetweenKeys(input.fromDate, input.toDate) + 1 : 0;
  const seen = formatLetterDate(ctx.visitDate);
  const paragraphs = wording
    ? paragraphsOf(wording.body)
    : [
        `This is to certify that ${ctx.patient.name}${present(ctx.patient.idNumber) ? ` (ID ${ctx.patient.idNumber})` : ''} was examined by me${seen ? ` on ${seen}` : ''}.`,
        valid
          ? `In my opinion the patient is unfit for work or school from ${formatLetterDate(input.fromDate)} to ${formatLetterDate(input.toDate)} inclusive (${days} ${days === 1 ? 'day' : 'days'}), and may return on ${formatLetterDate(addDaysToKey(input.toDate, 1))}.`
          : 'In my opinion the patient is unfit for work or school.'
      ];
  const sections: LetterSection[] = [];
  const diagnosis = [input.diagnosis?.trim(), present(input.diagnosisCode) ? `(${input.diagnosisCode.trim()})` : null].filter(present).join(' ');
  if (diagnosis && !wording?.showsDiagnosis) sections.push({ heading: 'Diagnosis (shown with the patient\'s consent)', lines: [diagnosis] });
  const number = present(input.formNumber) ? input.formNumber.trim() : null;
  const fileName = `sick-note-${number ? fileSafe(number) : fileSafe(ctx.patient.name)}-${ctx.letterDate}.pdf`;
  const email = emailFor(ctx.practice, ctx.author, `Please find the sick note for ${ctx.patient.name} from ${ctx.author.name}.`, fileName);
  return {
    kind: 'sick_note',
    title: wording?.title.trim() || 'MEDICAL CERTIFICATE',
    reference: number ? `No ${number}` : null,
    ...common,
    recipientLines: [],
    subjectLine: wording ? wording.subject.trim() : 'Sick note',
    salutation: wording ? wording.greeting.trim() : 'To whom it may concern',
    paragraphs,
    sections,
    fileName,
    recordTitle: `Sick note${valid ? `, ${days} ${days === 1 ? 'day' : 'days'}` : ''}`,
    email: { ...email, subject: `Sick note: ${ctx.patient.name}` }
  };
}
