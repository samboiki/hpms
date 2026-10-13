import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import toast from 'react-hot-toast';
import EnhancedServiceSelector from '../EnhancedServiceSelector';
import type { ServiceSelection } from '../../../types/billing';

type QueryResult = { data: unknown; error: { message: string } | null };

// Each table answers with a canned result: nothing here reaches the database
const { results } = vi.hoisted(() => ({ results: {} as Record<string, QueryResult> }));

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        limit: () => query,
        maybeSingle: () => Promise.resolve(results[table]),
        then: (onFulfilled: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
          Promise.resolve(results[table]).then(onFulfilled, onRejected)
      };
      return query;
    }
  }
}));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (state: { selectedPracticeId: string | null; user: null }) => unknown) =>
    selector({ selectedPracticeId: null, user: null })
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('framer-motion', async () => {
  const { createElement, Fragment } = await import('react');
  const animationProps = new Set(['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'layout']);
  const element = (tag: string) =>
    ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
      createElement(tag, Object.fromEntries(Object.entries(props).filter(([key]) => !animationProps.has(key))), children);
  return {
    motion: { div: element('div'), button: element('button') },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => createElement(Fragment, null, children)
  };
});

const consultation: ServiceSelection = {
  id: 'line-1',
  tariffId: 'tariff-1',
  code: '0190',
  description: 'Consultation',
  category: 'Consultation',
  unitPrice: 500,
  quantity: 1,
  totalPrice: 500
};

const renderSelector = () =>
  render(
    <EnhancedServiceSelector
      practiceId="practice-1"
      patientId="patient-1"
      serviceDate="2026-10-06"
      selectedServices={[consultation]}
      onServiceChange={vi.fn()}
    />
  );

describe('EnhancedServiceSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    results.practices = { data: { id: 'practice-1', practice_type: 'medical' }, error: null };
    results.practice_tariffs_with_types = {
      data: [{ id: 'tariff-1', code: '0190', description: 'Consultation', price: 500, is_active: true, can_be_multiplied: 'NO', requires_tooth_number: 'NO' }],
      error: null
    };
    results.medical_aid_details = { data: [], error: null };
  });

  // Staff read dates day-first; the yyyy-MM-dd key is only for pricing
  it('shows the service date day-first', async () => {
    renderSelector();

    expect(await screen.findByText(/Tariff prices in effect on 06 Oct 2026/)).toBeInTheDocument();
  });

  // A failed lookup left "Checking the patient's medical aid..." on screen forever, so staff could
  // not tell that the medical aid / patient split was unconfirmed
  it('says when the medical aid lookup failed instead of checking forever', async () => {
    results.medical_aid_details = { data: null, error: { message: 'timeout' } };
    renderSelector();

    expect(await screen.findByText(/Could not check the patient's medical aid, so this split is not final/)).toBeInTheDocument();
    expect(screen.queryByText("Checking the patient's medical aid...")).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalled();
  });
});
