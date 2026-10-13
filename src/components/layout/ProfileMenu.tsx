import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../stores/authStore';
import { APP_COLOR, SECTION_COLORS, type SectionKey } from '../../config/sectionColors';
import { initialsOf, personalAvatar } from '../../utils/avatarUtils';

/** The user's photo, or their initials when there is none (never a stock photo standing in for them) */
export const UserAvatar: React.FC<{ avatar?: string | null; name: string }> = ({ avatar, name }) => {
  const [failed, setFailed] = useState(false);
  const photo = personalAvatar(avatar);
  if (photo && !failed) {
    return <img src={photo} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />;
  }
  const initials = initialsOf(name);
  return (
    <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-600 font-semibold text-white" aria-hidden="true">
      {initials}
    </span>
  );
};

/**
 * The signed-in user's picture at the top right of a page: it opens their name, role, Settings and Sign out. Every
 * page shows it at every width (below the lg breakpoint the app bar has only the menu), so staff can always see who
 * is signed in and sign out. A page that is not a section (Dashboard, Settings) leaves `section` out: app purple.
 */
export const ProfileMenu: React.FC<{ section?: SectionKey }> = ({ section }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  // Where the menu opens: under the picture, kept on screen on a phone
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const color = section ? SECTION_COLORS[section] : APP_COLOR;
  const open = position !== null;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPosition(null);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!user) return null;
  const toggle = () => {
    const anchor = buttonRef.current?.getBoundingClientRect();
    setPosition(open ? null : { top: anchor ? anchor.bottom + 12 : 80, right: anchor ? Math.max(window.innerWidth - anchor.right, 16) : 16 });
  };
  const close = () => {
    setPosition(null);
    buttonRef.current?.focus();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Open profile menu (${user.name})`}
        className="group relative block flex-none rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
      >
        <span className={`absolute inset-0 rounded-full bg-gradient-to-br ${color.from} ${color.to} opacity-30 blur-lg transition-opacity group-hover:opacity-50`} aria-hidden="true" />
        <span className={`absolute -inset-1 rounded-full bg-gradient-to-br ${color.from} ${color.to} opacity-50`} aria-hidden="true" />
        <span className="relative block h-12 w-12 overflow-hidden rounded-full border-4 border-white shadow-xl transition-transform group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100 md:h-16 md:w-16">
          <UserAvatar avatar={user.avatar} name={user.name} />
        </span>
      </button>

      {position && createPortal(
        <>
          <div className="fixed inset-0 z-[99998] bg-black/20 backdrop-blur-sm" onClick={close} aria-hidden="true" />
          <div
            role="dialog"
            aria-labelledby={titleId}
            style={{ position: 'fixed', top: position.top, right: position.right, zIndex: 99999 }}
            className="w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 id={titleId} className="text-xl font-bold text-gray-900">Your profile</h2>
              <button ref={closeRef} type="button" onClick={close} className="rounded-full p-2 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400" aria-label="Close profile menu">
                <Icon icon="solar:close-circle-bold-duotone" className="h-5 w-5 text-gray-500" aria-hidden="true" />
              </button>
            </div>
            <div className="mb-5 flex items-start gap-3 rounded-xl bg-gray-50 p-4">
              <span className="block h-14 w-14 flex-none overflow-hidden rounded-full border-2 border-white shadow">
                <UserAvatar avatar={user.avatar} name={user.name} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-gray-900">{user.name}</p>
                <p className="break-words text-sm text-gray-500">{user.email}</p>
                <span className="mt-1 inline-flex rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium capitalize text-gray-700">{user.role}</span>
              </div>
            </div>
            {/* The Dashboard's own profile menu had it: the user's account (photo, password) is Settings' first tab */}
            <button
              type="button"
              onClick={() => {
                setPosition(null);
                navigate('/settings');
              }}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
            >
              <Icon icon="solar:settings-bold-duotone" className="h-5 w-5" aria-hidden="true" />
              Settings
            </button>
            <button
              type="button"
              onClick={() => {
                setPosition(null);
                void logout();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-4 py-3 font-medium text-white shadow-lg transition-shadow hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            >
              <Icon icon="solar:logout-3-bold-duotone" className="h-5 w-5" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  );
};
