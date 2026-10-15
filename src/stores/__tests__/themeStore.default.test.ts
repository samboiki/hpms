/**
 * Owner decision 14 Oct 2026: the main colour of OneHealth is the black one (Monochrome, the dark charcoal sidebar), not the
 * orange Sunset. A browser with nothing remembered, "reset" and a practice with no theme of its own all start there. A practice
 * that saved a theme in Settings (practices.theme_id) still sees that one: the database wins at sign-in, even over a browser that
 * remembered Sunset as the old default. And every theme stays selectable, so no practice loses a colour it can choose.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  single: vi.fn(),
  update: vi.fn(),
  updateSelect: vi.fn()
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: db.single }) }),
      update: (values: unknown) => {
        db.update(values);
        return { eq: () => ({ select: db.updateSelect }) };
      }
    })
  }
}));

const STORAGE_KEY = 'hpms-theme-storage';
const MONOCHROME_SIDEBAR = 'from-[#4a5568] to-[#2d3748]';
const SUNSET_SIDEBAR = 'from-[#f46b45] to-[#eea849]';

/** A visit to the app: a fresh copy of the store, optionally on top of the theme the browser remembered from an earlier visit */
async function openStore(rememberedThemeId?: string) {
  localStorage.clear();
  vi.resetModules();
  if (rememberedThemeId) {
    const { useThemeStore: earlier } = await import('../themeStore');
    const themes = earlier.getState().themes;
    const currentTheme = themes.find((theme) => theme.id === rememberedThemeId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { currentTheme, themes }, version: 0 }));
    vi.resetModules();
  }
  return (await import('../themeStore')).useThemeStore;
}

const sidebarVariable = () => document.documentElement.style.getPropertyValue('--theme-sidebar-gradient');

beforeEach(() => {
  db.single.mockReset();
  db.update.mockReset();
  db.updateSelect.mockReset();
  document.documentElement.removeAttribute('style');
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the starting colour theme', () => {
  it('a browser with nothing remembered starts on Monochrome, the black theme the owner chose as the main colour', async () => {
    const store = await openStore();
    expect(store.getState().currentTheme.id).toBe('monochrome');
    expect(store.getState().currentTheme.gradients.sidebar).toBe(MONOCHROME_SIDEBAR);
  });

  it('"reset" goes back to the black theme, not to the orange one it used to be', async () => {
    const store = await openStore();
    await store.getState().setTheme('ocean');
    expect(store.getState().currentTheme.id).toBe('ocean');
    store.getState().resetToDefaults();
    expect(store.getState().currentTheme.id).toBe('monochrome');
  });

  it('every theme stays selectable in Settings, in the same order: only the starting colour changed', async () => {
    const store = await openStore();
    expect(store.getState().themes.map((theme) => theme.id)).toEqual([
      'sunset', 'ocean', 'forest', 'purple', 'cosmic', 'monochrome', 'sapphire', 'emerald', 'rose-gold', 'midnight'
    ]);
  });
});

describe('a practice\'s saved theme still wins', () => {
  it('a practice that chose Sunset keeps its orange: the database is read at sign-in, the starting colour is not forced', async () => {
    const store = await openStore();
    db.single.mockResolvedValue({ data: { theme_id: 'sunset' }, error: null });
    await store.getState().loadThemeFromDatabase('practice-1');
    expect(store.getState().currentTheme.id).toBe('sunset');
    expect(sidebarVariable()).toBe(SUNSET_SIDEBAR);
  });

  it('a browser that remembered Sunset as its old default shows the black theme after sign-in when the practice is on Monochrome', async () => {
    const store = await openStore('sunset');
    db.single.mockResolvedValue({ data: { theme_id: 'monochrome' }, error: null });
    await store.getState().loadThemeFromDatabase('practice-1');
    expect(store.getState().currentTheme.id).toBe('monochrome');
    expect(sidebarVariable()).toBe(MONOCHROME_SIDEBAR);
  });

  it('a practice with no theme saved keeps the black starting colour: nothing falls back to orange', async () => {
    const store = await openStore();
    db.single.mockResolvedValue({ data: { theme_id: null }, error: null });
    await store.getState().loadThemeFromDatabase('practice-1');
    expect(store.getState().currentTheme.id).toBe('monochrome');
  });

  it('choosing another theme in Settings saves that choice for the practice, so the default never overrules it', async () => {
    const store = await openStore();
    db.updateSelect.mockResolvedValue({ data: [{ id: 'practice-1' }], error: null });
    await expect(store.getState().setTheme('sunset', 'practice-1')).resolves.toBe(true);
    expect(db.update).toHaveBeenCalledWith({ theme_id: 'sunset' });
    expect(store.getState().currentTheme.id).toBe('sunset');
  });
});
