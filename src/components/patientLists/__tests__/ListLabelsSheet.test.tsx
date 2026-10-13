import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PatientListRecord } from '../../../services/patientListService';
import type { ListMember } from '../../../utils/patientLists/listRules';
import type { PatientMergeSource } from '../../../utils/templates/mergeFields';

const mailing = vi.hoisted(() => ({ loadMailingSources: vi.fn() }));

vi.mock('../../../services/labels/mailingLabelsService', () => mailing);
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
// Icons load their drawings later; in a test that can land after the page is gone ("window is not defined")
vi.mock('@iconify/react', () => ({ Icon: () => null }));

import { ListLabelsSheet } from '../ListLabelsSheet';

// Invented patients: two of one family at one address, one without any address on file
const member = (patientId: string, firstName: string, lastName: string): ListMember =>
  ({ patientId, facts: { firstName, lastName }, automatic: false, manual: true, addedAt: null, lastSentAt: null, lastSentPeriod: null }) as unknown as ListMember;
const members = [member('p1', 'Anna', 'Nghipondoka'), member('p2', 'Petrus', 'Nghipondoka'), member('p3', 'Selma', 'Iipumbu')];
const list = { id: 'list-1', name: 'Recall due' } as unknown as PatientListRecord;
const familyAddress: PatientMergeSource = { postalAddress: 'PO Box 10', postalCode: '9000' };

describe('mailing labels for a patient list (O9)', () => {
  beforeEach(() => {
    mailing.loadMailingSources.mockReset().mockResolvedValue(new Map<string, PatientMergeSource>([
      ['p1', { ...familyAddress, firstName: 'Anna', lastName: 'Nghipondoka', title: 'Ms' }],
      ['p2', { ...familyAddress, firstName: 'Petrus', lastName: 'Nghipondoka', title: 'Mr' }],
      ['p3', { firstName: 'Selma', lastName: 'Iipumbu' }]
    ]));
  });

  // A family is not posted the same letter twice, and nobody is dropped without the staff knowing who
  it('prints one label per address by default and names the patients who have no address', async () => {
    render(<ListLabelsSheet onClose={() => undefined} list={list} members={members} />);
    expect(await screen.findByRole('button', { name: 'Print 1 label' })).toBeEnabled();
    expect(screen.getByText(/1 of 3 have no postal or home address/)).toBeInTheDocument();
    expect(screen.getByText('Selma Iipumbu')).toBeInTheDocument();
    expect(screen.getByText(/1 patient shares an address/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /One label per address/ }));
    expect(screen.getByRole('button', { name: 'Print 2 labels' })).toBeEnabled();
    expect(mailing.loadMailingSources).toHaveBeenCalledWith(['p1', 'p2', 'p3']);
  });

  it('says why nothing can be printed when the addresses cannot be read', async () => {
    mailing.loadMailingSources.mockRejectedValue(new Error('Could not read the patients\' addresses: offline'));
    render(<ListLabelsSheet onClose={() => undefined} list={list} members={members} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    expect(screen.getByRole('button', { name: 'Print labels' })).toBeDisabled();
  });
});
