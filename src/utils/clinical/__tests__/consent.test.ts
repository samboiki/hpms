import { describe, expect, it } from 'vitest';
import { buildConsentDocument, consentSignatureProblems, signedAtText, signerRoleLine, type ConsentSignature } from '../consent';
import type { LetterContext } from '../letters';

// Invented practice, practitioner and patient
const ctx: LetterContext = {
  practice: {
    name: 'Example Family Practice',
    address: '1 Example Street',
    city: 'Windhoek',
    country: 'Namibia',
    postalCode: null,
    contactPhone: '061 000 0000',
    contactEmail: null,
    practiceNumber: '0000000',
    primaryColor: '#123456'
  },
  author: { name: 'Dr A Example', title: 'General practitioner', hpcnaNumber: 'MP 00000' },
  patient: { name: 'Maria Example', dateOfBirth: '1990-05-14', idNumber: null },
  letterDate: '2026-10-13'
};

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const input = {
  name: 'Consent to a procedure',
  parts: {
    title: 'CONSENT TO A PROCEDURE',
    recipient: '',
    subject: 'Patient: Maria Example',
    greeting: '',
    body: 'I, the undersigned, consent to the following procedure for Maria Example: removal of a skin lesion.\n\nI understand that I may withdraw.'
  }
};

// 08:42 UTC is 10:42 in Windhoek
const signature: ConsentSignature = { signedBy: 'patient', signerName: '  Maria   Example ', image: PNG, signedAt: new Date('2026-10-13T08:42:00Z') };

describe('the signed consent form', () => {
  it('prints the signature with who signed, when (Windhoek time) and who witnessed it, so the form stands on its own', () => {
    const doc = buildConsentDocument(input, ctx, signature);
    expect(doc.kind).toBe('consent');
    expect(doc.title).toBe('CONSENT TO A PROCEDURE');
    expect(doc.closing).toBe('Signature:');
    expect(doc.signatureImage).toBe(PNG);
    expect(doc.signatureLines).toEqual([
      'Maria Example',
      'The patient',
      'Signed on 13 October 2026 at 10:42',
      'Witness: Dr A Example, General practitioner, HPCNA no MP 00000'
    ]);
    expect(doc.paragraphs).toHaveLength(2);
    expect(doc.recordTitle).toBe('Consent to a procedure');
  });

  it('names the patient when a parent, guardian or someone else signs for them', () => {
    expect(signerRoleLine('parent_or_guardian', 'Tim Example')).toBe('Parent or guardian of Tim Example');
    expect(signerRoleLine('other', 'Tim Example')).toBe('For Tim Example');
    expect(buildConsentDocument(input, ctx, { ...signature, signedBy: 'parent_or_guardian' }).signatureLines[1]).toBe(
      'Parent or guardian of Maria Example'
    );
  });

  it('shows how the form is signed in the preview, before anyone signs, and carries no signature', () => {
    const doc = buildConsentDocument(input, ctx, null);
    expect(doc.signatureImage).toBeNull();
    expect(doc.signatureLines[0]).toMatch(/Signed on the screen/);
  });

  it('leaves out the parts of the witness line the staff profile does not have', () => {
    const plain = { ...ctx, author: { name: 'Sister B Example', title: null, hpcnaNumber: null } };
    expect(buildConsentDocument(input, plain, signature).signatureLines[3]).toBe('Witness: Sister B Example');
  });

  it('writes the time in Windhoek whatever the device clock zone, two digits each', () => {
    expect(signedAtText(new Date('2026-12-31T22:05:00Z'))).toBe('1 January 2027 at 00:05');
  });
});

describe('before the form can be signed', () => {
  it('asks for who signs, their name and the signature, in plain words', () => {
    expect(consentSignatureProblems({})).toEqual([
      'Say who signs: the patient, a parent or guardian, or someone else for the patient.',
      'Give the name of the person who signs.',
      'The signature is missing: sign in the box.'
    ]);
    expect(consentSignatureProblems(signature)).toEqual([]);
  });

  it('keeps the name within what the database stores', () => {
    expect(consentSignatureProblems({ ...signature, signerName: 'x'.repeat(121) })).toEqual(['Keep the name to 120 characters.']);
  });

  it('accepts only a drawn PNG signature, never an empty or other image', () => {
    expect(consentSignatureProblems({ ...signature, image: 'data:image/png;base64,' })).toEqual(['The signature is missing: sign in the box.']);
    expect(consentSignatureProblems({ ...signature, image: 'data:image/jpeg;base64,AAAAAAAAAAAAAAAAAAAAAAAA' })).toHaveLength(1);
  });
});
