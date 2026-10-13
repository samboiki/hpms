import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { recordLink } = vi.hoisted(() => ({ recordLink: vi.fn() }));
vi.mock('../../../services/recordFiles', () => ({ recordLink }));

import RecordImage from '../RecordImage';

// Invented ids
const PATH = '1a2b3c4d-0000-4000-8000-00000000000a/patient-media/5e6f7a8b-0000-4000-8000-000000000001/1.png';

// Patient photos and scans have no public link: the thumbnail asks for a short-lived link when it is shown, from the
// bucket the row names, and shows a grey box (never a broken image) while it waits or if it may not be opened.
describe('a stored patient image', () => {
  afterEach(() => {
    cleanup();
    recordLink.mockReset();
  });

  it('is shown through a link made when it is displayed', async () => {
    recordLink.mockResolvedValue('https://files.example/signed?token=now');
    render(<RecordImage path={PATH} bucket="records" alt="Wound photo" className="w-12 h-12" />);

    await waitFor(() => expect(screen.getByRole('img', { name: 'Wound photo' }).tagName).toBe('IMG'));
    expect(screen.getByRole('img', { name: 'Wound photo' }).getAttribute('src')).toBe('https://files.example/signed?token=now');
    expect(recordLink).toHaveBeenCalledWith(PATH, 'records');
  });

  it('keeps a same-size grey box when the link cannot be made', async () => {
    recordLink.mockRejectedValue(new Error('Object not found'));
    render(<RecordImage path={PATH} alt="X-ray" className="w-8 h-8" />);

    const placeholder = screen.getByRole('img', { name: 'X-ray' });
    expect(placeholder.tagName).toBe('SPAN');
    expect(placeholder.className).toContain('w-8 h-8');
    await Promise.resolve();
    expect(screen.getByRole('img', { name: 'X-ray' }).tagName).toBe('SPAN');
  });
});
