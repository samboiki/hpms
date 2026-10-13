/**
 * The standard top of a page. The owner: Stock "doesn't have the login stuff... If you go to Settings, Finance,
 * Messages, all of those are standard: you can see you're in one app", and it was narrower than the full-width
 * pages. The shared header always shows who is signed in with a way to sign out, and the frame has no max width.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Iconify would try to download icon data over the network
vi.mock('@iconify/react', () => ({ Icon: () => null }));

const auth = vi.hoisted(() => ({
  user: { id: 'u1', name: 'Test Staff', email: 'staff@example.test', role: 'receptionist', avatar: null as string | null },
  logout: vi.fn(async () => undefined)
}));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: () => auth }));

import { PageHeader, PageShell } from '../PageHeader';
import { APP_COLOR, SECTION_COLORS } from '../../../config/sectionColors';

const renderStockTop = () =>
  render(
    <MemoryRouter>
      <PageShell>
        <PageHeader section="stock" icon="solar:box-bold-duotone" title="Stock" subtitle="Medicines and consumables" actions={<span>This practice dispenses</span>} />
      </PageShell>
    </MemoryRouter>
  );

/** The icon box beside the page's title */
const titleIcon = (title: string) => screen.getByRole('heading', { level: 1, name: title }).parentElement?.previousElementSibling;

beforeEach(() => auth.logout.mockClear());

describe('PageHeader', () => {
  it("names the page in its only heading and keeps the page as wide as every other (no max width)", () => {
    const { container } = renderStockTop();
    expect(screen.getAllByRole('heading', { level: 1 }).map(heading => heading.textContent)).toEqual(['Stock']);
    expect(screen.getByText('This practice dispenses')).toBeTruthy();
    expect(container.innerHTML).not.toMatch(/max-w-|mx-auto/);
  });

  it('shows who is signed in and lets them sign out, on every page that uses it', () => {
    renderStockTop();
    const button = screen.getByRole('button', { name: /open profile menu/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    // No photo: the initials stand in, never a stranger's stock photo
    expect(button.textContent).toBe('TS');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('dialog', { name: 'Your profile' });
    expect(menu.textContent).toContain('Test Staff');
    expect(menu.textContent).toContain('staff@example.test');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // The Dashboard's old menu had Settings; now every page's menu does, so the shortcut was not lost in the move
  it('opens Settings from the profile menu and closes the menu', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<PageHeader icon="solar:widget-bold-duotone" title="Dashboard" />} />
          <Route path="/settings" element={<p>Settings page</p>} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /open profile menu/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByText('Settings page')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // The Dashboard and Settings are not sections: they keep the app purple instead of borrowing a section's colour
  it("wears the page's section colour, or the app purple on a page that is not a section", () => {
    renderStockTop();
    expect(titleIcon('Stock')?.className).toContain(SECTION_COLORS.stock.iconBox);
    render(
      <MemoryRouter>
        <PageHeader icon="solar:settings-bold-duotone" title="Settings" />
      </MemoryRouter>
    );
    expect(titleIcon('Settings')?.className).toContain(APP_COLOR.iconBox);
  });

  it('closes the profile menu with Escape and returns the keyboard to the picture', () => {
    renderStockTop();
    const button = screen.getByRole('button', { name: /open profile menu/i });
    fireEvent.click(button);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close profile menu' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(auth.logout).not.toHaveBeenCalled();
  });
});
