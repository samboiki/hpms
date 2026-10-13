import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import FullScreenModal from '../FullScreenModal';

describe('FullScreenModal and the Escape key', () => {
  it('closes an ordinary full-screen window on Escape', () => {
    const onClose = vi.fn();
    render(<FullScreenModal isOpen onClose={onClose}><p>Message</p></FullScreenModal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps a visit open on Escape, so pressing it to close a list or pop-up never throws away the typed visit', () => {
    const onClose = vi.fn();
    render(<FullScreenModal isOpen onClose={onClose} closeOnEscape={false}><p>Visit</p></FullScreenModal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
