import React from 'react';
import { Icon } from '@iconify/react';
import { APP_COLOR, SECTION_COLORS, type SectionKey } from '../../config/sectionColors';
import { ProfileMenu } from './ProfileMenu';

/**
 * The frame of a page: full width (no max-width, so a page lines up with every other), the same gutters and
 * spacing as Settings, Finance and Encounters. The page's content goes inside: header, tab bar, tab panel.
 */
export const PageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-gray-50">
    <div className="space-y-4 px-4 py-4 md:space-y-6 md:px-6 md:py-6 xl:px-8">{children}</div>
  </div>
);

interface PageHeaderProps {
  /** Whose colour the page wears (src/config/sectionColors.ts); the Dashboard and Settings, not sections, leave it out
   *  and wear the app purple */
  section?: SectionKey;
  /** Solar bold-duotone icon, as in the sidebar */
  icon: string;
  title: string;
  subtitle?: React.ReactNode;
  /** Page-wide controls or status (period, refresh, a badge): beside the title on a laptop, under it on a phone */
  actions?: React.ReactNode;
}

/**
 * The top of every page: the section's icon in its colour, the title (the page's only h1) and a line saying what
 * the page is for; on the right the page's controls and the signed-in user's picture with Sign out.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ section, icon, title, subtitle, actions }) => (
  <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1 md:py-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
    <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-3">
      {/* A fixed size, so the box does not shrink to a dot while the icon loads */}
      <div className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl shadow-lg md:h-14 md:w-14 ${(section ? SECTION_COLORS[section] : APP_COLOR).iconBox}`}>
        <Icon icon={icon} className="h-6 w-6 text-white md:h-8 md:w-8" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-gray-800 md:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
    </div>
    {actions && (
      <div className="col-span-2 row-start-2 flex flex-wrap items-center gap-3 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:justify-end">
        {actions}
      </div>
    )}
    <div className="col-start-2 row-start-1 lg:col-start-3">
      <ProfileMenu section={section} />
    </div>
  </header>
);
