/**
 * Video consult room links (Jitsi) and the SMS invite text.
 *
 * Anyone who knows a Jitsi room URL can join that room, so the room name must be unguessable:
 * its random part comes from the browser's cryptographic RNG (crypto.getRandomValues), never from
 * Math.random, and never from ids that appear elsewhere (practice or visit ids).
 */
import { formatDoctorName } from '../../utils/formatDoctorName';

export const DEFAULT_TELEMEDICINE_BASE_URL = 'https://meet.jit.si';

// Lowercase RFC 4648 base32: URL-safe, no case ambiguity (Jitsi treats room names case-insensitively)
const ROOM_TOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
// 26 characters x 5 bits = 130 bits of randomness
export const ROOM_TOKEN_LENGTH = 26;
const PRACTICE_SHORT_LENGTH = 8;

export type RandomBytes = (length: number) => Uint8Array;

const secureRandomBytes: RandomBytes = (length) => {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') {
    throw new Error('This browser cannot create a private video room (secure random numbers are unavailable).');
  }
  return cryptoApi.getRandomValues(new Uint8Array(length));
};

/** "hpms-<first 8 alphanumerics of the practice id>-<26 random base32 characters>" */
export function createTelemedicineRoomName(
  practiceId?: string | null,
  randomBytes: RandomBytes = secureRandomBytes
): string {
  const practiceShort =
    (practiceId ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, PRACTICE_SHORT_LENGTH) || 'clinic';
  const bytes = randomBytes(ROOM_TOKEN_LENGTH);
  if (bytes.length < ROOM_TOKEN_LENGTH) {
    throw new Error('Not enough random data to create a private video room.');
  }
  let token = '';
  for (let i = 0; i < ROOM_TOKEN_LENGTH; i++) {
    // 256 is a multiple of 32, so the low 5 bits of a uniform byte are uniform
    token += ROOM_TOKEN_ALPHABET[bytes[i] & 31];
  }
  return `hpms-${practiceShort}-${token}`;
}

export function buildTelemedicineRoomUrl(roomName: string, baseUrl: string = DEFAULT_TELEMEDICINE_BASE_URL): string {
  return `${baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(roomName)}`;
}

/** New unguessable room URL, e.g. https://meet.jit.si/hpms-1a2b3c4d-<random> */
export function createTelemedicineRoomUrl(practiceId?: string | null, baseUrl?: string): string {
  return buildTelemedicineRoomUrl(createTelemedicineRoomName(practiceId), baseUrl);
}

/**
 * Room URL for the clinician's in-app view, with their display name pre-filled so the patient
 * sees who joined. The link sent to the patient stays the plain room URL.
 */
export function withJitsiDisplayName(roomUrl: string, displayName?: string | null): string {
  const name = displayName?.trim();
  if (!name) return roomUrl;
  return `${roomUrl}#userInfo.displayName=${encodeURIComponent(JSON.stringify(name))}`;
}

/** How the person starting the call is named to the patient: doctors get one "Dr." prefix. */
export function getClinicianDisplayName(user?: { name?: string | null; role?: string | null } | null): string | null {
  const name = user?.name?.trim();
  if (!name) return null;
  return user?.role === 'doctor' ? formatDoctorName(name) : name;
}

export interface TelemedicineInviteDetails {
  roomUrl: string;
  patientFirstName?: string | null;
  clinicianName?: string | null;
  practiceName?: string | null;
}

/** SMS text inviting the patient into the room. Kept short (one SMS where names allow) and free of clinical details. */
export function buildTelemedicineInviteMessage({
  roomUrl,
  patientFirstName,
  clinicianName,
  practiceName
}: TelemedicineInviteDetails): string {
  const firstName = patientFirstName?.trim();
  // Always follows the greeting, so the fallback is lower case
  const clinician = clinicianName?.trim() || 'your doctor';
  const practice = practiceName?.trim();
  const greeting = firstName ? `Hi ${firstName}, ` : 'Hi, ';
  const who = practice ? `${clinician} from ${practice}` : clinician;
  return `${greeting}${who} is ready for your video consultation. Join: ${roomUrl}`;
}
