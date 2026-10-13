/**
 * Keyboard users close dialogs with Escape. Dialogs open over each other (a confirmation over a form): Escape must close
 * only the one on top, never the form underneath with typed work in it, and nothing when a list inside the dialog used
 * the key to close itself.
 */
import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useEscapeToClose } from '../useEscapeToClose';

const Dialog: React.FC<{ name: string; children?: React.ReactNode }> = ({ name, children }) => {
  const [open, setOpen] = useState(true);
  useEscapeToClose(open, () => setOpen(false));
  return open ? <div role="dialog" aria-label={name}>{children}</div> : null;
};

const TwoDialogs: React.FC = () => {
  const [second, setSecond] = useState(false);
  return (
    <>
      <Dialog name="Form">
        <button type="button" onClick={() => setSecond(true)}>Open the confirmation</button>
      </Dialog>
      {second && <Dialog name="Confirmation" />}
    </>
  );
};

const escape = (target: EventTarget = document.body) => fireEvent.keyDown(target, { key: 'Escape' });

describe('useEscapeToClose', () => {
  it('closes the open dialog', () => {
    render(<Dialog name="Form" />);
    act(() => { escape(); });
    expect(screen.queryByRole('dialog', { name: 'Form' })).not.toBeInTheDocument();
  });

  it('closes only the dialog on top, then the one underneath', () => {
    render(<TwoDialogs />);
    fireEvent.click(screen.getByRole('button', { name: 'Open the confirmation' }));
    act(() => { escape(); });
    expect(screen.queryByRole('dialog', { name: 'Confirmation' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Form' })).toBeInTheDocument();
    act(() => { escape(); });
    expect(screen.queryByRole('dialog', { name: 'Form' })).not.toBeInTheDocument();
  });

  it('leaves the dialog open when something inside used Escape (a town list closing)', () => {
    render(
      <Dialog name="Form">
        <input aria-label="Town" onKeyDown={(event) => { if (event.key === 'Escape') event.preventDefault(); }} />
      </Dialog>
    );
    act(() => { escape(screen.getByLabelText('Town')); });
    expect(screen.getByRole('dialog', { name: 'Form' })).toBeInTheDocument();
  });

  it('ignores other keys', () => {
    render(<Dialog name="Form" />);
    act(() => { fireEvent.keyDown(document.body, { key: 'Enter' }); });
    expect(screen.getByRole('dialog', { name: 'Form' })).toBeInTheDocument();
  });
});
