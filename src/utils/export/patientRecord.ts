/**
 * One patient's full record as exported from the patient file (parity C17): every section of the summary PDF and the
 * names of the documents in the ZIP are decided here (tested); src/components/patients/export/recordSummaryPdf.ts only
 * draws the sections, and src/services/patientRecordExportService.ts reads the record and fetches the documents.
 *
 * What is in it is what the person exporting may see on the file (the database decides: a receptionist sees no clinical
 * notes). Private notes of other practitioners are never read; the exporter's own are added only when they ask.
 */
import { formatServiceDate, toDateKey } from '../billing/dates';
import { formatNad } from '../billing/money';
import { safeZipPath, uniqueZipPaths } from './zipStore';

export interface RecordFact {
  label: string;
  value: string;
}

/** A group of facts under an optional title (one visit, one medical aid, one note) */
export interface RecordBlock {
  title?: string;
  facts: RecordFact[];
}

export interface RecordTable {
  columns: string[];
  rows: string[][];
}

export interface RecordSection {
  heading: string;
  /** A line under the heading ("What this login may see") */
  note?: string;
  blocks?: RecordBlock[];
  table?: RecordTable;
  /** Shown when there is nothing to list */
  empty?: string;
}

// ---------------------------------------------------------------------------------------------
// What is read from the file (the service fills these from the database)
// ---------------------------------------------------------------------------------------------

export interface RecordPatient {
  name: string;
  formalName: string | null;
  idNumber: string | null;
  dateOfBirth: string | null;
  age: number | null;
  gender: string | null;
  fileNumber: string | null;
  oldFileNumber: string | null;
  cellNumber: string | null;
  email: string | null;
  homeAddress: string | null;
  postalAddress: string | null;
  occupation: string | null;
  employer: string | null;
  homeLanguage: string | null;
  maritalStatus: string | null;
  pregnancyDueDate: string | null;
}

export interface RecordMedicalAid {
  fund: string | null;
  option: string | null;
  memberNumber: string | null;
  dependantCode: string | null;
  mainMember: string | null;
  mainMemberId: string | null;
  relationship: string | null;
}

export interface RecordNextOfKin {
  name: string;
  relationship: string | null;
  phone: string | null;
  address: string | null;
}

export interface RecordAlerts {
  /** null: allergies are not recorded on this database */
  allergies: string[] | null;
  noKnownAllergies: boolean;
  alertNote: string | null;
  activeProblems: string[];
  pastProblems: string[];
}

export interface RecordVisit {
  date: string | null;
  time: string | null;
  type: string | null;
  status: string | null;
  practitioner: string | null;
  complaint: string | null;
  diagnosis: string | null;
  /** ICD-10 codes billed for the visit */
  icd10: string[];
  treatmentPlan: string | null;
  notes: string | null;
  prescription: string | null;
  vitals: string | null;
}

export interface RecordMedicine {
  date: string | null;
  name: string;
  dose: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  status: string | null;
}

export interface RecordLabResult {
  date: string | null;
  test: string;
  value: string;
  unit: string | null;
  range: string | null;
  status: string | null;
}

export interface RecordLabRequest {
  date: string | null;
  laboratory: string | null;
  status: string | null;
  notes: string | null;
}

export interface RecordImaging {
  date: string | null;
  study: string;
  status: string | null;
  report: string | null;
}

export interface RecordLetter {
  date: string | null;
  title: string;
  details: string | null;
}

export interface RecordNote {
  date: string | null;
  kind: string;
  header: string | null;
  body: string;
  author: string | null;
  addenda: Array<{ date: string | null; body: string }>;
}

export interface RecordInvoice {
  date: string | null;
  number: string | null;
  total: number;
  medicalAid: number;
  patient: number;
  /** null: what was paid is not known (receipts not in use) */
  paid: number | null;
  status: string;
}

export interface RecordPayment {
  date: string | null;
  number: string | null;
  payer: string;
  method: string | null;
  amount: number;
  reversed: boolean;
}

/** A stored file of the patient's: where it is and what to call it in the ZIP */
export interface RecordDocument {
  /** "Photo", "Lab result", "Invoice", "Consent form"... */
  kind: string;
  /** The name staff gave it, or the file's own name */
  label: string;
  date: string | null;
  /** A path in a bucket, or a link saved before the records moved */
  ref: string;
  bucket: string | null;
  mimeType: string | null;
}

