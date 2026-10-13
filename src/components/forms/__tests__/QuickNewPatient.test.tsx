import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';

// Reception books a caller by phone with a name and cell number only. All people and numbers are invented.
const services = vi.hoisted(() => ({
  findDuplicates: vi.fn(),
  createTemporary: vi.fn()
}));
vi.mock('../../../services/patientDuplicateService', () => ({ findPracticeDuplicatesForCaller: services.findDuplicates }));
vi.mock('../../../services/patientFileService', () => ({ createTemporaryPatient: services.createTemporary }));
// Iconify would try to download icon data over the network
vi.mock('@iconify/react', () => ({ Icon: () => null }));

import QuickNewPatient from '../QuickNewPatient';

const opened = { id: 'new-file', first_name: 'Ndapewa', last_name: 'Shilongo', id_number: 'TEMP-1-abc', cell_number: '081 123 4567' };
const existingFile = { id: 'old-file', first_name: 'Ndapewa', last_name: 'Shilongo', id_number: '90051400123', date_of_birth: '1990-05-14', cell_number: '0811234567' };

const renderPanel = (initialText = 'Ndapewa Shilongo') => {
  const onUse = vi.fn();
  render(<QuickNewPatient practiceId="practice-1" initialText={initialText} onUse={onUse} onCancel={vi.fn()} />);
  return onUse;
};

afterEach(() => cleanup());
beforeEach(() => {
  services.findDuplicates.mockReset().mockResolvedValue([]);
  services.createTemporary.mockReset().mockResolvedValue(opened);
});

describe('New patient: name and cell', () => {
  it('starts from the name typed in the search, so reception does not type it twice', () => {
    renderPanel('Ndapewa Maria Shilongo');
    expect(screen.getByLabelText('First name(s)')).toHaveValue('Ndapewa Maria');
    expect(screen.getByLabelText('Surname')).toHaveValue('Shilongo');
  });

  it('checks the practice for the same name or number first, then opens a file to complete on arrival', async () => {
    const onUse = renderPanel();
    fireEvent.change(screen.getByLabelText('Cell number'), { target: { value: '081 123 4567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(onUse).toHaveBeenCalledWith(opened, true));
    expect(services.findDuplicates).toHaveBeenCalledWith('practice-1', { firstName: 'Ndapewa', lastName: 'Shilongo', cellNumber: '081 123 4567' });
    expect(services.createTemporary).toHaveBeenCalledTimes(1);
  });

  it('offers the existing file instead of opening a second one for the same person', async () => {
    services.findDuplicates.mockResolvedValue([{ patient: existingFile, reasons: ['name', 'cell_number'] }]);
    const onUse = renderPanel();
    fireEvent.change(screen.getByLabelText('Cell number'), { target: { value: '081 123 4567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('This caller may already have a file')).toBeInTheDocument();
    expect(screen.getByText('Same name, Same cell number')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use this patient' }));
    expect(onUse).toHaveBeenCalledWith(expect.objectContaining({ id: 'old-file' }), false);
    expect(services.createTemporary).not.toHaveBeenCalled();
  });

  it('still books a new file when reception says the caller is someone else (a family shares the number)', async () => {
    services.findDuplicates.mockResolvedValue([{ patient: { ...existingFile, first_name: 'Tangeni' }, reasons: ['cell_number'] }]);
    const onUse = renderPanel();
    fireEvent.change(screen.getByLabelText('Cell number'), { target: { value: '081 123 4567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Book as a new patient' }));
    await waitFor(() => expect(onUse).toHaveBeenCalledWith(opened, true));
  });

  it('asks for a cell number the practice can call or text before anything is saved', () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText('Cell number'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/cell number the practice can call or text/);
    expect(services.findDuplicates).not.toHaveBeenCalled();
    expect(services.createTemporary).not.toHaveBeenCalled();
  });

  it('keeps Enter in its fields from submitting the booking form around it (a half-made booking)', () => {
    renderPanel('');
    const surname = screen.getByLabelText('Surname');
    const enter = createEvent.keyDown(surname, { key: 'Enter' });
    fireEvent(surname, enter);
    expect(enter.defaultPrevented).toBe(true);
  });
});
