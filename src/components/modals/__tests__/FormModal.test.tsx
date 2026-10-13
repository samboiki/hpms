/**
 * FormModal holds most of the app's forms (Add patient, Edit patient, Send message, Select branch, ...). Keyboard users
 * close it with Escape as with its X; the patient file under an Edit patient form stays open (before, Escape closed the
 * whole file and the typed edits with it), and Escape used by a list inside the form (a town list) closes only the list.
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('framer-motion', () => {
  const Plain = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    const { initial, animate, exit, transition, whileHover, whileTap, layout, ...rest } = props;
    void initial; void animate; void exit; void transition; void whileHover; void whileTap; void layout;
    return <div {...(rest as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>;
  };
  return { motion: new Proxy({}, { get: () => Plain }), AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

import FormModal from '../FormModal';
import { escapeClosesADialog } from '../../../hooks/useEscapeToClose';

describe('FormModal and Escape', () => {
  it('closes with Escape, as with its X', () => {
    const onClose = vi.fn();
    render(<FormModal isOpen onClose={onClose} title="Edit patient"><input aria-label="First name" /></FormModal>);
    act(() => { fireEvent.keyDown(screen.getByLabelText('First name'), { key: 'Escape' }); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('tells the patient file underneath that the form takes the key while it is open', () => {
    const { rerender } = render(<FormModal isOpen onClose={vi.fn()} title="Edit patient"><p>Form</p></FormModal>);
    expect(escapeClosesADialog()).toBe(true);
    rerender(<FormModal isOpen={false} onClose={vi.fn()} title="Edit patient"><p>Form</p></FormModal>);
    expect(escapeClosesADialog()).toBe(false);
  });

  it('stays open when a list inside it used Escape to close itself', () => {
    const onClose = vi.fn();
    render(
      <FormModal isOpen onClose={onClose} title="Add patient">
        <input aria-label="Town" onKeyDown={(event) => { if (event.key === 'Escape') event.preventDefault(); }} />
      </FormModal>
    );
    act(() => { fireEvent.keyDown(screen.getByLabelText('Town'), { key: 'Escape' }); });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does nothing while closed', () => {
    const onClose = vi.fn();
    render(<FormModal isOpen={false} onClose={onClose} title="Add patient"><p>Form</p></FormModal>);
    act(() => { fireEvent.keyDown(document.body, { key: 'Escape' }); });
    expect(onClose).not.toHaveBeenCalled();
  });
});