export interface PatientRecord {
  patient: RecordPatient;
  medicalAids: RecordMedicalAid[];
  nextOfKin: RecordNextOfKin[];
  alerts: RecordAlerts;
  visits: RecordVisit[];
  medicines: RecordMedicine[];
  labRequests: RecordLabRequest[];
  labResults: RecordLabResult[];
  imaging: RecordImaging[];
  letters: RecordLetter[];
  notes: RecordNote[];
  /** The exporter's own private notes, only when they asked for them; null when not included */
  privateNotes: RecordNote[] | null;
  invoices: RecordInvoice[];
  payments: RecordPayment[];
  documents: RecordDocument[];
  /** Parts that could not be read (another update not applied, a failed query): named in the summary */
  unavailable: string[];
}

// ---------------------------------------------------------------------------------------------
// The summary's sections
// ---------------------------------------------------------------------------------------------

const present = (value: string | null | undefined): value is string => Boolean(value && value.trim());
const fact = (label: string, value: string | null | undefined): RecordFact[] => (present(value) ? [{ label, value: value.trim() }] : []);
const day = (value: string | null | undefined): string => (toDateKey(value ?? null) ? formatServiceDate(value ?? null) : '');
const cell = (value: string | null | undefined): string => (present(value) ? value.trim() : '');

function patientSection(patient: RecordPatient): RecordSection {
  const born = day(patient.dateOfBirth);
  return {
    heading: 'Patient details',
    blocks: [
      {
        facts: [
          ...fact('Name', patient.formalName && patient.formalName !== patient.name ? `${patient.name} (${patient.formalName})` : patient.name),
          ...fact('Date of birth', born ? `${born}${patient.age !== null ? ` (${patient.age} years)` : ''}` : null),
          ...fact('Gender', patient.gender),
          ...fact('ID number', patient.idNumber),
          ...fact('File number', patient.fileNumber),
          ...fact('Old file number', patient.oldFileNumber),
          ...fact('Cell number', patient.cellNumber),
          ...fact('Email', patient.email),
          ...fact('Home address', patient.homeAddress),
          ...fact('Postal address', patient.postalAddress),
          ...fact('Occupation', patient.occupation),
          ...fact('Employer', patient.employer),
          ...fact('Home language', patient.homeLanguage),
          ...fact('Marital status', patient.maritalStatus),
          ...fact('Pregnancy due date', day(patient.pregnancyDueDate))
        ]
      }
    ]
  };
}

function alertsSection(alerts: RecordAlerts): RecordSection {
  const allergies =
    alerts.allergies === null
      ? 'Not recorded on this system'
      : alerts.allergies.length > 0
        ? alerts.allergies.join('; ')
        : alerts.noKnownAllergies
          ? 'No known allergies'
          : 'None recorded';
  return {
    heading: 'Allergies, alerts and problems',
    blocks: [
      {
        facts: [
          { label: 'Allergies', value: allergies },
          ...fact('Clinical alert', alerts.alertNote),
          ...fact('Active problems', alerts.activeProblems.join('; ')),
          ...fact('Past problems', alerts.pastProblems.join('; '))
        ]
      }
    ]
  };
}

function visitTitle(visit: RecordVisit): string {
  return [day(visit.date) || 'Date not recorded', visit.time ? visit.time.slice(0, 5) : null, visit.type, visit.practitioner, visit.status]
    .filter(present)
    .join(' - ');
}

const money = (amount: number): string => formatNad(amount);

