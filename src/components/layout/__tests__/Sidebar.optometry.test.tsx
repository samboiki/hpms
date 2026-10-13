/**
 * The sidebar's Optometry link (parity M12): an optometry practice reaches its lab orders, frames and optometry reports
 * from the menu, not only from inside a patient's file. OneHealth serves every discipline, so a GP, dental or
 * specialist practice never sees the link (isOptometryPractice decides, as for the Eyes tab).
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

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
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 'practice-1', practice_type: practice.type }, error: null }) }) }) })
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
    <MemoryRouter>
      <Sidebar collapsed={false} onToggle={vi.fn()} isMobile={false} />
    </MemoryRouter>
  );
};

describe('the Optometry link in the sidebar', () => {
  it('takes an optometry practice to the Optometry page', async () => {
    renderFor('optometry');
    expect(await screen.findByRole('link', { name: /Optometry/ })).toHaveAttribute('href', '/optometry');
  });

  it('is not there for a GP or dental practice', async () => {
    renderFor('dental');
    // The practice is read first: the other sections are there once it is known
    expect(await screen.findByRole('link', { name: /Stock/ })).toBeInTheDocument();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(screen.queryByRole('link', { name: /Optometry/ })).toBeNull();
  });
});
