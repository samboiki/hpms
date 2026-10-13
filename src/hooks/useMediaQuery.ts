import { useEffect, useState } from 'react';

const matchesNow = (query: string, fallback: boolean): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : fallback;

/**
 * Whether a CSS media query matches, kept up to date as the window is resized. For a part that should exist only once
 * on a page but sits in a different place per screen size: render it where it belongs instead of rendering it twice and
 * hiding one copy with CSS (a hidden copy still loads its data). Without matchMedia (tests) the fallback applies.
 */
export function useMediaQuery(query: string, fallback = false): boolean {
  const [matches, setMatches] = useState(() => matchesNow(query, fallback));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}
