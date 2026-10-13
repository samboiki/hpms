/**
 * The columns the Eminance import understands, and how they are recognised in an export.
 *
 * Eminance stores a family account as ACCOUNT (ACCOUNT_KEY: 7 characters, usually a zero-padded number) and each
 * person on it as PATIENT (ACCOUNT_KEY, PATIENT_KEY), where PATIENT_KEY 0 is the main member. Its own conversion
 * procedure (SP_PATIENT_CONV) takes SURNAME, TITLE, INITIALS, FIRSTNAME, SEX, BIRTHDAY, IDNUMBER, FILENUMBER, PHONE1,
 * PHONE2, CELL, EMAIL, EMPLOYER, OCCUPATION, MEMBERSHIPNO, HOMELANGUAGE, USERDEPENDANTNUMBER (the code on the card),
 * PATIENTALERTMSG, MEDICALAID_KEY (the plan on the account), RELATIONSHIP_KEY and the physical and postal address
 * lines. Its age analysis (SP_PATIENTPERIODTOTALSPORTIONS, SP_MEDICALAIDPATIENT) gives per account CURR (or
 * CURRENT), DAY30, DAY60, DAY90, DAY120, DAY150, DAY180, UNALLOCATED and TOTAL; the printed and CSV reports label
 * them Account, Debtor, Current, 30, 60 ... 180+, Unallocated and Total. Recalls (RECALLS / TMPRECALLS) carry
 * ACCOUNT_KEY, PATIENT_KEY, RECALLDATE and a reason. Exports therefore use either the database names (Report
 * Generator, SQL exports) or the screen labels; both are listed below, and staff can map any other heading by hand.
 * (Source: the read-only study of Eminance's upgrade scripts and manuals, scratchpad/eminence.)
 */

export type ImportFileKind = 'patients' | 'balances' | 'recalls';

export type FieldKey =
  | 'accountNumber'
  | 'dependantNumber'
  | 'dependantCode'
  | 'title'
  | 'initials'
  | 'firstName'
  | 'surname'
  | 'fullName'
  | 'idNumber'
  | 'dateOfBirth'
  | 'sex'
  | 'cell'
  | 'phone'
  | 'email'
  | 'language'
  | 'occupation'
  | 'employer'
  | 'address1'
  | 'address2'
  | 'town'
  | 'postalCode'
  | 'postal1'
  | 'postal2'
  | 'postalTown'
  | 'medicalAid'
  | 'option'
  | 'membershipNumber'
  | 'relationship'
  | 'alert'
  | 'recallDate'
  | 'recallReason'
  | 'current'
  | 'days30'
  | 'days60'
  | 'days90'
  | 'days120'
  | 'days150'
  | 'days180'
  | 'unallocated'
  | 'total';

export interface FieldDefinition {
  key: FieldKey;
  /** What staff see in the column list */
  label: string;
  kinds: readonly ImportFileKind[];
  /** Shown under "More columns" in the mapping step */
  extra?: boolean;
  /** Headings that mean this field, written as normalizeHeader writes them */
  synonyms: readonly string[];
}

const P: readonly ImportFileKind[] = ['patients'];
const B: readonly ImportFileKind[] = ['balances'];
const ALL: readonly ImportFileKind[] = ['patients', 'balances', 'recalls'];
const PR: readonly ImportFileKind[] = ['patients', 'recalls'];