/** Every section of the summary, in the order a practitioner reads a file. */
export function recordSections(record: PatientRecord): RecordSection[] {
  const sections: RecordSection[] = [patientSection(record.patient)];

  sections.push({
    heading: 'Medical aid',
    blocks: record.medicalAids.map(aid => ({
      facts: [
        ...fact('Fund', aid.fund),
        ...fact('Option', aid.option),
        ...fact('Member number', aid.memberNumber),
        ...fact('Dependant code', aid.dependantCode),
        ...fact('Main member', [aid.mainMember, aid.mainMemberId ? `ID ${aid.mainMemberId}` : null].filter(present).join(', ')),
        ...fact('Relationship', aid.relationship)
      ]
    })),
    empty: 'No medical aid recorded (pays privately).'
  });

  sections.push({
    heading: 'Next of kin',
    table: { columns: ['Name', 'Relationship', 'Phone', 'Address'], rows: record.nextOfKin.map(kin => [kin.name, cell(kin.relationship), cell(kin.phone), cell(kin.address)]) },
    empty: 'No next of kin recorded.'
  });

  sections.push(alertsSection(record.alerts));

  sections.push({
    heading: 'Visits',
    note: 'Newest first, with the notes and diagnoses recorded at each visit.',
    blocks: record.visits.map(visit => ({
      title: visitTitle(visit),
      facts: [
        ...fact('Complaint', visit.complaint),
        ...fact('Diagnosis', visit.diagnosis),
        ...fact('ICD-10', visit.icd10.join(', ')),
        ...fact('Vital signs', visit.vitals),
        ...fact('Treatment plan', visit.treatmentPlan),
        ...fact('Prescription', visit.prescription),
        ...fact('Notes', visit.notes)
      ]
    })),
    empty: 'No visits recorded.'
  });

  sections.push({
    heading: 'Medicines',
    table: {
      columns: ['Date', 'Medicine', 'Dose', 'How often', 'How long', 'Instructions', 'Status'],
      rows: record.medicines.map(medicine => [
        day(medicine.date),
        medicine.name,
        cell(medicine.dose),
        cell(medicine.frequency),
        cell(medicine.duration),
        cell(medicine.instructions),
        cell(medicine.status)
      ])
    },
    empty: 'No medicines recorded.'
  });

  sections.push({
    heading: 'Laboratory results',
    table: {
      columns: ['Date', 'Test', 'Result', 'Unit', 'Normal range', 'Status'],
      rows: record.labResults.map(result => [day(result.date), result.test, result.value, cell(result.unit), cell(result.range), cell(result.status)])
    },
    empty: record.labRequests.length > 0 ? 'No results typed in yet: see the laboratory requests below and the documents.' : 'No laboratory results recorded.'
  });

  if (record.labRequests.length > 0) {
    sections.push({
      heading: 'Laboratory requests',
      table: {
        columns: ['Date', 'Laboratory', 'Status', 'Notes'],
        rows: record.labRequests.map(request => [day(request.date), cell(request.laboratory), cell(request.status), cell(request.notes)])
      }
    });
  }

  sections.push({
    heading: 'Imaging',
    table: {
      columns: ['Date', 'Study', 'Status', 'Report'],
      rows: record.imaging.map(study => [day(study.date), study.study, cell(study.status), cell(study.report)])
    },
    empty: 'No imaging recorded.'
  });

  sections.push({
    heading: 'Letters, sick notes and consent forms',
    table: { columns: ['Date', 'Document', 'Details'], rows: record.letters.map(letter => [day(letter.date), letter.title, cell(letter.details)]) },
    empty: 'No letters, sick notes or consent forms.'
  });

  sections.push({
    heading: 'Notes on the file',
    note: 'The notes your role may read.',
    blocks: record.notes.map(note => noteBlock(note)),
    empty: 'No notes on the file.'
  });

  if (record.privateNotes) {
    sections.push({
      heading: 'My private notes',
      note: 'Added at the request of the practitioner exporting: only their own private notes.',
      blocks: record.privateNotes.map(note => noteBlock(note)),
      empty: 'No private notes.'
    });
  }

  sections.push({
    heading: 'Invoices',
    table: {
      columns: ['Date', 'Invoice', 'Total', 'Medical aid', 'Patient', 'Paid', 'Status'],
      rows: record.invoices.map(invoice => [
        day(invoice.date),
        cell(invoice.number),
        money(invoice.total),
        money(invoice.medicalAid),
        money(invoice.patient),
        invoice.paid === null ? '' : money(invoice.paid),
        invoice.status
      ])
    },
    empty: 'No invoices.'
  });

  sections.push({
    heading: 'Payments',
    table: {
      columns: ['Date', 'Receipt', 'Paid by', 'Method', 'Amount'],
      rows: record.payments.map(payment => [
        day(payment.date),
        cell(payment.number),
        payment.payer,
        cell(payment.method),
        `${money(payment.amount)}${payment.reversed ? ' (reversed)' : ''}`
      ])
    },
    empty: 'No payments recorded.'
  });

  return sections;
}

