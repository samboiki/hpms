import { useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { cn } from '../../utils/cn';

export interface PageTab<K extends string> {
  key: K;
  label: string;
  /** Solar bold-duotone icon name */
  icon: string;
}

interface PageTabsProps<K extends string> {
  tabs: readonly PageTab<K>[];
  active: K;
  onChange: (key: K) => void;
  /** Accessible name of the tab list, e.g. "Finance sections" */
  label: string;
  /** Classes for the selected tab in the page's accent, e.g. "bg-gradient-to-r from-cyan-500 to-cyan-600" */
  activeClassName: string;
  className?: string;
}

/**
 * Main tab bar of a page (Finance, Settings, Encounters, Patients...). Tabs share the width when they fit;
 * otherwise each keeps its natural width and the bar scrolls sideways, so a label is never cut off on a
 * tablet or phone. The selected tab is scrolled into view, e.g. when a link opens a later tab.
 */
export function PageTabs<K extends string>({ tabs, active, onChange, label, activeClassName, className }: PageTabsProps<K>) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    const tab = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !tab) return;
    const outOfView = tab.offsetLeft < list.scrollLeft || tab.offsetLeft + tab.offsetWidth > list.scrollLeft + list.clientWidth;
    if (outOfView) list.scrollLeft = tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2;
  }, [active]);

  return (
    <div className={cn('bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden', className)}>
      <div ref={listRef} role="tablist" aria-label={label} className="relative flex overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.key)}
              className={cn(
                'flex flex-1 shrink-0 flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 whitespace-nowrap px-3 lg:px-4 py-2.5 sm:py-3 min-h-[56px]',
                'text-xs sm:text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-500',
                isActive ? cn('text-white shadow-lg', activeClassName) : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              )}
            >
              <Icon icon={tab.icon} className="w-5 h-5 flex-none" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
