import { describe, expect, it } from 'vitest';
import { containsTerm, findAllergyConflicts, type AllergyForMatching } from '../allergyMatch';

const allergy = (substance: string, id = substance): AllergyForMatching => ({ id, substance, severity: 'severe', reaction: 'Rash' });

describe('containsTerm', () => {
  it('finds a term at the start of a word, so "sulfa" catches sulfasalazine', () => {
    expect(containsTerm('Sulfasalazine 500mg', 'sulfa')).toBe(true);
  });

  it('does not find a short term inside another word, so an "ACE" allergy never flags paracetamol', () => {
    expect(containsTerm('Paracetamol 500mg', 'ace')).toBe(false);
    expect(containsTerm('ACE inhibitor', 'ace')).toBe(true);
  });
});

describe('findAllergyConflicts', () => {
  it('flags the allergy substance itself, whatever strength or form is written after it', () => {
    const [conflict] = findAllergyConflicts('Amoxicillin 500mg caps', [allergy('Amoxicillin')]);
    expect(conflict.kind).toBe('same');
    expect(conflict.explanation).toBe('Amoxicillin 500mg caps matches the recorded allergy to Amoxicillin.');
  });

  it('flags a brand of a group the patient is allergic to: Augmentin is a penicillin', () => {
    const [conflict] = findAllergyConflicts('Augmentin 625mg', [allergy('Penicillin')]);
    expect(conflict.kind).toBe('group');
    expect(conflict.explanation).toBe('Augmentin 625mg is a penicillin, and the patient is allergic to Penicillin.');
  });

  it('flags other members of the group when the allergy was recorded as one medicine (amoxicillin -> flucloxacillin)', () => {
    expect(findAllergyConflicts('Flucloxacillin', [allergy('Amoxicillin')])[0].kind).toBe('group');
  });

  it('flags co-trimoxazole brands for a sulfa allergy', () => {
    expect(findAllergyConflicts('Bactrim DS', [allergy('Sulfa drugs')])[0].kind).toBe('group');
  });

  it('flags a dental anaesthetic for a local anaesthetic allergy, because dental practices inject daily', () => {
    expect(findAllergyConflicts('Ubistesin forte', [allergy('Lidocaine')])[0].kind).toBe('group');
  });

  it('flags NSAIDs for an aspirin allergy (they cross-react)', () => {
    expect(findAllergyConflicts('Ibuprofen 400mg', [allergy('Aspirin')])[0].kind).toBe('group');
  });

  it('flags cephalosporins more softly for a penicillin allergy: a few people react to both', () => {
    const [conflict] = findAllergyConflicts('Cefuroxime', [allergy('Penicillin')]);
    expect(conflict.kind).toBe('related');
    expect(conflict.explanation).toMatch(/cephalosporin/);
  });

  it('does not flag unrelated medicines (no false alarm on paracetamol for a penicillin allergy)', () => {
    expect(findAllergyConflicts('Paracetamol 500mg', [allergy('Penicillin'), allergy('Latex')])).toEqual([]);
  });

  it('does not treat "Vitamin C" and a "Vitamin B12" allergy as the same medicine', () => {
    expect(findAllergyConflicts('Vitamin C', [allergy('Vitamin B12 injection')])).toEqual([]);
  });

  it('ignores notes in brackets on the allergy and still matches the medicine', () => {
    expect(findAllergyConflicts('Augmentin', [allergy('Augmentin (rash in 2019)')])[0].kind).toBe('same');
  });

  it('lists the most direct match first when several allergies apply', () => {
    const conflicts = findAllergyConflicts('Amoxicillin', [allergy('Penicillin', 'a1'), allergy('Amoxicillin', 'a2')]);
    expect(conflicts.map(conflict => conflict.allergy.id)).toEqual(['a2', 'a1']);
  });

  it('returns nothing for an empty medicine name', () => {
    expect(findAllergyConflicts('   ', [allergy('Penicillin')])).toEqual([]);
  });
});
