/**
 * Reference data for the demo seed: Namibian names and places, dental visit scenarios built on the practice's
 * NAMAF dental tariff codes, prescriptions, lab tests, suppliers and stock. Nothing here is a real person.
 */

export const FEMALE_FIRST_NAMES = [
  'Ndapewa', 'Ndeshipanda', 'Tuyeni', 'Nangula', 'Selma', 'Hilma', 'Martha', 'Johanna', 'Ester', 'Loide', 'Albertina',
  'Taimi', 'Panduleni', 'Saara', 'Maria', 'Anna', 'Rosalia', 'Vistorina', 'Uerikua', 'Kaera', 'Ueripi', 'Mercedes',
  'Chantell', 'Monique', 'Lizelle', 'Anke', 'Carola', 'Mutaleni', 'Lusia', 'Namasiku', 'Ndinelao', 'Pendapala',
  'Hileni', 'Fransina', 'Emilia', 'Victoria', 'Charmaine', 'Elfriede', 'Sandra', 'Ilse', 'Magano', 'Ndahafa'
];

export const MALE_FIRST_NAMES = [
  'Petrus', 'Johannes', 'Thomas', 'Simeon', 'Andreas', 'Festus', 'Lazarus', 'Mathias', 'Hafeni', 'Tuhafeni', 'Kalenga',
  'Erastus', 'Immanuel', 'Lukas', 'Paulus', 'Kaupee', 'Uaundja', 'Vetaruhe', 'Jerome', 'Dawid', 'Hendrik', 'Willem',
  'Jacobus', 'Dieter', 'Klaus', 'Mbanga', 'Sikwese', 'Gerson', 'Ndjoze', 'Tjiuai', 'Abraham', 'Elias', 'Ruben',
  'Moses', 'Josef', 'Frans', 'Vilho', 'Tangeni', 'Kristof', 'Werner', 'Marius', 'Ignatius'
];

export const SURNAMES = [
  'Amutenya', 'Shikongo', 'Nakale', 'Iipinge', 'Haufiku', 'Nghidinwa', 'Shilongo', 'Ithete', 'Nangolo', 'Nghipandulwa',
  'Kandjii', 'Tjiriange', 'Kaura', 'Hijarunguru', 'Katjiuongua', 'Tjihero', 'Kazombiaze', 'Gawanas', 'Garoeb',
  'Hoaeb', 'Goagoses', 'Tsuses', 'Gaseb', 'van Wyk', 'Beukes', 'Cloete', 'Diergaardt', 'Isaacs', 'Swartbooi',
  'Coetzee', 'Steenkamp', 'Visagie', 'Schmidt', 'Hoffmann', 'Schneider', 'Haingura', 'Muyenga', 'Kandjimi',
  'Kudumo', 'Simasiku', 'Mwilima', 'Sinvula', 'Muyamba', 'Motinga', 'Nashandi', 'Uushona', 'Hamutenya', 'Kambonde',
  'Shaanika', 'Nekongo', 'Mbumba', 'Shivute', 'Angula', 'Kapofi', 'Ekandjo', 'Iyambo', 'Shangala', 'Kauluma'
];

export const WINDHOEK_SUBURBS = [
  'Katutura', 'Khomasdal', 'Klein Windhoek', 'Olympia', 'Pionierspark', 'Eros', 'Ludwigsdorf', 'Wanaheda',
  'Otjomuise', 'Dorado Park', 'Hochland Park', 'Academia', 'Kleine Kuppe', 'Rocky Crest', 'Okuryangava', 'Hakahana',
  'Goreangab', 'Cimbebasia', 'Brakwater', 'Auasblick'
];

export const STREETS = [
  'Independence Avenue', 'Mandume Ndemufayo Avenue', 'Sam Nujoma Drive', 'Robert Mugabe Avenue', 'Nelson Mandela Avenue',
  'Hosea Kutako Drive', 'Jan Jonker Road', 'Monte Christo Road', 'Florence Nightingale Street', 'Otjomuise Road',
  'Frans Indongo Street', 'Dr Frans Indongo Street', 'Hans-Dietrich Genscher Street', 'Ombika Street', 'Omaruru Street',
  'Bahnhof Street', 'Pasteur Street', 'Feld Street', 'Beethoven Street', 'Okahandja Road'
];

