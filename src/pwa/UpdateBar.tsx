import React, { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { APP_COLOR } from '../config/sectionColors';
import { confirmUpdate, keepWorking, requestUpdate, snoozeUpdate, useUpdatePhase } from './appUpdate';

const MESSAGE = {
  ready: 'A new version of OneHealth is ready.',
  confirm: 'You may have changes that are not saved yet. Update anyway?',
  updating: 'Updating OneHealth...'
} as const;

/**
 * "A new version of OneHealth is ready" with Update. It shows on every screen (sign-in included) and on a phone it is a
 * plain bar at the top, not a pop-up over the page. Update reloads once the new version has taken over; if something is
 * typed or a full-screen window is open it asks first (appUpdate.ts).
 */
const UpdateBar: React.FC = () => {
  const phase = useUpdatePhase();
  const visible = phase === 'ready' || phase === 'confirm' || phase === 'updating';
  const bar = useRef<HTMLDivElement>(null);

  // Above every window, the full-screen visit screens included (a bar that only shows over some screens would leave the app on
  // an old copy for as long as that screen is open). The browser's top layer (Popover API) does that whatever the windows' z-index
  // or when they were added to the page. The toasts keep their layer last in <body> by watching it, so this must not do the same:
  // two layers moving each other to the end never stop and the page freezes. A browser without a top layer gets the highest z-index.
  useLayoutEffect(() => {
    const element = bar.current;
    if (!visible || !element || typeof element.showPopover !== 'function') return;
    element.setAttribute('popover', 'manual');
    try {
      element.showPopover();
    } catch {
      // already showing
    }
    return () => {
      try {
        element.hidePopover();
      } catch {
        // already gone
      }
    };
  }, [visible]);

  if (!visible) return null;

  const asking = phase === 'confirm';
  return createPortal(
    <div
      ref={bar}
      role="status"
      aria-live="polite"
      data-app-notice
      className="pointer-events-none fixed inset-x-0 top-0 bottom-auto z-[2147483647] m-0 flex h-auto max-h-none w-auto justify-center overflow-visible border-0 bg-transparent p-0 px-3"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div className="pointer-events-auto flex w-full max-w-md flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl">
        <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gradient-to-br ${APP_COLOR.from} ${APP_COLOR.to} text-white shadow-sm`}>
          <Icon icon="solar:refresh-circle-bold-duotone" className={`h-6 w-6 ${phase === 'updating' ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
        </span>
        <p className="min-w-0 flex-[1_1_12rem] text-sm font-medium leading-snug text-gray-900">{MESSAGE[phase]}</p>
        {phase !== 'updating' && (
          <div className="ml-auto flex flex-none items-center gap-1">
            <button
              type="button"
              onClick={asking ? confirmUpdate : requestUpdate}
              className={`min-h-[2.5rem] rounded-xl bg-gradient-to-r px-3 text-sm font-semibold text-white shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 ${APP_COLOR.from} ${APP_COLOR.to}`}
            >
              {asking ? 'Update anyway' : 'Update'}
            </button>
            <button
              type="button"
              onClick={asking ? keepWorking : () => snoozeUpdate()}
              className="min-h-[2.5rem] rounded-xl px-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
            >
              {asking ? 'Not yet' : 'Later'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default UpdateBar;