function noteBlock(note: RecordNote): RecordBlock {
  return {
    title: [day(note.date), note.kind, note.header, note.author].filter(present).join(' - '),
    facts: [
      { label: 'Note', value: note.body },
      ...note.addenda.map(addendum => ({ label: `Added ${day(addendum.date)}`.trim(), value: addendum.body }))
    ]
  };
}

/** What happened to each document: its path in the ZIP, or why it is not there */
export interface DocumentOutcome {
  path: string | null;
  problem: string | null;
}

/** The documents the patient has stored, and for each whether it is in the ZIP (or why not). */
export function documentsSection(documents: readonly RecordDocument[], outcomes: readonly DocumentOutcome[] | null): RecordSection {
  return {
    heading: 'Documents',
    note: outcomes ? "In the ZIP's documents folder, oldest first." : 'This summary was made without the documents: export the record to get them.',
    table: {
      columns: ['Date', 'Document', 'In the ZIP'],
      rows: documents.map((document, index) => {
        const outcome = outcomes?.[index] ?? null;
        const inZip = outcome?.path ? outcome.path.slice(outcome.path.lastIndexOf('/') + 1) : outcome?.problem ?? 'Not in this export';
        return [day(document.date), `${document.kind}: ${document.label}`, inZip];
      })
    },
    empty: 'No documents stored for this patient.'
  };
}

export interface ExportFacts {
  exportedBy: string;
  /** "13 October 2026 at 10:42" */
  exportedAt: string;
  practiceName: string;
}

/** The last part of the summary: who made it, when, and what it holds. */
export function aboutSection(facts: ExportFacts, unavailable: readonly string[]): RecordSection {
  return {
    heading: 'About this export',
    blocks: [
      {
        facts: [
          { label: 'Made by', value: `${facts.exportedBy}, ${facts.practiceName}` },
          { label: 'Made on', value: facts.exportedAt },
          {
            label: 'What it holds',
            value: `What ${facts.exportedBy} may see on the patient file. Other practitioners' private notes are never included. Confidential medical information: keep it safe and share it only with people entitled to it.`
          },
          ...(unavailable.length > 0 ? [{ label: 'Could not be read', value: unavailable.join('; ') }] : [])
        ]
      }
    ]
  };
}

// ---------------------------------------------------------------------------------------------
// Names in the ZIP
// ---------------------------------------------------------------------------------------------

const slug = (value: string): string => value.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 40) || 'patient';

/** "record-maria-example-2026-10-13": the ZIP, its folder and the summary PDF are named after it. */
export const recordExportBase = (patientName: string, dateKey: string): string => `record-${slug(patientName)}-${dateKey}`;

const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/gif': '.gif',
  'text/plain': '.txt',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
};

/** The file's extension: from its label or stored path, else from its type; none when neither says. */
export function documentExtension(document: Pick<RecordDocument, 'label' | 'ref' | 'mimeType'>): string {
  for (const name of [document.label, document.ref.split(/[?#]/)[0]]) {
    const match = /\.([A-Za-z0-9]{1,5})$/.exec(name.trim());
    if (match) return `.${match[1].toLowerCase()}`;
  }
  return MIME_EXTENSIONS[(document.mimeType ?? '').toLowerCase()] ?? '';
}

/**
 * Each document's path in the ZIP, in the order given: "<base>/documents/2026-10-12 Lab result - Full blood count.pdf",
 * numbered when two would share a name.
 */
export function documentZipPaths(base: string, documents: readonly RecordDocument[]): string[] {
  // A label or kind is one file name: a "/" in it never makes a folder
  const oneName = (value: string): string => value.replace(/[/\\]+/g, '-').trim();
  const names = documents.map(document => {
    const extension = documentExtension(document);
    const label = oneName(document.label).replace(/\.[A-Za-z0-9]{1,5}$/, '') || 'file';
    const date = toDateKey(document.date ?? null);
    return safeZipPath(`${base}/documents/${`${date ? `${date} ` : ''}${oneName(document.kind)} - ${label}`.slice(0, 160)}${extension}`);
  });
  return uniqueZipPaths(names);
}