export const OTHER_TOWNS = ['Okahandja', 'Rehoboth', 'Gobabis', 'Swakopmund', 'Walvis Bay', 'Otjiwarongo'];

/** The patients table only accepts these four values (check constraint); Otjiherero, Khoekhoegowab and others are "Other" */
export const LANGUAGES: Array<[string, number]> = [['Oshiwambo', 45], ['Afrikaans', 14], ['English', 12], ['Other', 29]];

export const OCCUPATIONS: Array<{ occupation: string; employer: string }> = [
  { occupation: 'Teacher', employer: 'Ministry of Education, Arts and Culture' },
  { occupation: 'Registered nurse', employer: 'Ministry of Health and Social Services' },
  { occupation: 'Police officer', employer: 'Namibian Police Force' },
  { occupation: 'Civil servant', employer: 'Office of the Prime Minister' },
  { occupation: 'Accountant', employer: 'Self-employed' },
  { occupation: 'Electrician', employer: 'NamPower' },
  { occupation: 'Bank teller', employer: 'Bank Windhoek' },
  { occupation: 'Mechanic', employer: 'Self-employed' },
  { occupation: 'Shop assistant', employer: 'Shoprite Namibia' },
  { occupation: 'Mine worker', employer: 'Namdeb' },
  { occupation: 'Software developer', employer: 'MTC Namibia' },
  { occupation: 'Domestic worker', employer: 'Private household' },
  { occupation: 'Taxi driver', employer: 'Self-employed' },
  { occupation: 'Lecturer', employer: 'University of Namibia' },
  { occupation: 'Soldier', employer: 'Namibian Defence Force' },
  { occupation: 'Farmer', employer: 'Self-employed' },
  { occupation: 'Municipal clerk', employer: 'City of Windhoek' },
  { occupation: 'Pharmacist', employer: 'Self-employed' }
];

export const PLAN_TYPES: Record<string, string[]> = {
  MAG1: ['PSEMAS Member'],
  NHPM: ['NHP Comprehensive', 'NHP Standard', 'NHP Essential'],
  NMC1: ['NMC Platinum', 'NMC Gold', 'NMC Silver'],
  NAMM: ['Nammed Comprehensive', 'Nammed Saver'],
  PROS: ['Prosperity Premium', 'Prosperity Classic']
};

export const FUND_WEIGHTS: Record<string, number> = { MAG1: 30, NHPM: 22, NMC1: 22, PROS: 14, NAMM: 12 };

export interface SeedLine {
  code: string;
  quantity?: number;
  /** 'tooth' takes the scenario's tooth; 'none' bills without a tooth */
  tooth?: 'tooth' | 'none';
  /** Add the 8346 material factor for this restorative line */
  material?: boolean;
}

export interface SeedMedication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface SeedLab {
  facility: string;
  notes: string;
  results: Array<{ test: string; unit: string; range: string; normal: [number, number]; abnormal: [number, number]; abnormalChance: number }>;
}

export interface Scenario {
  key: string;
  weight: number;
  minAge?: number;
  maxAge?: number;
  visitType: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  complaint: string;
  diagnosis: string;
  plan: string;
  /** Teeth the scenario may involve (FDI) */
  teeth: string[];
  lines: SeedLine[];
  medications?: SeedMedication[];
  lab?: SeedLab;
  imaging?: { type: string; bodyPart: string; indication: string; facility: string; report: string };
  vitalsChance: number;
}

const POSTERIOR = ['16', '17', '26', '27', '36', '37', '46', '47', '14', '15', '24', '25', '34', '35', '44', '45'];
const ANTERIOR = ['11', '12', '21', '22', '13', '23', '31', '32', '41', '42'];
const WISDOM = ['38', '48', '18', '28'];

