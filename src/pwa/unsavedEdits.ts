/**
 * Whether reloading this page now could throw away work someone has not saved. The app has no single "unsaved changes"
 * flag (each screen guards its own, and the visit screen is a full-screen window), so this looks at what is on the page:
 * a full-screen window is open, or the person typed into a text box that is still on screen. A false alarm only means the
 * update asks first; a reload is never done over typed work without the person's say (owner, 15 Oct 2026).
 */
const NOT_TEXT = new Set(['search', 'password', 'checkbox', 'radio', 'range', 'file', 'color', 'button', 'submit', 'reset', 'image', 'hidden']);

const typedInto = new Set<HTMLElement>();

function editedField(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  if (target instanceof HTMLTextAreaElement) return target;
  if (target instanceof HTMLInputElement) return NOT_TEXT.has(target.type) ? null : target;
  // The editing host (jsdom does not know isContentEditable, so the attribute is read too)
  return target.closest<HTMLElement>('[contenteditable="true"]') ?? (target.isContentEditable ? target : null);
}

const holdsText = (field: HTMLElement): boolean =>
  field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement ? field.value.trim() !== '' : (field.textContent ?? '').trim() !== '';

/** Starts noting which text boxes people type into; call once at start-up */
export function trackTypedFields(doc: Document = document): () => void {
  const onInput = (event: Event) => {
    const field = editedField(event.target);
    if (field) typedInto.add(field);
  };
  doc.addEventListener('input', onInput, true);
  return () => doc.removeEventListener('input', onInput, true);
}

export function mayHaveUnsavedEdits(doc: Document = document): boolean {
  if (doc.querySelector('[data-fullscreen-modal="true"]')) return true;
  for (const field of typedInto) {
    if (!field.isConnected) typedInto.delete(field); // its screen is gone: the work was saved or left
    else if (holdsText(field) && !field.closest('[data-app-notice]')) return true;
  }
  return false;
}

/** Tests only */
export function resetTypedFieldsForTests(): void {
  typedInto.clear();
}
