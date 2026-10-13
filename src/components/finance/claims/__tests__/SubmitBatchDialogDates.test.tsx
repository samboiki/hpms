import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ClaimFile } from '../../../../utils/billing/claimFile';
import type { BatchHeaderRow } from '../types';

vi.mock('../claimsService', () => ({ submitBatch: vi.fn() }));
vi.mock('../../../ui/MedicalAidLogo', () => ({ MedicalAidLogo: () => null }));

import SubmitBatchDialog from '../SubmitBatchDialog';

afterEach(cleanup);

describe('sending a claim batch', () => {
  // "must be received by 2026-12-01" made reception read the date backwards; dates are day first everywhere
  it("names the fund's deadline day first", () => {
    render(
      <SubmitBatchDialog
        practice={{ id: 'practice-1', name: 'Example Practice', practice_number: '1234567', practice_type: 'general_practice', contact_email: null }}
        batch={{ batch_id: 'b1', medical_aid_reference: 'NMC1', transaction_type: null } as unknown as BatchHeaderRow}
        fund={{ id: 'f1', name: 'Namibia Medical Care', short_name: 'NMC', email: 'claims@example.test', medical_aid_reference: 'NMC1', logo_url: null, theme_color: null }}
        file={{ fileName: 'EXAMPLE.DAT', lineCount: 3, totalCents: 120000 } as unknown as ClaimFile}
        warningCount={0}
        submitBy="2026-12-01"
        userId="user-1"
        onClose={vi.fn()}
        onSubmitted={vi.fn()}
      />
    );
    expect(screen.getByText('Earliest line must be received by 1 Dec 2026')).toBeInTheDocument();
  });
});