export const MEDS = {
  amoxicillin: { name: 'Amoxicillin 500 mg capsules', dosage: '500 mg', frequency: 'Three times a day', duration: '5 days', instructions: 'Finish the course even if you feel better.' },
  ibuprofen: { name: 'Ibuprofen 400 mg tablets', dosage: '400 mg', frequency: 'Three times a day after meals', duration: '3 days', instructions: 'Take with food. Do not use with other anti-inflammatories.' },
  paracetamol: { name: 'Paracetamol 500 mg tablets', dosage: '1 g (2 tablets)', frequency: 'Four times a day as needed', duration: '3 days', instructions: 'No more than 8 tablets in 24 hours.' },
  chlorhexidine: { name: 'Chlorhexidine 0.2% mouthwash', dosage: '10 ml rinse', frequency: 'Twice a day', duration: '7 days', instructions: 'Rinse for 1 minute and spit out; do not swallow. Start 24 hours after the extraction.' },
  metronidazole: { name: 'Metronidazole 400 mg tablets', dosage: '400 mg', frequency: 'Three times a day', duration: '5 days', instructions: 'Avoid alcohol during the course and for 48 hours after.' },
  fluorideToothpaste: { name: 'Sodium fluoride 5000 ppm toothpaste', dosage: 'Pea-sized amount', frequency: 'Twice a day', duration: '3 months', instructions: 'Spit out after brushing, do not rinse.' }
} satisfies Record<string, SeedMedication>;

