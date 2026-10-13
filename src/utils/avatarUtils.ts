/**
 * Staff pictures. A person without their own uploaded photo shows their initials (UserAvatar in
 * src/components/layout/ProfileMenu.tsx), never a stock photo of a stranger (owner, 13 Oct 2026).
 *
 * Older versions picked a stock photo from images.unsplash.com for anyone without a photo and saved that address
 * into users.avatar. Such an address is not the person's picture, so it is treated as "no photo".
 */
const STOCK_PHOTO_HOSTS = ['images.unsplash.com'];

/** The person's own photo address, or null when there is none (empty, or a stock photo saved by older versions) */
export function personalAvatar(url?: string | null): string | null {
  const value = url?.trim();
  if (!value) return null;
  try {
    const host = new URL(value).hostname.toLowerCase();
    if (STOCK_PHOTO_HOSTS.includes(host)) return null;
  } catch {
    // Not an absolute address (for example an uploaded file's data URL preview is fine; a broken value shows initials)
    if (!value.startsWith('data:')) return null;
  }
  return value;
}

/** Up to two initials from a name ("Anna Maria Shikongo" -> "AM"); "?" when there is no name */
export function initialsOf(name?: string | null): string {
  return (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || '?';
}
