import React from 'react';
import { Icon } from '@iconify/react';
import { DIARY_SETTINGS_NOT_ENABLED_MESSAGE } from '../../../services/diarySettingsService';

/** What the database or the form refused, in plain words */
export const SettingsErrors: React.FC<{ errors: string[] }> = ({ errors }) =>
  errors.length === 0 ? null : (
    <ul role="alert" className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {errors.map((message) => (
        <li key={message} className="flex items-start gap-2">
          <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          <span className="min-w-0 break-words">{message}</span>
        </li>
      ))}
    </ul>
  );

/** Why the user can read but not change a setting */
export const ReadOnlyNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
    <Icon icon="solar:info-circle-bold-duotone" className="mt-0.5 h-4 w-4 flex-none text-gray-400" aria-hidden="true" />
    <span>{children}</span>
  </p>
);

/** Before the database update that a setting needs: say so in plain words, never a raw database error */
export const SettingsNotEnabled: React.FC<{ message?: string }> = ({ message = DIARY_SETTINGS_NOT_ENABLED_MESSAGE }) => (
  <div className="rounded-xl bg-gray-50 px-4 py-6 text-center">
    <Icon icon="solar:settings-bold-duotone" className="mx-auto mb-2 h-8 w-8 text-indigo-400" aria-hidden="true" />
    <p className="mx-auto max-w-sm text-sm text-gray-600">{message} Until then the diary works as before.</p>
  </div>
);