export const SCENARIOS: Scenario[] = [
  {
    key: 'checkup', weight: 22, minAge: 14, visitType: 'consultation', vitalsChance: 0.2,
    complaint: 'Routine six-monthly check-up and clean',
    diagnosis: 'Z01.2 Dental examination; K03.6 Deposits (accretions) on teeth',
    plan: 'Full mouth examination and charting, scale and polish, oral hygiene instructions. Recall in 6 months.',
    teeth: ['11'], lines: [{ code: '8101', tooth: 'none' }, { code: '8159', tooth: 'tooth' }, { code: '8151', tooth: 'tooth' }]
  },
  {
    key: 'caries', weight: 22, minAge: 6, visitType: 'procedure', vitalsChance: 0.6,
    complaint: 'Sensitivity to cold and sweets on a back tooth',
    diagnosis: 'K02.1 Caries of dentine',
    plan: 'Composite restoration under local anaesthetic. Review at next recall.',
    teeth: POSTERIOR, lines: [{ code: '8104', tooth: 'tooth' }, { code: '8107', tooth: 'tooth' }, { code: '8145', tooth: 'tooth' }, { code: '8368', tooth: 'tooth', material: true }]
  },
  {
    key: 'caries_large', weight: 7, minAge: 12, visitType: 'procedure', vitalsChance: 0.6,
    complaint: 'Food gets stuck in a broken filling',
    diagnosis: 'K02.1 Caries of dentine; K08.88 Fractured restoration',
    plan: 'Replace failed restoration with a three-surface composite under local anaesthetic.',
    teeth: POSTERIOR, lines: [{ code: '8104', tooth: 'tooth' }, { code: '8107', quantity: 2, tooth: 'tooth' }, { code: '8145', tooth: 'tooth' }, { code: '8369', tooth: 'tooth', material: true }]
  },
  {
    key: 'pulpitis', weight: 6, minAge: 14, visitType: 'emergency', vitalsChance: 0.9,
    complaint: 'Severe throbbing toothache keeping me awake at night',
    diagnosis: 'K04.0 Pulpitis',
    plan: 'Gross pulpal debridement and temporary dressing today. Root canal treatment over two further visits.',
    teeth: POSTERIOR, lines: [{ code: '8104', tooth: 'tooth' }, { code: '8107', tooth: 'tooth' }, { code: '8145', tooth: 'tooth' }, { code: '8132', tooth: 'tooth' }],
    medications: [MEDS.ibuprofen, MEDS.paracetamol]
  },
  {
    key: 'rct', weight: 4, minAge: 16, visitType: 'procedure', vitalsChance: 0.7,
    complaint: 'Root canal treatment visit (continuation)',
    diagnosis: 'K04.1 Necrosis of pulp',
    plan: 'Shape, clean and obturate canals. Crown recommended once the tooth is settled.',
    teeth: ['36', '46', '37', '47', '16', '26'], lines: [{ code: '8145', tooth: 'tooth' }, { code: '8304', tooth: 'tooth' }, { code: '8339', tooth: 'tooth' }, { code: '8340', quantity: 2, tooth: 'tooth' }]
  },
  {
    key: 'extraction', weight: 9, minAge: 16, visitType: 'procedure', vitalsChance: 0.95,
    complaint: 'Broken molar, painful to chew',
    diagnosis: 'K08.3 Retained dental root; K04.7 Periapical abscess without sinus',
    plan: 'Extraction under local anaesthetic. Post-operative instructions given; review if bleeding or pain persists.',
    teeth: POSTERIOR, lines: [{ code: '8104', tooth: 'tooth' }, { code: '8107', tooth: 'tooth' }, { code: '8145', tooth: 'tooth' }, { code: '8201', tooth: 'tooth' }],
    medications: [MEDS.amoxicillin, MEDS.ibuprofen, MEDS.chlorhexidine],
    lab: {
      facility: 'PathCare', notes: 'INR before extraction: patient on warfarin',
      results: [{ test: 'INR', unit: 'ratio', range: '2.0-3.0', normal: [2.0, 2.9], abnormal: [3.3, 4.1], abnormalChance: 0.25 }]
    }
  },
  {
    key: 'gingivitis', weight: 8, minAge: 16, visitType: 'consultation', vitalsChance: 0.4,
    complaint: 'Gums bleed when brushing',
    diagnosis: 'K05.1 Chronic gingivitis',
    plan: 'Periodontal screening, scaling for periodontally compromised patient, oral hygiene instruction. Review in 4 weeks.',
    teeth: ['31'], lines: [{ code: '8104', tooth: 'tooth' }, { code: '8176', tooth: 'none' }, { code: '8180', tooth: 'none' }, { code: '8177', tooth: 'none' }],
    medications: [MEDS.chlorhexidine],
    lab: {
      facility: 'Namibia Institute of Pathology', notes: 'HbA1c: known diabetic with periodontal disease',
      results: [
        { test: 'HbA1c', unit: '%', range: '4.0-6.0', normal: [5.2, 5.9], abnormal: [7.1, 9.4], abnormalChance: 0.6 },
        { test: 'Fasting glucose', unit: 'mmol/L', range: '3.9-5.6', normal: [4.4, 5.5], abnormal: [7.2, 11.8], abnormalChance: 0.5 }
      ]
    }
  },
  {
    key: 'child', weight: 9, maxAge: 13, visitType: 'consultation', vitalsChance: 0.1,
    complaint: 'Child dental check-up',
    diagnosis: 'Z01.2 Dental examination',
    plan: 'Examination, fluoride varnish and fissure sealants on the first permanent molars. Recall in 6 months.',
    teeth: ['36', '46', '16', '26'], lines: [{ code: '8101', tooth: 'none' }, { code: '8161', tooth: 'tooth' }, { code: '8163', quantity: 2, tooth: 'tooth' }],
    medications: [MEDS.fluorideToothpaste]
  },
  {
    key: 'review', weight: 8, visitType: 'follow-up', vitalsChance: 0.2,
    complaint: 'Review after treatment',
    diagnosis: 'Z09.8 Follow-up examination after other treatment',
    plan: 'Healing well. No further treatment needed now; routine recall.',
    teeth: POSTERIOR, lines: [{ code: '8104', tooth: 'tooth' }]
  },
  {
    key: 'trauma', weight: 2, minAge: 6, visitType: 'emergency', vitalsChance: 0.8,
    complaint: 'Fell and chipped a front tooth',
    diagnosis: 'S02.5 Fracture of tooth (traumatic)',
    plan: 'Radiograph to check the root, composite build-up of the incisal edge. Monitor vitality.',
    teeth: ANTERIOR, lines: [{ code: '8104', tooth: 'tooth' }, { code: '8107', tooth: 'tooth' }, { code: '8145', tooth: 'tooth' }, { code: '8351', tooth: 'tooth', material: true }]
  },
  {
    key: 'denture', weight: 3, minAge: 50, visitType: 'consultation', vitalsChance: 0.3,
    complaint: 'Upper denture is loose',
    diagnosis: 'K08.1 Loss of teeth due to extraction or local periodontal disease',
    plan: 'Chairside reline of the upper denture; review in one week.',
    teeth: ['11'], lines: [{ code: '8104', tooth: 'tooth' }, { code: '8263', tooth: 'none' }]
  },
  {
    key: 'pericoronitis', weight: 3, minAge: 17, maxAge: 40, visitType: 'emergency', vitalsChance: 0.9,
    complaint: 'Swelling and pain behind the last tooth, hard to open the mouth',
    diagnosis: 'K05.2 Acute periodontitis (pericoronitis)',
    plan: 'Irrigation and palliative treatment. Panoramic radiograph to plan removal of the wisdom tooth.',
    teeth: WISDOM, lines: [{ code: '8104', tooth: 'tooth' }, { code: '8131', tooth: 'tooth' }],
    medications: [MEDS.metronidazole, MEDS.chlorhexidine, MEDS.ibuprofen],
    imaging: {
      type: 'panoramic_x_ray', bodyPart: 'Mandible (panoramic / OPG)', indication: 'Partially erupted lower wisdom tooth with pericoronitis: assess position and nerve proximity',
      facility: 'Windhoek Radiology', report: 'Mesioangular impaction of the lower third molar; root apex close to the inferior alveolar canal. Surgical removal advised.'
    }
  },
  {
    key: 'lesion', weight: 1, minAge: 35, visitType: 'consultation', vitalsChance: 0.6,
    complaint: 'Ulcer on the tongue that has not healed for three weeks',
    diagnosis: 'K14.0 Glossitis; D37.0 Neoplasm of uncertain behaviour of lip, oral cavity (to exclude)',
    plan: 'Incisional biopsy sent for histology. Review with results in 7-10 days.',
    teeth: ['31'], lines: [{ code: '8104', tooth: 'tooth' }, { code: '8145', tooth: 'tooth' }, { code: '8188', tooth: 'none' }],
    lab: {
      facility: 'PathCare', notes: 'Histology: incisional biopsy, lateral border of tongue',
      results: [{ test: 'Histology (biopsy)', unit: '', range: '', normal: [0, 0], abnormal: [0, 0], abnormalChance: 0 }]
    }
  },
  {
    key: 'sensitivity', weight: 3, minAge: 18, visitType: 'consultation', vitalsChance: 0.1,
    complaint: 'Teeth sensitive to cold drinks',
    diagnosis: 'K03.8 Dentine hypersensitivity',
    plan: 'Desensitising treatment applied; high-fluoride toothpaste prescribed.',
    teeth: ['14', '24', '34', '44'], lines: [{ code: '8104', tooth: 'tooth' }, { code: '8167', tooth: 'tooth' }],
    medications: [MEDS.fluorideToothpaste]
  }
];

