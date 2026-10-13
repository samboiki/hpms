import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UploadLabDocument from './UploadLabDocument';
import { supabase } from '../../lib/supabase';
import { geminiExtractLabResults } from '../../lib/geminiClient';

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('../../lib/geminiClient', () => ({ isGeminiConfigured: () => true, geminiExtractLabResults: vi.fn() }));

describe('lab upload persistence failures', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.test/lab.pdf' }, error: null }),
    } as never);
    vi.mocked(geminiExtractLabResults).mockResolvedValue({ results: [{ testName: 'Test', testValue: '1' }] } as never);
  });

  async function upload(failStatus: boolean) {
    const onClose = vi.fn();
    const onExtractionComplete = vi.fn();
    let updates = 0;
    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'lab_requests') return {
        // The request's practice decides the report's folder in the private bucket (invented id)
        select: () => ({ eq: () => ({ single: async () => ({ data: { patient_id: 'patient-1', practice_id: '1a2b3c4d-0000-4000-8000-00000000000a' }, error: null }) }) }),
        update: () => ({ eq: async () => ({ error: ++updates === (failStatus ? 2 : 1) ? new Error('Write rejected') : null }) }),
      } as never;
      return {
        select: () => ({ eq: async () => ({ data: [], error: null }) }),
        insert: async () => ({ error: null }),
      } as never;
    });
    const { container } = render(<UploadLabDocument requestId="request-1" onClose={onClose} onExtractionComplete={onExtractionComplete} />);
    fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [new File(['test'], 'lab.pdf', { type: 'application/pdf' })] } });
    await screen.findByText(failStatus ? 'Failed to extract test results. Please try manual entry.' : 'Failed to upload file');
    expect(onClose).not.toHaveBeenCalled();
    expect(onExtractionComplete).not.toHaveBeenCalled();
  }

  it('does not start extraction when the uploaded document cannot be linked to the request', async () => {
    await upload(false);
    expect(geminiExtractLabResults).not.toHaveBeenCalled();
  });

  it('does not report completion when the final status update fails', async () => {
    await upload(true);
    await waitFor(() => expect(geminiExtractLabResults).toHaveBeenCalledOnce());
  });

  // A lab report names the patient: it goes to the private bucket in the practice's folder, and the request keeps its
  // path, never a link (a stored link would outlive its purpose; the old one expired after an hour anyway)
  it('stores the report in the practice folder of the private bucket and keeps only its path', async () => {
    const updates: Array<Record<string, unknown>> = [];
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'lab_requests') return {
        select: () => ({ eq: () => ({ single: async () => ({ data: { patient_id: 'patient-1', practice_id: '1a2b3c4d-0000-4000-8000-00000000000a' }, error: null }) }) }),
        update: (values: Record<string, unknown>) => { updates.push(values); return { eq: async () => ({ error: null }) }; },
      } as never;
      return { select: () => ({ eq: async () => ({ data: [], error: null }) }), insert: async () => ({ error: null }) } as never;
    });
    const { container } = render(<UploadLabDocument requestId="request-1" onClose={vi.fn()} onExtractionComplete={vi.fn()} />);
    fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [new File(['test'], 'lab.pdf', { type: 'application/pdf' })] } });

    await waitFor(() => expect(updates.length).toBeGreaterThan(0));
    expect(supabase.storage.from).toHaveBeenCalledWith('records');
    expect(updates[0].media_url).toMatch(/^1a2b3c4d-0000-4000-8000-00000000000a\/lab-results\/patient-1\/\d+_lab\.pdf$/);
  });
});
