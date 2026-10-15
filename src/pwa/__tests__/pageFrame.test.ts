import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = (path: string) => join(__dirname, '..', '..', '..', path);
const read = (path: string) => readFileSync(root(path), 'utf8');

/** Width and height from a PNG's header (so an icon that is not the size the manifest claims is caught) */
function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(root(path));
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('index.html', () => {
  const html = read('index.html');

  // The owner's phone showed the new Dashboard with its app bar (practice name, menu button) scrolled out of sight and a blank
  // strip at the bottom: the page was one browser toolbar taller than the screen. 100vh counts the toolbar as hidden; 100dvh
  // is the height actually visible, which is what the app (Layout, 100dvh) fills.
  it('never makes the page taller than the screen: min-height is 100dvh, with 100vh only as the fallback for old browsers', () => {
    const rule = /html,\s*body\s*\{([^}]*)\}/.exec(html)?.[1] ?? '';
    expect(rule).toMatch(/min-height:\s*100vh;[\s\S]*min-height:\s*100dvh;/);
  });

  it('colours the browser toolbar like the white app bar, the same as the manifest says', () => {
    const meta = /<meta name="theme-color" content="(#[0-9a-fA-F]{6})"/.exec(html)?.[1];
    const manifest = /theme_color:\s*'(#[0-9a-fA-F]{6})'/.exec(read('vite.config.ts'))?.[1];
    expect(meta).toBe('#ffffff');
    expect(manifest).toBe(meta);
  });

  it('links the manifest through the PWA plugin and the iPhone home-screen icon', () => {
    expect(html).toContain('rel="apple-touch-icon" href="/icons/apple-touch-icon.png"');
    expect(html).toContain('name="apple-mobile-web-app-title" content="OneHealth"');
  });
});

// Chrome, Samsung Internet and Edge only offer to install a site whose manifest has these (and the icons really exist).
describe('the app manifest (vite.config.ts)', () => {
  const config = read('vite.config.ts');

  it('has a name, a start address, standalone display and a scope', () => {
    expect(config).toMatch(/name:\s*'OneHealth'/);
    expect(config).toMatch(/short_name:\s*'OneHealth'/);
    expect(config).toMatch(/start_url:\s*'\/'/);
    expect(config).toMatch(/scope:\s*'\/'/);
    expect(config).toMatch(/display:\s*'standalone'/);
  });

  it('lists a 192 and a 512 icon and a maskable 512 icon, and each file is really that size', () => {
    expect(config).toMatch(/src:\s*'\/icons\/pwa-192x192\.png',\s*sizes:\s*'192x192'/);
    expect(config).toMatch(/src:\s*'\/icons\/pwa-512x512\.png',\s*sizes:\s*'512x512'/);
    expect(config).toMatch(/src:\s*'\/icons\/maskable-512x512\.png',\s*sizes:\s*'512x512',\s*type:\s*'image\/png',\s*purpose:\s*'maskable'/);
    expect(pngSize('public/icons/pwa-192x192.png')).toEqual({ width: 192, height: 192 });
    expect(pngSize('public/icons/pwa-512x512.png')).toEqual({ width: 512, height: 512 });
    expect(pngSize('public/icons/maskable-512x512.png')).toEqual({ width: 512, height: 512 });
    expect(pngSize('public/icons/apple-touch-icon.png')).toEqual({ width: 180, height: 180 });
  });

  it('keeps old versions of the app\'s files from piling up on a phone, and keeps the app starting offline', () => {
    expect(config).toContain('cleanupOutdatedCaches: true');
    expect(config).toContain("navigateFallback: '/index.html'");
    expect(config).toContain("registerType: 'prompt'");
  });
});