export const LAB_FACILITIES = ['PathCare', 'Namibia Institute of Pathology', 'Diagnolab'];

export interface ExpenseTemplate {
  name: string;
  type: 'rent' | 'utilities' | 'insurance' | 'supplies' | 'equipment' | 'staff' | 'professional_services' | 'marketing' | 'technology' | 'regulatory' | 'maintenance' | 'other';
  cadence: 'fixed_monthly' | 'variable_monthly' | 'quarterly' | 'annual' | 'one_time';
  frequency: 'monthly' | 'quarterly' | 'annual' | 'once_off';
  vendor: string;
  method: 'bank_transfer' | 'debit_order' | 'credit_card' | 'cash';
  amount: [number, number];
  /** Months (1-12) the expense falls in; all months when absent */
  months?: number[];
  dueDay: number;
}

export const EXPENSES: ExpenseTemplate[] = [
  { name: 'Rent - Otjomuise consulting rooms', type: 'rent', cadence: 'fixed_monthly', frequency: 'monthly', vendor: 'Otjomuise Medical Centre (Pty) Ltd', method: 'debit_order', amount: [28500, 28500], dueDay: 1 },
  { name: 'Electricity', type: 'utilities', cadence: 'variable_monthly', frequency: 'monthly', vendor: 'City of Windhoek', method: 'debit_order', amount: [3100, 4900], dueDay: 15 },
  { name: 'Water and sewerage', type: 'utilities', cadence: 'variable_monthly', frequency: 'monthly', vendor: 'City of Windhoek', method: 'debit_order', amount: [620, 1150], dueDay: 15 },
  { name: 'Telephone and fibre internet', type: 'technology', cadence: 'fixed_monthly', frequency: 'monthly', vendor: 'Telecom Namibia', method: 'debit_order', amount: [1450, 1450], dueDay: 5 },
  { name: 'Practice management software', type: 'technology', cadence: 'fixed_monthly', frequency: 'monthly', vendor: 'OneHealth Systems', method: 'debit_order', amount: [1999, 1999], dueDay: 1 },
  { name: 'Dental consumables', type: 'supplies', cadence: 'variable_monthly', frequency: 'monthly', vendor: 'Dental Supplies Namibia', method: 'bank_transfer', amount: [7800, 16500], dueDay: 25 },
  { name: 'Dental laboratory work', type: 'professional_services', cadence: 'variable_monthly', frequency: 'monthly', vendor: 'Windhoek Dental Laboratory', method: 'bank_transfer', amount: [3900, 12400], dueDay: 25 },
  { name: 'Medical waste removal', type: 'maintenance', cadence: 'fixed_monthly', frequency: 'monthly', vendor: 'Enviro Clean Namibia', method: 'bank_transfer', amount: [1100, 1100], dueDay: 10 },
  { name: 'Cleaning services', type: 'maintenance', cadence: 'fixed_monthly', frequency: 'monthly', vendor: 'Spotless Cleaning Services', method: 'bank_transfer', amount: [2800, 2800], dueDay: 28 },
  { name: 'Bookkeeping and payroll', type: 'professional_services', cadence: 'fixed_monthly', frequency: 'monthly', vendor: 'Kalahari Accounting Services', method: 'bank_transfer', amount: [3500, 3500], dueDay: 7 },
  { name: 'Bank charges', type: 'other', cadence: 'variable_monthly', frequency: 'monthly', vendor: 'Bank Windhoek', method: 'debit_order', amount: [380, 690], dueDay: 28 },
  { name: 'Professional indemnity insurance', type: 'insurance', cadence: 'quarterly', frequency: 'quarterly', vendor: 'Hollard Insurance Namibia', method: 'debit_order', amount: [6300, 6300], months: [1, 4, 7, 10], dueDay: 1 },
  { name: 'Dental chair and autoclave service', type: 'equipment', cadence: 'quarterly', frequency: 'quarterly', vendor: 'Medi-Tech Namibia', method: 'bank_transfer', amount: [3900, 5200], months: [2, 5, 8, 11], dueDay: 20 },
  { name: 'HPCNA annual registration', type: 'regulatory', cadence: 'annual', frequency: 'annual', vendor: 'Health Professions Councils of Namibia', method: 'bank_transfer', amount: [7800, 7800], months: [1], dueDay: 31 },
  { name: 'Practice number renewal (NAMAF)', type: 'regulatory', cadence: 'annual', frequency: 'annual', vendor: 'NAMAF', method: 'bank_transfer', amount: [1850, 1850], months: [3], dueDay: 31 }
];

