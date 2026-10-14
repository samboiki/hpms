/**
 * The ICD-10 suggestions in a billing line's editor. Why: a medical aid line needs a diagnosis, the practitioner (not the
 * app) chooses it, and the codes that help most are the ones this practice already uses with the line's tariff code. The
 * editor passes its line's tariff code to the code box, which offers what the practice billed and the reviewed starter
 * codes; choosing one sends it as the line's code like any typed code, and merely opening the editor changes nothing.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BillingLineDetails from '../BillingLineDetails';
import type { ServiceSelection } from '../../../types/billing';
import { EMPTY_TARIFF_ICD10_DATA, toLearnedMap, toStarterMap } from '../../../utils/billing/tariffIcd10Suggestions';

// The line helpers are pure; nothing here may reach the database
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));
const { service } = vi.hoisted(() => ({ service: { load: null as unknown, asked: [] as Array<string | null> } }));
vi.mock('../../../services/tariffIcd10SuggestionService', () => ({
  loadTariffIcd10Suggestions: async (practiceId: string | null) => {
    service.asked.push(practiceId);
    return service.load;
  },
  loadProcedureSuggestions: async () => ({ status: 'ready', codes: [] })
}));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (state: { selectedPracticeId: string | null; user: { practice_id: string } }) => unknown) =>
    selector({ selectedPracticeId: null, user: { practice_id: 'practice-1' } })
}));

const preAnaesthetic: ServiceSelection = {
  id: 'line-1', tariffId: 't-0102', code: '0102', description: 'Pre-anaesthetic assessment', category: 'Consultation', unitPrice: 450, quantity: 1, totalPrice: 450
};

beforeEach(() => {
  service.asked = [];
  service.load = {
    data: {
      ...EMPTY_TARIFF_ICD10_DATA,
      usual: new Map(),
      learned: toLearnedMap([{ tariff_code: '0102', icd10_code: 'I10', times_used: 3 }]),
      starter: toStarterMap([{ code: '0102', icd10_code: 'Z01.8', sort_order: 1, rationale: 'Assessment before anaesthesia or an operation: other special examination' }])
    },
    parts: { usual: 'ready', learned: 'ready', starter: 'ready', common: 'ready' },
    discipline: '014'
  };
});

const renderEditor = (props: Partial<React.ComponentProps<typeof BillingLineDetails>> = {}) => {
  const onChange = vi.fn();
  render(
    <BillingLineDetails
      service={preAnaesthetic}
      visitDate="2026-10-14"
      visitPractitionerId={null}
      practitioners={[]}
      editable={false}
      hasMedicalAid
      amounts={null}
      today="2026-10-14"
      onChange={onChange}
      icd10={{ codes: [], suggested: false, sourceLabel: null }}
      codesEditable
      canChangeFee
      {...props}
    />
  );
  return onChange;
};

describe('suggestions in the editor of a billing line', () => {
  it("offers the practice's own codes and the starter codes for the line's tariff code, and chooses nothing itself", async () => {
    const onChange = renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    fireEvent.focus(screen.getByLabelText(/ICD-10 code/));
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('I10');
    expect(options[0]).toHaveTextContent('Billed with 0102 3 times in the last 2 years');
    expect(options[1]).toHaveTextContent('Z01.8');
    expect(options[1]).toHaveTextContent('Assessment before anaesthesia or an operation: other special examination');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('sends the code the practitioner chooses as the line\'s code', async () => {
    const onChange = renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    fireEvent.focus(screen.getByLabelText(/ICD-10 code/));
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
    fireEvent.click(screen.getAllByRole('option')[1]);
    expect(onChange).toHaveBeenLastCalledWith({ icd10Codes: ['Z01.8'] });
  });

  // The line's own pre-filled code (the practice's usual code or the visit's diagnosis) is untouched by the new suggestions
  it('leaves a code the line already carries as it is', async () => {
    const onChange = renderEditor({ icd10: { codes: ['J06.9'], suggested: true, sourceLabel: "the practice's usual code for 0102" } });
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    fireEvent.focus(screen.getByLabelText(/ICD-10 code/));
    await waitFor(() => expect(service.asked).toEqual(['practice-1']));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("ICD-10 J06.9 (the practice's usual code for 0102)")).toBeInTheDocument();
  });

  it('reads nothing while the editor is closed', () => {
    renderEditor();
    expect(service.asked).toEqual([]);
  });

  it('offers no suggestions where the codes cannot be changed', () => {
    renderEditor({ codesEditable: false, canChangeFee: false, editable: true });
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.queryByLabelText(/ICD-10 code/)).toBeNull();
    expect(service.asked).toEqual([]);
  });
});
