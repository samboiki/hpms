/**
 * The patient's photo (owner's decision, 13 Oct 2026; parity A12): made small before upload so lists load at once
 * on a practice's connection, and stored only in the practice's own private folder so no other practice can open it.
 * Invented ids only; no real photos.
 */
import { describe, expect, it } from 'vitest';
import { PHOTO_MAX_SIDE, fitWithin, isPatientPhotoPath, patientPhotoPath, photoFileProblem } from '../patientPhoto';

const PRACTICE = '11111111-2222-3333-4444-555555555555';
const PATIENT = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('making the photo small', () => {
  it('fits a phone photo within the longest side, keeping its shape, so a list of photos loads quickly', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: PHOTO_MAX_SIDE, height: 384 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 384, height: PHOTO_MAX_SIDE });
  });

  it('never enlarges a small photo (that only adds blur and bytes)', () => {
    expect(fitWithin(300, 200)).toEqual({ width: 300, height: 200 });
  });

  it('gives nothing for an unreadable size instead of a broken picture', () => {
    expect(fitWithin(0, 100)).toEqual({ width: 0, height: 0 });
  });
});

describe('choosing a file', () => {
  it('refuses a file that is not an image, with plain words', () => {
    expect(photoFileProblem({ type: 'application/pdf', size: 1000 })).toMatch(/Choose a photo/);
    expect(photoFileProblem({ type: 'image/jpeg', size: 2_000_000 })).toBeNull();
  });

  it('refuses a huge file before reading it, so a slow device does not hang', () => {
    expect(photoFileProblem({ type: 'image/jpeg', size: 30 * 1024 * 1024 })).toMatch(/too large/);
  });
});

describe('where the photo is stored', () => {
  it("stores it in the practice's own patient-media folder, which the storage rules keep to that practice", () => {
    const path = patientPhotoPath(PRACTICE, PATIENT, new Date('2026-10-13T08:30:15.123Z'));
    expect(path).toBe(`${PRACTICE}/patient-media/${PATIENT}/photo-20261013083015123.jpg`);
    expect(isPatientPhotoPath(path, PATIENT)).toBe(true);
  });

  it('refuses to store a photo when the practice is not known (it would land where nobody can reach it)', () => {
    expect(() => patientPhotoPath(null, PATIENT)).toThrow(/practice is not known/);
  });

  it("never treats another patient's or another kind of file as this patient's photo (nothing else is signed or removed)", () => {
    const other = patientPhotoPath(PRACTICE, 'ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(isPatientPhotoPath(other, PATIENT)).toBe(false);
    expect(isPatientPhotoPath(`${PRACTICE}/patient-documents/${PATIENT}/photo-1.jpg`, PATIENT)).toBe(false);
    expect(isPatientPhotoPath(`${PRACTICE}/patient-media/${PATIENT}/photo-1.jpg/../x`, PATIENT)).toBe(false);
    expect(isPatientPhotoPath(null, PATIENT)).toBe(false);
  });
});