export interface InventorySeed {
  name: string;
  sku: string;
  category: 'disposables' | 'medications' | 'office_supplies' | 'equipment' | 'other';
  unit: string;
  unitCost: number;
  quantity: number;
  reorderLevel: number;
  supplier: string;
  location: string;
  /** Months until expiry from today; absent for items that do not expire */
  expiresInMonths?: number;
}

export const INVENTORY: InventorySeed[] = [
  { name: 'Nitrile examination gloves (M), box of 100', sku: 'DSP-GLV-M', category: 'disposables', unit: 'box', unitCost: 145, quantity: 38, reorderLevel: 15, supplier: 'Dental Supplies Namibia', location: 'Store room' },
  { name: 'Nitrile examination gloves (S), box of 100', sku: 'DSP-GLV-S', category: 'disposables', unit: 'box', unitCost: 145, quantity: 9, reorderLevel: 10, supplier: 'Dental Supplies Namibia', location: 'Store room' },
  { name: 'Surgical face masks, box of 50', sku: 'DSP-MSK', category: 'disposables', unit: 'box', unitCost: 85, quantity: 22, reorderLevel: 10, supplier: 'Dental Supplies Namibia', location: 'Store room' },
  { name: 'Patient bibs, pack of 500', sku: 'DSP-BIB', category: 'disposables', unit: 'pack', unitCost: 310, quantity: 6, reorderLevel: 3, supplier: 'Dental Supplies Namibia', location: 'Store room' },
  { name: 'Saliva ejectors, pack of 100', sku: 'DSP-SAL', category: 'disposables', unit: 'pack', unitCost: 95, quantity: 14, reorderLevel: 6, supplier: 'Dental Supplies Namibia', location: 'Surgery 1' },
  { name: 'Cotton rolls, pack of 1000', sku: 'DSP-COT', category: 'disposables', unit: 'pack', unitCost: 120, quantity: 4, reorderLevel: 5, supplier: 'Dental Supplies Namibia', location: 'Surgery 1' },
  { name: 'Sterilisation pouches, box of 200', sku: 'DSP-STP', category: 'disposables', unit: 'box', unitCost: 260, quantity: 12, reorderLevel: 5, supplier: 'Dental Supplies Namibia', location: 'Sterilisation room' },
  { name: 'Lidocaine 2% with adrenaline cartridges, box of 50', sku: 'MED-LID', category: 'medications', unit: 'box', unitCost: 480, quantity: 11, reorderLevel: 6, supplier: 'Medi-Sure Pharmaceuticals', location: 'Surgery 1', expiresInMonths: 14 },
  { name: 'Articaine 4% cartridges, box of 50', sku: 'MED-ART', category: 'medications', unit: 'box', unitCost: 620, quantity: 3, reorderLevel: 4, supplier: 'Medi-Sure Pharmaceuticals', location: 'Surgery 2', expiresInMonths: 2 },
  { name: 'Dental needles 27G short, box of 100', sku: 'DSP-NDL', category: 'disposables', unit: 'box', unitCost: 175, quantity: 8, reorderLevel: 4, supplier: 'Dental Supplies Namibia', location: 'Surgery 1' },
  { name: 'Composite resin A2 syringe (4 g)', sku: 'RST-A2', category: 'disposables', unit: 'syringe', unitCost: 410, quantity: 16, reorderLevel: 8, supplier: 'Dental Supplies Namibia', location: 'Surgery 1', expiresInMonths: 18 },
  { name: 'Composite resin A3 syringe (4 g)', sku: 'RST-A3', category: 'disposables', unit: 'syringe', unitCost: 410, quantity: 12, reorderLevel: 8, supplier: 'Dental Supplies Namibia', location: 'Surgery 2', expiresInMonths: 16 },
  { name: 'Bonding agent (5 ml)', sku: 'RST-BND', category: 'disposables', unit: 'bottle', unitCost: 690, quantity: 5, reorderLevel: 3, supplier: 'Dental Supplies Namibia', location: 'Surgery 1', expiresInMonths: 9 },
  { name: 'Etching gel 37% (3 ml)', sku: 'RST-ETC', category: 'disposables', unit: 'syringe', unitCost: 95, quantity: 20, reorderLevel: 8, supplier: 'Dental Supplies Namibia', location: 'Surgery 1', expiresInMonths: 20 },
  { name: 'Glass ionomer restorative kit', sku: 'RST-GIC', category: 'disposables', unit: 'kit', unitCost: 1180, quantity: 2, reorderLevel: 2, supplier: 'Dental Supplies Namibia', location: 'Surgery 2', expiresInMonths: 11 },
  { name: 'Fluoride varnish (10 ml)', sku: 'PRV-FLV', category: 'medications', unit: 'tube', unitCost: 460, quantity: 7, reorderLevel: 3, supplier: 'Dental Supplies Namibia', location: 'Surgery 1', expiresInMonths: 8 },
  { name: 'Fissure sealant (2 x 1.2 ml)', sku: 'PRV-SEA', category: 'disposables', unit: 'pack', unitCost: 520, quantity: 4, reorderLevel: 2, supplier: 'Dental Supplies Namibia', location: 'Surgery 1', expiresInMonths: 12 },
  { name: 'Prophylaxis paste, jar of 340 g', sku: 'PRV-PRO', category: 'disposables', unit: 'jar', unitCost: 230, quantity: 6, reorderLevel: 2, supplier: 'Dental Supplies Namibia', location: 'Surgery 2', expiresInMonths: 24 },
  { name: 'Alginate impression material (450 g)', sku: 'IMP-ALG', category: 'disposables', unit: 'bag', unitCost: 175, quantity: 9, reorderLevel: 4, supplier: 'Dental Supplies Namibia', location: 'Store room', expiresInMonths: 10 },
  { name: 'Endodontic files assorted, pack of 6', sku: 'END-FIL', category: 'disposables', unit: 'pack', unitCost: 340, quantity: 15, reorderLevel: 6, supplier: 'Dental Supplies Namibia', location: 'Surgery 2' },
  { name: 'Gutta-percha points, box of 120', sku: 'END-GUT', category: 'disposables', unit: 'box', unitCost: 260, quantity: 5, reorderLevel: 3, supplier: 'Dental Supplies Namibia', location: 'Surgery 2' },
  { name: 'Sodium hypochlorite 3.5% (1 L)', sku: 'END-HYP', category: 'disposables', unit: 'bottle', unitCost: 85, quantity: 6, reorderLevel: 3, supplier: 'Dental Supplies Namibia', location: 'Surgery 2', expiresInMonths: 6 },
  { name: 'Absorbable sutures 4-0, box of 12', sku: 'SRG-SUT', category: 'disposables', unit: 'box', unitCost: 690, quantity: 3, reorderLevel: 2, supplier: 'Dental Supplies Namibia', location: 'Surgery 1', expiresInMonths: 30 },
  { name: 'Haemostatic sponges, box of 10', sku: 'SRG-HAE', category: 'disposables', unit: 'box', unitCost: 410, quantity: 1, reorderLevel: 2, supplier: 'Dental Supplies Namibia', location: 'Surgery 1', expiresInMonths: 1 },
  { name: 'Surface disinfectant (5 L)', sku: 'INF-DIS', category: 'disposables', unit: 'container', unitCost: 520, quantity: 4, reorderLevel: 2, supplier: 'Enviro Clean Namibia', location: 'Sterilisation room' },
  { name: 'Hand sanitiser (5 L)', sku: 'INF-SAN', category: 'disposables', unit: 'container', unitCost: 380, quantity: 3, reorderLevel: 2, supplier: 'Enviro Clean Namibia', location: 'Reception' },
  { name: 'Amoxicillin 500 mg (dispensing pack 15)', sku: 'MED-AMX', category: 'medications', unit: 'pack', unitCost: 38, quantity: 40, reorderLevel: 20, supplier: 'Medi-Sure Pharmaceuticals', location: 'Dispensary cupboard', expiresInMonths: 7 },
  { name: 'Ibuprofen 400 mg (dispensing pack 15)', sku: 'MED-IBU', category: 'medications', unit: 'pack', unitCost: 22, quantity: 55, reorderLevel: 20, supplier: 'Medi-Sure Pharmaceuticals', location: 'Dispensary cupboard', expiresInMonths: 15 },
  { name: 'Chlorhexidine mouthwash 0.2% (250 ml)', sku: 'MED-CHX', category: 'medications', unit: 'bottle', unitCost: 58, quantity: 18, reorderLevel: 10, supplier: 'Medi-Sure Pharmaceuticals', location: 'Dispensary cupboard', expiresInMonths: 4 },
  { name: 'Intra-oral X-ray film / sensor sleeves, box of 500', sku: 'XRY-SLV', category: 'disposables', unit: 'box', unitCost: 330, quantity: 2, reorderLevel: 2, supplier: 'Dental Supplies Namibia', location: 'X-ray room' },
  { name: 'Printer paper A4, box of 5 reams', sku: 'OFF-A4', category: 'office_supplies', unit: 'box', unitCost: 340, quantity: 4, reorderLevel: 2, supplier: 'Rite Office Supplies', location: 'Reception' },
  { name: 'Appointment cards, pack of 500', sku: 'OFF-APP', category: 'office_supplies', unit: 'pack', unitCost: 260, quantity: 3, reorderLevel: 1, supplier: 'Rite Office Supplies', location: 'Reception' },
  { name: 'Curing light (LED)', sku: 'EQP-CUR', category: 'equipment', unit: 'unit', unitCost: 6800, quantity: 2, reorderLevel: 0, supplier: 'Medi-Tech Namibia', location: 'Surgery 1' },
  { name: 'Ultrasonic scaler handpiece', sku: 'EQP-SCL', category: 'equipment', unit: 'unit', unitCost: 9400, quantity: 2, reorderLevel: 0, supplier: 'Medi-Tech Namibia', location: 'Surgery 2' },
  { name: 'High-speed handpiece', sku: 'EQP-HSP', category: 'equipment', unit: 'unit', unitCost: 7200, quantity: 4, reorderLevel: 1, supplier: 'Medi-Tech Namibia', location: 'Surgery 1' },
  { name: 'Autoclave (Class B, 23 L)', sku: 'EQP-AUT', category: 'equipment', unit: 'unit', unitCost: 68500, quantity: 1, reorderLevel: 0, supplier: 'Medi-Tech Namibia', location: 'Sterilisation room' },
  { name: 'Intra-oral X-ray unit', sku: 'EQP-XRY', category: 'equipment', unit: 'unit', unitCost: 92000, quantity: 1, reorderLevel: 0, supplier: 'Medi-Tech Namibia', location: 'X-ray room' }
];
