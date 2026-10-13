/**
 * The sidebar's Tariffs link (parity E13, D8): every practice administrator manages the practice's own codes, prices,
 * co-payments and levies, so every one of them needs the link. Before, only administrators who also manage practices
 * (half of them) saw the Administration section; the others could open /admin/tariffs only by typing the address.
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
vi.mock('../../../services/unreadMessagesService', () => ({ unreadMessagesService: { initialize: vi.fn(), subscribe: () => () => undefined } }));
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

const renderAs = (user: TestUser) => {
  auth.user = user;
  render(
    <MemoryRouter>
      <Sidebar collapsed={false} onToggle={vi.fn()} isMobile={false} />
    </MemoryRouter>
  );
};

describe('the Tariffs link in the sidebar', () => {
  it('shows a practice administrator Tariffs, without the support pages', () => {
    renderAs({ id: 'u1', role: 'admin', practice_id: 'practice-1' });
    expect(screen.getByRole('link', { name: /Tariffs/ })).toHaveAttribute('href', '/admin/tariffs');
    expect(screen.queryByRole('link', { name: /Manage Practices/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /System Blueprint/ })).toBeNull();
  });

  // Manage Practices lets in OneHealth support only: a link to it would end at "Access Denied"
  it('shows a practice administrator flagged "can manage practices" only what opens for them', () => {
    renderAs({ id: 'u2', role: 'admin', practice_id: 'practice-1', can_manage_practices: true });
    expect(screen.getByRole('link', { name: /Tariffs/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Manage Practices/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /System Blueprint/ })).toBeNull();
  });

  it('shows no Tariffs link to a receptionist, who cannot open the page', () => {
    renderAs({ id: 'u3', role: 'receptionist', practice_id: 'practice-1' });
    expect(screen.queryByRole('link', { name: /Tariffs/ })).toBeNull();
  });
});

// Administration > Medical aid funds (parity E10): every practice administrator reads the funds' claim rules and keeps
// the practice's notes there, and OneHealth support changes the rules; a receptionist cannot open the page
describe('the Medical aid funds link in the sidebar', () => {
  it('shows a practice administrator the link', () => {
    renderAs({ id: 'u1', role: 'admin', practice_id: 'practice-1' });
    expect(screen.getByRole('link', { name: /Medical aid funds/ })).toHaveAttribute('href', '/admin/funds');
  });

  it('shows OneHealth support the link too', () => {
    renderAs({ id: 'u4', role: 'admin', practice_id: null, is_super_admin: true });
    expect(screen.getByRole('link', { name: /Medical aid funds/ })).toHaveAttribute('href', '/admin/funds');
  });

  it('shows no link to a receptionist', () => {
    renderAs({ id: 'u3', role: 'receptionist', practice_id: 'practice-1' });
    expect(screen.queryByRole('link', { name: /Medical aid funds/ })).toBeNull();
  });
});
