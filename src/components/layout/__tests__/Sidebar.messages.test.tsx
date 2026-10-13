/**
 * The sidebar's Messages link: its badge counts unread staff messages, so with some waiting it opens the Messaging tab
 * that holds them (it opened the Messages dashboard, one more tap away from what the badge promised).
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

type TestUser = { id: string; role: string; practice_id: string | null; is_super_admin?: boolean; can_manage_practices?: boolean };
const auth = vi.hoisted(() => ({ user: null as TestUser | null }));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => ({
    user: auth.user,
    selectedPracticeId: null,
    isSuperAdmin: () => auth.user?.is_super_admin === true,
    canManagePractices: () => auth.user?.is_super_admin === true || auth.user?.can_manage_practices === true
  })
}));
vi.mock('../../../hooks/useScreenAccess', () => ({ useScreenAccess: () => ({}) }));
vi.mock('../../../utils/auth/screenAccess', () => ({ sidebarShowsPath: () => true }));
vi.mock('../../../stores/themeStore', () => ({ useTheme: () => ({ currentTheme: { gradients: { sidebar: '' } } }) }));
const unread = vi.hoisted(() => ({ count: 0 }));
vi.mock('../../../services/unreadMessagesService', () => ({
  unreadMessagesService: {
    initialize: vi.fn(),
    subscribe: (listener: (count: number) => void) => {
      listener(unread.count);
      return () => undefined;
    }
  }
}));
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }) }
}));
vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('framer-motion', async () => {
  const { createElement } = await import('react');
  const div = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
    createElement('div', Object.fromEntries(Object.entries(props).filter(([key]) => !['initial', 'animate', 'transition', 'whileHover'].includes(key))), children);
  return { motion: { div } };
});

import Sidebar from '../Sidebar';

const renderWith = (count: number, collapsed = false) => {
  unread.count = count;
  auth.user = { id: 'u1', role: 'receptionist', practice_id: 'practice-1' };
  render(
    <MemoryRouter>
      <Sidebar collapsed={collapsed} onToggle={vi.fn()} isMobile={false} />
    </MemoryRouter>
  );
};

describe('the Messages link in the sidebar', () => {
  it('opens the Messaging tab while staff messages are unread', () => {
    renderWith(3);
    expect(screen.getByRole('link', { name: /Messages/ })).toHaveAttribute('href', '/communications?tab=messaging');
  });

  it('opens the Messages page as before when nothing is unread', () => {
    renderWith(0);
    expect(screen.getByRole('link', { name: /Messages/ })).toHaveAttribute('href', '/communications');
  });

  // The collapsed bar has no room for the badge: the link's name and tooltip carry the count instead
  it('names the unread count on the collapsed bar', () => {
    renderWith(3, true);
    const link = screen.getByRole('link', { name: 'Messages (3 unread)' });
    expect(link).toHaveAttribute('title', 'Messages (3 unread)');
  });
});
