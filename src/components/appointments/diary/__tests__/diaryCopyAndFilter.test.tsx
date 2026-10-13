import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CopiedBookingBanner } from '../CopiedBookingBanner';
import { PractitionerFilterModal } from '../PractitionerFilterModal';
import type { BookingPrefill } from '../../../../utils/diary/bookingCopy';
import type { DiaryPractitioner } from '../../../../utils/diary/diaryPractitioners';

// An invented copy and practice
const copied: BookingPrefill = {
  patientId: 'pt-1',
  patientName: 'Anna Tester',
  patientFirstName: 'Anna',
  practitionerId: 'dr-1',
  type: 'consultation',
  durationMinutes: 30,
  reason: ''
};
const PRACTITIONERS: DiaryPractitioner[] = [
  { id: 'dr-1', name: 'Dr One', role: 'doctor' },
  { id: 'dr-2', name: 'Dr Two', role: 'doctor' },
  { id: 'nurse-1', name: 'Nurse One', role: 'nurse' }
];
const nameOf = (id: string) => PRACTITIONERS.find((practitioner) => practitioner.id === id)?.name ?? 'Someone';

describe('CopiedBookingBanner', () => {
  it('says whose booking is copied and how to paste it, in the words reception sees', () => {
    render(<CopiedBookingBanner copied={copied} onCancel={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Copied: Anna, 30 min. Choose a free time, or press Esc.');
  });

  it('can be cancelled with a tap, since a tablet has no Esc key', () => {
    const onCancel = vi.fn();
    render(<CopiedBookingBanner copied={copied} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel the copy' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('offers the time slots when the diary shows cards, where there is no free time to click', () => {
    const onShowSlots = vi.fn();
    const { rerender } = render(<CopiedBookingBanner copied={copied} onCancel={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Show time slots' })).toBeNull();
    rerender(<CopiedBookingBanner copied={copied} onCancel={() => {}} onShowSlots={onShowSlots} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show time slots' }));
    expect(onShowSlots).toHaveBeenCalledTimes(1);
  });
});

describe('PractitionerFilterModal', () => {
  const renderFilter = (overrides: Partial<React.ComponentProps<typeof PractitionerFilterModal>> = {}) => {
    const props = {
      isOpen: true,
      onClose: vi.fn(),
      practitioners: PRACTITIONERS,
      view: [] as string[],
      onChange: vi.fn(),
      defaultView: [] as string[],
      canSaveDefault: true,
      onSaveDefault: vi.fn().mockResolvedValue({ ok: true }),
      nameOf,
      ...overrides
    };
    render(<PractitionerFilterModal {...props} />);
    return props;
  };

  it('adds a second practitioner to the one shown, so a doctor covering a colleague sees both diaries', () => {
    const { onChange } = renderFilter({ view: ['dr-1'] });
    fireEvent.click(screen.getByRole('checkbox', { name: /Nurse One/ }));
    expect(onChange).toHaveBeenCalledWith(['dr-1', 'nurse-1']);
  });

  it('goes back to everyone with "All practitioners"', () => {
    const { onChange } = renderFilter({ view: ['dr-1', 'dr-2'] });
    fireEvent.click(screen.getByRole('checkbox', { name: /All practitioners/ }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('keeps the shown practitioners as the default with "Open the diary on ...", for every computer the user signs in on', async () => {
    const { onSaveDefault } = renderFilter({ view: ['dr-2'], defaultView: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Open the diary on Dr Two' }));
    await waitFor(() => expect(onSaveDefault).toHaveBeenCalledWith(['dr-2']));
  });

  it('says the diary already opens on this choice instead of offering to save it again', () => {
    renderFilter({ view: ['dr-1'], defaultView: ['dr-1'] });
    expect(screen.getByText('The diary opens on Dr One.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open the diary on/ })).toBeNull();
  });

  it('offers no save before the database can keep a default, rather than a button that does nothing', () => {
    renderFilter({ view: ['dr-2'], canSaveDefault: false });
    expect(screen.queryByRole('button', { name: /Open the diary on/ })).toBeNull();
  });

  it('closes with Esc and gives the focus back to the button that opened it, for keyboard users', () => {
    const onClose = vi.fn();
    const filterProps = {
      onClose,
      practitioners: PRACTITIONERS,
      view: [] as string[],
      onChange: () => {},
      defaultView: [] as string[],
      canSaveDefault: false,
      onSaveDefault: vi.fn(),
      nameOf
    };
    const { rerender } = render(
      <>
        <button type="button">Practitioner: All practitioners</button>
        <PractitionerFilterModal isOpen={false} {...filterProps} />
      </>
    );
    const opener = screen.getByRole('button', { name: 'Practitioner: All practitioners' });
    opener.focus();
    rerender(
      <>
        <button type="button">Practitioner: All practitioners</button>
        <PractitionerFilterModal isOpen {...filterProps} />
      </>
    );
    expect(screen.getByRole('checkbox', { name: /All practitioners/ })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(
      <>
        <button type="button">Practitioner: All practitioners</button>
        <PractitionerFilterModal isOpen={false} {...filterProps} />
      </>
    );
    expect(opener).toHaveFocus();
  });

  it('shows why a default could not be saved', async () => {
    renderFilter({ view: ['dr-2'], onSaveDefault: vi.fn().mockResolvedValue({ ok: false, message: 'Could not save your default. Please try again.' }) });
    fireEvent.click(screen.getByRole('button', { name: 'Open the diary on Dr Two' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your default.');
  });
});
