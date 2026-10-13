import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  ROOM_TOKEN_LENGTH,
  buildTelemedicineInviteMessage,
  buildTelemedicineRoomUrl,
  createTelemedicineRoomName,
  createTelemedicineRoomUrl,
  getClinicianDisplayName,
  withJitsiDisplayName
} from '../telemedicineLinks';

const PRACTICE_ID = '1A2B3C4D-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const ROOM_NAME_PATTERN = new RegExp(`^hpms-[a-z0-9]{1,8}-[a-z2-7]{${ROOM_TOKEN_LENGTH}}$`);

afterEach(() => {
  vi.restoreAllMocks();
});

// Anyone holding a Jitsi room URL can join the consult, so the URL is effectively the key to a
// private medical conversation: it must be unguessable, fresh per room, and safe to put in an SMS.
describe('createTelemedicineRoomName', () => {
  it('namespaces the room by practice and appends a random token', () => {
    expect(createTelemedicineRoomName(PRACTICE_ID)).toMatch(/^hpms-1a2b3c4d-[a-z2-7]{26}$/);
  });

  it('falls back to a neutral prefix when the practice is unknown', () => {
    expect(createTelemedicineRoomName(undefined)).toMatch(/^hpms-clinic-[a-z2-7]{26}$/);
    expect(createTelemedicineRoomName('')).toMatch(/^hpms-clinic-[a-z2-7]{26}$/);
  });

  it('carries at least 128 bits of randomness', () => {
    // 26 characters from a 32-character alphabet = 130 bits
    expect(ROOM_TOKEN_LENGTH * Math.log2(32)).toBeGreaterThanOrEqual(128);
  });

  it('draws its randomness from crypto.getRandomValues, not Math.random', () => {
    const cryptoSpy = vi.spyOn(globalThis.crypto, 'getRandomValues');
    const mathSpy = vi.spyOn(Math, 'random');
    createTelemedicineRoomName(PRACTICE_ID);
    expect(cryptoSpy).toHaveBeenCalledTimes(1);
    expect(mathSpy).not.toHaveBeenCalled();
  });

  it('never repeats a room across many calls', () => {
    const names = new Set(Array.from({ length: 2000 }, () => createTelemedicineRoomName(PRACTICE_ID)));
    expect(names.size).toBe(2000);
    names.forEach((name) => expect(name).toMatch(ROOM_NAME_PATTERN));
  });

  it('does not derive the token from the practice id (only the prefix depends on it)', () => {
    const tokens = new Set(
      Array.from({ length: 50 }, () => createTelemedicineRoomName(PRACTICE_ID).split('-')[2])
    );
    expect(tokens.size).toBe(50);
  });

  it('maps every random byte onto the URL-safe alphabet', () => {
    const allBits = () => new Uint8Array(ROOM_TOKEN_LENGTH).fill(255);
    const noBits = () => new Uint8Array(ROOM_TOKEN_LENGTH).fill(0);
    expect(createTelemedicineRoomName(PRACTICE_ID, allBits)).toBe(`hpms-1a2b3c4d-${'7'.repeat(26)}`);
    expect(createTelemedicineRoomName(PRACTICE_ID, noBits)).toBe(`hpms-1a2b3c4d-${'a'.repeat(26)}`);
  });

  it('refuses to create a room without a secure random source', () => {
    expect(() => createTelemedicineRoomName(PRACTICE_ID, () => new Uint8Array(4))).toThrow();
    vi.stubGlobal('crypto', undefined);
    try {
      expect(() => createTelemedicineRoomName(PRACTICE_ID)).toThrow(/private video room/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('createTelemedicineRoomUrl', () => {
  it('builds a meet.jit.si link that needs no escaping in an SMS or a URL', () => {
    const url = createTelemedicineRoomUrl(PRACTICE_ID);
    expect(url).toMatch(/^https:\/\/meet\.jit\.si\/hpms-1a2b3c4d-[a-z2-7]{26}$/);
    const roomName = url.split('/').pop() as string;
    expect(encodeURIComponent(roomName)).toBe(roomName);
  });

  it('returns a different link every time', () => {
    expect(createTelemedicineRoomUrl(PRACTICE_ID)).not.toBe(createTelemedicineRoomUrl(PRACTICE_ID));
  });

  it('supports another Jitsi host without doubling slashes', () => {
    expect(buildTelemedicineRoomUrl('hpms-x-abc', 'https://video.example.na/')).toBe('https://video.example.na/hpms-x-abc');
  });
});

describe('withJitsiDisplayName', () => {
  it('pre-fills the clinician name only in the in-app view', () => {
    const url = 'https://meet.jit.si/hpms-x-abc';
    expect(withJitsiDisplayName(url, 'Dr. Hilma Amalwa')).toBe(
      `${url}#userInfo.displayName=${encodeURIComponent('"Dr. Hilma Amalwa"')}`
    );
    expect(withJitsiDisplayName(url, '  ')).toBe(url);
  });
});

describe('getClinicianDisplayName', () => {
  // The patient is told who is waiting in the room; doctors must read "Dr. X" exactly once
  it('titles doctors once, whether or not the stored name already has the title', () => {
    expect(getClinicianDisplayName({ name: 'Hilma Amalwa', role: 'doctor' })).toBe('Dr. Hilma Amalwa');
    expect(getClinicianDisplayName({ name: 'Dr. Hilma Amalwa', role: 'doctor' })).toBe('Dr. Hilma Amalwa');
  });

  it('does not give other staff a doctor title', () => {
    expect(getClinicianDisplayName({ name: 'Anna Shikongo', role: 'nurse' })).toBe('Anna Shikongo');
  });

  it('returns null when the name is unknown so the invite falls back to "your doctor"', () => {
    expect(getClinicianDisplayName({ name: '  ', role: 'doctor' })).toBeNull();
    expect(getClinicianDisplayName(null)).toBeNull();
  });
});

describe('buildTelemedicineInviteMessage', () => {
  const roomUrl = 'https://meet.jit.si/hpms-1a2b3c4d-abcdefghijklmnopqrstuvwxyz';

  it('tells the patient who is waiting and where to join', () => {
    expect(
      buildTelemedicineInviteMessage({
        roomUrl,
        patientFirstName: 'Maria',
        clinicianName: 'Dr. Hilma Amalwa',
        practiceName: 'Kalahari Medical'
      })
    ).toBe(`Hi Maria, Dr. Hilma Amalwa from Kalahari Medical is ready for your video consultation. Join: ${roomUrl}`);
  });

  it('still reads naturally when names are missing', () => {
    expect(buildTelemedicineInviteMessage({ roomUrl })).toBe(
      `Hi, your doctor is ready for your video consultation. Join: ${roomUrl}`
    );
  });

  it('fits in a single SMS for typical names', () => {
    const message = buildTelemedicineInviteMessage({
      roomUrl,
      patientFirstName: 'Maria',
      clinicianName: 'Dr. Hilma Amalwa',
      practiceName: 'Kalahari Medical'
    });
    expect(message.length).toBeLessThanOrEqual(160);
  });
});
