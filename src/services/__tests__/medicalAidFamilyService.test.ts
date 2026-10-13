import { afterEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: supabaseMock }));

import { swapMainMember } from '../medicalAidFamilyService';
import type { FamilyMemberRecord } from '../../utils/patients/medicalAidMember';

// An invented family on one membership
const family: FamilyMemberRecord[] = [
  { medicalAidId: 'ma-1', patientId: 'p-father', firstName: 'Johannes', lastName: 'Shilongo', idNumber: '70010100111', relationship: 'self' },
  { medicalAidId: 'ma-2', patientId: 'p-mother', firstName: 'Ndapewa', lastName: 'Shilongo', idNumber: '72020200222', relationship: 'spouse' }
];

const recordUpdates = (failOnCall?: number) => {
  const calls: Array<{ changes: Record<string, unknown>; id: string }> = [];
  supabaseMock.from.mockImplementation(() => ({
    update: (changes: Record<string, unknown>) => ({
      eq: async (_column: string, id: string) => {
        calls.push({ changes, id });
        return calls.length === failOnCall ? { error: { message: 'network' } } : { error: null };
      }
    })
  }));
  return calls;
};

afterEach(() => supabaseMock.from.mockReset());

describe('swapMainMember', () => {
  it('writes every planned change, promoting the new main member last', async () => {
    const calls = recordUpdates();
    await expect(swapMainMember(family, 'p-mother', 'spouse')).resolves.toEqual({ newMainMemberName: 'Shilongo, N', updated: 4 });
    expect(calls.map(call => call.id)).toEqual(['ma-1', 'ma-2', 'ma-1', 'ma-2']);
    expect(calls[3]).toEqual({ id: 'ma-2', changes: { relationship_to_main: 'self' } });
  });

  it('says how far it got and how to finish when the connection drops half-way', async () => {
    recordUpdates(3);
    await expect(swapMainMember(family, 'p-mother', 'spouse')).rejects.toThrow(/only partly changed \(2 of 4 updates\)\. Choose "Make main member" again/);
  });

  it('changes nothing when the swap is not possible', async () => {
    const calls = recordUpdates();
    await expect(swapMainMember(family, 'p-father', 'spouse')).rejects.toThrow('This person is already the main member.');
    expect(calls).toEqual([]);
  });
});
