/**
 * A leave request can carry a document (a sick note, a death notice). It was saved but nobody could ever open it, so
 * the approver decided without seeing it. The request now links to it, opened with a fresh short-lived link.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mocks = vi.hoisted(() => ({ openRecord: vi.fn() }));

vi.mock('../../../../stores/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'staff-1', role: 'nurse', practice_id: 'practice-1', name: 'Test Nurse' } })
}));
vi.mock('../../../../services/recordFiles', () => ({
  RECORDS_BUCKET: 'records',
  recordPath: (...parts: string[]) => parts.join('/'),
  openRecord: mocks.openRecord
}));
vi.mock('../../../../lib/supabase', () => {
  const request = {
    id: 'request-1',
    user_id: 'staff-1',
    user: { full_name: 'Test Nurse', email: 'nurse@example.test' },
    leave_type: { id: 'type-1', name: 'Sick Leave', color: '#10B981' },
    start_date: '2026-10-05',
    end_date: '2026-10-06',
    days_requested: 2,
    reason: 'Flu',
    status: 'pending',
    supporting_document_url: 'practice-1/leave-documents/staff-1/note.pdf',
    created_at: '2026-10-04T08:00:00Z'
  };
  const builder = (table: string): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const name of ['select', 'eq', 'in', 'or', 'order', 'limit', 'gte', 'lte', 'neq']) chain[name] = self;
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: table === 'leave_requests' ? [request] : [], error: null }).then(resolve, reject);
    return chain;
  };
  return { supabase: { from: (table: string) => builder(table) } };
});
vi.mock('framer-motion', () => {
  const Plain = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    const { initial, animate, exit, transition, whileHover, whileTap, layout, ...rest } = props;
    void initial; void animate; void exit; void transition; void whileHover; void whileTap; void layout;
    return <div {...(rest as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>;
  };
  return { motion: new Proxy({}, { get: () => Plain }), AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

import { LeaveManagement } from '../LeaveManagement';

beforeEach(() => {
  mocks.openRecord.mockReset().mockResolvedValue(undefined);
});

describe('a leave request with a supporting document', () => {
  it('opens the attached document from the request', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <LeaveManagement isTeamView={false} practiceId="practice-1" />
      </QueryClientProvider>
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Open the supporting document' }));
    await waitFor(() => expect(mocks.openRecord).toHaveBeenCalledWith('practice-1/leave-documents/staff-1/note.pdf'));
  });

  // Leave Settings is for administrators: a nurse is told who can add the leave types, not sent to a screen she lacks
  it('tells staff without leave types to ask their administrator', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <LeaveManagement isTeamView={false} practiceId="practice-1" />
      </QueryClientProvider>
    );
    await screen.findByRole('button', { name: 'Open the supporting document' });
    expect(screen.getAllByTitle('Ask your practice administrator to add the leave types first').length).toBeGreaterThan(0);
  });
});
