import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mayHaveUnsavedEdits, resetTypedFieldsForTests, trackTypedFields } from '../unsavedEdits';

// An update must never reload a page over something a doctor typed (a clinical note is gone for good if it was not saved).
// There is no app-wide "unsaved" flag, so the check looks at what is on the screen.
describe('mayHaveUnsavedEdits', () => {
  let stop: () => void;

  beforeEach(() => {
    document.body.innerHTML = '';
    resetTypedFieldsForTests();
    stop = trackTypedFields();
  });
  afterEach(() => stop());

  const add = <T extends HTMLElement>(element: T): T => {
    document.body.appendChild(element);
    return element;
  };
  const textBox = (type = 'text'): HTMLInputElement => {
    const input = document.createElement('input');
    input.type = type;
    return add(input);
  };
  const typeInto = (field: HTMLInputElement | HTMLTextAreaElement, text: string) => {
    field.value = text;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  };

  it('is false on a page nobody typed on, even when forms show saved values (reading is not editing)', () => {
    const saved = textBox();
    saved.value = 'Saved practice name';
    expect(mayHaveUnsavedEdits()).toBe(false);
  });

  it('is true once someone types into a text box that is still on the screen', () => {
    typeInto(textBox(), 'Patient reports a dull ache');
    expect(mayHaveUnsavedEdits()).toBe(true);
  });

  it('counts a notes area and an editable block the same way', () => {
    const notes = add(document.createElement('textarea'));
    typeInto(notes, 'Follow up in two weeks');
    expect(mayHaveUnsavedEdits()).toBe(true);

    notes.remove();
    expect(mayHaveUnsavedEdits()).toBe(false);

    const block = add(document.createElement('div'));
    block.setAttribute('contenteditable', 'true');
    block.textContent = 'Typed in the editor';
    block.dispatchEvent(new Event('input', { bubbles: true }));
    expect(mayHaveUnsavedEdits()).toBe(true);
  });

  it('is false again when the typed text is cleared', () => {
    const box = textBox();
    typeInto(box, 'abc');
    typeInto(box, '');
    expect(mayHaveUnsavedEdits()).toBe(false);
  });

  it('ignores a search box and a password: losing those costs nothing, and asking every time would be a nuisance', () => {
    typeInto(textBox('search'), 'Tester');
    typeInto(textBox('password'), 'secret');
    expect(mayHaveUnsavedEdits()).toBe(false);
  });

  it('is false when the screen with the typed text is gone (the work was saved, or left)', () => {
    const box = textBox();
    typeInto(box, 'draft');
    box.remove();
    expect(mayHaveUnsavedEdits()).toBe(false);
  });

  it('is true while a full-screen window (a visit being written up) is open, even with nothing typed in a box', () => {
    const visit = add(document.createElement('div'));
    visit.setAttribute('data-fullscreen-modal', 'true');
    expect(mayHaveUnsavedEdits()).toBe(true);
    visit.remove();
    expect(mayHaveUnsavedEdits()).toBe(false);
  });

  it('ignores typing inside the update notice itself', () => {
    const notice = add(document.createElement('div'));
    notice.setAttribute('data-app-notice', '');
    const inside = document.createElement('input');
    notice.appendChild(inside);
    typeInto(inside, 'x');
    expect(mayHaveUnsavedEdits()).toBe(false);
  });
});
