import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createSignedUrl, getPublicUrl, from } = vi.hoisted(() => {
  const createSignedUrl = vi.fn();
  // A record must never be given a public link: any call fails the test
  const getPublicUrl = vi.fn(() => { throw new Error('a public link was made for a record'); });
  return { createSignedUrl, getPublicUrl, from: vi.fn(() => ({ createSignedUrl, getPublicUrl })) };
});
vi.mock('../../lib/supabase', () => ({ supabase: { storage: { from } } }));

import { currentPracticeId, openRecord, recordLink } from '../recordFiles';
import { RECORDS_BUCKET, RECORD_LINK_SECONDS } from '../recordPaths';
import { useAuthStore } from '../../stores/authStore';

// Invented ids
const PRACTICE_A = '1a2b3c4d-0000-4000-8000-00000000000a';
const PRACTICE_B = '1a2b3c4d-0000-4000-8000-00000000000b';
const RECORD = `${PRACTICE_A}/prescriptions/prescription_v_1.pdf`;

beforeEach(() => {
  from.mockClear();
  getPublicUrl.mockClear();
  createSignedUrl.mockReset();
  createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://files.example/signed?token=fresh' }, error: null });
});
afterEach(() => vi.restoreAllMocks());

// A link stored in a row, an email or a browser history would outlive the reason it was made: links are made when
// someone opens the file, from the private bucket, and expire within minutes.
describe('opening a record', () => {
  it('makes a short-lived link from the private bucket, never a public one', async () => {
    await expect(recordLink(RECORD)).resolves.toBe('https://files.example/signed?token=fresh');
    expect(from).toHaveBeenCalledWith(RECORDS_BUCKET);
    expect(createSignedUrl).toHaveBeenCalledWith(RECORD, RECORD_LINK_SECONDS);
    expect(getPublicUrl).not.toHaveBeenCalled();
  });

  it('opens the tab straight from the click and makes the link only then', async () => {
    const tab = { closed: false, opener: {} as unknown, location: { href: '' }, close: vi.fn() };
    let resolveLink: (value: unknown) => void = () => undefined;
    createSignedUrl.mockReturnValue(new Promise(resolve => { resolveLink = resolve; }));
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);

    const opening = openRecord(RECORD);
    // The tab exists before the link: a pop-up blocker allows it because it came from the click
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(tab.location.href).toBe('');

    resolveLink({ data: { signedUrl: 'https://files.example/signed?token=now' }, error: null });
    await opening;
    expect(tab.location.href).toBe('https://files.example/signed?token=now');
    // The opened file cannot reach back into the app's window
    expect(tab.opener).toBeNull();
  });

  it('closes the empty tab and reports the error when the link cannot be made (another practice\'s file)', async () => {
    const tab = { closed: false, opener: null, location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    createSignedUrl.mockResolvedValue({ data: null, error: new Error('Object not found') });

    await expect(openRecord(`${PRACTICE_B}/invoices/x.pdf`)).rejects.toThrow('Object not found');
    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.href).toBe('');
  });

  it('still opens rows written before the move: an old path from the old bucket, an old public link as it is', async () => {
    await recordLink('invoices/invoice_INV-1_1.pdf');
    expect(from).toHaveBeenLastCalledWith('documents');
    const publicLink = 'https://project.supabase.co/storage/v1/object/public/documents/timesheets/u/1.pdf';
    await expect(recordLink(publicLink)).resolves.toBe(publicLink);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });
});

// The storage rules let staff write only under their own practice; a super admin looking at another practice works
// in the practice they chose, so an upload there is refused rather than filed under their own practice.
describe('the practice an upload goes under', () => {
  afterEach(() => useAuthStore.setState({ user: null, selectedPracticeId: null }));

  it('is the practice the staff member is working in', () => {
    useAuthStore.setState({ user: { id: 'u', email: 'a@example.test', name: 'A', role: 'nurse', practice_id: PRACTICE_A }, selectedPracticeId: PRACTICE_B });
    expect(currentPracticeId()).toBe(PRACTICE_B);
    useAuthStore.setState({ selectedPracticeId: null });
    expect(currentPracticeId()).toBe(PRACTICE_A);
  });

  it('is unknown when nobody is signed in, so nothing is uploaded', () => {
    useAuthStore.setState({ user: null, selectedPracticeId: null });
    expect(currentPracticeId()).toBeNull();
  });
});
