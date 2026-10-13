import React, { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@iconify/react';

export interface MoreMenuItem {
  label: string;
  /** Solar bold-duotone icon */
  icon: string;
  onSelect: () => void;
}

/**
 * "More": the things a page needs now and then (a report, settings, the duplicate finder), one tap away instead of
 * crowding the page. Keyboard: arrows move, Escape closes and returns focus to the button. Used by the diary header
 * (DiaryMoreMenu) and the Patients page.
 */
export const MoreMenu: React.FC<{ items: MoreMenuItem[]; menuLabel: string }> = ({ items, menuLabel }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const close = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const onMenuKey = (event: React.KeyboardEvent, index: number) => {
    if (event.key === 'Escape') {
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = (index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
      itemRefs.current[next]?.focus();
    }
  };

  return (
    <div ref={containerRef} className="relative flex-none">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        aria-label="More"
        title={`More: ${items.map((item) => item.label.toLowerCase()).join(', ')}`}
        className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
      >
        <Icon icon="solar:menu-dots-bold-duotone" className="h-4 w-4 text-gray-500" aria-hidden="true" />
        <span className="hidden md:inline" aria-hidden="true">More</span>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={menuLabel}
          className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              role="menuitem"
              onKeyDown={(event) => onMenuKey(event, index)}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-purple-50 focus-visible:bg-purple-50 focus-visible:outline-none"
            >
              <Icon icon={item.icon} className="h-4 w-4 flex-none text-purple-600" aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MoreMenu;
