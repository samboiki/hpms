/**
 * Does a medicine about to be prescribed match one of the patient's recorded allergies?
 *
 * Medicine names are free text in OneHealth (no NAPPI-coded catalogue yet), so this is a check by
 * name: it catches the allergy word in the medicine ("Penicillin V" for a penicillin allergy) and the
 * common members of the drug groups patients are most often allergic to ("Augmentin" for a penicillin
 * allergy, "Bactrim" for a sulfa allergy, "Ubistesin" for a local anaesthetic allergy). It is a safety
 * net, not a full interaction check, and the screens say so. A match never blocks: the prescriber
 * may continue with a reason, which is kept.
 *
 * Group members are generic names and well-known brands in Namibia and South Africa. Adding a name
 * to a group only makes the check warn more often, never less.
 */

export interface AllergyForMatching {
  id: string;
  substance: string;
  reaction?: string | null;
  severity?: string | null;
}

export type ConflictKind = 'same' | 'group' | 'related';

export interface AllergyConflict {
  allergy: AllergyForMatching;
  kind: ConflictKind;
  /** One plain sentence: why this medicine was flagged */
  explanation: string;
}

interface DrugGroup {
  key: string;
  /** "a penicillin", used in "Augmentin is a penicillin" */
  memberNoun: string;
  /** "penicillins", used in "allergic to penicillins" */
  label: string;
  /** Words in an allergy record that mean "allergic to this group" */
  allergyTerms: readonly string[];
  /** Medicine names (generic and brand) in the group */
  members: readonly string[];
}

export const DRUG_GROUPS: readonly DrugGroup[] = [
  {
    key: 'penicillins',
    memberNoun: 'a penicillin',
    label: 'penicillins',
    allergyTerms: ['penicillin', 'penicillins', 'pen v', 'penicillin v', 'beta lactam', 'beta-lactam'],
    members: [
      'penicillin', 'amoxicillin', 'amoxycillin', 'amoxil', 'moxypen', 'ranmoxy', 'augmentin', 'augmaxcil', 'curam',
      'clamentin', 'co-amoxiclav', 'coamoxiclav', 'amoxiclav', 'ampicillin', 'cloxacillin', 'flucloxacillin', 'floxapen',
      'dicloxacillin', 'phenoxymethylpenicillin', 'benzylpenicillin', 'benzathine', 'procaine penicillin', 'piperacillin',
      'tazocin', 'pivmecillinam'
    ]
  },
  {
    key: 'cephalosporins',
    memberNoun: 'a cephalosporin',
    label: 'cephalosporins',
    allergyTerms: ['cephalosporin', 'cephalosporins', 'cefalosporin'],
    members: [
      'cefalexin', 'cephalexin', 'cefadroxil', 'cefaclor', 'cefuroxime', 'zinnat', 'cefixime', 'cefpodoxime', 'cefprozil',
      'ceftriaxone', 'rocephin', 'cefotaxime', 'ceftazidime', 'cefepime', 'cefazolin', 'cefoxitin'
    ]
  },
  {
    key: 'sulfonamides',
    memberNoun: 'a sulfonamide (sulfa) medicine',
    label: 'sulfa medicines',
    allergyTerms: ['sulfa', 'sulpha', 'sulfonamide', 'sulphonamide', 'sulfonamides', 'sulphonamides'],
    members: [
      'sulfamethoxazole', 'sulphamethoxazole', 'co-trimoxazole', 'cotrimoxazole', 'bactrim', 'septran', 'sulfadiazine',
      'sulphadiazine', 'sulfasalazine', 'sulphasalazine', 'salazopyrin', 'sulfadoxine'
    ]
  },
  {
    key: 'nsaids',
    memberNoun: 'an anti-inflammatory (NSAID)',
    label: 'anti-inflammatories (NSAIDs) and aspirin',
    allergyTerms: ['nsaid', 'nsaids', 'anti-inflammatory', 'anti-inflammatories', 'anti inflammatory', 'aspirin', 'salicylate'],
    members: [
      'aspirin', 'disprin', 'ecotrin', 'ibuprofen', 'brufen', 'nurofen', 'diclofenac', 'voltaren', 'cataflam', 'naproxen',
      'naprosyn', 'mefenamic', 'ponstan', 'indomethacin', 'indometacin', 'ketoprofen', 'piroxicam', 'meloxicam', 'mobic',
      'celecoxib', 'celebrex', 'etoricoxib', 'arcoxia', 'ketorolac', 'nimesulide'
    ]
  },
  {
    key: 'opioids',
    memberNoun: 'an opioid related to codeine and morphine',
    label: 'codeine and morphine-type opioids',
    allergyTerms: ['codeine', 'morphine', 'opiate', 'opiates', 'opioid', 'opioids'],
    members: ['codeine', 'dihydrocodeine', 'morphine', 'oxycodone', 'hydromorphone', 'hydrocodone', 'pholcodine']
  },
  {
    key: 'macrolides',
    memberNoun: 'a macrolide antibiotic',
    label: 'macrolide antibiotics',
    allergyTerms: ['macrolide', 'macrolides', 'erythromycin'],
    members: ['erythromycin', 'azithromycin', 'zithromax', 'clarithromycin', 'klacid', 'roxithromycin']
  },
  {
    key: 'tetracyclines',
    memberNoun: 'a tetracycline',
    label: 'tetracyclines',
    allergyTerms: ['tetracycline', 'tetracyclines'],
    members: ['tetracycline', 'doxycycline', 'minocycline', 'oxytetracycline', 'lymecycline']
  },
  {
    key: 'quinolones',
    memberNoun: 'a quinolone antibiotic',
    label: 'quinolone antibiotics',
    allergyTerms: ['quinolone', 'quinolones', 'fluoroquinolone', 'fluoroquinolones'],
    members: ['ciprofloxacin', 'ciprobay', 'levofloxacin', 'moxifloxacin', 'ofloxacin', 'norfloxacin']
  },
  {
    key: 'local-anaesthetics',
    memberNoun: 'a local anaesthetic',
    label: 'local anaesthetics',
    allergyTerms: ['local anaesthetic', 'local anesthetic', 'local anaesthetics', 'local anesthetics', 'dental anaesthetic', 'dental anesthetic'],
    members: [
      'lidocaine', 'lignocaine', 'xylocaine', 'articaine', 'septanest', 'ubistesin', 'mepivacaine', 'scandonest',
      'prilocaine', 'citanest', 'bupivacaine', 'marcaine', 'benzocaine', 'procaine'
    ]
  }
];

