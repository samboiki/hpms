/**
 * Owner decision 13 Oct 2026: staff without their own photo show their initials, never a stock photo of a stranger.
 * Older versions saved stock photo addresses into users.avatar, so those count as "no photo".
 */
import { describe, expect, it } from 'vitest';
import { initialsOf, personalAvatar } from '../avatarUtils';

describe('personalAvatar', () => {
  it('a stock photo saved by an older version is not the person: initials show instead', () => {
    expect(personalAvatar('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200')).toBeNull();
  });

  it("keeps the person's own uploaded photo and the preview of a photo being uploaded", () => {
    const uploaded = 'https://example.supabase.co/storage/v1/object/public/documents/avatars/u1.png';
    expect(personalAvatar(uploaded)).toBe(uploaded);
    expect(personalAvatar('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
  });

  it('nothing or a broken value means no photo', () => {
    expect(personalAvatar(null)).toBeNull();
    expect(personalAvatar('  ')).toBeNull();
    expect(personalAvatar('not a picture')).toBeNull();
  });
});

describe('initialsOf', () => {
  it('two initials from the name, "?" without one', () => {
    expect(initialsOf('Tuyeni Nangolo Amutenya')).toBe('TN');
    expect(initialsOf('')).toBe('?');
  });
});