export const FIELDS: readonly FieldDefinition[] = [
  { key: 'accountNumber', label: 'Account number', kinds: ALL, synonyms: ['accountkey', 'account', 'accountno', 'accountnumber', 'accountnr', 'accno', 'accnr', 'acc', 'accnum', 'debtorno', 'debtornumber', 'rekening', 'rekeningno', 'rekeningnommer'] },
  { key: 'dependantNumber', label: 'Dependant number in Eminance (0 is the main member)', kinds: PR, synonyms: ['patientkey', 'patkey', 'depkey'] },
  { key: 'dependantCode', label: 'Dependant code on the card', kinds: PR, synonyms: ['userdependantnumber', 'dependant', 'dependent', 'dependantno', 'dependentno', 'dependantnumber', 'dependentnumber', 'dependantcode', 'dependentcode', 'depno', 'dep', 'depcode', 'afhanklike'] },
  { key: 'title', label: 'Title', kinds: P, extra: true, synonyms: ['title', 'titlekey', 'titel'] },
  { key: 'initials', label: 'Initials', kinds: P, extra: true, synonyms: ['initials', 'initial', 'voorletters'] },
  { key: 'firstName', label: 'First names', kinds: PR, synonyms: ['firstname', 'firstnames', 'names', 'givenname', 'givennames', 'forename', 'forenames', 'voorname', 'voornaam', 'patientfirstname'] },
  { key: 'surname', label: 'Surname', kinds: PR, synonyms: ['surname', 'lastname', 'familyname', 'van', 'patientsurname'] },
  { key: 'fullName', label: 'Name (surname and first names in one column)', kinds: ALL, synonyms: ['patient', 'patientname', 'name', 'fullname', 'debtor', 'debtorname', 'accountholder', 'membername', 'naam'] },
  { key: 'idNumber', label: 'ID number', kinds: PR, synonyms: ['idnumber', 'idno', 'idnr', 'identitynumber', 'identityno', 'idnommer', 'nationalid', 'idpassport', 'idorpassport'] },
  { key: 'dateOfBirth', label: 'Date of birth', kinds: PR, synonyms: ['birthday', 'dateofbirth', 'dob', 'birthdate', 'born', 'geboortedatum', 'verjaarsdag'] },
  { key: 'sex', label: 'Sex', kinds: P, synonyms: ['sex', 'gender', 'geslag'] },
  { key: 'cell', label: 'Cell number', kinds: P, synonyms: ['cell', 'cellno', 'cellnumber', 'cellphone', 'cellphoneno', 'cellular', 'telcell', 'mobile', 'mobileno', 'mobilenumber', 'selfoon'] },
  { key: 'phone', label: 'Other phone (used when there is no cell number)', kinds: P, extra: true, synonyms: ['phone1', 'phone', 'telephone', 'tel', 'telno', 'homephone', 'phonehome', 'telefoon'] },
  { key: 'email', label: 'Email', kinds: P, synonyms: ['email', 'emailaddress', 'epos', 'eposadres'] },
  { key: 'language', label: 'Home language', kinds: P, extra: true, synonyms: ['homelanguage', 'homelanguagekey', 'language', 'taal'] },
  { key: 'occupation', label: 'Occupation', kinds: P, extra: true, synonyms: ['occupation', 'occupationkey', 'beroep'] },
  { key: 'employer', label: 'Employer', kinds: P, extra: true, synonyms: ['employer', 'employerkey', 'werkgewer'] },
  { key: 'address1', label: 'Home address', kinds: P, extra: true, synonyms: ['physicaladdress1', 'physicaladdress', 'address1', 'address', 'streetaddress', 'residentialaddress', 'homeaddress'] },
  { key: 'address2', label: 'Home address, second line', kinds: P, extra: true, synonyms: ['physicaladdress2', 'address2'] },
  { key: 'town', label: 'Town', kinds: P, extra: true, synonyms: ['physicaltown', 'town', 'city', 'suburb', 'dorp'] },
  { key: 'postalCode', label: 'Postal code', kinds: P, extra: true, synonyms: ['physicalpostalcode', 'postalpostalcode', 'postalcode', 'postcode', 'poskode'] },
  { key: 'postal1', label: 'Postal address', kinds: P, extra: true, synonyms: ['postaladdress1', 'postaladdress', 'posadres'] },
  { key: 'postal2', label: 'Postal address, second line', kinds: P, extra: true, synonyms: ['postaladdress2'] },
  { key: 'postalTown', label: 'Postal town', kinds: P, extra: true, synonyms: ['postaltown'] },
  { key: 'medicalAid', label: 'Medical aid (fund or plan)', kinds: P, synonyms: ['medicalaidkey', 'medicalaid', 'medicalaidname', 'medicalaidplan', 'medicalaidscheme', 'medicalscheme', 'scheme', 'fund', 'medicalfund', 'mediesefonds'] },
  { key: 'option', label: 'Medical aid option', kinds: P, extra: true, synonyms: ['option', 'planoption', 'benefitoption', 'plan', 'plantype', 'schemeoption', 'opsie'] },
  { key: 'membershipNumber', label: 'Membership number', kinds: P, synonyms: ['membershipno', 'membershipnumber', 'membership', 'memberno', 'membernumber', 'medicalaidno', 'medicalaidnumber', 'lidnommer'] },
  { key: 'relationship', label: 'Relationship to the main member', kinds: P, synonyms: ['relationship', 'relationshipkey', 'relation', 'verwantskap'] },
  { key: 'alert', label: 'Alert message', kinds: P, extra: true, synonyms: ['alert', 'alertmsg', 'patientalertmsg', 'alertmessage', 'waarskuwing'] },
  { key: 'recallDate', label: 'Recall or next visit date', kinds: PR, synonyms: ['recalldate', 'recall', 'nextrecall', 'recalldue', 'recallduedate', 'nextvisit', 'nextvisitdate', 'nextappointment'] },
  { key: 'recallReason', label: 'Recall reason', kinds: PR, synonyms: ['recallreason', 'reason', 'reasonkey', 'recalltype', 'recalltypekey', 'rede'] },
  { key: 'current', label: 'Current', kinds: B, synonyms: ['curr', 'current', 'currentbalance', '029', '029days', '030days', 'huidig'] },
  { key: 'days30', label: '30 days', kinds: B, synonyms: ['day30', 'days30', '30', '30days', '3059', '3059days', '30dae'] },
  { key: 'days60', label: '60 days', kinds: B, synonyms: ['day60', 'days60', '60', '60days', '6089', '6089days', '60dae'] },
  { key: 'days90', label: '90 days', kinds: B, synonyms: ['day90', 'days90', '90', '90days', '90119', '90119days', '90dae'] },
  { key: 'days120', label: '120 days', kinds: B, synonyms: ['day120', 'days120', '120', '120days', '120149', '120149days', '120dae'] },
  { key: 'days150', label: '150 days', kinds: B, synonyms: ['day150', 'days150', '150', '150days', '150179', '150179days', '150plus', '150daysplus', '150dae'] },
  { key: 'days180', label: '180 days and older', kinds: B, synonyms: ['day180', 'days180', '180', '180plus', '180days', '180daysplus', 'over180', 'over180days', '180dae'] },
  { key: 'unallocated', label: 'Unallocated (credit)', kinds: B, synonyms: ['unallocated', 'unalloc', 'unallocatedcredit', 'credit', 'credits', 'onallokeer', 'krediet'] },
  { key: 'total', label: 'Total', kinds: B, synonyms: ['total', 'totaal', 'balance', 'accbalance', 'accountbalance', 'totalbalance', 'totaldue', 'outstanding'] }
];

