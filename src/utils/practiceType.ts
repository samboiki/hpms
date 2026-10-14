/**
 * A practice's discipline (dental, medical/GP, optometry, ...). It is stored twice on practices: practice_type, the
 * text every discipline rule reads (isDentalPractice / isOptometryPractice in src/utils/billing/tariffRules.ts, the
 * tariff list by practice_types.name), and practice_type_id, the link to practice_types. The two disagreed for most
 * practices because no screen wrote either, so a change always writes both from one practice_types row.
 */
import { normalisePracticeType } from './billing/practiceTypeNames';

export interface PracticeTypeOption {
  id: string;
  /** practice_types.name, e.g. 'dental': the value practices.practice_type must hold */
  name: string;
  /** What staff read */
  label: string;
}

/** Plain names for the practice_types rows (an unknown name is shown capitalised). */
const LABELS: Readonly<Record<string, string>> = {
  medical: 'Medical practice (GP)',
  dental: 'Dental',
  optometry: 'Optometry',
  physiotherapy: 'Physiotherapy',
  psychology: 'Psychology',
  nursing: 'Nursing',
  dermatology: 'Dermatology',
  ent: 'Ear, nose and throat (ENT)',
  gynecology: 'Gynaecology',
  pediatrics: 'Paediatrics',
  cardiology: 'Cardiology',
  orthopedics: 'Orthopaedics',
  ophthalmology: 'Ophthalmology',
  neurology: 'Neurology',
  radiology: 'Radiology',
  pathology: 'Pathology',
  pharmacy: 'Pharmacy',
  aesthetic: 'Aesthetic practice',
  // The disciplines added with proposals/2026-10-14-practice-type-disciplines.sql (each bills from its NAMAF list)
  anesthesiology: 'Anaesthetics',
  internal_medicine: 'Internal medicine (specialist physician)',
  psychiatry: 'Psychiatry',
  general_surgery: 'General surgery',
  urology: 'Urology',
  occupational_therapy: 'Occupational therapy',
  speech_therapy: 'Speech therapy and audiology',
  dietetics: 'Dietetics',
  biokinetics: 'Biokinetics',
  private_hospital: 'Private hospital (A tariff)',
  day_clinic: 'Day clinic',
  // The types of proposals/2026-10-14-more-practice-types.sql: the dental specialists (they work like a dental practice),
  // then every other NAMAF discipline that has a code list of its own
  orthodontist: 'Orthodontist',
  maxillofacial_oral_surgeon: 'Maxillo-facial and oral surgeon',
  periodontist: 'Periodontist (oral medicine)',
  prosthodontist: 'Prosthodontist',
  dental_therapist: 'Dental therapist',
  dental_technician: 'Dental technician (laboratory)',
  family_medicine: 'Family medicine',
  pulmonologist: 'Pulmonologist',
  gastroenterologist: 'Gastroenterologist',
  medical_oncologist: 'Medical oncologist',
  neurosurgeon: 'Neurosurgeon',
  nuclear_physician: 'Nuclear physician',
  clinical_hematologist: 'Clinical haematologist',
  rheumatology: 'Rheumatology',
  pediatric_cardiologist: 'Paediatric cardiologist',
  physical_medicine: 'Physical medicine',
  emergency_medicine: 'Emergency medicine specialist',
  plastic_surgeon: 'Plastic surgeon',
  radiation_oncologist: 'Radiation oncologist',
  thoracic_surgeon: 'Thoracic and cardio-thoracic surgeon',
  pediatric_surgeon: 'Paediatric surgeon',
  medical_technology_lab: 'Medical technology laboratory',
  radiographer: 'Radiographer',
  sonographer: 'Sonographer',
  art_therapist: 'Art therapist',
  podiatrist: 'Podiatrist',
  medical_scientist: 'Medical scientist',
  orthoptist: 'Orthoptist',
  clinical_technologist: 'Clinical technologist',
  hearing_aid_acoustician: 'Hearing aid acoustician',
  orthotist_prosthetist: 'Orthotist and prosthetist',
  social_worker: 'Social worker',
  psychological_counsellor: 'Psychological counsellor',
  chiropractor: 'Chiropractor',
  chinese_medicine_practitioner: 'Chinese medicine practitioner',
  homeopath: 'Homeopath',
  naturopath: 'Naturopath',
  phytotherapist: 'Phytotherapist',
  acupuncturist: 'Acupuncturist',
  ambulance_service: 'Ambulance service',
  ambulance_intermediate: 'Ambulance service (intermediate)',
  ambulance_basic: 'Ambulance service (basic)',
  drug_and_alcohol: 'Drug and alcohol treatment',
  sub_acute_facility: 'Sub-acute facility',
  mental_health_institute: 'Mental health institute',
  provincial_hospital: 'Provincial (state) hospital',
  private_hospital_b: 'Private hospital (B tariff)',
  rehabilitation_hospital: 'Rehabilitation hospital',
  day_clinic_077: 'Day clinic (NAMAF list 077)',
  blood_transfusion_service: 'Blood transfusion service',
  hospice: 'Hospice',
  nursing_agency: 'Nursing agency',
  clinical_support_services: 'Clinical and support services',
  oncology_unit: 'Stand-alone oncology unit'
};

