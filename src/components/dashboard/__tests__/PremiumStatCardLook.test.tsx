/**
 * The four Dashboard cards must look the same on a phone, a tablet, a laptop and a TV. The owner (15 October 2026) likes
 * the phone: a plain light card with the small coloured lines, dots and bars, but no colour wash. On desktops the cards
 * were tinted purple, orange, blue and green because two global rules for narrow screens (index.css and
 * styles/mobile-performance.css) changed a card on phones only: they hide an absolute inset-0 bg-gradient-to-br layer
 * (the tint), swap .shadow-lg for a lighter shadow, and pad every element whose class contains "p-6" (top-6 made a tiny
 * dot a 1rem one). A card that leans on those rules would split phone and desktop again, so these tests keep it off them.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

// Iconify would try to download icon data over the network
vi.mock('@iconify/react', () => ({ Icon: () => null }));

import PremiumStatCard from '../PremiumStatCard';

const TYPES = ['patients', 'communication', 'encounters', 'finance'] as const;

const renderCard = (cardType: (typeof TYPES)[number]) =>
  render(<PremiumStatCard title="Card" mainValue="1" subtitle="" gradient="" stats={[]} cardType={cardType} onClick={() => undefined} />).container;

describe('PremiumStatCard looks the same at every width', () => {
  it.each(TYPES)('%s has no colour tint over the card, which only desktops used to show', (cardType) => {
    const fullCardLayers = [...renderCard(cardType).querySelectorAll('.absolute.inset-0')];
    // What is left over the whole card is neutral glass (grey, white or clear): none of it starts from the card's colour
    expect(fullCardLayers.filter((layer) => /\bfrom-(?!transparent|white|gray)/.test(layer.className))).toEqual([]);
  });

  it.each(TYPES)('%s has no class that the phones-only padding rule catches (top-6 is one)', (cardType) => {
    const tokens = [...renderCard(cardType).querySelectorAll('*')].flatMap((element) => [...element.classList]);
    // [class*="p-6"] pads any element whose class contains it, on phones only
    expect(tokens.filter((token) => token.includes('p-6'))).toEqual([]);
  });

  it.each(TYPES)('%s writes its resting shadow out, because .shadow-lg is swapped for a lighter one on phones only', (cardType) => {
    const tokens = [...renderCard(cardType).querySelectorAll('*')].flatMap((element) => [...element.classList]);
    expect(tokens).not.toContain('shadow-lg');
    expect(tokens.some((token) => token.startsWith('[box-shadow:'))).toBe(true);
  });

  it.each(TYPES)("%s keeps the phone's small coloured lines, dots, divider and bottom accent", (cardType) => {
    const container = renderCard(cardType);
    // The card's own colour, as worn by its icon tile
    const colour = [...(container.querySelector('.bg-gradient-to-br.shadow-md')?.classList ?? [])].find((name) => name.startsWith('from-'));
    expect(colour).toBeTruthy();
    const wearsColour = (selector: string) => !!container.querySelector(selector)?.classList.contains(colour as string);
    expect(wearsColour('.absolute.top-2.right-3')).toBe(true); // the two lines in the top right corner
    expect(wearsColour('.absolute.top-4.right-5')).toBe(true);
    expect(wearsColour('.absolute.top-3.right-1')).toBe(true); // and the dot beside them
    expect(wearsColour('.absolute.top-1\\/2.left-0')).toBe(true); // the faint divider across the middle
    expect(wearsColour('.absolute.bottom-0.left-0.right-0.h-1')).toBe(true); // the accent along the bottom edge
    // The soft dot beside the title is 1rem wide in every width: sized outright, not by a padding rule
    expect(container.querySelector('.absolute.left-8.w-4.h-4.rounded-full')).not.toBeNull();
  });
});