/** Penicillin allergy: cephalosporins occasionally cross-react, so they are flagged more softly. */
const RELATED_GROUPS: ReadonlyArray<{ from: string; to: string; note: string }> = [
  { from: 'penicillins', to: 'cephalosporins', note: 'A few people allergic to penicillins also react to cephalosporins.' }
];

/** Lower case, letters, digits and single spaces ("Amoxicillin 500mg/5ml" -> "amoxicillin 500mg 5ml"). */
export function normalizeMedicineText(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * True when `term` appears in `text` at the start of a word: "sulfa" is found in "sulfasalazine",
 * but "ace" is not found in "paracetamol". Terms shorter than 4 letters must be whole words.
 */
export function containsTerm(text: string, term: string): boolean {
  const normalizedText = normalizeMedicineText(text);
  const normalizedTerm = normalizeMedicineText(term);
  if (!normalizedText || !normalizedTerm) return false;
  const padded = ` ${normalizedText} `;
  if (normalizedTerm.length < 4) return padded.includes(` ${normalizedTerm} `);
  return padded.includes(` ${normalizedTerm}`);
}

const groupsOfAllergy = (substance: string): DrugGroup[] =>
  DRUG_GROUPS.filter(group => group.allergyTerms.some(term => containsTerm(substance, term)) || group.members.some(member => containsTerm(substance, member)));

const groupsOfMedicine = (medicine: string): DrugGroup[] => DRUG_GROUPS.filter(group => group.members.some(member => containsTerm(medicine, member)));

/** "Augmentin (rash in 2019)" -> "augmentin": notes in brackets are not part of the substance */
const substanceCore = (substance: string): string => normalizeMedicineText(substance.replace(/\([^)]*\)/g, ' '));

/** Leading words many unrelated medicines share ("Vitamin C" and "Vitamin B12"): never a match on their own */
const SHARED_LEADING_WORDS = new Set([
  'vitamin', 'sodium', 'potassium', 'calcium', 'magnesium', 'ferrous', 'iron', 'zinc', 'folic', 'oral', 'topical',
  'nasal', 'tablet', 'tablets', 'syrup', 'cream', 'injection', 'drops', 'compound', 'paediatric', 'pediatric', 'adult',
  'children', 'extra', 'forte', 'plus', 'cough', 'cold', 'eye', 'ear'
]);

/** Same medicine: the allergy's substance is in the medicine name, or both start with the same distinctive word. */
function isSameMedicine(medicine: string, substance: string): boolean {
  const core = substanceCore(substance);
  if (!core) return false;
  if (containsTerm(medicine, core)) return true;
  const medicineWord = normalizeMedicineText(medicine).split(' ')[0] ?? '';
  const substanceWord = core.split(' ')[0] ?? '';
  return medicineWord.length >= 4 && medicineWord === substanceWord && !SHARED_LEADING_WORDS.has(medicineWord);
}

/** The recorded allergies this medicine may trigger, most direct first. */
export function findAllergyConflicts(medicine: string, allergies: readonly AllergyForMatching[]): AllergyConflict[] {
  const medicineText = normalizeMedicineText(medicine);
  if (!medicineText) return [];
  const medicineName = medicine.trim();
  const medicineGroups = groupsOfMedicine(medicine);
  const conflicts: AllergyConflict[] = [];

  for (const allergy of allergies) {
    const substance = allergy.substance.trim();
    if (!substance) continue;
    // 1. The same medicine
    if (isSameMedicine(medicine, substance)) {
      conflicts.push({ allergy, kind: 'same', explanation: `${medicineName} matches the recorded allergy to ${substance}.` });
      continue;
    }
    // 2. Same drug group ("Augmentin is a penicillin")
    const allergyGroups = groupsOfAllergy(substance);
    const shared = medicineGroups.find(group => allergyGroups.includes(group));
    if (shared) {
      conflicts.push({
        allergy,
        kind: 'group',
        explanation: `${medicineName} is ${shared.memberNoun}, and the patient is allergic to ${substance}.`
      });
      continue;
    }
    // 3. A group known to cross-react
    const related = RELATED_GROUPS.find(link => allergyGroups.some(group => group.key === link.from) && medicineGroups.some(group => group.key === link.to));
    if (related) {
      const target = DRUG_GROUPS.find(group => group.key === related.to);
      conflicts.push({
        allergy,
        kind: 'related',
        explanation: `${medicineName} is ${target?.memberNoun ?? 'a related medicine'}. ${related.note}`
      });
    }
  }
  const order: Record<ConflictKind, number> = { same: 0, group: 1, related: 2 };
  return conflicts.sort((a, b) => order[a.kind] - order[b.kind]);
}