/**
 * Settings > Practice lists the types under these headings: with about 80 types one flat list is hard to use. A heading's
 * types are listed by name; a type no heading names (one added in the database later) is listed last, under "Other".
 */
const GROUPS: ReadonlyArray<{ label: string; names: readonly string[] }> = [
  { label: 'General practice and nursing', names: ['medical', 'family_medicine', 'nursing', 'aesthetic'] },
  { label: 'Dental', names: ['dental', 'orthodontist', 'maxillofacial_oral_surgeon', 'periodontist', 'prosthodontist', 'dental_therapist', 'dental_technician'] },
  {
    label: 'Specialist doctors',
    names: [
      'dermatology', 'ent', 'gynecology', 'pediatrics', 'cardiology', 'orthopedics', 'ophthalmology', 'neurology', 'radiology', 'pathology',
      'anesthesiology', 'internal_medicine', 'psychiatry', 'general_surgery', 'urology', 'pulmonologist', 'gastroenterologist', 'medical_oncologist',
      'neurosurgeon', 'nuclear_physician', 'clinical_hematologist', 'rheumatology', 'pediatric_cardiologist', 'physical_medicine',
      'emergency_medicine', 'plastic_surgeon', 'radiation_oncologist', 'thoracic_surgeon', 'pediatric_surgeon'
    ]
  },
  {
    label: 'Therapy and allied health',
    names: [
      'optometry', 'physiotherapy', 'psychology', 'occupational_therapy', 'speech_therapy', 'dietetics', 'biokinetics', 'pharmacy', 'podiatrist',
      'orthotist_prosthetist', 'hearing_aid_acoustician', 'art_therapist', 'social_worker', 'clinical_technologist', 'orthoptist',
      'psychological_counsellor', 'medical_scientist', 'medical_technology_lab', 'radiographer', 'sonographer'
    ]
  },
  { label: 'Complementary medicine', names: ['chiropractor', 'homeopath', 'naturopath', 'acupuncturist', 'chinese_medicine_practitioner', 'phytotherapist'] },
  {
    label: 'Hospitals, clinics and services',
    names: [
      'private_hospital', 'private_hospital_b', 'day_clinic', 'day_clinic_077', 'provincial_hospital', 'rehabilitation_hospital', 'mental_health_institute',
      'sub_acute_facility', 'drug_and_alcohol', 'hospice', 'oncology_unit', 'ambulance_service', 'ambulance_intermediate', 'ambulance_basic',
      'blood_transfusion_service', 'nursing_agency', 'clinical_support_services'
    ]
  }
];

