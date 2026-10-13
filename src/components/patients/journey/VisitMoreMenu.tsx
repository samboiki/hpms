import React, { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { SECONDARY } from '../../stock/stockUi';
import type { VisitMenuAction } from './visitJourney';

interface VisitMoreMenuProps {
  items: VisitMenuAction[];
  onSelect: (item: VisitMenuAction) => void;
  /** Names the visit for screen readers, e.g. "More actions for visit #18" */
  label: string;
  /** id of the "More" button, so the card can move focus to it */
  buttonId?: string;
}

/**
 * "More" on a journey card: the visit's less-used actions, one tap away. Keyboard: Enter, Space or
 * Arrow Down opens it on the first item; arrows, Home and End move; Escape closes it; Tab leaves it.
 */
export const VisitMoreMenu: React.FC<VisitMoreMenuProps> = ({ items, onSelect, label, buttonId }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const closeOnOutside = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('touchstart', closeOnOutside);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('touchstart', closeOnOutside);
    };
  }, [open]);

  const closeAndReturnFocus = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onItemKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = items.length - 1;
    const focusItem = (next: number) => {
      event.preventDefault();
      itemRefs.current[next]?.focus();
    };
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAndReturnFocus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    } else if (event.key === 'ArrowDown') {
      focusItem(index === last ? 0 : index + 1);
    } else if (event.key === 'ArrowUp') {
      focusItem(index === 0 ? last : index - 1);
    } else if (event.key === 'Home') {
      focusItem(0);
    } else if (event.key === 'End') {
      focusItem(last);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title="More actions"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={SECONDARY}
      >
        <Icon icon="solar:menu-dots-bold-duotone" className="h-4 w-4 text-gray-500" aria-hidden="true" />
        <span className="hidden sm:inline" aria-hidden="true">More</span>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onKeyDown={(event) => onItemKeyDown(event, index)}
              onClick={() => {
                closeAndReturnFocus();
                onSelect(item);
              }}
              className="flex min-h-[44px] w-full items-center gap-2.5 px-3 text-left text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:bg-cyan-50 focus-visible:text-cyan-800 sm:min-h-[40px]"
            >
              <Icon icon={item.icon} className="h-4 w-4 flex-none text-gray-500" aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default VisitMoreMenu;
