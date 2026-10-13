import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import toast from 'react-hot-toast';
import { TOAST_LAYER_Z_INDEX, ToastLayer, keepLast } from '../ToastLayer';

const layerOf = () => document.querySelector<HTMLElement>('[data-toast-layer]');
const nextMutations = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));

describe('ToastLayer', () => {
  it('stays above a full-screen visit screen opened later, so "Payment received" and errors are seen', async () => {
    const { unmount } = render(<ToastLayer />);
    // A full-screen window adds its own layer to the end of <body> when it opens
    const fullScreen = document.createElement('div');
    fullScreen.style.zIndex = String(TOAST_LAYER_Z_INDEX);
    document.body.appendChild(fullScreen);
    await nextMutations();

    expect(document.body.lastElementChild).toBe(layerOf());
    unmount();
    fullScreen.remove();
  });

  it('has no size, so it never takes a click meant for the page under it', () => {
    const { unmount } = render(<ToastLayer />);
    const layer = layerOf()!;
    expect(layer.style.width).toBe('0px');
    expect(layer.style.height).toBe('0px');
    expect(layer.style.zIndex).toBe(String(TOAST_LAYER_Z_INDEX));
    unmount();
    expect(layerOf()).toBeNull();
  });

  it('shows the toast inside the layer', async () => {
    // react-hot-toast asks for the reduced-motion setting, which jsdom does not have
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    const { unmount } = render(<ToastLayer />);
    act(() => {
      toast.success('Payment received');
    });
    expect(await screen.findByText('Payment received')).toBeTruthy();
    expect(layerOf()!.textContent).toContain('Payment received');
    act(() => toast.remove());
    unmount();
    vi.unstubAllGlobals();
  });

  it('does not move a layer that is already last, so its own move cannot loop', () => {
    const parent = document.createElement('div');
    const node = document.createElement('span');
    parent.appendChild(node);
    let moves = 0;
    const observer = new MutationObserver(records => {
      moves += records.length;
    });
    observer.observe(parent, { childList: true });
    keepLast(parent, node);
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
    expect(moves).toBe(0);
  });
});
