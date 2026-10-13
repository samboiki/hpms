import { useEffect, useRef } from 'react';

/**
 * Escape closes an open dialog, as its X does, for people who use the keyboard. Dialogs open over each other (a
 * confirmation over a form, "Complete the file" over "Add patient"): only the one on top closes. Something inside a
 * dialog that uses Escape itself (a town list, a date picker, an ICD-10 list) marks the key as handled
 * (event.preventDefault()), and then no dialog closes.
 */
type Closer = { current: () => void };

const openDialogs: Closer[] = [];

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  const top = openDialogs[openDialogs.length - 1];
  if (!top) return;
  event.preventDefault();
  top.current();
};

/** True while such a dialog is open: a page that also uses Escape (the patient file closes with it) leaves the key to it */
export const escapeClosesADialog = (): boolean => openDialogs.length > 0;

export function useEscapeToClose(open: boolean, onClose: () => void): void {
  const closer = useRef(onClose);
  useEffect(() => {
    closer.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const entry: Closer = closer;
    openDialogs.push(entry);
    // Listening on window lets the page's own handlers (on the document and below) see the key first
    if (openDialogs.length === 1) window.addEventListener('keydown', onKeyDown);
    return () => {
      const index = openDialogs.lastIndexOf(entry);
      if (index >= 0) openDialogs.splice(index, 1);
      if (openDialogs.length === 0) window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);
}
