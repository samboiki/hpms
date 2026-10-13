import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Patient and staff records live in the private bucket "records" and are opened through short-lived links
// (recordFiles.ts, proposals/2026-10-08-records-bucket.sql). A public link to a record can be downloaded by anyone
// who gets hold of it, forever. These checks read the app's source so that a new screen cannot quietly go back to
// the public bucket.

const SRC = join(process.cwd(), 'src');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
const rel = (file: string) => relative(SRC, file).replace(/\\/g, '/');
const sources = walk(SRC)
  .filter(file => /\.(ts|tsx)$/.test(file) && !/__tests__|\.test\.|\/test\//.test(file.replace(/\\/g, '/')))
  .map(file => ({ path: rel(file), text: readFileSync(file, 'utf8') }));

// The 11 unused screens that still put records in the public bucket were deleted on 2026-10-08, so every source
// file is checked
const inUse = sources;

// The only files meant to be public: the practice logo, staff avatars and signatures, which printouts and practice
// websites show. Settings: logo, own avatar, own signature; EditUserModal: a colleague's avatar.
const PUBLIC_ON_PURPOSE: Record<string, number> = {
  'pages/Settings.tsx': 3,
  'components/settings/UserManagement/EditUserModal.tsx': 1
};

const count = (text: string, pattern: RegExp) => (text.match(pattern) || []).length;

describe('records never get a public link', () => {
  it('makes public links only for logos, avatars and signatures', () => {
    const found = Object.fromEntries(
      inUse
        .map((source): [string, number] => [source.path, count(source.text, /\.getPublicUrl\(/g)])
        .filter(([, n]) => n > 0)
    );
    expect(found).toEqual(PUBLIC_ON_PURPOSE);
  });

  it('uploads to the public bucket only the logo, avatars and signatures', () => {
    for (const source of inUse) {
      // Each public upload names its folder: practice-logos/, avatars/ or signatures/
      const publicBucketCalls = count(source.text, /\.from\(\s*['"](documents|media)['"]\s*\)/g);
      const expected = (PUBLIC_ON_PURPOSE[source.path] ?? 0) * 2;
      expect({ file: source.path, publicBucketCalls }).toEqual({ file: source.path, publicBucketCalls: expected });
    }
  });
});
