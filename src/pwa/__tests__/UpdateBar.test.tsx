import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UpdateBar from '../UpdateBar';
import { requestUpdate, resetAppUpdateForTests, setUpdateApplier, updateWaiting } from '../appUpdate';
import { mayHaveUnsavedEdits } from '../unsavedEdits';

vi.mock('../unsavedEdits', () => ({ mayHaveUnsavedEdits: vi.fn(() => false) }));
const hasEdits = vi.mocked(mayHaveUnsavedEdits);

// The owner opened the app on his phone and saw an old-looking screen with no way to tell a newer one exists. The bar is how
// every open copy (browser tab, home-screen app, a link opened inside WhatsApp) learns that a release is waiting.
describe('UpdateBar', () => {
  let apply: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetAppUpdateForTests();
    hasEdits.mockReturnValue(false);
    apply = vi.fn().mockResolvedValue(undefined);
    setUpdateApplier(apply, () => undefined);
  });

  const showBar = async () => {
    render(<UpdateBar />);
    act(() => updateWaiting());
    return screen.findByText('A new version of OneHealth is ready.');
  };

  it('shows nothing while the app is up to date', () => {
    render(<UpdateBar />);
    expect(screen.queryByText(/new version/i)).toBeNull();
    expect(document.querySelector('[data-update-layer]')).toBeNull();
  });

  it('says a new version is ready, with Update and Later, in a status region (announced, not a dialog that takes over the screen)', async () => {
    await showBar();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Later' })).toBeInTheDocument();
  });

  it('Update asks the waiting version to take over and says it is updating', async () => {
    await showBar();
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(await screen.findByText('Updating OneHealth...')).toBeInTheDocument();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
  });

  it('asks before reloading over typed work, and "Not yet" puts the choice back', async () => {
    hasEdits.mockReturnValue(true);
    await showBar();
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(await screen.findByText(/changes that are not saved yet/i)).toBeInTheDocument();
    expect(apply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Not yet' }));
    expect(await screen.findByText('A new version of OneHealth is ready.')).toBeInTheDocument();

    act(() => requestUpdate());
    fireEvent.click(await screen.findByRole('button', { name: 'Update anyway' }));
    await vi.waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
  });

  it('Later hides the bar without losing the new version', async () => {
    await showBar();
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByText('A new version of OneHealth is ready.')).toBeNull();
  });

  it('goes in the browser\'s top layer, so no window (a full-screen visit screen added later) can cover it', async () => {
    const showPopover = vi.fn();
    const hidePopover = vi.fn();
    Object.assign(HTMLElement.prototype, { showPopover, hidePopover });
    try {
      await showBar();
      expect(showPopover).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('status')).toHaveAttribute('popover', 'manual');

      fireEvent.click(screen.getByRole('button', { name: 'Later' }));
      expect(hidePopover).toHaveBeenCalled();
    } finally {
      delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
      delete (HTMLElement.prototype as Partial<HTMLElement>).hidePopover;
    }
  });

  it('without a top layer it still sits at the highest z-index', async () => {
    await showBar();
    expect(screen.getByRole('status').className).toContain('z-[2147483647]');
  });

  // The toast layer (components/ui/ToastLayer.tsx, mounted in the signed-in app) keeps itself last in <body> by watching <body>.
  // A second layer doing the same moves after it, and it after that, for ever: the page froze when the bar showed.
  it('does not watch <body> to stay last, which would fight the toast layer for ever', () => {
    render(<UpdateBar />);
    const observers = vi.spyOn(globalThis, 'MutationObserver'); // (no findBy here: testing-library's own waiting uses one)
    try {
      act(() => updateWaiting());
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(observers).not.toHaveBeenCalled();
    } finally {
      observers.mockRestore();
    }
  });

  it('is removed from the page when it goes away', async () => {
    await showBar();
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