const clean = (value: unknown): string => (typeof value === 'string' ? value.trim().toLowerCase() : '');

/** The database's default type for a new practice; no tariff list is called 'general' */
const GENERAL = 'general';

/**
 * Owner decision 13 Oct 2026: a practice whose type is 'general' (or not set) matches no price list, so Settings >
 * Practice asks an administrator to choose the type, and the price-list screens point there.
 */
export function needsPracticeTypeChoice(practiceType: unknown): boolean {
  const key = clean(practiceType);
  return !key || key === GENERAL;
}

export function practiceTypeLabel(name: string | null | undefined): string {
  const key = clean(name);
  if (!key) return 'Not chosen yet';
  return LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
}

/** The practice_types rows a practice can choose from: active ones with a name, the most common disciplines first. */
export function practiceTypeOptions(rows: readonly unknown[]): PracticeTypeOption[] {
  const order = Object.keys(LABELS);
  const rank = (name: string) => (order.includes(name) ? order.indexOf(name) : order.length);
  return rows
    .flatMap(row => {
      const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
      const id = typeof r?.id === 'string' ? r.id : '';
      const name = clean(r?.name);
      // 'general' matches no price list, so it is never offered (owner, 13 Oct 2026: the practice chooses its type)
      if (!id || !name || name === GENERAL || r?.is_active === false) return [];
      return [{ id, name, label: practiceTypeLabel(name) }];
    })
    .sort((a, b) => rank(a.name) - rank(b.name) || a.label.localeCompare(b.label));
}

export interface PracticeTypeGroup {
  label: string;
  options: PracticeTypeOption[];
}

/** The options under their headings (GROUPS), each heading's types by name; a heading without a type is left out. */
export function practiceTypeGroups(options: readonly PracticeTypeOption[]): PracticeTypeGroup[] {
  const byLabel = (a: PracticeTypeOption, b: PracticeTypeOption) => a.label.localeCompare(b.label);
  const named = new Set(GROUPS.flatMap(group => group.names));
  const groups = [
    ...GROUPS.map(group => ({ label: group.label, options: options.filter(option => group.names.includes(option.name)).sort(byLabel) })),
    { label: 'Other', options: options.filter(option => !named.has(option.name)).sort(byLabel) }
  ];
  return groups.filter(group => group.options.length > 0);
}

export interface PracticeTypeState {
  /** The type the app works with now (practices.practice_type), or null when none of the options ('general' default) */
  current: PracticeTypeOption | null;
  /** The type practice_type_id links to, when it differs from `current` (the two copies disagree) */
  linkedElsewhere: PracticeTypeOption | null;
  /** What the chooser starts on: the current type, else the linked one (one tap to make both agree) */
  suggested: PracticeTypeOption | null;
}

export function practiceTypeState(practice: { practice_type?: unknown; practice_type_id?: unknown }, options: readonly PracticeTypeOption[]): PracticeTypeState {
  // The practice's text as the app reads it: 'dental_practice' is Dental (the stored text stays until a type is saved)
  const current = options.find(option => option.name === normalisePracticeType(practice.practice_type)) ?? null;
  const linked = options.find(option => option.id === practice.practice_type_id) ?? null;
  const linkedElsewhere = linked && linked.id !== current?.id ? linked : null;
  return { current, linkedElsewhere, suggested: current ?? linked };
}

/** Saving `choice` changes something: either copy differs from it. */
export const practiceTypeChanged = (practice: { practice_type?: unknown; practice_type_id?: unknown }, choice: PracticeTypeOption): boolean =>
  clean(practice.practice_type) !== choice.name || practice.practice_type_id !== choice.id;

/** Both columns from one row, so the text the app reads and the directory's link can never disagree again. */
export const practiceTypeUpdate = (choice: PracticeTypeOption): { practice_type: string; practice_type_id: string } => ({
  practice_type: choice.name,
  practice_type_id: choice.id
});
