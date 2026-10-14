import { describe, expect, it, vi } from 'vitest';

const loads = vi.hoisted(() => ({ settings: 0 }));
vi.mock('../pages/Settings', () => {
  loads.settings += 1;
  return { default: () => null };
});

import { PAGE_LOADERS, prefetchPage } from '../pageLoaders';

describe('prefetchPage (sidebar links download their page before the click)', () => {
  it('downloads the page a link leads to, so Settings opens without a spinner after hovering its link', async () => {
    prefetchPage('/settings/');
    prefetchPage('/settings');
    // The hovering alone downloads it. The click waits for that: vitest cannot answer two imports of one mocked page at
    // the same instant and would load the real Settings page with everything it imports (5 s on a quiet machine, over
    // 30 s in a full run), which is not what this checks
    await vi.waitFor(() => expect(loads.settings).toBe(1), { timeout: 20000 });
    await PAGE_LOADERS['/settings']();
    // The module is evaluated once however often the pointer passes over the link, and the click does not fetch it again
    expect(loads.settings).toBe(1);
  }, 30000);

  it('ignores addresses that are not lazily loaded pages (the Dashboard, outside links)', () => {
    expect(() => prefetchPage('/')).not.toThrow();
    expect(() => prefetchPage('/no-such-page')).not.toThrow();
  });

  it('covers every page the sidebar opens, so no page is left to download on click', () => {
    expect(Object.keys(PAGE_LOADERS)).toEqual(expect.arrayContaining(['/patients', '/encounters', '/communications', '/finance', '/stock', '/settings']));
  });
});
