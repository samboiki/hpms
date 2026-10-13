import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIcd10Search } from '../../hooks/useIcd10Search';
import { icd10OptionNote, type Icd10Option, type Icd10Position } from '../../utils/billing/icd10Master';

interface Icd10SearchInputProps {
  /** The text in the box: a code, or words being searched for */
  value: string;
  onChange: (text: string) => void;
  /** A code chosen from the list */
  onPick: (option: Icd10Option) => void;
  onBlur?: () => void;
  /** Keys the search does not use, such as Enter with no option highlighted */
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Where the chosen code goes, for the notes on options: first on a claim line ('main') or after it */
  position?: Icd10Position;
  /** Codes offered first (the line's suggested codes); the practice's usual codes follow */
  suggestedCodes?: readonly string[];
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  ariaLabel?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
}

interface Placement {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

const LIST_WIDTH = 448;
const GUTTER = 16;
const LIST_HEIGHT = 288;
// Above every sheet and full-screen dialog (the highest use z-index 2147483647; the list is added to the page later)
const LIST_LAYER = 2147483647;

/** Under the box, or above it when there is more room there; inside the screen with a 16 px gutter. */
function placementFor(anchor: DOMRect): Placement {
  const width = Math.min(LIST_WIDTH, window.innerWidth - 2 * GUTTER);
  const left = Math.max(GUTTER, Math.min(anchor.left, window.innerWidth - width - GUTTER));
  const below = window.innerHeight - anchor.bottom - GUTTER;
  const above = anchor.top - GUTTER;
  if (below < 160 && above > below) return { left, width, bottom: window.innerHeight - anchor.top + 4, maxHeight: Math.min(LIST_HEIGHT, above) };
  return { left, width, top: anchor.bottom + 4, maxHeight: Math.min(LIST_HEIGHT, Math.max(below, 120)) };
}

/**
 * The one ICD-10 code search (parity E14): type a code ("j069", "J06") or words ("acute sinusitis") and choose from the
 * medical aids' full list, the exact code first and the practice's usual codes before the rest. Codes that cannot be
 * used in that place are marked (a category heading, an asterisk code first, not a main diagnosis, discontinued).
 * Free typing still works, so a code can be entered before the list is set up.
 */
const Icd10SearchInput: React.FC<Icd10SearchInputProps> = ({
  value,
  onChange,
  onPick,
  onBlur,
  onKeyDown,
  position = 'main',
  suggestedCodes,
  id,
  placeholder = 'Code or words',
  disabled = false,
  autoFocus = false,
  className = '',
  ariaLabel,
  ariaInvalid,
  ariaDescribedBy
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const { options, status } = useIcd10Search(value, { enabled: open && !disabled, suggestedCodes });
  const typed = value.trim().length > 0;
  const optionsKey = options.map(option => option.code).join(' ');

  // Once something is typed the first match waits for Enter; before that nothing is chosen for the practitioner
  useEffect(() => {
    setActive(typed && optionsKey ? 0 : -1);
  }, [typed, optionsKey]);

  const place = useCallback(() => {
    const anchor = inputRef.current?.getBoundingClientRect();
    if (anchor) setPlacement(placementFor(anchor));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active, listId]);

  const pick = (option: Icd10Option) => {
    onPick(option);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) setOpen(true);
      else if (options.length > 0) {
        setActive(current =>
          event.key === 'ArrowDown' ? (current + 1) % options.length : current <= 0 ? options.length - 1 : current - 1
        );
      }
      return;
    }
    if (event.key === 'Enter' && open && options[active]) {
      event.preventDefault();
      pick(options[active]);
      return;
    }
    if (event.key === 'Escape' && open) {
      // Closes the list only, not the sheet or dialog around it
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === 'Tab') setOpen(false);
    onKeyDown?.(event);
  };

  let message: string | null = null;
  if (status === 'not-set-up') message = 'The full ICD-10 list is not set up yet: type the code.';
  else if (status === 'error') message = 'The ICD-10 list could not be searched: type the code.';
  else if (options.length === 0) {
    if (status === 'searching') message = 'Searching...';
    else if (typed && status === 'ready') message = `No ICD-10 code matches "${value.trim()}".`;
    else message = 'Type a code (J06.9) or words (acute sinusitis).';
  }
  const shown = open && !disabled ? placement : null;
  const expanded = shown !== null && options.length > 0;
  const announcement = !open ? '' : options.length > 0 ? `${options.length} code${options.length === 1 ? '' : 's'} found` : message ?? '';

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid || undefined}
        aria-describedby={ariaDescribedBy}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onFocus={() => setOpen(true)}
        onChange={event => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          setOpen(false);
          onBlur?.();
        }}
        onKeyDown={handleKeyDown}
        className={className}
      />
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
      {shown &&
        createPortal(
          <div
            className="overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-lg"
            style={{ position: 'fixed', left: shown.left, width: shown.width, top: shown.top, bottom: shown.bottom, zIndex: LIST_LAYER }}
            // Choosing with the mouse must not take the focus away from the box first
            onMouseDown={event => event.preventDefault()}
          >
            {options.length > 0 && (
              <ul id={listId} role="listbox" aria-label="Search results" className="overflow-y-auto py-1" style={{ maxHeight: shown.maxHeight }}>
                {options.map((option, index) => {
                  const note = option.entry ? icd10OptionNote(option.entry, position) : null;
                  return (
                    <li
                      key={option.code}
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={index === active}
                      onClick={() => pick(option)}
                      onMouseMove={() => setActive(index)}
                      className={`flex cursor-pointer items-start gap-2 px-3 py-2 ${index === active ? 'bg-cyan-50' : ''}`}
                    >
                      <span className="w-14 shrink-0 font-mono text-xs font-semibold text-gray-900">{option.code}</span>
                      <span className="min-w-0 flex-1">
                        {option.entry?.description && <span className="block text-xs text-gray-700">{option.entry.description}</span>}
                        {note && <span className="mt-0.5 block text-xs font-medium text-amber-700">{note}</span>}
                      </span>
                      {option.suggested && (
                        <span className="shrink-0 rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-700 ring-1 ring-cyan-100">Suggested</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {message && <p className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500 first:border-t-0">{message}</p>}
          </div>,
          document.body
        )}
    </>
  );
};

export default Icd10SearchInput;
