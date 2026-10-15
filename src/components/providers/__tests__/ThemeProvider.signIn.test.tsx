/**
 * Owner decision 14 Oct 2026: black (Monochrome) is the main colour. Browsers that signed in before the change remembered Sunset as
 * their theme; when staff sign in, the practice's saved theme must replace it on screen, with no reload and no click in Settings.
 * This runs the real provider and store: only the practice and the database read are replaced.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  single: vi.fn(),
  practice: { practiceId: 'practice-1' as string | null, isLoading: false }
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: mocks.single }) }) }) }
}));
vi.mock('../../../contexts/PracticeContext', () => ({ usePractice: () => mocks.practice }));

const STORAGE_KEY = 'hpms-theme-storage';

/** The app opened in a browser that remembered Sunset from an earlier visit */
async function openAppRememberingSunset() {
  localStorage.clear();
  vi.resetModules();
  const { useThemeStore: earlier } = await import('../../../stores/themeStore');
  const themes = earlier.getState().themes;
  const currentTheme = themes.find((theme) => theme.id === 'sunset');
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { currentTheme, themes }, version: 0 }));
  vi.resetModules();
  const { useThemeStore } = await import('../../../stores/themeStore');
  const { ThemeProvider } = await import('../ThemeProvider');
  return { useThemeStore, ThemeProvider };
}

const sidebarVariable = () => document.documentElement.style.getPropertyValue('--theme-sidebar-gradient');

beforeEach(() => {
  mocks.single.mockReset();
  mocks.practice = { practiceId: 'practice-1', isLoading: false };
  document.documentElement.removeAttribute('style');
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the theme at sign-in', () => {
  it('a browser that remembered Sunset shows Monochrome once the practice is known and is on Monochrome', async () => {
    const { useThemeStore, ThemeProvider } = await openAppRememberingSunset();
    expect(useThemeStore.getState().currentTheme.id).toBe('sunset');
    mocks.single.mockResolvedValue({ data: { theme_id: 'monochrome' }, error: null });

    render(<ThemeProvider><div /></ThemeProvider>);

    await waitFor(() => expect(useThemeStore.getState().currentTheme.id).toBe('monochrome'));
    await waitFor(() => expect(sidebarVariable()).toBe('from-[#4a5568] to-[#2d3748]'));
  });

  it('nothing is asked of the database before the practice is known', async () => {
    mocks.practice = { practiceId: null, isLoading: true };
    const { ThemeProvider } = await openAppRememberingSunset();

    render(<ThemeProvider><div /></ThemeProvider>);

    expect(mocks.single).not.toHaveBeenCalled();
  });
});
