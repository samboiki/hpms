/**
 * Owner decision (13 Oct 2026): the Optometry page is merged into existing screens. Lens orders, frames and their
 * reports are tabs of Stock for optometry practices, so the menu has no Optometry entry of its own (one place to look,
 * one access rule) and an optometry practice finds them under Stock.
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const practice = vi.hoisted(() => ({ type: 'general' }));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'u1', role: 'doctor', practice_id: 'practice-1' },
    selectedPracticeId: null,
    isSuperAdmin: () => false,
    canManagePractices: () => false
  })
}));
vi.mock('../../../hooks/useScreenAccess', () => ({ useScreenAccess: () => ({}) }));
vi.mock('../../../utils/auth/screenAccess', () => ({ sidebarShowsPath: () => true }));
vi.mock('../../../stores/themeStore', () => ({ useTheme: () => ({ currentTheme: { gradients: { sidebar: '' } } }) }));
vi.mock('../../../services/unreadMessagesService', () => ({ unreadMessagesService: { initialize: vi.fn(), subscribe: () => () => undefined } }));
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'practice-1', practice_type: practice.type }, error: null }) }) }) })
  }
}));
vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('framer-motion', async () => {
  const { createElement } = await import('react');
  const div = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
    createElement('div', Object.fromEntries(Object.entries(props).filter(([key]) => !['initial', 'animate', 'transition', 'whileHover'].includes(key))), children);
  return { motion: { div } };
});

import Sidebar from '../Sidebar';

const renderFor = (type: string) => {
  practice.type = type;
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>
      <Sidebar collapsed={false} onToggle={vi.fn()} isMobile={false} />
    </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('the sidebar after the Optometry page was merged into Stock', () => {
  it('has no Optometry entry for an optometry practice: lens orders and frames are under Stock', async () => {
    renderFor('optometry');
    expect(await screen.findByRole('link', { name: /Stock/ })).toHaveAttribute('href', '/stock');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(screen.queryByRole('link', { name: /Optometry/ })).toBeNull();
  });

  it('has none for a GP or dental practice either', async () => {
    renderFor('dental');
    expect(await screen.findByRole('link', { name: /Stock/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Optometry/ })).toBeNull();
  });
});
