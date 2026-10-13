import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// A Supabase stand-in: what each table answers, and every update the screen sends
const db = vi.hoisted(() => ({
  practice: { practice_type: 'general', practice_type_id: 'type-dental' } as Record<string, unknown>,
  updateResult: { data: [{ id: 'practice-1' }], error: null } as { data: unknown; error: unknown },
  updates: [] as Array<Record<string, unknown>>
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'practice_types') {
        return {
          select: () => ({
            order: () =>
              Promise.resolve({
                data: [
                  { id: 'type-dental', name: 'dental', is_active: true },
                  { id: 'type-medical', name: 'medical', is_active: true }
                ],
                error: null
              })
          })
        };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: db.practice, error: null }) }) }),
        update: (values: Record<string, unknown>) => {
          db.updates.push(values);
          return { eq: () => ({ select: () => Promise.resolve(db.updateResult) }) };
        }
      };
    }
  }
}));
vi.mock('@iconify/react', () => ({ Icon: () => null }));
const refresh = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('../../../lib/queryClient', () => ({ refreshAfterSave: refresh }));

import { PracticeTypeSection } from '../PracticeTypeSection';

beforeEach(() => {
  db.practice = { practice_type: 'general', practice_type_id: 'type-dental' };
  db.updateResult = { data: [{ id: 'practice-1' }], error: null };
  db.updates = [];
  refresh.mockClear();
});

describe('PracticeTypeSection', () => {
  // The type decides the tariff list and which clinical records show: only an administrator changes it
  it('shows the type to every staff member but lets only administrators change it', async () => {
    render(<PracticeTypeSection practiceId="practice-1" canChange={false} />);
    expect(await screen.findByText('Not chosen yet')).toBeInTheDocument();
    expect(screen.getByText(/Only a practice administrator can change the practice type/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Type of practice')).not.toBeInTheDocument();
  });

  it('starts on the directory type when the two copies disagree and saves both copies together', async () => {
    render(<PracticeTypeSection practiceId="practice-1" canChange />);
    expect(await screen.findByText(/The OneHealth directory lists this practice as Dental/)).toBeInTheDocument();
    expect(screen.getByLabelText('Type of practice')).toHaveValue('type-dental');
    fireEvent.click(screen.getByRole('button', { name: 'Save type' }));
    await waitFor(() => expect(db.updates).toEqual([{ practice_type: 'dental', practice_type_id: 'type-dental' }]));
    expect(await screen.findByText(/Saved: Dental/)).toBeInTheDocument();
    // The menu, the tariff list and the diary read the practice from the shared 5-minute cache (owner, 13 Oct 2026):
    // the saved type refreshes it, or the menu would keep the old type for up to 5 minutes
    expect(refresh).toHaveBeenCalledWith('practice');
  });

  // The practices_protected_columns trigger refuses anyone but an administrator; its own words explain why
  it("shows the database's own message when it refuses the change", async () => {
    db.updateResult = {
      data: null,
      error: { code: '42501', hint: 'practice_protected_columns', message: "Only a practice administrator can change the practice's name, numbers or bank details." }
    };
    render(<PracticeTypeSection practiceId="practice-1" canChange />);
    fireEvent.change(await screen.findByLabelText('Type of practice'), { target: { value: 'type-medical' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save type' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Only a practice administrator can change the practice's name, numbers or bank details.");
    expect(screen.queryByText(/^Saved:/)).not.toBeInTheDocument();
  });

  it('never says "Saved" when nothing was changed for this practice', async () => {
    db.updateResult = { data: [], error: null };
    render(<PracticeTypeSection practiceId="practice-1" canChange />);
    fireEvent.click(await screen.findByRole('button', { name: 'Save type' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not saved');
    expect(refresh).not.toHaveBeenCalled();
  });
});