export const FIELD_BY_KEY: Readonly<Record<FieldKey, FieldDefinition>> = Object.fromEntries(FIELDS.map(field => [field.key, field])) as Record<FieldKey, FieldDefinition>;

/** The age columns, oldest last (the order of AGE_BANDS in src/services/ledger/receivables.ts) */
export const BAND_FIELDS = ['current', 'days30', 'days60', 'days90', 'days120', 'days150', 'days180'] as const;

/** Which column holds a field: column index, or absent */
export type ColumnMapping = Partial<Record<FieldKey, number>>;

/** "ACCOUNT_KEY" -> "accountkey", "Acc No." -> "accno", "180+" -> "180plus", "0 - 29" -> "029" */
export function normalizeHeader(text: string): string {
  return text.toLowerCase().replace(/\+/g, 'plus').replace(/[^a-z0-9]/g, '');
}

const synonymIndex = (kind: ImportFileKind): Map<string, FieldKey> => {
  const index = new Map<string, FieldKey>();
  for (const field of FIELDS) {
    if (!field.kinds.includes(kind)) continue;
    for (const synonym of field.synonyms) if (!index.has(synonym)) index.set(synonym, field.key);
  }
  return index;
};

/**
 * The columns of a file of this kind, from its headings. The first column with a recognised heading wins (Eminance
 * repeats some columns, e.g. two phone numbers). A lone "Name" column next to a surname column holds the first names.
 */
export function recogniseColumns(headers: readonly string[], kind: ImportFileKind): ColumnMapping {
  const index = synonymIndex(kind);
  const mapping: ColumnMapping = {};
  headers.forEach((header, column) => {
    const field = index.get(normalizeHeader(header));
    if (field && mapping[field] === undefined) mapping[field] = column;
  });
  if (kind !== 'balances' && mapping.fullName !== undefined && mapping.surname !== undefined && mapping.firstName === undefined) {
    mapping.firstName = mapping.fullName;
    delete mapping.fullName;
  }
  return mapping;
}

const has = (mapping: ColumnMapping, key: FieldKey): boolean => mapping[key] !== undefined;

/** What a file of this kind needs, in plain words, and whether the mapping has it */
export function missingColumns(kind: ImportFileKind, mapping: ColumnMapping): string[] {
  const missing: string[] = [];
  if (!has(mapping, 'accountNumber')) missing.push('the account number');
  if (kind === 'patients') {
    if (!has(mapping, 'fullName') && (!has(mapping, 'firstName') || !has(mapping, 'surname'))) missing.push('the first names and surname (or a name column)');
    if (!has(mapping, 'dateOfBirth') && !has(mapping, 'idNumber')) missing.push('the date of birth (or the ID number)');
  } else if (kind === 'balances') {
    if (!BAND_FIELDS.some(key => has(mapping, key))) missing.push('at least one age column (Current, 30 days ... 180+)');
  } else if (!has(mapping, 'recallDate')) {
    missing.push('the recall date');
  }
  return missing;
}

/**
 * What kind of file this is, from its headings: an age analysis has age columns, a recall list has recall dates but
 * no dates of birth, anything with names is a patient list. null when none of these fit.
 */
export function detectFileKind(headers: readonly string[]): { kind: ImportFileKind; mapping: ColumnMapping } | null {
  const balances = recogniseColumns(headers, 'balances');
  if (has(balances, 'accountNumber') && BAND_FIELDS.filter(key => has(balances, key)).length >= 2) return { kind: 'balances', mapping: balances };
  const patients = recogniseColumns(headers, 'patients');
  const recalls = recogniseColumns(headers, 'recalls');
  const personal = has(patients, 'dateOfBirth') || has(patients, 'idNumber') || has(patients, 'membershipNumber') || has(patients, 'sex');
  if (has(recalls, 'accountNumber') && has(recalls, 'recallDate') && !personal) return { kind: 'recalls', mapping: recalls };
  if (has(patients, 'accountNumber') && missingColumns('patients', patients).length === 0) return { kind: 'patients', mapping: patients };
  return null;
}

/** How many headings of a row are known fields of any kind: picks the heading row below a report's title lines */
export function headerScore(headers: readonly string[]): number {
  const known = new Set(FIELDS.flatMap(field => field.synonyms));
  return headers.filter(header => known.has(normalizeHeader(header))).length;
}
